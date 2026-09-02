"""
Pydantic schemas for Rumah Sakit endpoints.
Password is NEVER returned in any response (write-only).
"""

from pydantic import BaseModel
from typing import Optional


class RumahSakitCreate(BaseModel):
    kode_rs: str
    nama_rs: str
    alamat: Optional[str] = None
    kontak: Optional[str] = None
    email: Optional[str] = None
    password: str  # Required on creation, will be hashed before storage


class RumahSakitUpdate(BaseModel):
    kode_rs: Optional[str] = None
    nama_rs: Optional[str] = None
    alamat: Optional[str] = None
    kontak: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None  # If empty/None, don't change it


class RumahSakitResponse(BaseModel):
    """Response schema — NO password field ever."""
    rs_id: str
    kode_rs: str
    nama_rs: str
    alamat: Optional[str] = None
    kontak: Optional[str] = None
    email: Optional[str] = None

    model_config = {"from_attributes": True}
