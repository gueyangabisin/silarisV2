"""
Pydantic schemas for Pengiriman endpoints.
Field names match 03_api_data_contract.md §2.3 exactly.
"""

from pydantic import BaseModel, field_validator
from typing import List, Optional, Any, Union
from datetime import datetime


class PengirimanCreate(BaseModel):
    rs_id: Union[str, int]
    daftar_epc: List[str]  # List of EPC strings

    @field_validator("rs_id", mode="before")
    @classmethod
    def coerce_rs_id_to_str(cls, v):
        return str(v) if v is not None else ""


class PengirimanCreateResponse(BaseModel):
    """Response for POST /api/pengiriman (201)."""
    temp_id: int
    kode_verifikasi: str
    status_upload: str


class EpcDetail(BaseModel):
    """Single item in daftar_epc JSON array."""
    epc: str
    nama_linen: str
    kategori: str


class PengirimanTempResponse(BaseModel):
    """Full PengirimanTemp object for antrean-bermasalah list."""
    temp_id: int
    kode_verifikasi: str
    rs_id: str
    nama_rs: Optional[str] = None  # Resolved from local RS cache
    daftar_epc: List[EpcDetail]
    status_upload: str
    timestamp: datetime


class HistoriPengirimanResponse(BaseModel):
    """Single histori row from Supabase."""
    id: Optional[Any] = None  # Cloud-side ID
    kode_verifikasi: str
    rs_id: str
    nama_rs: Optional[str] = None
    jumlah_linen: int = 0
    status_upload: str
    timestamp: Optional[datetime] = None


class HistoriDetailResponse(BaseModel):
    """Detail of a single shipment from Supabase."""
    kode_verifikasi: str
    nama_rs: Optional[str] = None
    timestamp: Optional[datetime] = None
    daftar_epc: List[EpcDetail]
