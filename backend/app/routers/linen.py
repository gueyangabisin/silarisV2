"""
Linen router — CRUD + search + pagination at /api/linen
"""

import math
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
from datetime import datetime, timezone

from app.database.session import get_db
from app.database.models import Linen, KategoriLinen, NamaLinen, PengirimanTemp, RumahSakitLocal
from app.schemas.linen import LinenCreate, LinenUpdate, LinenResponse, LinenDetailResponse

router = APIRouter(prefix="/api/linen", tags=["Linen"])


@router.get("")
def list_linen(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Paginated list of linen with search and status filter.
    Search matches epc or nama_linen. Returns PaginatedResponse wrapper.
    """
    query = (
        db.query(Linen, KategoriLinen.nama, NamaLinen.nama_linen)
        .join(KategoriLinen, Linen.kategori_id == KategoriLinen.kategori_id)
        .join(NamaLinen, Linen.nama_id == NamaLinen.nama_id)
    )

    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Linen.epc.ilike(search_term),
                NamaLinen.nama_linen.ilike(search_term),
            )
        )
    if status:
        query = query.filter(Linen.status == status)

    # Count total
    total_data = query.count()
    total_page = max(1, math.ceil(total_data / limit))

    # Paginate
    offset = (page - 1) * limit
    rows = query.order_by(Linen.timestamp.desc()).offset(offset).limit(limit).all()

    data = []
    for linen, kategori_nama, nama_linen_str in rows:
        data.append({
            "linen_id": linen.linen_id,
            "epc": linen.epc,
            "kategori_id": linen.kategori_id,
            "kategori": kategori_nama,
            "nama_id": linen.nama_id,
            "nama_linen": nama_linen_str,
            "status": linen.status,
            "timestamp": linen.timestamp.isoformat() if linen.timestamp else None,
        })

    return {
        "data": data,
        "total_data": total_data,
        "total_page": total_page,
        "current_page": page,
    }


@router.get("/{epc}", response_model=LinenDetailResponse)
def get_linen_by_epc(epc: str, db: Session = Depends(get_db)):
    """
    Detail of a single linen item by EPC.
    If status == "dikirim", also resolves nama_rs from PengirimanTemp.
    """
    result = (
        db.query(Linen, KategoriLinen.nama, NamaLinen.nama_linen)
        .join(KategoriLinen, Linen.kategori_id == KategoriLinen.kategori_id)
        .join(NamaLinen, Linen.nama_id == NamaLinen.nama_id)
        .filter(Linen.epc == epc)
        .first()
    )

    if not result:
        raise HTTPException(status_code=404, detail="Item belum terdaftar.")

    linen, kategori_nama, nama_linen_str = result

    # Resolve nama_rs if status is "dikirim"
    nama_rs = None
    if linen.status == "dikirim":
        # Find the latest PengirimanTemp containing this EPC
        pengiriman_records = (
            db.query(PengirimanTemp)
            .filter(PengirimanTemp.daftar_epc.contains(epc))
            .order_by(PengirimanTemp.timestamp.desc())
            .first()
        )
        if pengiriman_records:
            rs = db.query(RumahSakitLocal).filter(
                RumahSakitLocal.rs_id == pengiriman_records.rs_id
            ).first()
            if rs:
                nama_rs = rs.nama_rs

    return {
        "epc": linen.epc,
        "nama_linen": nama_linen_str,
        "kategori": kategori_nama,
        "status": linen.status,
        "nama_rs": nama_rs,
    }


@router.post("", status_code=201)
def create_linen(payload: LinenCreate, db: Session = Depends(get_db)):
    """Register a new linen item from scan. 409 if EPC already exists."""
    existing = db.query(Linen).filter(Linen.epc == payload.epc).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag sudah terdaftar.")

    linen = Linen(
        epc=payload.epc,
        kategori_id=payload.kategori_id,
        nama_id=payload.nama_id,
        status="tersedia",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(linen)
    db.commit()
    db.refresh(linen)

    # Return full response with joined names
    result = (
        db.query(Linen, KategoriLinen.nama, NamaLinen.nama_linen)
        .join(KategoriLinen, Linen.kategori_id == KategoriLinen.kategori_id)
        .join(NamaLinen, Linen.nama_id == NamaLinen.nama_id)
        .filter(Linen.linen_id == linen.linen_id)
        .first()
    )
    linen_obj, kategori_nama, nama_linen_str = result
    return {
        "linen_id": linen_obj.linen_id,
        "epc": linen_obj.epc,
        "kategori_id": linen_obj.kategori_id,
        "kategori": kategori_nama,
        "nama_id": linen_obj.nama_id,
        "nama_linen": nama_linen_str,
        "status": linen_obj.status,
        "timestamp": linen_obj.timestamp.isoformat() if linen_obj.timestamp else None,
    }


@router.put("/{epc}")
def update_linen(epc: str, payload: LinenUpdate, db: Session = Depends(get_db)):
    """Update a linen item's kategori_id, nama_id, or status."""
    linen = db.query(Linen).filter(Linen.epc == epc).first()
    if not linen:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan.")

    if payload.kategori_id is not None:
        linen.kategori_id = payload.kategori_id
    if payload.nama_id is not None:
        linen.nama_id = payload.nama_id
    if payload.status is not None:
        if payload.status not in ("tersedia", "dikirim"):
            raise HTTPException(
                status_code=400,
                detail="Status hanya boleh 'tersedia' atau 'dikirim'.",
            )
        linen.status = payload.status

    db.commit()
    db.refresh(linen)

    result = (
        db.query(Linen, KategoriLinen.nama, NamaLinen.nama_linen)
        .join(KategoriLinen, Linen.kategori_id == KategoriLinen.kategori_id)
        .join(NamaLinen, Linen.nama_id == NamaLinen.nama_id)
        .filter(Linen.linen_id == linen.linen_id)
        .first()
    )
    linen_obj, kategori_nama, nama_linen_str = result
    return {
        "linen_id": linen_obj.linen_id,
        "epc": linen_obj.epc,
        "kategori_id": linen_obj.kategori_id,
        "kategori": kategori_nama,
        "nama_id": linen_obj.nama_id,
        "nama_linen": nama_linen_str,
        "status": linen_obj.status,
        "timestamp": linen_obj.timestamp.isoformat() if linen_obj.timestamp else None,
    }


@router.delete("/{epc}")
def delete_linen(epc: str, db: Session = Depends(get_db)):
    """Delete a linen item. 409 if status is 'dikirim'."""
    linen = db.query(Linen).filter(Linen.epc == epc).first()
    if not linen:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan.")

    if linen.status == "dikirim":
        raise HTTPException(
            status_code=409,
            detail="Item ini masih tercatat dalam riwayat pengiriman aktif.",
        )

    db.delete(linen)
    db.commit()
    return {"detail": "Item berhasil dihapus."}
