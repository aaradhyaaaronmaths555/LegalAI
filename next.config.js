/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse pulls in pdfjs-dist; bundling breaks in the App Router without this.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
  },
};

module.exports = nextConfig;
