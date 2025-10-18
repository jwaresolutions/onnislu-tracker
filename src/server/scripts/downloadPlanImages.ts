// downloadPlanImages.ts - Downloads ONNISLU floor plan images into public/plan-images
//
// Usage examples:
//   npx ts-node src/server/scripts/downloadPlanImages.ts
//   npx ts-node src/server/scripts/downloadPlanImages.ts --codes=D1,D2,E1
//   npx ts-node src/server/scripts/downloadPlanImages.ts --range=D1-D12,E1-E12 --t=1,2
//
// Images are saved under /static/plan-images via Express static hosting.
// References: [express.static()](src/server/index.ts:1), [downloadPlanImages.ts](src/server/scripts/downloadPlanImages.ts:1)

import fs from 'fs';
import path from 'path';

type TCode = 't1' | 't2';

const BASE_URLS = [
  'https://s3.us-west-2.amazonaws.com/onnisouthlakeunion/plans/_c1000w',
  'https://s3.us-west-2.amazonaws.com/onnisouthlakeunion/plans/_c2000w',
  'https://s3.us-west-2.amazonaws.com/onnisouthlakeunion/plans'
];

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

const OUT_DIR = path.join(process.cwd(), 'public', 'plan-images');

interface Options { codes: string[]; t: TCode[]; }

function generateDefaultCodes(): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 20; i++) { out.push(`D${i}`); }
  for (let i = 1; i <= 20; i++) { out.push(`E${i}`); }
  return out;
}

function expandRangeToken(tok: string): string[] {
  // Supports tokens like D1-D12 or E1-E8 or single D3
  const m = tok.match(/^([DE])(\d+)(?:-([DE])?(\d+))?$/i);
  if (!m) return [tok.toUpperCase()];
  const sL = m[1].toUpperCase();
  const sN = parseInt(m[2], 10);
  const eL = (m[3] ? m[3].toUpperCase() : sL);
  const eN = (m[4] ? parseInt(m[4], 10) : sN);
  if (sL !== eL) return [tok.toUpperCase()];
  const out: string[] = [];
  const start = Math.min(sN, eN);
  const end = Math.max(sN, eN);
  for (let n = start; n <= end; n++) out.push(`${sL}${n}`);
  return out;
}

function parseArgs(argv: string[]): Options {
  const codesArg = argv.find(a => a.startsWith('--codes='));
  const rangeArg = argv.find(a => a.startsWith('--range='));
  const tArg = argv.find(a => a.startsWith('--t='));

  let codes: string[] = [];
  if (codesArg) {
    codes = codesArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
  } else if (rangeArg) {
    const tokens = rangeArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    codes = tokens.flatMap(expandRangeToken);
  } else {
    codes = generateDefaultCodes();
  }

  let t: TCode[] = ['t1','t2'];
  if (tArg) {
    const parts = tArg.split('=')[1].split(',').map(s => s.trim());
    t = parts.map(p => (p === '1' || p.toLowerCase() === 't1') ? 't1' : 't2')
             .filter((v, i, a) => a.indexOf(v) === i) as TCode[];
    if (t.length === 0) t = ['t1','t2'];
  }

  return { codes, t };
}

async function ensureOutDir() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
}

function codeToFileStem(t: TCode, code: string): string {
  const codeNorm = code.trim().toLowerCase(); // d1, e2
  return `${t}-plan_${codeNorm}`;
}

async function exists(p: string): Promise<boolean> {
  try { await fs.promises.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

async function tryDownload(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!(res as any).ok) return false;
    const buf = Buffer.from(await (res as any).arrayBuffer());
    await fs.promises.writeFile(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

function candidateUrls(stem: string): { url: string; filePath: string }[] {
  const candidates: { url: string; filePath: string }[] = [];
  for (const base of BASE_URLS) {
    for (const ext of EXTENSIONS) {
      const fileName = `${stem}.${ext}`;
      const url = `${base}/${fileName}`;
      const filePath = path.join(OUT_DIR, fileName);
      candidates.push({ url, filePath });
    }
  }
  return candidates;
}

async function main() {
  const { codes, t } = parseArgs(process.argv.slice(2));
  await ensureOutDir();

  const results: { file: string; ok: boolean }[] = [];

  for (const tcode of t) {
    for (const code of codes) {
      const stem = codeToFileStem(tcode, code);

      // Skip if any extension already exists locally
      let already = false;
      for (const ext of EXTENSIONS) {
        if (await exists(path.join(OUT_DIR, `${stem}.${ext}`))) {
          results.push({ file: `${stem}.*`, ok: true });
          already = true;
          break;
        }
      }
      if (already) continue;

      let ok = false;
      for (const c of candidateUrls(stem)) {
        ok = await tryDownload(c.url, c.filePath);
        if (ok) {
          results.push({ file: path.basename(c.filePath), ok: true });
          break;
        }
      }
      if (!ok) {
        results.push({ file: `${stem}.[${EXTENSIONS.join('|')}]`, ok: false });
      }
    }
  }

  const okCount = results.filter(r => r.ok).length;
  const total = results.length;
  const fail = results.filter(r => !r.ok).map(r => r.file);
  // eslint-disable-next-line no-console
  console.log(`Downloaded ${okCount}/${total} images to ${OUT_DIR}`);
  if (fail.length) {
    // eslint-disable-next-line no-console
    console.log(`Missing or failed: ${fail.slice(0, 80).join(', ')}${fail.length > 80 ? ' ...' : ''}`);
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('downloadPlanImages failed', err);
  process.exit(1);
});