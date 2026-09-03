"""
Pengiriman router — shipment management at /api/pengiriman

Handles: create shipment, antrean bermasalah, retry, cancel, histori.
"""

import json
import math
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.database.models import Linen, PengirimanTemp, RumahSakitLocal, KategoriLinen, NamaLinen
from app.schemas.pengiriman import PengirimanCreate, PengirimanCreateResponse
from app.services.supabase_client import supabase_client
from app.services.sync_service import sync_service

router = APIRouter(prefix="/api/pengiriman", tags=["Pengiriman"])


def _generate_kode_verifikasi() -> str:
    """Generate a unique verification code in format VRF-XXXXXX."""
    chars = string.ascii_uppercase + string.digits
    random_part = "".join(random.choices(chars, k=6))
    return f"VRF-{random_part}"


@router.post("", status_code=201, response_model=PengirimanCreateResponse)
async def create_pengiriman(
    payload: PengirimanCreate, db: Session = Depends(get_db)
):
    """
    Create a new shipment.
    1. Validate all EPCs have status "tersedia"
    2. Generate kode_verifikasi
    3. Save to PengirimanTemp with status_upload "pending"
    4. Update all linen status to "dikirim"
    5. Try immediate sync to Supabase
    """
    if not payload.daftar_epc:
        raise HTTPException(status_code=400, detail="Daftar EPC tidak boleh kosong.")

    # Validate all EPCs exist and are "tersedia"
    linen_items = (
        db.query(Linen, KategoriLinen.nama, NamaLinen.nama_linen)
        .join(KategoriLinen, Linen.kategori_id == KategoriLinen.kategori_id)
        .join(NamaLinen, Linen.nama_id == NamaLinen.nama_id)
        .filter(Linen.epc.in_(payload.daftar_epc))
        .all()
    )

    found_epcs = {item[0].epc for item in linen_items}
    missing = set(payload.daftar_epc) - found_epcs
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"EPC tidak ditemukan: {', '.join(missing)}",
        )

    not_available = [
        item[0].epc for item in linen_items if item[0].status != "tersedia"
    ]
    if not_available:
        raise HTTPException(
            status_code=400,
            detail=f"EPC berikut tidak berstatus 'tersedia': {', '.join(not_available)}",
        )

    # Build daftar_epc JSON array for storage
    daftar_epc_json = [
        {
            "epc": item[0].epc,
            "nama_linen": item[2],  # NamaLinen.nama_linen
            "kategori": item[1],  # KategoriLinen.nama
        }
        for item in linen_items
    ]

    # Generate unique kode_verifikasi
    kode = _generate_kode_verifikasi()
    while db.query(PengirimanTemp).filter(
        PengirimanTemp.kode_verifikasi == kode
    ).first():
        kode = _generate_kode_verifikasi()

    # Create PengirimanTemp record
    pengiriman = PengirimanTemp(
        kode_verifikasi=kode,
        rs_id=payload.rs_id,
        daftar_epc=json.dumps(daftar_epc_json),
        status_upload="pending",
        percobaan_ke=0,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(pengiriman)

    # Update all linen status to "dikirim"
    for item in linen_items:
        item[0].status = "dikirim"

    db.commit()
    temp_id = pengiriman.temp_id
    kode_verifikasi = pengiriman.kode_verifikasi

    # Try immediate sync to Supabase (deletes record from pengiriman_temp if upload succeeds)
    uploaded = await sync_service.try_upload_now(db, pengiriman)
    status_upload = "sukses" if uploaded else pengiriman.status_upload

    return {
        "temp_id": temp_id,
        "kode_verifikasi": kode_verifikasi,
        "status_upload": status_upload,
    }


@router.get("/antrean-bermasalah")
def get_antrean_bermasalah(db: Session = Depends(get_db)):
    """List PengirimanTemp with status_upload = 'gagal_permanen'."""
    records = (
        db.query(PengirimanTemp)
        .filter(PengirimanTemp.status_upload == "gagal_permanen")
        .order_by(PengirimanTemp.timestamp.desc())
        .all()
    )

    result = []
    for rec in records:
        # Resolve nama_rs from local cache
        rs = db.query(RumahSakitLocal).filter(
            RumahSakitLocal.rs_id == rec.rs_id
        ).first()

        result.append({
            "temp_id": rec.temp_id,
            "kode_verifikasi": rec.kode_verifikasi,
            "rs_id": rec.rs_id,
            "nama_rs": rs.nama_rs if rs else None,
            "daftar_epc": json.loads(rec.daftar_epc),
            "status_upload": rec.status_upload,
            "timestamp": rec.timestamp.isoformat() if rec.timestamp else None,
        })

    return result


@router.post("/{temp_id}/coba-lagi")
async def retry_pengiriman(temp_id: int, db: Session = Depends(get_db)):
    """Retry uploading a failed pengiriman to Supabase."""
    record = db.query(PengirimanTemp).filter(
        PengirimanTemp.temp_id == temp_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Pengiriman tidak ditemukan.")

    # Reset retry counter and status
    record.status_upload = "pending"
    record.percobaan_ke = 0
    db.commit()

    # Try immediate sync
    uploaded = await sync_service.try_upload_now(db, record)
    db.refresh(record)

    return {
        "temp_id": record.temp_id,
        "kode_verifikasi": record.kode_verifikasi,
        "status_upload": record.status_upload,
    }


@router.post("/{temp_id}/batalkan")
def cancel_pengiriman(temp_id: int, db: Session = Depends(get_db)):
    """
    Cancel a pengiriman.
    Reverts all linen in daftar_epc to status "tersedia" and deletes the record.
    """
    record = db.query(PengirimanTemp).filter(
        PengirimanTemp.temp_id == temp_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Pengiriman tidak ditemukan.")

    # Parse EPC list and revert linen status
    epc_list = json.loads(record.daftar_epc)
    epc_strings = [item["epc"] for item in epc_list]

    linen_items = db.query(Linen).filter(Linen.epc.in_(epc_strings)).all()
    for linen in linen_items:
        linen.status = "tersedia"

    # Delete the PengirimanTemp record
    db.delete(record)
    db.commit()

    return {"detail": "Pengiriman berhasil dibatalkan. Status linen dikembalikan ke 'tersedia'."}


@router.get("/histori")
async def get_histori_pengiriman(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Paginated shipment history from Supabase.
    Falls back to local PengirimanTemp with status_upload = 'sukses' if offline.
    """
    start_date_str = start_date if isinstance(start_date, str) and start_date.strip() else None
    end_date_str = end_date if isinstance(end_date, str) and end_date.strip() else None
    page_num = page if isinstance(page, int) else 1
    limit_num = limit if isinstance(limit, int) else 50

    # Try Supabase first
    if sync_service.cloud_online:
        result = await supabase_client.get_histori_pengiriman(
            start_date=start_date_str,
            end_date=end_date_str,
            page=page_num,
            limit=limit_num,
        )
        if result is not None:
            # Enrich with nama_rs and jumlah_linen
            for item in result["data"]:
                if isinstance(item.get("rumah_sakit"), dict):
                    item["nama_rs"] = item["rumah_sakit"].get("nama_rs")
                    del item["rumah_sakit"]
                if "total_linen" in item and item["total_linen"] is not None:
                    item["jumlah_linen"] = item["total_linen"]
                elif isinstance(item.get("daftar_epc"), list):
                    item["jumlah_linen"] = len(item["daftar_epc"])
                elif isinstance(item.get("daftar_epc"), str):
                    try:
                        parsed = json.loads(item["daftar_epc"])
                        item["jumlah_linen"] = len(parsed)
                    except (json.JSONDecodeError, TypeError):
                        item["jumlah_linen"] = 0
                else:
                    item["jumlah_linen"] = 0

                if "created_at" in item and not item.get("timestamp"):
                    item["timestamp"] = item["created_at"]
            return result

    # Fallback: local data
    query = db.query(PengirimanTemp).filter(
        PengirimanTemp.status_upload == "sukses"
    )
    total_data = query.count()
    total_page = max(1, math.ceil(total_data / limit_num))
    offset = (page_num - 1) * limit_num
    records = query.order_by(PengirimanTemp.timestamp.desc()).offset(offset).limit(limit_num).all()

    data = []
    for rec in records:
        rs = db.query(RumahSakitLocal).filter(
            RumahSakitLocal.rs_id == rec.rs_id
        ).first()
        epc_list = json.loads(rec.daftar_epc) if rec.daftar_epc else []
        data.append({
            "temp_id": rec.temp_id,
            "kode_verifikasi": rec.kode_verifikasi,
            "rs_id": rec.rs_id,
            "nama_rs": rs.nama_rs if rs else None,
            "jumlah_linen": len(epc_list),
            "status_upload": rec.status_upload,
            "timestamp": rec.timestamp.isoformat() if rec.timestamp else None,
        })

    return {
        "data": data,
        "total_data": total_data,
        "total_page": total_page,
        "current_page": page,
    }


@router.get("/histori/{pengiriman_id}")
async def get_histori_detail(
    pengiriman_id: str, db: Session = Depends(get_db)
):
    """Detail of a single shipment — list of linen items."""
    # Try Supabase first
    if sync_service.cloud_online:
        detail = await supabase_client.get_pengiriman_detail(pengiriman_id)
        if detail is not None:
            nama_rs = None
            if isinstance(detail.get("rumah_sakit"), dict):
                nama_rs = detail["rumah_sakit"].get("nama_rs")

            daftar_epc = detail.get("daftar_epc", [])
            if isinstance(daftar_epc, str):
                try:
                    daftar_epc = json.loads(daftar_epc)
                except (json.JSONDecodeError, TypeError):
                    daftar_epc = []

            return {
                "kode_verifikasi": detail.get("kode_verifikasi"),
                "nama_rs": nama_rs,
                "timestamp": detail.get("timestamp"),
                "daftar_epc": daftar_epc,
            }

    # Fallback: try local PengirimanTemp by temp_id
    try:
        temp_id = int(pengiriman_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Pengiriman tidak ditemukan.")

    record = db.query(PengirimanTemp).filter(
        PengirimanTemp.temp_id == temp_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Pengiriman tidak ditemukan.")

    rs = db.query(RumahSakitLocal).filter(
        RumahSakitLocal.rs_id == record.rs_id
    ).first()

    return {
        "kode_verifikasi": record.kode_verifikasi,
        "nama_rs": rs.nama_rs if rs else None,
        "timestamp": record.timestamp.isoformat() if record.timestamp else None,
        "daftar_epc": json.loads(record.daftar_epc) if record.daftar_epc else [],
    }
