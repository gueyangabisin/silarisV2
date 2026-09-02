"""
==============================================================================
SEMENTARA & DEV-ONLY: Script Seeding Data Dummy Rumah Sakit ke SQLite Lokal
==============================================================================
Peringatan: Script ini HANYA digunakan saat development ketika Supabase cloud
belum tersedia/offline. Hapus atau jangan jalankan script ini ketika Supabase
sudah live agar data local cache tidak berkonflik dengan data asli di cloud.
==============================================================================
"""

import sys
import os
import uuid
from datetime import datetime, timezone

# Add parent directory (backend) to sys.path so app imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import SessionLocal, engine
from app.database.models import Base, RumahSakitLocal


def seed_rumah_sakit():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    dummy_rs = [
        {
            "rs_id": str(uuid.uuid4()),
            "kode_rs": "RS001",
            "nama_rs": "RS Sentra Medika",
            "alamat": "Jl. Kesehatan No.1, Malang",
            "kontak": "0341-556677",
            "email": "admin@rssentramedika.co.id",
            "timestamp": datetime.now(timezone.utc),
        },
        {
            "rs_id": str(uuid.uuid4()),
            "kode_rs": "RS002",
            "nama_rs": "RS Harapan Bunda",
            "alamat": "Jl. Merdeka No.45, Surabaya",
            "kontak": "031-7788990",
            "email": "info@harapanbunda.co.id",
            "timestamp": datetime.now(timezone.utc),
        },
        {
            "rs_id": str(uuid.uuid4()),
            "kode_rs": "RS3000",
            "nama_rs": "Rs Sehat Sentosa",
            "alamat": "-",
            "kontak": "031-7788990",
            "email": "info@sehatsentosa.co.id",
            "timestamp": datetime.now(timezone.utc),
        },
    ]

    try:
        inserted_count = 0
        updated_count = 0
        for item in dummy_rs:
            existing = (
                db.query(RumahSakitLocal)
                .filter(RumahSakitLocal.kode_rs == item["kode_rs"])
                .first()
            )
            if existing:
                existing.nama_rs = item["nama_rs"]
                existing.alamat = item["alamat"]
                existing.kontak = item["kontak"]
                existing.email = item["email"]
                updated_count += 1
            else:
                new_rs = RumahSakitLocal(**item)
                db.add(new_rs)
                inserted_count += 1

        db.commit()
        print(f"[DEV SEED] Berhasil! Added: {inserted_count}, Updated: {updated_count}")

    except Exception as e:
        db.rollback()
        print(f"[DEV SEED ERROR] Gagal melakukan seeding: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_rumah_sakit()
