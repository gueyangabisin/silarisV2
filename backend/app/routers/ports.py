"""
Serial Ports router — GET /api/ports & POST /api/ports/open
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from app.config import get_settings
from app.services.serial_service import serial_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ports", tags=["Serial Ports"])
settings = get_settings()


class OpenPortRequest(BaseModel):
    port: str


@router.get("")
def list_serial_ports() -> List[dict]:
    """
    List available serial ports filtered by ALLOWED_DRIVERS.
    Returns [{ port, description }] for the frontend's port selector dropdown.
    """
    try:
        from serial.tools.list_ports import comports

        allowed_keywords = [
            kw.strip().lower()
            for kw in settings.ALLOWED_DRIVERS.split(",")
            if kw.strip()
        ]

        result = []
        for port_info in comports():
            description = (port_info.description or "").lower()
            manufacturer = (port_info.manufacturer or "").lower()
            hwid = (port_info.hwid or "").lower()

            if not allowed_keywords or any(
                kw in description or kw in manufacturer or kw in hwid
                for kw in allowed_keywords
            ):
                result.append({
                    "port": port_info.device,
                    "description": port_info.description or port_info.device,
                })

        return result

    except ImportError:
        logger.warning("pyserial not installed — cannot list ports")
        return []
    except Exception as e:
        logger.error(f"Error listing serial ports: {e}")
        return []


@router.post("/open")
async def open_serial_port(payload: OpenPortRequest):
    """
    Manually switch or open a connection to the specified serial port.
    """
    port = payload.port.strip()
    if not port:
        raise HTTPException(status_code=400, detail="Port serial tidak boleh kosong.")

    success = await serial_service.open_port(port)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Gagal membuka port serial {port}. Periksa apakah port sedang digunakan.",
        )

    return {
        "success": True,
        "port": port,
        "message": f"Sensor berhasil terhubung di {port}",
    }
