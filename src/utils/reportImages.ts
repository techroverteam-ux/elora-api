/**
 * Image loading for PDF / PPT reports.
 *
 * Replaces the old per-generator loaders, which dropped photos at random:
 *  - single attempt, no retry (any storage hiccup = blank slide)
 *  - temp files under process.cwd()/temp (read-only on Vercel) and, in some
 *    PPTs, deleted before pptxgenjs actually read them
 *  - double-encoded URLs (stored "%20" became "%2520" -> 404)
 *  - HEIC / WEBP passed straight to PDFKit, which only reads JPEG/PNG
 *  - no timeout on fetch, so one slow photo could stall the whole report
 *
 * Every image is downloaded with retries + timeout, converted to an
 * EXIF-rotated JPEG (max 1600px) with sharp, and memoised briefly so a report
 * that uses the same photo twice — or the prefetch below — only downloads once.
 */
import sharp from "sharp";

const STORAGE_BASE = "https://storage.enamorimpex.com/eloraftp/";
const MAX_SIDE = 1600;
const TIMEOUT_MS = 12000;
const RETRIES = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 300;

export type ReportImage = { buffer: Buffer; width: number; height: number };

const safeDecode = (v: string) => {
  try { return decodeURIComponent(v); } catch { return v; }
};

/** Absolute, correctly-encoded URL for a stored photo path or URL. */
export const buildImageUrl = (pathOrUrl: string): string => {
  if (!pathOrUrl) return "";
  const raw = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(raw)) {
    // Re-encode only the path, once (decode first so "%20" doesn't become "%2520").
    try {
      const u = new URL(raw);
      u.pathname = u.pathname.split("/").map((seg) => encodeURIComponent(safeDecode(seg))).join("/");
      return u.toString();
    } catch {
      return raw;
    }
  }
  const clean = raw.replace(/^\/+/, "");
  return STORAGE_BASE + clean.split("/").map((seg) => encodeURIComponent(safeDecode(seg))).join("/");
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchWithRetry = async (url: string): Promise<Buffer | null> => {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (EloraReports)" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const expected = Number(res.headers.get("content-length") || 0);
        if (buf.length > 0 && (!expected || buf.length >= expected)) return buf;
        console.warn(`[reportImages] truncated ${url} (${buf.length}/${expected} bytes), retrying`);
      } else if (res.status === 404 || res.status === 403) {
        console.warn(`[reportImages] ${res.status} ${url}`);
        return null; // won't get better on retry
      } else {
        console.warn(`[reportImages] HTTP ${res.status} ${url} (attempt ${attempt + 1})`);
      }
    } catch (e: any) {
      console.warn(`[reportImages] ${e?.name === "AbortError" ? "timeout" : e?.message} ${url} (attempt ${attempt + 1})`);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < RETRIES - 1) await sleep(400 * 2 ** attempt);
  }
  return null;
};

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const isPng = (b: Buffer) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

const normalise = async (input: Buffer): Promise<ReportImage | null> => {
  try {
    const { data, info } = await sharp(input, { failOn: "none" })
      .rotate() // honour EXIF orientation (phone photos)
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch (e: any) {
    // sharp couldn't decode it (e.g. HEIC without codec). JPEG/PNG still usable as-is.
    if (isJpeg(input) || isPng(input)) {
      try {
        const meta = await sharp(input).metadata();
        return { buffer: input, width: meta.width || 1600, height: meta.height || 1200 };
      } catch {
        return { buffer: input, width: 1600, height: 1200 };
      }
    }
    console.warn(`[reportImages] unsupported image format: ${e?.message}`);
    return null;
  }
};

const cache = new Map<string, { at: number; p: Promise<ReportImage | null> }>();

/** Load one report image (memoised). Resolves null if it can't be fetched/decoded. */
export const loadReportImage = (pathOrUrl?: string | null): Promise<ReportImage | null> => {
  if (!pathOrUrl) return Promise.resolve(null);
  const url = buildImageUrl(pathOrUrl);
  if (!url) return Promise.resolve(null);
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.p;

  const p = fetchWithRetry(url).then((buf) => (buf ? normalise(buf) : null));
  cache.set(url, { at: now, p });
  // Don't keep failures around; keep the cache bounded.
  p.then((img) => { if (!img) cache.delete(url); });
  if (cache.size > CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, cache.size - CACHE_MAX);
    oldest.forEach(([k]) => cache.delete(k));
  }
  return p;
};

/** Download many images in parallel (bounded) before building a report. */
export const prefetchReportImages = async (paths: Array<string | null | undefined>, concurrency = 4) => {
  const list = [...new Set(paths.filter(Boolean) as string[])];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (i < list.length) {
      const next = list[i++];
      await loadReportImage(next);
    }
  });
  await Promise.all(workers);
};

/** All photo paths a store's reports may use. */
export const collectStoreImagePaths = (store: any): string[] => [
  ...(store?.recce?.initialPhotos || []),
  ...((store?.recce?.reccePhotos || []).map((p: any) => p?.photo)),
  ...((store?.installation?.photos || []).map((p: any) => (typeof p === "string" ? p : p?.installationPhoto))),
].filter((p) => typeof p === "string" && p.length > 0);

/** Fit an image of (iw x ih) inside a box, centred, keeping its aspect ratio. */
export const containBox = (iw: number, ih: number, x: number, y: number, w: number, h: number) => {
  const scale = Math.min(w / iw, h / ih);
  const cw = iw * scale;
  const ch = ih * scale;
  return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, w: cw, h: ch };
};

/** pptxgenjs `data:` string for an image (no temp files needed). */
export const toPptData = (img: ReportImage) => `image/jpeg;base64,${img.buffer.toString("base64")}`;
