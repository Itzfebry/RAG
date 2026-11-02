"""
Security middleware: headers, body size limit, IP block.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

MAX_BODY_BYTES = 1_000_000  # 1 MB (QRIS data URL di /api/admin/pricing dibatasi 600k char)
# Ekstraksi dokumen command /doc: 2 MB/file + overhead multipart. Hanya path
# ini yang dilonggarkan; endpoint lain tetap 1 MB.
MAX_UPLOAD_BYTES = 3_000_000
UPLOAD_PATH_SUFFIXES = ("/user/documents/extract",)


def _body_limit_for(path: str) -> int:
    return MAX_UPLOAD_BYTES if path.endswith(UPLOAD_PATH_SUFFIXES) else MAX_BODY_BYTES


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-XSS-Protection": "0",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        # HSTS only if https (prod behind proxy sends x-forwarded-proto)
        proto = request.headers.get("x-forwarded-proto", "")
        if proto == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        limit = _body_limit_for(request.url.path)
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > limit:
            return Response(content='{"detail":"Payload too large"}', status_code=413, media_type="application/json")
        # Request chunked tidak punya Content-Length: hitung byte nyata saat dibaca
        if not cl:
            body = b""
            async for part in request.stream():
                body += part
                if len(body) > limit:
                    return Response(
                        content='{"detail":"Payload too large"}', status_code=413, media_type="application/json"
                    )

            async def _replay():
                yield {"type": "http.request", "body": body, "more_body": False}

            request._receive = _replay().__anext__
        return await call_next(request)
