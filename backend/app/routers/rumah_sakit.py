"""
Rumah Sakit router — CRUD at /api/rumah-sakit

All operations go DIRECTLY to Supabase. On success, also sync-down to
local SQLite cache. Password is hashed before storage and NEVER returned.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import bcrypt
import httpx

from app.database.session import get_db
from app.database.models import RumahSakitLocal
from app.schemas.rumah_sakit import RumahSakitCreate, RumahSakitUpdate, RumahSakitResponse
from app.services.supabase_client import supabase_client
from app.services.sync_service import sync_service

router = APIRouter(prefix="/api/rumah-sakit", tags=["Rumah Sakit"])


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.get("", response_model=List[RumahSakitResponse])
async def list_rumah_sakit(db: Session = Depends(get_db)):
    """
    List all rumah sakit from Supabase (no password field).
    Falls back to local cache if cloud is offline.
    """
    # Try Supabase first
    if sync_service.cloud_online:
        data = await supabase_client.get_rumah_sakit()
        if data is not None:
            return data

    # Fallback: local cache
    rows = db.query(RumahSakitLocal).order_by(RumahSakitLocal.nama_rs).all()
    return [
        {
            "rs_id": r.rs_id,
            "kode_rs": r.kode_rs,
            "nama_rs": r.nama_rs,
            "alamat": r.alamat,
            "kontak": r.kontak,
            "email": r.email,
        }
        for r in rows
    ]


@router.post("", response_model=RumahSakitResponse, status_code=201)
async def create_rumah_sakit(
    payload: RumahSakitCreate, db: Session = Depends(get_db)
):
    """Create a new rumah sakit in Supabase. Password is hashed."""
    if not sync_service.cloud_online:
        raise HTTPException(
            status_code=503,
            detail="Cloud database tidak dapat dijangkau. Silakan coba lagi nanti.",
        )

    rs_id = str(uuid.uuid4())
    data = {
        "rs_id": rs_id,
        "kode_rs": payload.kode_rs,
        "nama_rs": payload.nama_rs,
        "alamat": payload.alamat,
        "kontak": payload.kontak,
        "email": payload.email,
        "password": _hash_password(payload.password),
    }

    try:
        result = await supabase_client.create_rumah_sakit(data)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(
                status_code=409,
                detail="Kode RS sudah terdaftar.",
            )
        raise HTTPException(
            status_code=502,
            detail="Gagal menyimpan data ke cloud.",
        )

    # Sync to local cache
    local_rs = RumahSakitLocal(
        rs_id=rs_id,
        kode_rs=payload.kode_rs,
        nama_rs=payload.nama_rs,
        alamat=payload.alamat,
        kontak=payload.kontak,
        email=payload.email,
    )
    db.add(local_rs)
    db.commit()

    return {
        "rs_id": rs_id,
        "kode_rs": payload.kode_rs,
        "nama_rs": payload.nama_rs,
        "alamat": payload.alamat,
        "kontak": payload.kontak,
        "email": payload.email,
    }


@router.put("/{rs_id}", response_model=RumahSakitResponse)
async def update_rumah_sakit(
    rs_id: str, payload: RumahSakitUpdate, db: Session = Depends(get_db)
):
    """Update a rumah sakit in Supabase. Empty password = don't change."""
    if not sync_service.cloud_online:
        raise HTTPException(
            status_code=503,
            detail="Cloud database tidak dapat dijangkau. Silakan coba lagi nanti.",
        )

    update_data = {}
    if payload.kode_rs is not None:
        update_data["kode_rs"] = payload.kode_rs
    if payload.nama_rs is not None:
        update_data["nama_rs"] = payload.nama_rs
    if payload.alamat is not None:
        update_data["alamat"] = payload.alamat
    if payload.kontak is not None:
        update_data["kontak"] = payload.kontak
    if payload.email is not None:
        update_data["email"] = payload.email
    if payload.password and payload.password.strip():
        update_data["password"] = _hash_password(payload.password)

    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah.")

    try:
        await supabase_client.update_rumah_sakit(rs_id, update_data)
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=502,
            detail="Gagal memperbarui data di cloud.",
        )

    # Sync to local cache
    local_rs = db.query(RumahSakitLocal).filter(
        RumahSakitLocal.rs_id == rs_id
    ).first()
    if local_rs:
        for key, value in update_data.items():
            if key != "password" and hasattr(local_rs, key):
                setattr(local_rs, key, value)
        db.commit()

    # Return fresh data
    rs = db.query(RumahSakitLocal).filter(RumahSakitLocal.rs_id == rs_id).first()
    if not rs:
        raise HTTPException(status_code=404, detail="Rumah Sakit tidak ditemukan.")

    return {
        "rs_id": rs.rs_id,
        "kode_rs": rs.kode_rs,
        "nama_rs": rs.nama_rs,
        "alamat": rs.alamat,
        "kontak": rs.kontak,
        "email": rs.email,
    }


@router.delete("/{rs_id}")
async def delete_rumah_sakit(rs_id: str, db: Session = Depends(get_db)):
    """Delete a rumah sakit. 409 if it has related pengiriman records."""
    if not sync_service.cloud_online:
        raise HTTPException(
            status_code=503,
            detail="Cloud database tidak dapat dijangkau. Silakan coba lagi nanti.",
        )

    # Check for related pengiriman in cloud
    has_pengiriman = await supabase_client.check_rs_has_pengiriman(rs_id)
    if has_pengiriman:
        raise HTTPException(
            status_code=409,
            detail="Rumah Sakit ini masih memiliki riwayat pengiriman terkait.",
        )

    try:
        await supabase_client.delete_rumah_sakit(rs_id)
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=502,
            detail="Gagal menghapus data dari cloud.",
        )

    # Remove from local cache
    local_rs = db.query(RumahSakitLocal).filter(
        RumahSakitLocal.rs_id == rs_id
    ).first()
    if local_rs:
        db.delete(local_rs)
        db.commit()

    return {"detail": "Rumah Sakit berhasil dihapus."}
