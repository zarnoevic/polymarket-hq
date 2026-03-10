/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@polymarket-hq/dashboard-prisma"],
};

module.exports = nextConfig;
