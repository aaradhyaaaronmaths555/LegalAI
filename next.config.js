const path = require("path");

/**
 * distDir:
 * - Default: `.next` in the project.
 * - Dev: use `npm run dev` (Turbopack) to avoid webpack chunk MODULE_NOT_FOUND on synced folders.
 * - Optional: NEXT_DIST_DIR in .env.local = non-synced path if you must use `npm run dev:webpack`.
 */
const distDir =
  process.env.NEXT_DIST_DIR && String(process.env.NEXT_DIST_DIR).trim()
    ? path.resolve(process.cwd(), String(process.env.NEXT_DIST_DIR).trim())
    : ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
