from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock
from typing import Any, Optional


class TTLCache:
    """Thread-safe in-memory cache with per-entry TTL and LRU eviction."""

    def __init__(self, max_size: int = 512) -> None:
        self._data: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._max_size = max_size
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < time.time():
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._data[key] = (time.time() + ttl_seconds, value)
            self._data.move_to_end(key)
            while len(self._data) > self._max_size:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


mise_cache = TTLCache(max_size=256)
geo_cache = TTLCache(max_size=1024)
