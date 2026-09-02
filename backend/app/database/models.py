"""
SQLAlchemy ORM models for the local SQLite database.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()


class KategoriLinen(Base):
    __tablename__ = "kategori_linen"

    kategori_id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String, nullable=False)
    keterangan = Column(Text, nullable=True)

    # Relationships
    nama_linen_list = relationship("NamaLinen", back_populates="kategori", passive_deletes=True)
    linen_list = relationship("Linen", back_populates="kategori", passive_deletes=True)


class NamaLinen(Base):
    __tablename__ = "nama_linen"

    nama_id = Column(Integer, primary_key=True, autoincrement=True)
    kategori_id = Column(Integer, ForeignKey("kategori_linen.kategori_id"), nullable=False)
    nama_linen = Column(String, nullable=False)
    keterangan = Column(Text, nullable=True)

    # Relationships
    kategori = relationship("KategoriLinen", back_populates="nama_linen_list")
    linen_list = relationship("Linen", back_populates="nama", passive_deletes=True)


class Linen(Base):
    __tablename__ = "linen"

    linen_id = Column(Integer, primary_key=True, autoincrement=True)
    epc = Column(String, nullable=False, unique=True, index=True)
    kategori_id = Column(Integer, ForeignKey("kategori_linen.kategori_id"), nullable=False)
    nama_id = Column(Integer, ForeignKey("nama_linen.nama_id"), nullable=False)
    status = Column(
        String,
        nullable=False,
        default="tersedia",
    )
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint("status IN ('tersedia', 'dikirim')", name="ck_linen_status"),
    )

    # Relationships
    kategori = relationship("KategoriLinen", back_populates="linen_list")
    nama = relationship("NamaLinen", back_populates="linen_list")


class RumahSakitLocal(Base):
    """Local cache of cloud rumah_sakit data for offline access."""
    __tablename__ = "rumah_sakit"

    rs_id = Column(String, primary_key=True)  # UUID from cloud, stored as text
    kode_rs = Column(String, nullable=True)
    nama_rs = Column(String, nullable=True)
    alamat = Column(Text, nullable=True)
    kontak = Column(String, nullable=True)
    email = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=True)


class PengirimanTemp(Base):
    """Local buffer for shipment drafts before cloud sync."""
    __tablename__ = "pengiriman_temp"

    temp_id = Column(Integer, primary_key=True, autoincrement=True)
    kode_verifikasi = Column(String, nullable=False, unique=True)
    rs_id = Column(String, nullable=False)  # Reference to cloud rumah_sakit UUID
    daftar_epc = Column(Text, nullable=False)  # JSON array string
    status_upload = Column(
        String,
        nullable=False,
        default="pending",
    )
    percobaan_ke = Column(Integer, nullable=False, default=0)
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(
            "status_upload IN ('pending', 'sukses', 'gagal_permanen')",
            name="ck_pengiriman_status_upload",
        ),
    )
