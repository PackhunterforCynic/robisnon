import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const endpoints = [
  { entry: 'server/track.ts', out: 'api/track.js' },
  { entry: 'server/setup/webhook.ts', out: 'api/setup/webhook.js' },
  { entry: 'server/telegram/webhook.ts', out: 'api/telegram/webhook.js' },
  { entry: 'server/seo/audit.ts', out: 'api/seo/audit.js' },
  { entry: 'server/cron/daily-report.ts', out: 'api/cron/daily-report.js' },
  { entry: 'server/cron/weekly-report.ts', out: 'api/cron/weekly-report.js' },
  { entry: 'server/cron/seo-audit.ts', out: 'api/cron/seo-audit.js' },
];

async function buildApi() {
  console.log('[build-api] Compiling serverless endpoints...');
  
  for (const ep of endpoints) {
    const outDir = path.dirname(path.resolve(ep.out));
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [ep.entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      outfile: ep.out,
      packages: 'external',
      sourcemap: false,
      minify: false,
    });
    console.log(`[build-api] ✓ ${ep.entry} -> ${ep.out}`);
  }

  console.log('[build-api] All 7 serverless endpoints compiled successfully.');
}

buildApi().catch(err => {
  console.error('[build-api] Build failed:', err);
  process.exit(1);
});
