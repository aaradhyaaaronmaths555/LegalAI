export type ClauseSegment = {
  position: number;
  heading: string | null;
  raw_text: string;
};

/**
 * Split on blank lines; optional short first line as heading if it looks like a section title.
 * TODO: numbered sections, exhibits, tables.
 */
export function segmentClauses(fullText: string): ClauseSegment[] {
  const normalized = fullText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split(/\n{2,}/);

  const out: ClauseSegment[] = [];
  let position = 0;

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    let heading: string | null = null;
    let body = trimmed;

    if (lines.length > 1 && lines[0].length <= 120) {
      const first = lines[0];
      const looksLikeHeading =
        /^(Article|Section|Clause|Schedule|PART)\b/i.test(first) ||
        /^[\d]+(?:\.\d+)*[\.\)]\s+\S/.test(first) ||
        (first.endsWith(":") && first.length < 90);
      if (looksLikeHeading) {
        heading = first;
        body = lines.slice(1).join("\n").trim() || first;
      }
    }

    if (!body.trim()) continue;
    position += 1;
    out.push({ position, heading, raw_text: body.trim() });
  }

  if (out.length === 0 && normalized.trim()) {
    return [{ position: 1, heading: null, raw_text: normalized.trim() }];
  }

  return out;
}
