"""
FastAPI Application Entry Point.

- Creates all SQLite tables on startup
- Starts background sync and health-check tasks
- Wires up serial service callbacks for WebSocket broadcast
- Mounts all routers and the WebSocket endpoint
- Configures CORS for local network access
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import engine
from app.database.models import Base
from app.services.serial_service import serial_service
from app.services.websocket_manager import ws_manager
from app.services.sync_service import sync_service
from app.services.supabase_client import supabase_client
from app.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

settings = get_settings()


# ────────────────────── Serial Callbacks ──────────────────────

async def _on_epc_detected(epc: str, rssi: str):
    """Called by serial_service when a new EPC is detected — broadcast to all WS clients."""
    await ws_manager.broadcast_epc_detected(epc, rssi)


async def _on_serial_error(message: str):
    """Called by serial_service on port-level errors — broadcast to all WS clients."""
    await ws_manager.broadcast_error(message)
    await ws_manager.broadcast_connection_state(
        serial_connected=serial_service.serial_connected,
        cloud_online=sync_service.cloud_online,
    )


# ────────────────────── Lifespan ──────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks."""
    # === STARTUP ===
    logger.info("Starting RFID Linen Pro backend...")

    # Create all SQLite tables
    Base.metadata.create_all(bind=engine)
    logger.info("SQLite database tables created/verified")

    # Wire up serial service callbacks
    serial_service.set_callbacks(
        on_epc_detected=_on_epc_detected,
        on_error=_on_serial_error,
    )

    # Set mock mode or auto-connect to real serial port
    if settings.MOCK_SERIAL:
        logger.info("Mock serial mode ENABLED — no real hardware required")
        serial_service.serial_connected = False
    else:
        logger.info("Real serial mode ENABLED — checking for connected RFID readers...")
        from app.routers.ports import list_serial_ports
        matching_ports = list_serial_ports()
        if len(matching_ports) == 1:
            single_port = matching_ports[0]["port"]
            logger.info(f"Auto-connecting to single matching serial port: {single_port}")
            await serial_service.open_port(single_port)
        elif len(matching_ports) > 1:
            logger.info(f"Found {len(matching_ports)} matching serial ports. Waiting for user selection.")
        else:
            logger.info("No matching serial ports found on startup.")

    # Start background sync service (cloud health check + pending upload loop)
    await sync_service.start()
    logger.info("Background sync service started")

    logger.info("Backend startup complete ✓")

    yield  # Application is running

    # === SHUTDOWN ===
    logger.info("Shutting down RFID Linen Pro backend...")

    # Stop scanning if active
    await serial_service.stop_inventory()
    await serial_service.close_port()

    # Stop background tasks
    await sync_service.stop()

    # Close httpx client
    await supabase_client.close()

    logger.info("Backend shutdown complete")


# ────────────────────── App Creation ──────────────────────

app = FastAPI(
    title="RFID Linen Pro API",
    description="Backend API untuk Sistem Informasi RFID Produsen Linen",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local network access (no auth system)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────── Mount Routers ──────────────────────

from app.routers import dashboard, kategori, nama_linen, linen, rumah_sakit, pengiriman, ports

app.include_router(dashboard.router)
app.include_router(kategori.router)
app.include_router(nama_linen.router)
app.include_router(linen.router)
app.include_router(rumah_sakit.router)
app.include_router(pengiriman.router)
app.include_router(ports.router)


# ────────────────────── Mount WebSocket ──────────────────────

from app.websocket import websocket_endpoint

app.websocket("/ws")(websocket_endpoint)


import os
from fastapi.staticfiles import StaticFiles

# ────────────────────── Serve Frontend ──────────────────────

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    @app.get("/", tags=["Health"])
    def root():
        """Basic health check endpoint."""
        return {
            "status": "ok",
            "app": "RFID Linen Pro API",
            "version": "1.0.0",
        }

