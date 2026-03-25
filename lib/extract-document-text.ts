import mammoth from "mammoth";

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function sniff(buffer: Buffer): "pdf" | "docx" | "unknown" {
  if (buffer.length < 5) return "unknown";
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)
    return "pdf";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
  return "unknown";
}

function extFromName(name: string): "pdf" | "docx" | null {
  const e = name.split(".").pop()?.toLowerCase();
  if (e === "pdf" || e === "docx") return e;
  return null;
}

/** Prefer file magic over extension (PDF mislabeled as .docx, etc.). */
function pickFormat(buffer: Buffer, fileName: string): "pdf" | "docx" | null {
  const s = sniff(buffer);
  if (s === "pdf" || s === "docx") return s;
  return extFromName(fileName);
}

/**
 * PDF via pdf-parse (pdf.js). Dynamic import avoids webpack bundling pdfjs-dist.
 * TODO: OCR for scanned PDFs, password-protected files, layout tuning.
 */
async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text } = await parser.getText();
    return normalize(text);
  } finally {
    await parser.destroy();
  }
}

/**
 * DOCX via mammoth.
 * TODO: richer structure (styles) for smarter clause boundaries.
 */
async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return normalize(value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Corrupted zip|End of data reached/i.test(msg)) {
      throw new Error("DOCX_CORRUPT");
    }
    throw e;
  }
}

export async function extractPlainText(buffer: Buffer, fileName: string): Promise<string> {
  const fmt = pickFormat(buffer, fileName);
  if (!fmt) throw new Error("UNSUPPORTED_FORMAT");

  if (fmt === "pdf") {
    return extractPdf(buffer);
  }

  try {
    return await extractDocx(buffer);
  } catch (e) {
    // Truncated ZIP still claims "docx"; try PDF if bytes are actually a PDF (rare mis-wrap).
    if (e instanceof Error && e.message === "DOCX_CORRUPT") {
      if (looksLikePdf(buffer)) {
        try {
          return await extractPdf(buffer);
        } catch {
          throw new Error("DOCX_CORRUPT");
        }
      }
      throw e;
    }
    throw e;
  }
}

function looksLikePdf(buffer: Buffer): boolean {
  if (buffer.length >= 5 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)
    return true;
  const idx = buffer.indexOf(Buffer.from("%PDF"));
  return idx >= 0 && idx < 1024;
}
