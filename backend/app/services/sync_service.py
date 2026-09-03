"""
Background sync service for cloud operations.

- Periodic sync loop: uploads pending PengirimanTemp to Supabase
- Cloud health check: pings Supabase every 10s to update cloud_online status
- Sync-down rumah_sakit: fetches cloud RS data to local SQLite cache
"""

import asyncio
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.database.session import SessionLocal
from app.database.models import PengirimanTemp, RumahSakitLocal
from app.services.supabase_client import supabase_client
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)
settings = get_settings()


class SyncService:
    """Manages background cloud synchronization tasks."""

    def __init__(self):
        self.cloud_online: bool = False
        self._sync_task: Optional[asyncio.Task] = None
        self._health_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start all background sync tasks."""
        # Initial cloud check
        self.cloud_online = await supabase_client.health_check()
        logger.info(f"Initial cloud status: {'online' if self.cloud_online else 'offline'}")

        # Sync down rumah_sakit on startup
        await self.sync_down_rumah_sakit()

        # Start background loops
        self._sync_task = asyncio.create_task(self._sync_loop())
        self._health_task = asyncio.create_task(self._health_check_loop())

    async def stop(self):
        """Stop all background sync tasks."""
        for task in [self._sync_task, self._health_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._sync_task = None
        self._health_task = None

    # ────────────────────── Cloud Health Check ──────────────────────

    async def _health_check_loop(self):
        """Periodically check Supabase connectivity and broadcast state changes."""
        while True:
            try:
                await asyncio.sleep(10)  # Check every 10 seconds
                was_online = self.cloud_online
                self.cloud_online = await supabase_client.health_check()

                if was_online != self.cloud_online:
                    status = "online" if self.cloud_online else "offline"
                    logger.info(f"Cloud status changed to: {status}")
                    # Import here to get current serial state
                    from app.services.serial_service import serial_service
                    await ws_manager.broadcast_connection_state(
                        serial_connected=serial_service.serial_connected,
                        cloud_online=self.cloud_online,
                    )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(10)

    # ────────────────────── Sync Loop (Pending Uploads) ──────────────────────

    async def _sync_loop(self):
        """Periodically try to upload pending PengirimanTemp records to Supabase."""
        while True:
            try:
                await asyncio.sleep(settings.SYNC_LOOP_INTERVAL_SECONDS)

                if not self.cloud_online:
                    continue

                db = SessionLocal()
                try:
                    pending = (
                        db.query(PengirimanTemp)
                        .filter(PengirimanTemp.status_upload == "pending")
                        .all()
                    )

                    for record in pending:
                        await self._try_upload(db, record)
                finally:
                    db.close()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Sync loop error: {e}")

    async def _try_upload(self, db: Session, record: PengirimanTemp) -> bool:
        """Attempt to upload a single PengirimanTemp record to Supabase."""
        import json

        try:
            local_rs = db.query(RumahSakitLocal).filter(
                RumahSakitLocal.rs_id == record.rs_id
            ).first()

            daftar_epc = json.loads(record.daftar_epc) if record.daftar_epc else []

            upload_data = {
                "kode_verifikasi": record.kode_verifikasi,
                "rs_id": record.rs_id,
                "kode_rs": local_rs.kode_rs if local_rs else "RS-UNKNOWN",
                "total_linen": len(daftar_epc),
                "status": "DIKIRIM",
            }

            success = await supabase_client.upload_pengiriman(upload_data)

            if success:
                db.delete(record)
                db.commit()
                logger.info(
                    f"Pengiriman {record.kode_verifikasi} uploaded successfully to cloud and deleted from local pengiriman_temp"
                )
                return True
            else:
                record.percobaan_ke += 1
                if record.percobaan_ke >= settings.SYNC_MAX_RETRY_BEFORE_PERMANENT_FAIL:
                    record.status_upload = "gagal_permanen"
                    logger.warning(
                        f"Pengiriman {record.kode_verifikasi} marked gagal_permanen "
                        f"after {record.percobaan_ke} attempts"
                    )
                db.commit()
                return False

        except Exception as e:
            logger.error(
                f"Upload error for {record.kode_verifikasi}: {e}"
            )
            record.percobaan_ke += 1
            if record.percobaan_ke >= settings.SYNC_MAX_RETRY_BEFORE_PERMANENT_FAIL:
                record.status_upload = "gagal_permanen"
            db.commit()
            return False

    # ────────────────────── Sync Down Rumah Sakit ──────────────────────

    async def sync_down_rumah_sakit(self) -> bool:
        """Fetch rumah_sakit data from Supabase and upsert to local SQLite cache."""
        try:
            rows = await supabase_client.get_rumah_sakit_full()
            if rows is None:
                logger.warning("Could not sync rumah_sakit — cloud unreachable")
                return False

            db = SessionLocal()
            try:
                for row in rows:
                    existing = db.query(RumahSakitLocal).filter(
                        RumahSakitLocal.rs_id == row["rs_id"]
                    ).first()

                    if existing:
                        existing.kode_rs = row.get("kode_rs")
                        existing.nama_rs = row.get("nama_rs")
                        existing.alamat = row.get("alamat")
                        existing.kontak = row.get("kontak")
                        existing.email = row.get("email")
                    else:
                        db.add(RumahSakitLocal(
                            rs_id=row["rs_id"],
                            kode_rs=row.get("kode_rs"),
                            nama_rs=row.get("nama_rs"),
                            alamat=row.get("alamat"),
                            kontak=row.get("kontak"),
                            email=row.get("email"),
                        ))

                db.commit()
                logger.info(f"Synced {len(rows)} rumah_sakit records to local cache")
                return True
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to sync rumah_sakit: {e}")
            return False

    async def try_upload_now(self, db: Session, record: PengirimanTemp) -> bool:
        """Immediate upload attempt (called from pengiriman router)."""
        if not self.cloud_online:
            return False
        return await self._try_upload(db, record)


# Global singleton instance
sync_service = SyncService()
