/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 wajib daftar allowlist quality. 90 dipakai gambar layanan
  // (screenshot berteks) supaya re-encode tidak menghaluskan detail.
  images: {
    qualities: [75, 90],
  },
  async rewrites() {
    if (process.env.VERCEL) {
      // Production on Vercel: ALL /api/* and /v1/* requests are routed at the
      // platform level by vercel.json rewrites → api/app.py (FastAPI).
      // next.config rewrites are intentionally empty in prod: a Next-level
      // rewrite never re-enters Vercel's function filesystem, and Python
      // functions have no catch-all support (see api/app.py docstring).
      return [];
    }
    // Local dev: proxy everything to the FastAPI dev server.
    return [
      {
        source: "/api/python/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
