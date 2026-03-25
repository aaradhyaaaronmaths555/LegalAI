import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readNextDistDirFromEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "NEXT_DIST_DIR") continue;
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v || null;
  }
  return null;
}

const fromEnv = process.env.NEXT_DIST_DIR?.trim() || readNextDistDirFromEnvLocal();
const paths = [join(root, ".next"), join(root, "node_modules/.cache")];
if (fromEnv) {
  paths.push(resolve(root, fromEnv));
}
paths.push(join(tmpdir(), "legalai-next"));

for (const full of paths) {
  try {
    rmSync(full, { recursive: true, force: true });
    console.log("removed", relative(root, full) || ".");
  } catch {
    // ignore
  }
}
