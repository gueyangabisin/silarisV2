"""
WebSocket connection manager.

Maintains a pool of active WebSocket connections and provides
broadcast capabilities for RFID scan events and status changes.
"""

import asyncio
import json
import logging
from typing import Set, Any, Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections and broadcasts messages to all clients."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection and send initial state."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(
            f"WebSocket client connected. Total: {len(self.active_connections)}"
        )

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from the pool."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(
            f"WebSocket client disconnected. Total: {len(self.active_connections)}"
        )

    async def broadcast(self, message: Dict[str, Any]):
        """Send a JSON message to ALL connected clients."""
        if not self.active_connections:
            return

        payload = json.dumps(message)
        disconnected = set()

        async with self._lock:
            connections = list(self.active_connections)

        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.add(ws)

        # Clean up broken connections
        if disconnected:
            async with self._lock:
                self.active_connections -= disconnected

    async def send_personal(self, websocket: WebSocket, message: Dict[str, Any]):
        """Send a JSON message to a single client."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

    async def send_init_state(
        self,
        websocket: WebSocket,
        is_scanning_active: bool,
        serial_connected: bool,
        cloud_online: bool,
    ):
        """Send the init_state message to a newly connected client (API contract §4)."""
        await self.send_personal(
            websocket,
            {
                "type": "init_state",
                "is_scanning_active": is_scanning_active,
                "serial_connected": serial_connected,
                "cloud_online": cloud_online,
            },
        )

    async def broadcast_scan_state_changed(self, is_scanning_active: bool):
        """Broadcast scan state change to ALL clients."""
        await self.broadcast(
            {
                "type": "scan_state_changed",
                "is_scanning_active": is_scanning_active,
            }
        )

    async def broadcast_epc_detected(self, epc: str, rssi: str):
        """Broadcast a newly detected EPC to ALL clients."""
        await self.broadcast(
            {
                "type": "epc_detected",
                "epc": epc,
                "rssi": rssi,
            }
        )

    async def broadcast_error(self, message: str):
        """Broadcast an error message to ALL clients."""
        await self.broadcast(
            {
                "type": "error",
                "message": message,
            }
        )

    async def broadcast_connection_state(
        self, serial_connected: bool, cloud_online: bool
    ):
        """Broadcast updated connection state to ALL clients."""
        await self.broadcast(
            {
                "type": "connection_state",
                "serial_connected": serial_connected,
                "cloud_online": cloud_online,
            }
        )


# Global singleton instance
ws_manager = WebSocketManager()
