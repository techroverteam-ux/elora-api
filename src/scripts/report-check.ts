/**
 * Build one store's PPT + PDF locally (live DB + live photos) and report what's
 * inside the PPT, to tell "server builds it without images" apart from
 * "the phone's PPT viewer doesn't show them".
 *
 *   npx ts-node --transpile-only src/scripts/report-check.ts <dealerCode> [recce|installation]
 *
 * Writes ~/Downloads/CHECK_<type>_<dealerCode>.pptx and .pdf. Not for committing.
 */
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import { Writable } from "stream";
import mongoose from "mongoose";
import Store from "../modules/store/store.model";
import { collectStoreImagePaths, loadReportImage, buildImageUrl } from "../utils/reportImages";
import * as ppt from "../modules/store/ppt.controller";
import * as pdf from "../modules/store/pdf.controller";

dotenv.config({ path: ".env.production" });
dotenv.config();
const isMongoUri = (v?: string) => !!v && /^mongodb(\+srv)?:\/\//.test(v.trim());

const capture = (fn: any, req: any, file: string) =>
  new Promise<Buffer>((done, fail) => {
    const chunks: Buffer[] = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(file, buf);
      done(buf);
    };
    const res: any = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
    res.headersSent = false;
    res.setHeader = () => {};
    res.writeHead = () => res;
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (j: any) => fail(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(j)}`));
    res.send = (b: Buffer) => { chunks.push(Buffer.from(b)); finish(); };
    const end = res.end.bind(res);
    res.end = (b?: any) => { if (b) chunks.push(Buffer.from(b)); end(); finish(); return res; };
    res.on("finish", finish);
    Promise.resolve(fn(req, res)).catch(fail);
  });

(async () => {
  const key = process.argv[2];
  const type = (process.argv[3] || "installation") as "recce" | "installation";
  if (!key) throw new Error("Usage: npx ts-node --transpile-only src/scripts/report-check.ts <dealerCode> [recce|installation]");
  // Same databases the live API can use: env MONGO_URI, and the fallback
  // connection string hard-coded in api/index.ts. Try each until the store is found.
  const uris: string[] = [];
  const envUri = [process.env.MONGO_URI, process.env.MONGODB_URI].find(isMongoUri);
  try {
    const src = fs.readFileSync(path.join(process.cwd(), "api", "index.ts"), "utf8");
    const m = src.match(/"(mongodb(?:\+srv)?:\/\/[^"]+)"/);
    if (m) uris.push(m[1]);
  } catch {}
  if (envUri && !uris.includes(envUri.trim())) uris.push(envUri.trim());
  if (!uris.length) throw new Error("No MongoDB connection string found");

  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`^\\s*${esc}\\s*$`, "i");
  const or: any[] = [{ dealerCode: rx }, { storeId: rx }, { storeCode: rx }, { dealerName: rx }];
  if (/^\d+$/.test(key)) or.push({ dealerCode: Number(key) }, { storeCode: Number(key) });
  if (mongoose.isValidObjectId(key)) or.push({ _id: key });

  let store: any = null;
  for (const [i, uri] of uris.entries()) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`DB ${i + 1}/${uris.length}: ${mongoose.connection.host}/${mongoose.connection.name}`);
    store = await Store.findOne({ $or: or });
    if (store) break;
    const sample = await Store.find({}, { dealerCode: 1, storeName: 1 }).sort({ _id: -1 }).limit(5).lean();
    console.log(`  not found here. Latest stores: ${sample.map((s: any) => `${s.dealerCode} (${s.storeName})`).join(", ") || "none"}`);
    await mongoose.disconnect();
  }
  if (!store) throw new Error(`No store found for "${key}" in any database`);
  console.log(`Store: ${store.storeName} (${store._id})  type=${type}`);

  console.log("\nLogo file:", fs.existsSync(path.join(process.cwd(), "public", "logo.png")) ? "found" : "MISSING");
  console.log("\nPhotos:");
  for (const p of collectStoreImagePaths(store)) {
    const img = await loadReportImage(p);
    console.log(`  ${img ? "OK  " : "FAIL"} ${buildImageUrl(p)}${img ? ` (${img.width}x${img.height})` : ""}`);
  }

  const out = path.join(os.homedir(), "Downloads");
  const id = String(store._id);
  const pptFn = type === "recce" ? (ppt as any).generateReccePPT : (ppt as any).generateInstallationPPT;
  const pdfFn = type === "recce" ? pdf.generateReccePDF : pdf.generateInstallationPDF;

  const pptFile = path.join(out, `CHECK_${type}_${key}.pptx`);
  const pptBuf = await capture(pptFn, { params: { id }, body: {} }, pptFile);
  const pdfFile = path.join(out, `CHECK_${type}_${key}.pdf`);
  await capture(pdfFn, { params: { id } }, pdfFile);

  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(pptBuf);
  const media = Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/") && !f.endsWith("/"));
  console.log(`\nPPT: ${pptFile} (${(pptBuf.length / 1024).toFixed(0)} KB), ${media.length} images inside`);
  for (const m of media) {
    const b: Buffer = await zip.file(m).async("nodebuffer");
    const kind = b[0] === 0xff && b[1] === 0xd8 ? "jpeg" : b[0] === 0x89 && b[1] === 0x50 ? "png" : `UNKNOWN(${b.subarray(0, 4).toString("hex")})`;
    console.log(`  ${m}  ${(b.length / 1024).toFixed(0)} KB  ${kind}`);
  }
  console.log(`PDF: ${pdfFile}`);
  console.log("\nNow open both files on this Mac (Keynote / PowerPoint / Preview).");
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error("ERROR:", e?.message || e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
