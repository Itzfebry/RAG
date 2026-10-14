from functools import wraps
from typing import Any, Dict
import time

class ResponseCache:
    """Simple in-memory cache for RAG context and model responses."""
    def __init__(self, ttl: int = 300):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl

    def get(self, key: str) -> Any:
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry['timestamp'] < self.ttl:
                return entry['data']
            else:
                del self.cache[key]
        return None

    def set(self, key: str, data: Any):
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }

    def invalidate(self, key: str):
        if key in self.cache:
            del self.cache[key]

# Global instance for RAG search results
rag_cache = ResponseCache(ttl=600) # 10 minutes for knowledge

# Global instance for DB configurations
config_cache = ResponseCache(ttl=300) # 5 minutes for settings
