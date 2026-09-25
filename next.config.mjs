/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  allowedDevOrigins: [
    'ais-dev-vxwcnlpmfrnpdvxsfeaoj3-193501402343.us-east1.run.app',
    'ais-pre-vxwcnlpmfrnpdvxsfeaoj3-193501402343.us-east1.run.app',
    '*.run.app',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
}

export default nextConfig
