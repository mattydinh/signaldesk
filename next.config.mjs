/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
