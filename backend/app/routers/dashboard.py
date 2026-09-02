"""
Dashboard router — GET /api/dashboard/summary
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.database.models import Linen, PengirimanTemp

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Dashboard summary with 4 metric cards:
    - total_linen: all registered linen
    - total_tersedia: linen with status "tersedia"
    - total_dikirim: linen with status "dikirim"
    - total_antrean_bermasalah: PengirimanTemp with status_upload "gagal_permanen"
    """
    total_linen = db.query(func.count(Linen.linen_id)).scalar() or 0
    total_tersedia = (
        db.query(func.count(Linen.linen_id))
        .filter(Linen.status == "tersedia")
        .scalar()
        or 0
    )
    total_dikirim = (
        db.query(func.count(Linen.linen_id))
        .filter(Linen.status == "dikirim")
        .scalar()
        or 0
    )
    total_antrean_bermasalah = (
        db.query(func.count(PengirimanTemp.temp_id))
        .filter(PengirimanTemp.status_upload == "gagal_permanen")
        .scalar()
        or 0
    )

    return {
        "total_linen": total_linen,
        "total_tersedia": total_tersedia,
        "total_dikirim": total_dikirim,
        "total_antrean_bermasalah": total_antrean_bermasalah,
    }
