const apiTarget = process.env.NEXT_PUBLIC_API_PROXY_TARGET || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
