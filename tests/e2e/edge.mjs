// Edge cases in real Chromium: narrow phones with a long name, Back after creating, a player removed
// mid-quiz, a quiz deleted mid-quiz, a reported (hidden) quiz, and the share images.
// Usage: BASE=http://localhost:8823 node tests/e2e/edge.mjs   (cleans up after itself; the hidden-quiz case is local only)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8823';
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const SHOTS = process.env.SHOTS || 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome` });
const errors = [];
const created = [];
const LONG = 'Maximilianna-Josephine';
const step = (msg) => console.log('✓', msg);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const phone = (width) => ({ viewport: { width, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function ctxPage(opts, label) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`${label}: ${m.text()}`); });
  page.on('response', (r) => { const u = new URL(r.url()); if (r.status() >= 400 && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/q/')) errors.push(`${label}: ${r.status()} ${u.pathname}`); });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}/api/${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function makeQuiz(name) {
  const { PACKS } = await import('../../public/bank.js');
  const questions = PACKS[0].questions.slice(0, 10).map((x, i) => ({ q: x.q, a: x.a, c: i % x.a.length }));
  const { status, data } = await api('quizzes', { method: 'POST', body: { name, pack: 'friends', questions } });
  assert.equal(status, 201);
  created.push(data);
  return data;
}
async function noOverflow(page, where) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(sw <= iw, `${where}: page is ${sw}px wide in a ${iw}px viewport`);
}
// Locally every request shares one IP key, so repeated runs hit the per-IP create limit; start from a clean counter.
const d1Local = (sql) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'pb-know-me-quiz', '--local', '--command', sql], { stdio: 'ignore' });
if (LOCAL) d1Local('DELETE FROM rate');
const playAnswer = async (page) => {
  await page.locator('.answers .opt').first().click();
  await page.waitForSelector('.feedback.good, .feedback.bad');
};

try {
  // ---------- 1. Long name on 320 px and 360 px phones: nothing sticks out sideways ----------
  const quiz = await makeQuiz(LONG);
  for (const width of [320, 360]) {
    const { ctx, page } = await ctxPage(phone(width), `w${width}`);
    await page.goto(BASE + '/');
    await noOverflow(page, `landing ${width}`);
    await page.fill('#name', LONG);
    await page.click('#startForm button[type=submit]');
    await page.waitForSelector('#build:not(.hide)');
    assert.equal(await page.isVisible('#howLink'), false, '"How it works" points at a hidden section while building');
    await page.locator('.qcard').first().getByText('✎ Edit').click();
    await noOverflow(page, `builder edit ${width}`);
    await page.locator('.qcard').first().getByText('Done').click();
    await noOverflow(page, `builder ${width}`);
    // Owner dashboard with the long name.
    await page.evaluate(([qid, tok]) => localStorage.setItem('kn_owner_' + qid, JSON.stringify(tok)), [quiz.id, quiz.ownerToken]);
    await page.goto(`${BASE}/q/${quiz.id}`);
    await page.waitForSelector('#shareBtn');
    await noOverflow(page, `owner ${width}`);
    await page.click('#storyBtn');
    await page.waitForSelector('.modal img');
    await noOverflow(page, `story modal ${width}`);
    if (width === 320) await shot(page, `e1-story-modal-${width}`);
    // Taker on the same width.
    const { ctx: c2, page: t } = await ctxPage(phone(width), `taker${width}`);
    await t.goto(`${BASE}/q/${quiz.id}`);
    await t.waitForSelector('#nick');
    await noOverflow(t, `intro ${width}`);
    await t.fill('#nick', `Pal${width}`);
    await t.click('form button[type=submit]');
    await t.waitForSelector('.answers');
    await noOverflow(t, `question ${width}`);
    for (let i = 0; i < 10; i++) {
      await playAnswer(t);
      if (i < 9) await t.waitForFunction((n) => document.querySelector('.progress span')?.textContent.startsWith(`${n} /`), i + 2);
    }
    await t.waitForSelector('.score .big');
    await noOverflow(t, `result ${width}`);
    if (width === 320) await shot(t, `e2-result-${width}`);
    await t.click('text=Share my score');
    await t.waitForSelector('.modal img');
    // The score card button sits inside the card, not on its edge.
    await t.click('.modal .linkbtn');
    const pad = await t.evaluate(() => {
      const card = document.querySelector('.score').getBoundingClientRect();
      const btn = document.querySelector('.score .btn').getBoundingClientRect();
      return Math.min(btn.left - card.left, card.right - btn.right, card.bottom - btn.bottom);
    });
    assert.ok(pad >= 12, `score button is ${pad}px from the card edge`);
    await ctx.close();
    await c2.close();
    step(`${width}px: landing, builder, owner, story image, intro, question and result fit with name "${LONG}"`);
  }
  // Story and score images were rendered from canvas: check that the long name was shrunk to fit inside the white card.
  {
    const { ctx, page } = await ctxPage(phone(390), 'canvas');
    await page.goto(BASE + '/');
    await page.evaluate(([qid, tok]) => localStorage.setItem('kn_owner_' + qid, JSON.stringify(tok)), [quiz.id, quiz.ownerToken]);
    await page.goto(`${BASE}/q/${quiz.id}`);
    await page.click('#storyBtn');
    await page.waitForSelector('.modal img');
    const src = await page.getAttribute('.modal img', 'src');
    fs.writeFileSync(`${SHOTS}/e3-story-long-name.png`, Buffer.from(src.split(',')[1], 'base64'));
    // Pixels just outside the white card (x 60..89) in the title band must be gradient, not dark text.
    const darkOutside = await page.evaluate(async (s) => {
      const img = new Image(); img.src = s; await img.decode();
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      let dark = 0;
      for (const x of [20, 60, 1000, 1060]) for (let y = 700; y < 1200; y += 4) { const [r, gg, b] = g.getImageData(x, y, 1, 1).data; if (r + gg + b < 200) dark++; }
      return dark;
    }, src);
    assert.equal(darkOutside, 0, 'story title spills outside the card');
    await ctx.close();
    step('story image: long name shrunk to fit inside the card');
  }

  // ---------- 2. Back after creating does not reopen the builder (no duplicate quiz) ----------
  {
    const { ctx, page } = await ctxPage(phone(390), 'back');
    await page.goto(BASE + '/');
    await page.fill('#name', 'Backtest');
    await page.click('#startForm button[type=submit]');
    await page.waitForSelector('#build:not(.hide)');
    for (let i = 0; i < 10; i++) await page.locator('.qcard').nth(i).locator('.opt').first().click();
    await page.click('#createBtn');
    await page.waitForURL(/\/q\/[A-Za-z0-9]+/);
    const qid = new URL(page.url()).pathname.split('/')[2];
    await page.waitForSelector('#shareBtn');
    assert.equal(new URL(page.url()).search, '', '?new=1 is removed from the address bar');
    created.push({ id: qid, ownerToken: await page.evaluate((k) => JSON.parse(localStorage.getItem('kn_owner_' + k)), qid) });
    await page.goBack();
    await page.waitForSelector('#start:not(.hide)');
    assert.equal(await page.isVisible('#build'), false, 'Back shows the builder of a quiz that was already created');
    assert.equal(await page.locator('#mineList a').count(), 1, '"Your quizzes" lists the new quiz');
    await page.goForward();
    await page.waitForSelector('#shareBtn');
    assert.equal(await page.textContent('h1'), "Backtest's quiz", 'returning to the dashboard no longer says "ready"');
    await ctx.close();
    step('Back after creating shows the start page with the quiz under "Your quizzes", not the old builder');
  }

  // ---------- 3. Creator removes a player mid-quiz; 4. creator deletes the quiz mid-quiz ----------
  {
    const q = await makeQuiz('Rina');
    const { ctx, page } = await ctxPage(phone(390), 'removed');
    await page.goto(`${BASE}/q/${q.id}`);
    await page.fill('#nick', 'Kai');
    await page.click('form button[type=submit]');
    await page.waitForSelector('.answers');
    await playAnswer(page);
    const owner = await api(`quizzes/${q.id}`, { headers: { 'x-owner': q.ownerToken } });
    assert.equal(owner.data.in_progress, 1);
    // Unfinished players are not on the board; remove by id from the attempts the creator can see after one finishes.
    // Here the creator removes Kai through the API the dashboard uses, so fetch Kai's attempt id from storage.
    const att = await page.evaluate((k) => JSON.parse(localStorage.getItem('kn_att_' + k)), q.id);
    assert.equal((await api(`quizzes/${q.id}/attempts/${att.id}`, { method: 'DELETE', headers: { 'x-owner': q.ownerToken } })).status, 200);
    await page.waitForFunction(() => document.querySelector('.progress span')?.textContent.startsWith('2 /'));
    await page.locator('.answers .opt').first().click();
    await page.waitForSelector('#nick');
    await page.waitForSelector('.toast:not(.hide)');
    assert.match(await page.textContent('.toast'), /reset/);
    step('player removed mid-quiz is sent back to the nickname screen with a message (was: stuck on an error toast)');

    await page.fill('#nick', 'Kai');
    await page.click('form button[type=submit]');
    await page.waitForSelector('.answers');
    await playAnswer(page);
    assert.equal((await api(`quizzes/${q.id}`, { method: 'DELETE', headers: { 'x-owner': q.ownerToken } })).status, 200);
    await page.waitForFunction(() => document.querySelector('.progress span')?.textContent.startsWith('2 /'));
    await page.locator('.answers .opt').first().click();
    await page.waitForSelector('text=Quiz not found');
    await ctx.close();
    step('quiz deleted mid-quiz shows "Quiz not found" (was: stuck on an error toast)');
  }

  // ---------- 5. Reported quiz: friends see it is gone, the creator sees why ----------
  if (LOCAL) {
    const q = await makeQuiz('Hid');
    d1Local(`UPDATE quizzes SET hidden = 1, reports = 3 WHERE id = '${q.id}'`);
    const { ctx, page } = await ctxPage(phone(390), 'hidden');
    await page.goto(`${BASE}/q/${q.id}`);
    await page.waitForSelector('text=Quiz not found');
    await page.evaluate(([qid, tok]) => localStorage.setItem('kn_owner_' + qid, JSON.stringify(tok)), [q.id, q.ownerToken]);
    await page.reload();
    await page.waitForSelector('.notice');
    assert.match(await page.textContent('.notice'), /taken down after several reports/);
    await shot(page, 'e4-owner-hidden');
    await ctx.close();
    step('hidden quiz: takers get "Quiz not found", the creator sees a taken-down notice');
  } else step('hidden quiz: skipped (needs local D1)');
} finally {
  for (const q of created) await api(`quizzes/${q.id}`, { method: 'DELETE', headers: { 'x-owner': q.ownerToken } }).catch(() => {});
  await browser.close();
}

if (errors.length) {
  console.error('Console or asset errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`ALL PASSED, 0 console errors (${created.length} test quizzes deleted)`);
