"""
Kategori Linen router — CRUD at /api/kategori
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database.session import get_db
from app.database.models import KategoriLinen, Linen
from app.schemas.kategori import KategoriCreate, KategoriUpdate, KategoriResponse

router = APIRouter(prefix="/api/kategori", tags=["Kategori Linen"])


def _build_kategori_response(db: Session, kategori: KategoriLinen) -> dict:
    """Build response dict with computed jumlah_linen."""
    jumlah = (
        db.query(func.count(Linen.linen_id))
        .filter(Linen.kategori_id == kategori.kategori_id)
        .scalar()
        or 0
    )
    return {
        "kategori_id": kategori.kategori_id,
        "nama": kategori.nama,
        "keterangan": kategori.keterangan,
        "jumlah_linen": jumlah,
    }


@router.get("", response_model=List[KategoriResponse])
def list_kategori(db: Session = Depends(get_db)):
    """List all kategori (no pagination — data is small). Includes jumlah_linen."""
    rows = db.query(KategoriLinen).order_by(KategoriLinen.nama).all()
    return [_build_kategori_response(db, k) for k in rows]


@router.post("", response_model=KategoriResponse, status_code=201)
def create_kategori(payload: KategoriCreate, db: Session = Depends(get_db)):
    """Create a new kategori."""
    kategori = KategoriLinen(
        nama=payload.nama,
        keterangan=payload.keterangan,
    )
    db.add(kategori)
    db.commit()
    db.refresh(kategori)
    return _build_kategori_response(db, kategori)


@router.put("/{kategori_id}", response_model=KategoriResponse)
def update_kategori(
    kategori_id: int,
    payload: KategoriUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing kategori."""
    kategori = db.query(KategoriLinen).filter(
        KategoriLinen.kategori_id == kategori_id
    ).first()
    if not kategori:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")

    if payload.nama is not None:
        kategori.nama = payload.nama
    if payload.keterangan is not None:
        kategori.keterangan = payload.keterangan

    db.commit()
    db.refresh(kategori)
    return _build_kategori_response(db, kategori)


@router.delete("/{kategori_id}")
def delete_kategori(kategori_id: int, db: Session = Depends(get_db)):
    """Delete a kategori. 409 if still in use by linen."""
    kategori = db.query(KategoriLinen).filter(
        KategoriLinen.kategori_id == kategori_id
    ).first()
    if not kategori:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")

    jumlah = (
        db.query(func.count(Linen.linen_id))
        .filter(Linen.kategori_id == kategori_id)
        .scalar()
        or 0
    )
    if jumlah > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Kategori ini masih dipakai oleh {jumlah} data Linen.",
        )

    db.delete(kategori)
    db.commit()
    return {"detail": "Kategori berhasil dihapus."}
