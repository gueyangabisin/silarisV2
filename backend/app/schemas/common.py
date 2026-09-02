"""
Shared response models used across multiple routers.
"""

from pydantic import BaseModel
from typing import Any, List


class PaginatedResponse(BaseModel):
    """Standard paginated list wrapper per API contract §3."""
    data: List[Any]
    total_data: int
    total_page: int
    current_page: int
