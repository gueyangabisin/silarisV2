"""
Pydantic schemas for Linen endpoints.
Field names match 03_api_data_contract.md §2.1 exactly.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LinenCreate(BaseModel):
    epc: str = Field(..., min_length=1, description="24-char hex EPC tag identifier")
    kategori_id: int
    nama_id: int


class LinenUpdate(BaseModel):
    kategori_id: Optional[int] = None
    nama_id: Optional[int] = None
    status: Optional[str] = None


class LinenResponse(BaseModel):
    """Full linen object for list endpoints."""
    linen_id: int
    epc: str
    kategori_id: int
    kategori: str  # Derived: kategori_linen.nama
    nama_id: int
    nama_linen: str  # Derived: nama_linen.nama_linen
    status: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class LinenDetailResponse(BaseModel):
    """Linen detail for GET /api/linen/{epc} (Cek Info page)."""
    epc: str
    nama_linen: str
    kategori: str
    status: str
    nama_rs: Optional[str] = None  # Only present when status == "dikirim"

    model_config = {"from_attributes": True}
