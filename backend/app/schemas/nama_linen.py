"""
Pydantic schemas for Nama Linen endpoints.
"""

from pydantic import BaseModel
from typing import Optional


class NamaLinenCreate(BaseModel):
    kategori_id: int
    nama_linen: str
    keterangan: Optional[str] = None


class NamaLinenUpdate(BaseModel):
    kategori_id: Optional[int] = None
    nama_linen: Optional[str] = None
    keterangan: Optional[str] = None


class NamaLinenResponse(BaseModel):
    nama_id: int
    kategori_id: int
    nama_linen: str
    keterangan: Optional[str] = None
    jumlah_linen: int = 0  # Computed: COUNT of linen with this nama_id

    model_config = {"from_attributes": True}
