"""Rate tracker in-memory: RPM (request/menit) & TPM (token/menit).

Data hidup di jendela geser 60 detik, tidak perlu persist:
- restart backend -> counter mulai 0 lagi (wajar untuk metrik live)
- tiap proses menghitung sendiri; backend produksi single-process (uvicorn)
"""

import threading
import time
from collections import deque

_WINDOW_SECONDS = 60


class RateTracker:
    def __init__(self) -> None:
        self._req: deque[float] = deque()
        self._tok: deque[tuple[float, int]] = deque()
        self._lock = threading.Lock()

    def record(self, *, tokens: int = 0) -> None:
        """Catat 1 request (+jumlah token bila usage diketahui)."""
        now = time.time()
        with self._lock:
            self._req.append(now)
            if tokens > 0:
                self._tok.append((now, int(tokens)))
            self._prune(now)

    def _prune(self, now: float) -> None:
        cutoff = now - _WINDOW_SECONDS
        while self._req and self._req[0] < cutoff:
            self._req.popleft()
        while self._tok and self._tok[0][0] < cutoff:
            self._tok.popleft()

    def stats(self) -> dict[str, int]:
        now = time.time()
        with self._lock:
            self._prune(now)
            return {
                "rpm": len(self._req),
                "tpm": sum(t for _, t in self._tok),
                "window": _WINDOW_SECONDS,
            }


# Singleton dipakai ulang antar request di proses backend yang sama.
rate_tracker = RateTracker()
