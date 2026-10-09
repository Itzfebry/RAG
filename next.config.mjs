/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.VERCEL) {
      // Production on Vercel: FastAPI runs as the file-based Python function
      // at api/[...path].py, which already owns every /api/* route.
      // Only normalize the /api/python/* prefix the frontend uses.
      return [
        {
          source: '/api/python/:path*',
          destination: '/api/:path*',
        },
        {
          source: '/v1/:path*',
          destination: '/api/v1/:path*',
        },
      ];
    }
    // Local dev: proxy everything to the FastAPI dev server.
    return [
      {
        source: '/api/python/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
