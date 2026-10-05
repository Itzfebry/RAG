"""
In-memory cache for config tables to avoid repeated DB queries.
Invalidates on admin updates.
"""
import time
from typing import Dict, Any, Optional

class ConfigCache:
    def __init__(self, ttl_seconds: int = 60):
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._ttl = ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        if key not in self._cache:
            return None
        
        data, timestamp = self._cache[key]
        if time.time() - timestamp > self._ttl:
            del self._cache[key]
            return None
        
        return data
    
    def set(self, key: str, value: Any):
        """Set cache value with current timestamp."""
        self._cache[key] = (value, time.time())
    
    def invalidate(self, key: str):
        """Remove specific key from cache."""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear entire cache."""
        self._cache.clear()

# Global cache instance
config_cache = ConfigCache(ttl_seconds=300)  # 5 minutes TTL
