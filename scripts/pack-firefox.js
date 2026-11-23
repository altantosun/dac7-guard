/**
 * Builds a Firefox Add-on (Manifest V3) distributable zip in dist/ with
 * browser_specific_settings.gecko injected cleanly without polluting Chrome's manifest.json.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dac7-guard-ff-'));
try {
  // Copy runtime assets
  for (const item of ['icons', 'src', 'LICENSE']) {
    fs.cpSync(path.join(root, item), path.join(tmpDir, item), { recursive: true });
  }

  // Firefox MV3 requires browser_specific_settings.gecko and background.scripts fallback
  const ffManifest = {
    ...manifest,
    background: {
      scripts: ['src/background/service-worker.js'],
      type: 'module'
    },
    browser_specific_settings: {
      gecko: {
        id: 'dac7-guard@altantosun.github.io',
        strict_min_version: '121.0'
      }
    }
  };

  fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(ffManifest, null, 2));

  const zipName = `dac7-guard-firefox-v${manifest.version}.zip`;
  const zipPath = path.join(distDir, zipName);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  execFileSync('zip', ['-r', '-q', zipPath, 'manifest.json', 'icons', 'src', 'LICENSE'], {
    cwd: tmpDir,
    stdio: 'inherit'
  });

  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
  console.log(`Packed Firefox Add-on: ${zipPath} (${sizeKb} KB)`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
