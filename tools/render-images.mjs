// Renders public/og.png (1200x630) and the PNG icons from tools/og.html and public/icon.svg.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch({ executablePath: process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome` });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + path.join(root, 'tools/og.html'));
await page.screenshot({ path: path.join(root, 'public/og.png') });
import fs from 'node:fs';
const svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
// 180px apple-touch icon is full-bleed (iOS rounds it itself); 512px keeps the rounded corners.
for (const [size, bleed] of [[180, true], [512, false]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  const scale = bleed ? 1.3 : 1;
  const off = ((scale - 1) / 2) * size;
  await p.setContent(`<html><body style="margin:0;overflow:hidden;width:${size}px;height:${size}px;position:relative">
    <div style="position:absolute;left:-${off}px;top:-${off}px;width:${size * scale}px;height:${size * scale}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await p.screenshot({ path: path.join(root, `public/icon-${size}.png`), omitBackground: !bleed });
}
await browser.close();
console.log('rendered');
