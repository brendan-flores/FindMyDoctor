/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Strip /api/v1 suffix to get the backend base URL (works in both dev and production)
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiBase}/uploads/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
