/**
 * Heuristic clause segmentation for contracts (NDA / MSA / Employment).
 * No LLM â€” pattern + layout only. TODO: optional AI pass to refine boundaries / headings.
 */

export type ClauseChunk = {
  heading?: string;
  text: string;
};

export type ClauseSegment = {
  position: number;
  heading: string | null;
  raw_text: string;
};

/** Tunables */
const MAX_PARAGRAPH_BEFORE_LINE_SPLIT = 4500;
const MIN_MERGE_CHARS = 100;
const MAX_CLAUSE_CHARS_BEFORE_SPLIT = 6000;

// --- normalizeText ---

export function normalizeText(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\u00a0/g, " ");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

// --- splitIntoParagraphs ---

export function splitIntoParagraphs(text: string): string[] {
  const blocks = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.length > MAX_PARAGRAPH_BEFORE_LINE_SPLIT) {
      out.push(...splitHugeBlockBySectionLines(block));
    } else {
      out.push(block);
    }
  }
  return out;
}

/**
 * When PDF extraction dumps a giant block without blank lines, split on lines that look like new sections.
 */
function splitHugeBlockBySectionLines(block: string): string[] {
  const lines = block.split("\n");
  const chunks: string[] = [];
  let buf: string[] = [];
  let accLen = 0;

  const flush = () => {
    const s = buf.join("\n").trim();
    if (s) chunks.push(s);
    buf = [];
    accLen = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isStart = i === 0;
    if (
      !isStart &&
      accLen > 400 &&
      isLikelySectionStartLine(trimmed, lines[i - 1]?.trim() ?? "")
    ) {
      flush();
    }
    buf.push(line);
    accLen += line.length + 1;
  }
  flush();
  return chunks.length ? chunks : [block.trim()];
}

/** New section at line when it looks like a heading and previous line â€œfinishedâ€ a sentence/paragraph. */
function isLikelySectionStartLine(line: string, prevLine: string): boolean {
  if (!line || line.length > 200) return false;
  if (!isHeadingLine(line)) return false;
  if (!prevLine) return true;
  if (/[.!?:;)]$/.test(prevLine)) return true;
  if (prevLine.length > 80) return true;
  return false;
}

// --- heading detection ---

/** e.g. 1. Scope, 1.1 Definitions, (a) Items */
const RE_NUMBERED_HEADING =
  /^\s*(?:\([a-z]\)\s+|\d+(?:\.\d+)*[\.\)]?\s+)\S/i;

const RE_ROMAN_HEADING = /^\s*[IVXLC]{1,8}[\.\)]\s+\S/i;

const RE_KEYWORD_HEADING =
  /^\s*(?:Article|Section|Clause|Schedule|PART|Part|Appendix|Exhibit)\b/i;

export function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 180) return false;
  if (RE_NUMBERED_HEADING.test(t)) return true;
  if (RE_ROMAN_HEADING.test(t)) return true;
  if (RE_KEYWORD_HEADING.test(t)) return true;
  if (t.length <= 100 && t.endsWith(":") && t.split(/\s+/).length <= 12)
    return true;
  if (isAllCapsHeadingLine(t)) return true;
  return false;
}

/** Short line, mostly letters, predominantly uppercase (typical exhibit / section titles). */
export function isAllCapsHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 120) return false;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 4) return false;
  const lower = (t.match(/[a-z]/g) || []).length;
  const upper = (t.match(/[A-Z]/g) || []).length;
  if (lower > Math.max(2, upper * 0.15)) return false;
  return upper >= letters.length * 0.55;
}

// --- groupParagraphsIntoClauses ---

export function groupParagraphsIntoClauses(paragraphs: string[]): ClauseChunk[] {
  const raw: ClauseChunk[] = [];

  for (const para of paragraphs) {
    const chunk = paragraphToClauseChunk(para);
    if (chunk) raw.push(chunk);
  }

  let merged = mergeSmallFragments(raw);
  merged = splitOversizedClauses(merged);
  merged = mergeSmallFragments(merged);
  return merged;
}

function paragraphToClauseChunk(para: string): ClauseChunk | null {
  const lines = para.split("\n").map((l) => l.trimEnd());
  const trimmedLines = lines.map((l) => l.trim()).filter(Boolean);
  if (trimmedLines.length === 0) return null;

  const first = trimmedLines[0];

  if (trimmedLines.length === 1) {
    if (isHeadingLine(first)) {
      return { heading: first, text: first };
    }
    return { text: first };
  }

  if (isHeadingLine(first)) {
    const body = trimmedLines.slice(1).join("\n").trim();
    return {
      heading: first,
      text: body || first,
    };
  }

  return { text: trimmedLines.join("\n") };
}

function mergeSmallFragments(chunks: ClauseChunk[]): ClauseChunk[] {
  const out: ClauseChunk[] = [];
  for (const c of chunks) {
    const textLen = c.text.length;
    const hasHeading = Boolean(c.heading);
    const tiny = textLen < MIN_MERGE_CHARS;

    if (
      out.length > 0 &&
      tiny &&
      !hasHeading &&
      textLen > 0
    ) {
      const prev = out[out.length - 1];
      prev.text = `${prev.text}\n\n${c.text}`.trim();
    } else {
      out.push({ heading: c.heading, text: c.text });
    }
  }
  return out;
}

function splitOversizedClauses(chunks: ClauseChunk[]): ClauseChunk[] {
  const out: ClauseChunk[] = [];
  for (const c of chunks) {
    if (c.text.length <= MAX_CLAUSE_CHARS_BEFORE_SPLIT) {
      out.push(c);
      continue;
    }
    const sub = splitTextByInlineHeadings(c.text);
    if (sub.length <= 1) {
      out.push(c);
      continue;
    }
    sub.forEach((piece, i) => {
      const lines = piece.split("\n").map((l) => l.trim()).filter(Boolean);
      const first = lines[0] ?? "";
      const parentHeading = i === 0 ? c.heading : undefined;
      if (lines.length > 1 && isHeadingLine(first)) {
        out.push({
          heading: parentHeading ? `${parentHeading} â†’ ${first}` : first,
          text: lines.slice(1).join("\n").trim() || first,
        });
      } else {
        out.push({
          heading: parentHeading,
          text: piece,
        });
      }
    });
  }
  return out;
}

function splitTextByInlineHeadings(text: string): string[] {
  const lines = text.split("\n");
  const parts: string[] = [];
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (
      i > 0 &&
      buf.length > 0 &&
      buf.join("\n").length > 500 &&
      isHeadingLine(t)
    ) {
      parts.push(buf.join("\n").trim());
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) parts.push(buf.join("\n").trim());
  return parts.length ? parts : [text];
}

// --- segmentClauses (pipeline) ---

export function segmentClauses(fullText: string): ClauseSegment[] {
  const normalized = normalizeText(fullText);
  if (!normalized) return [];

  const paragraphs = splitIntoParagraphs(normalized);
  const chunks = groupParagraphsIntoClauses(paragraphs);

  const segments: ClauseSegment[] = chunks.map((c, i) => ({
    position: i + 1,
    heading: c.heading ?? null,
    raw_text: c.text.trim(),
  }));

  const filtered = segments.filter((s) => s.raw_text.length > 0);
  if (filtered.length === 0 && normalized.trim()) {
    return [{ position: 1, heading: null, raw_text: normalized.trim() }];
  }
  return filtered;
}

