"""
WebSocket endpoint at /ws

Handles client connections, init_state broadcast, and scan control
(start_inventory / stop_inventory) per API contract §4.
"""

import json
import logging
from fastapi import WebSocket, WebSocketDisconnect

from app.services.websocket_manager import ws_manager
from app.services.serial_service import serial_service
from app.services.sync_service import sync_service

logger = logging.getLogger(__name__)


async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket handler.

    On connect: send init_state with current scanning/connection status.
    On message: handle start_inventory / stop_inventory commands.
    On disconnect: clean up.
    """
    await ws_manager.connect(websocket)

    # Send initial state to the newly connected client
    await ws_manager.send_init_state(
        websocket,
        is_scanning_active=serial_service.is_scanning_active,
        serial_connected=serial_service.serial_connected,
        cloud_online=sync_service.cloud_online,
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from WebSocket client: {raw}")
                continue

            msg_type = message.get("type")

            if msg_type == "start_inventory":
                port = message.get("port")
                # Open port if specified and not already connected
                if port and not serial_service.serial_connected:
                    await serial_service.open_port(port)

                success = await serial_service.start_inventory()
                if success:
                    # Broadcast to ALL clients (including the sender)
                    await ws_manager.broadcast_scan_state_changed(
                        is_scanning_active=True
                    )
                else:
                    await ws_manager.send_personal(
                        websocket,
                        {
                            "type": "error",
                            "message": "Gagal memulai scan. Periksa koneksi sensor.",
                        },
                    )

            elif msg_type == "stop_inventory":
                await serial_service.stop_inventory()
                # Broadcast to ALL clients
                await ws_manager.broadcast_scan_state_changed(
                    is_scanning_active=False
                )

            else:
                logger.debug(f"Unknown WebSocket message type: {msg_type}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket)
