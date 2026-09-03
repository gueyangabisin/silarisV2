"""
Supabase REST API client using httpx.

Provides direct access to Supabase PostgREST endpoints with explicit
timeout control, as specified in 02_backend_foundation_antigravity.md §1.
"""

import httpx
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class SupabaseClient:
    """httpx-based client for Supabase REST API."""

    def __init__(self):
        self._base_url = f"{settings.SUPABASE_URL}/rest/v1"
        self._headers = {
            "apikey": settings.SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._sync_timeout = httpx.Timeout(
            timeout=float(settings.HTTPX_TIMEOUT_SYNC_SECONDS)
        )
        self._admin_timeout = httpx.Timeout(
            timeout=float(settings.HTTPX_TIMEOUT_ADMIN_SECONDS)
        )
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=self._admin_timeout,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ────────────────────── Health Check ──────────────────────

    async def health_check(self) -> bool:
        """Ping Supabase to check connectivity. Returns True if reachable."""
        try:
            client = await self._get_client()
            resp = await client.get(
                "/rumah_sakit",
                params={"select": "rs_id", "limit": "1"},
                timeout=httpx.Timeout(5.0),
            )
            return resp.status_code in (200, 206)
        except Exception as e:
            logger.debug(f"Supabase health check failed: {e}")
            return False

    # ────────────────────── Rumah Sakit ──────────────────────

    async def get_rumah_sakit(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch all rumah_sakit rows from Supabase (excluding password)."""
        try:
            client = await self._get_client()
            resp = await client.get(
                "/rumah_sakit",
                params={
                    "select": "rs_id,kode_rs,nama_rs,alamat,kontak,email",
                    "order": "nama_rs.asc",
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch rumah_sakit from Supabase: {e}")
            return None

    async def get_rumah_sakit_full(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch all rumah_sakit rows for local sync (includes all fields except password display)."""
        try:
            client = await self._get_client()
            resp = await client.get(
                "/rumah_sakit",
                params={
                    "select": "rs_id,kode_rs,nama_rs,alamat,kontak,email",
                    "order": "nama_rs.asc",
                },
                timeout=self._sync_timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Failed to sync rumah_sakit from Supabase: {e}")
            return None

    async def create_rumah_sakit(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Insert a new rumah_sakit row into Supabase."""
        try:
            client = await self._get_client()
            resp = await client.post("/rumah_sakit", json=data)
            resp.raise_for_status()
            result = resp.json()
            return result[0] if isinstance(result, list) else result
        except httpx.HTTPStatusError as e:
            logger.error(f"Supabase create rumah_sakit error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Failed to create rumah_sakit in Supabase: {e}")
            raise

    async def update_rumah_sakit(
        self, rs_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a rumah_sakit row in Supabase by rs_id."""
        try:
            client = await self._get_client()
            resp = await client.patch(
                "/rumah_sakit",
                params={"rs_id": f"eq.{rs_id}"},
                json=data,
            )
            resp.raise_for_status()
            result = resp.json()
            return result[0] if isinstance(result, list) and result else None
        except httpx.HTTPStatusError as e:
            logger.error(f"Supabase update rumah_sakit error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Failed to update rumah_sakit in Supabase: {e}")
            raise

    async def delete_rumah_sakit(self, rs_id: str) -> bool:
        """Delete a rumah_sakit row from Supabase."""
        try:
            client = await self._get_client()
            resp = await client.delete(
                "/rumah_sakit",
                params={"rs_id": f"eq.{rs_id}"},
            )
            resp.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Supabase delete rumah_sakit error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Failed to delete rumah_sakit from Supabase: {e}")
            raise

    # ────────────────────── Pengiriman (Cloud Sync) ──────────────────────

    async def upload_pengiriman(self, data: Dict[str, Any]) -> bool:
        """
        Upload a completed pengiriman to Supabase.
        Two-step: insert header (pengiriman table) then detail if needed.
        """
        try:
            client = await self._get_client()
            resp = await client.post(
                "/pengiriman",
                json=data,
                timeout=self._sync_timeout,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to upload pengiriman to Supabase: {e}")
            return False

    async def get_histori_pengiriman(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Optional[Dict[str, Any]]:
        """Fetch paginated pengiriman history from Supabase."""
        try:
            client = await self._get_client()
            params: Dict[str, str] = {
                "select": "*, rumah_sakit!rs_id(nama_rs)",
                "order": "created_at.desc",
                "offset": str((page - 1) * limit),
                "limit": str(limit),
            }
            if start_date:
                params["created_at"] = f"gte.{start_date}"
            if end_date:
                # Combine range filter if both dates present
                if start_date:
                    params["and"] = f"(created_at.gte.{start_date},created_at.lte.{end_date}T23:59:59)"
                    params.pop("created_at", None)
                else:
                    params["created_at"] = f"lte.{end_date}T23:59:59"

            # Get total count first
            count_headers = {**self._headers, "Prefer": "count=exact"}
            count_resp = await client.get(
                "/pengiriman",
                params={**params, "limit": "0", "offset": "0"},
                headers=count_headers,
            )
            total = 0
            content_range = count_resp.headers.get("content-range", "")
            if "/" in content_range:
                total_str = content_range.split("/")[-1]
                if total_str != "*":
                    total = int(total_str)

            # Get data
            resp = await client.get("/pengiriman", params=params)
            resp.raise_for_status()
            rows = resp.json()

            return {
                "data": rows,
                "total_data": total,
                "total_page": max(1, (total + limit - 1) // limit),
                "current_page": page,
            }
        except Exception as e:
            logger.error(f"Failed to fetch histori pengiriman: {e}")
            return None

    async def get_pengiriman_detail(self, pengiriman_id: str) -> Optional[Dict[str, Any]]:
        """Fetch detail of a single pengiriman from Supabase."""
        try:
            client = await self._get_client()
            resp = await client.get(
                "/pengiriman",
                params={
                    "select": "*, rumah_sakit!rs_id(nama_rs)",
                    "or": f"(pengiriman_id.eq.{pengiriman_id},kode_verifikasi.eq.{pengiriman_id})",
                },
            )
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else None
        except Exception as e:
            logger.error(f"Failed to fetch pengiriman detail: {e}")
            return None

    async def check_rs_has_pengiriman(self, rs_id: str) -> bool:
        """Check if a rumah_sakit has related pengiriman records."""
        try:
            client = await self._get_client()
            resp = await client.get(
                "/pengiriman",
                params={
                    "select": "id",
                    "rs_id": f"eq.{rs_id}",
                    "limit": "1",
                },
            )
            resp.raise_for_status()
            return len(resp.json()) > 0
        except Exception as e:
            logger.warning(f"Failed to check pengiriman for RS {rs_id}: {e}")
            return False


# Global singleton instance
supabase_client = SupabaseClient()
