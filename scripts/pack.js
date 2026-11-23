/**
 * Builds a clean distributable zip archive in dist/ for Chrome Web Store & GitHub Releases.
 * Includes only extension runtime files (manifest.json, icons/, src/, LICENSE).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const zipName = `dac7-guard-v${manifest.version}.zip`;
const zipPath = path.join(distDir, zipName);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

execFileSync('zip', ['-r', '-q', zipPath, 'manifest.json', 'icons', 'src', 'LICENSE'], {
  cwd: root,
  stdio: 'inherit'
});

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`Packed ${zipPath} (${sizeKb} KB)`);
