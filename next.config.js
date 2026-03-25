const path = require("path");
const os = require("os");

/**
 * distDir:
 * - `next dev`: default to OS temp (e.g. %TEMP%/legalai-next) so OneDrive/iCloud never corrupts webpack chunks.
 * - `next build` / `next start`: always `.next` in the project (stable production output).
 * - Override anytime: NEXT_DIST_DIR in .env.local (absolute or relative path).
 */
const distDirFromEnv =
  process.env.NEXT_DIST_DIR && String(process.env.NEXT_DIST_DIR).trim()
    ? path.resolve(process.cwd(), String(process.env.NEXT_DIST_DIR).trim())
    : null;

const isNextDev = process.argv.includes("dev");

const distDir =
  distDirFromEnv ?? (isNextDev ? path.join(os.tmpdir(), "legalai-next") : ".next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  experimental: {
    // pdf-parse pulls in pdfjs-dist; bundling breaks in the App Router without this.
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
