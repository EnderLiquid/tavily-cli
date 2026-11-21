import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { list, record, text } from "./data.js";
import { log } from "./stream.js";

const MAX_SLUG_LENGTH = 120;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** 从页面 URL 生成安全的文件名主干。 */
export function crawlSlug(url: string): string {
  let location = url;
  try {
    const parsed = new URL(url);
    location = parsed.host + parsed.pathname.replace(/\/+$/, "") + parsed.search;
  } catch {
    // Keep the raw value when the response contains a non-URL string.
  }
  let slug = location
    .replace(/[^\p{L}\p{N}_\-.]/gu, "_")
    .replace(/^_+/, "")
    .replace(/[._ ]+$/g, "");
  if (slug === "") return "index";
  const device = slug.split(".")[0] ?? slug;
  if (WINDOWS_RESERVED.test(device)) slug = `_${slug}`;
  const chars = [...slug];
  if (chars.length > MAX_SLUG_LENGTH) {
    const hash = createHash("sha1").update(slug).digest("hex").slice(0, 8);
    slug = `${chars.slice(0, MAX_SLUG_LENGTH - 9).join("")}-${hash}`;
  }
  return slug;
}

export interface SavedPages {
  files: string[];
}

function displayDir(dir: string): string {
  return /[\\/]$/.test(dir) ? dir : `${dir}${path.sep}`;
}

/** 把每个有 raw_content 的成功页面保存为 `<slug>.md`。 */
export function saveCrawlPages(data: unknown, dir: string): SavedPages {
  mkdirSync(dir, { recursive: true });
  const used = new Set<string>();
  const files: string[] = [];
  for (const item of list(record(data).results)) {
    const page = record(item);
    const raw = text(page.raw_content);
    if (raw === "") continue;
    const url = text(page.url);
    const base = crawlSlug(url);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}`;
    used.add(name.toLowerCase());
    const file = path.join(dir, `${name}.md`);
    writeFileSync(file, `# ${url}\n\n${raw}\n`);
    files.push(file);
  }
  log(`Saved ${files.length} pages to ${displayDir(dir)}`);
  return { files };
}
