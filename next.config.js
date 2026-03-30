const path = require("path");

/**
 * distDir:
 * - Default: `.next` in the project (reliable CSS/static serving in dev).
 * - If OneDrive corrupts chunks, set NEXT_DIST_DIR in .env.local to a folder outside sync, e.g.
 *   NEXT_DIST_DIR=C:\\Users\\YOU\\AppData\\Local\\Temp\\legalai-next
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
