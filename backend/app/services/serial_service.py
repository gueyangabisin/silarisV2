"""
RFID Serial Service — EL-UHF-RMT01 Protocol Implementation.

All protocol details are verified from official Electron EL-UHF-RMT01 documentation:
- Connection: 115200 baud, 8N1
- Frame: Header(0xBB) + Type(1) + CMD(1) + PL(2 BE) + Param(PL) + Checksum(1) + End(0x7E)
- Checksum: sum(Type..last_param_byte) & 0xFF (simple LSB-of-sum, NOT CRC)
- Start Multiple Inventory (0x27): BB 00 27 00 03 22 FF FF [chk] 7E
- Stop (0x28): BB 00 28 00 00 28 7E
- Notification: Type=0x02, CMD=0x22 (always, even during 0x27 mode)
- Inventory Fail (Type=0x01 CMD=0xFF Param=0x15): NORMAL, ignore — NOT a disconnect
"""

import asyncio
import logging
import struct
import time
import random
from typing import Optional, Set, Callable, Awaitable

logger = logging.getLogger(__name__)

# ────────────────────── Frame Constants ──────────────────────

FRAME_HEADER = 0xBB
FRAME_END = 0x7E

TYPE_COMMAND = 0x00
TYPE_RESPONSE = 0x01
TYPE_NOTIFICATION = 0x02

CMD_SINGLE_INVENTORY = 0x22
CMD_MULTIPLE_INVENTORY = 0x27
CMD_STOP = 0x28
CMD_ERROR = 0xFF

ERROR_NO_TAG = 0x15  # "Inventory Fail" — no tag in range, not an error


def _compute_checksum(data: bytes) -> int:
    """Compute frame checksum: sum of all bytes, take LSB."""
    return sum(data) & 0xFF


def _build_frame(frame_type: int, cmd: int, params: bytes = b"") -> bytes:
    """Build a complete EL-UHF-RMT01 frame."""
    pl = len(params)
    # Type + CMD + PL(2 bytes big-endian) + params
    payload = bytes([frame_type, cmd]) + struct.pack(">H", pl) + params
    checksum = _compute_checksum(payload)
    return bytes([FRAME_HEADER]) + payload + bytes([checksum, FRAME_END])


# Pre-built command frames
CMD_START_INVENTORY_FRAME = _build_frame(
    TYPE_COMMAND,
    CMD_MULTIPLE_INVENTORY,
    bytes([0x22, 0xFF, 0xFF]),  # Reserved(0x22) + CNT(0xFFFF = continuous)
)

CMD_STOP_FRAME = _build_frame(TYPE_COMMAND, CMD_STOP)
# Expected: BB 00 28 00 00 28 7E


def _parse_epc_from_notification(params: bytes) -> Optional[dict]:
    """
    Parse RSSI, PC, EPC from a notification frame's parameter bytes.

    Byte order: RSSI(1) -> PC(2) -> EPC(variable, from PC) -> Tag CRC(2)
    """
    if len(params) < 5:  # Minimum: RSSI(1) + PC(2) + at least 2 bytes EPC
        return None

    # RSSI: 1 byte, signed integer (dBm)
    rssi_raw = params[0]
    if rssi_raw > 127:
        rssi_raw -= 256  # Convert to signed

    # PC: 2 bytes — EPC length is encoded in bits 15-11 (word count)
    pc = struct.unpack(">H", params[1:3])[0]
    epc_word_count = (pc >> 11) & 0x1F
    epc_byte_length = epc_word_count * 2

    if len(params) < 3 + epc_byte_length:
        return None

    epc_bytes = params[3 : 3 + epc_byte_length]
    epc_hex = epc_bytes.hex().upper()

    # Format RSSI as hex string for WS message (matching contract: "C9")
    rssi_hex = format(params[0], "02X")

    return {"epc": epc_hex, "rssi": rssi_hex}


class SerialService:
    """
    Manages RFID reader connection and scanning via pyserial.

    Supports real hardware mode and mock mode (for development without hardware).
    """

    def __init__(self):
        self.is_scanning_active: bool = False
        self.serial_connected: bool = False
        self._current_port: Optional[str] = None
        self._serial_conn = None  # serial.Serial instance
        self._reader_task: Optional[asyncio.Task] = None
        self._mock_task: Optional[asyncio.Task] = None
        self._debounce_cache: dict = {}  # EPC -> last_seen_timestamp
        self._debounce_seconds: float = 1.5
        self._on_epc_detected: Optional[Callable] = None
        self._on_error: Optional[Callable] = None
        self._stop_event = asyncio.Event()

    def set_callbacks(
        self,
        on_epc_detected: Callable[[str, str], Awaitable[None]],
        on_error: Callable[[str], Awaitable[None]],
    ):
        """Set callback functions for EPC detection and errors."""
        self._on_epc_detected = on_epc_detected
        self._on_error = on_error

    def _is_debounced(self, epc: str) -> bool:
        """Check if this EPC was seen recently (within debounce window)."""
        now = time.time()
        last_seen = self._debounce_cache.get(epc, 0)
        if now - last_seen < self._debounce_seconds:
            return True
        self._debounce_cache[epc] = now
        return False

    def _cleanup_debounce_cache(self):
        """Remove stale entries from debounce cache."""
        now = time.time()
        stale = [
            epc
            for epc, ts in self._debounce_cache.items()
            if now - ts > self._debounce_seconds * 5
        ]
        for epc in stale:
            del self._debounce_cache[epc]

    # ────────────────────── Port Management ──────────────────────

    async def open_port(self, port: str) -> bool:
        """Open a serial port connection to the RFID reader."""
        try:
            import serial

            if self._serial_conn and self._serial_conn.is_open:
                self._serial_conn.close()

            self._serial_conn = serial.Serial(
                port=port,
                baudrate=115200,  # EL-UHF-RMT01 spec: 115200
                bytesize=serial.EIGHTBITS,  # 8 data bits
                parity=serial.PARITY_NONE,  # No parity
                stopbits=serial.STOPBITS_ONE,  # 1 stop bit
                timeout=0.1,  # Non-blocking read with short timeout
            )
            self._current_port = port
            self.serial_connected = True
            logger.info(f"Serial port {port} opened successfully (115200 8N1)")
            return True
        except Exception as e:
            self.serial_connected = False
            logger.error(f"Failed to open serial port {port}: {e}")
            if self._on_error:
                await self._on_error(f"Gagal membuka port serial: {e}")
            return False

    async def close_port(self):
        """Close the serial port connection."""
        await self.stop_inventory()
        if self._serial_conn and self._serial_conn.is_open:
            self._serial_conn.close()
        self.serial_connected = False
        self._current_port = None
        logger.info("Serial port closed")

    # ────────────────────── Inventory Control ──────────────────────

    async def start_inventory(self) -> bool:
        """Start continuous RFID scanning."""
        if self.is_scanning_active:
            return True

        self.is_scanning_active = True
        self._stop_event.clear()
        self._debounce_cache.clear()

        if self._serial_conn and self._serial_conn.is_open:
            try:
                # Send Multiple Inventory command
                self._serial_conn.write(CMD_START_INVENTORY_FRAME)
                self._serial_conn.flush()
                logger.info("Sent start inventory command (0x27)")

                # Start reader loop
                self._reader_task = asyncio.create_task(self._serial_reader_loop())
                return True
            except Exception as e:
                self.is_scanning_active = False
                self.serial_connected = False
                logger.error(f"Failed to start inventory: {e}")
                if self._on_error:
                    await self._on_error(f"Gagal memulai scan: {e}")
                return False
        else:
            # Mock mode or no port — start mock reader
            self._mock_task = asyncio.create_task(self._mock_reader_loop())
            logger.info("Started mock inventory mode")
            return True

    async def stop_inventory(self) -> bool:
        """Stop RFID scanning."""
        if not self.is_scanning_active:
            return True

        self.is_scanning_active = False
        self._stop_event.set()

        # Cancel reader tasks
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None

        if self._mock_task and not self._mock_task.done():
            self._mock_task.cancel()
            try:
                await self._mock_task
            except asyncio.CancelledError:
                pass
            self._mock_task = None

        # Send stop command to reader if connected
        if self._serial_conn and self._serial_conn.is_open:
            try:
                self._serial_conn.write(CMD_STOP_FRAME)
                self._serial_conn.flush()
                logger.info("Sent stop inventory command (0x28)")
            except Exception as e:
                logger.warning(f"Failed to send stop command: {e}")

        self._debounce_cache.clear()
        return True

    # ────────────────────── Serial Frame Reader ──────────────────────

    async def _serial_reader_loop(self):
        """
        Background loop that reads frames from the serial port.

        Runs in a thread executor to avoid blocking the event loop,
        since pyserial is synchronous.
        """
        loop = asyncio.get_event_loop()
        buffer = bytearray()

        while self.is_scanning_active and not self._stop_event.is_set():
            try:
                # Read from serial in a thread to avoid blocking
                raw = await loop.run_in_executor(None, self._read_serial_bytes)
                if not raw:
                    await asyncio.sleep(0.01)
                    continue

                buffer.extend(raw)

                # Try to extract complete frames from buffer
                while True:
                    frame, remaining = self._extract_frame(buffer)
                    buffer = bytearray(remaining)
                    if frame is None:
                        break
                    await self._process_frame(frame)

                # Periodic debounce cache cleanup
                self._cleanup_debounce_cache()

            except asyncio.CancelledError:
                break
            except Exception as e:
                # Port-level error — this IS a real disconnect
                self.serial_connected = False
                self.is_scanning_active = False
                logger.error(f"Serial reader error (port-level): {e}")
                if self._on_error:
                    await self._on_error(f"Koneksi sensor terputus: {e}")
                break

    def _read_serial_bytes(self) -> bytes:
        """Synchronous read from serial port (called via run_in_executor)."""
        try:
            if self._serial_conn and self._serial_conn.is_open:
                waiting = self._serial_conn.in_waiting
                if waiting > 0:
                    return self._serial_conn.read(waiting)
                return self._serial_conn.read(1)  # Block briefly for timeout
            return b""
        except Exception:
            raise  # Let the caller handle port-level exceptions

    def _extract_frame(self, buffer: bytearray):
        """
        Extract one complete frame from the buffer.
        Returns (frame_bytes, remaining_buffer) or (None, buffer).
        """
        # Find header
        try:
            start = buffer.index(FRAME_HEADER)
        except ValueError:
            return None, buffer

        # Need at least Header(1) + Type(1) + CMD(1) + PL(2) = 5 bytes to read PL
        if len(buffer) - start < 5:
            return None, buffer[start:]

        # Parse PL (parameter length) — 2 bytes big-endian at offset 3-4
        pl = struct.unpack(">H", buffer[start + 3 : start + 5])[0]

        # Total frame length: Header(1) + Type(1) + CMD(1) + PL(2) + params(pl) + Checksum(1) + End(1)
        frame_len = 1 + 1 + 1 + 2 + pl + 1 + 1
        if len(buffer) - start < frame_len:
            return None, buffer[start:]

        frame = bytes(buffer[start : start + frame_len])
        remaining = buffer[start + frame_len :]

        # Validate end byte
        if frame[-1] != FRAME_END:
            logger.warning(f"Frame missing end byte 0x7E, got 0x{frame[-1]:02X}")
            return None, remaining

        # Validate checksum
        # Checksum covers Type..last_param_byte (indexes 1 to -2 exclusive of checksum and end)
        payload_for_checksum = frame[1:-2]  # Type + CMD + PL + params
        expected_checksum = _compute_checksum(payload_for_checksum)
        actual_checksum = frame[-2]
        if expected_checksum != actual_checksum:
            logger.warning(
                f"Checksum mismatch: expected 0x{expected_checksum:02X}, got 0x{actual_checksum:02X}"
            )
            return None, remaining

        return frame, remaining

    async def _process_frame(self, frame: bytes):
        """Process a validated frame from the RFID reader."""
        frame_type = frame[1]
        cmd = frame[2]
        pl = struct.unpack(">H", frame[3:5])[0]
        params = frame[5 : 5 + pl] if pl > 0 else b""

        if frame_type == TYPE_NOTIFICATION and cmd == CMD_SINGLE_INVENTORY:
            # Tag detected notification (Type=0x02, CMD=0x22)
            result = _parse_epc_from_notification(params)
            if result and not self._is_debounced(result["epc"]):
                logger.debug(f"EPC detected: {result['epc']} RSSI: {result['rssi']}")
                if self._on_epc_detected:
                    await self._on_epc_detected(result["epc"], result["rssi"])

        elif frame_type == TYPE_RESPONSE and cmd == CMD_ERROR:
            # Check if it's an "Inventory Fail" (no tag in range)
            if pl > 0 and params[0] == ERROR_NO_TAG:
                # NORMAL condition — sensor alive, just no tags nearby.
                # Silently ignore. Do NOT set serial_connected=false.
                pass
            else:
                logger.warning(
                    f"Reader error response: CMD=0xFF, param=0x{params.hex() if params else 'none'}"
                )

        elif frame_type == TYPE_RESPONSE and cmd == CMD_STOP:
            # Stop command acknowledged
            logger.info("Reader acknowledged stop command")

        elif frame_type == TYPE_RESPONSE and cmd == CMD_MULTIPLE_INVENTORY:
            # Multiple inventory command acknowledged
            logger.info("Reader acknowledged start inventory command")

    # ────────────────────── Mock Mode ──────────────────────

    async def _mock_reader_loop(self):
        """Generate fake EPC detections for development without hardware."""
        logger.info("Mock serial reader started")
        mock_epcs = [
            f"300833B2DDD901400000{i:04X}" for i in range(1, 21)
        ]

        while self.is_scanning_active and not self._stop_event.is_set():
            try:
                await asyncio.sleep(random.uniform(1.5, 3.0))
                if not self.is_scanning_active:
                    break

                epc = random.choice(mock_epcs)
                rssi = format(random.randint(0xB0, 0xE0), "02X")

                if not self._is_debounced(epc):
                    logger.debug(f"Mock EPC detected: {epc} RSSI: {rssi}")
                    if self._on_epc_detected:
                        await self._on_epc_detected(epc, rssi)

                self._cleanup_debounce_cache()
            except asyncio.CancelledError:
                break

        logger.info("Mock serial reader stopped")


# Global singleton instance
serial_service = SerialService()
