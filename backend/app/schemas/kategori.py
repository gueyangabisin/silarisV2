"""
Pydantic schemas for Kategori Linen endpoints.
"""

from pydantic import BaseModel
from typing import Optional


class KategoriCreate(BaseModel):
    nama: str
    keterangan: Optional[str] = None


class KategoriUpdate(BaseModel):
    nama: Optional[str] = None
    keterangan: Optional[str] = None


class KategoriResponse(BaseModel):
    kategori_id: int
    nama: str
    keterangan: Optional[str] = None
    jumlah_linen: int = 0  # Computed: COUNT of linen with this kategori_id

    model_config = {"from_attributes": True}
