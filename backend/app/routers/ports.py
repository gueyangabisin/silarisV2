"""
Serial Ports router — GET /api/ports
"""

from fastapi import APIRouter
from typing import List
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ports", tags=["Serial Ports"])
settings = get_settings()


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

            # Check if any allowed driver keyword appears in port info
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
