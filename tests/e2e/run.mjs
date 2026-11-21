// End-to-end test in real Chromium: create a quiz, two friends play, owner tools, link preview, delete.
// Usage: BASE=http://localhost:8823 node tests/e2e/run.mjs   (BASE defaults to the local dev server)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8823';
const SHOTS = process.env.SHOTS || 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome` });
const errors = [];
const IG_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function ctxPage(opts = {}, label = 'page') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  // API 4xx answers are expected in the negative tests (they log "Failed to load resource");
  // any failed asset (script, style, image) is still an error.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`${label}: ${m.text()}`); });
  page.on('response', (r) => { const u = new URL(r.url()); if (r.status() >= 400 && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/q/')) errors.push(`${label}: ${r.status()} ${u.pathname}`); });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log('✓', msg);

// ---------- Creator builds a quiz on a phone ----------
const { page: maya } = await ctxPage(phone, 'maya');
await maya.goto(BASE + '/');
await shot(maya, '01-landing-phone');
await maya.click('#startForm button[type=submit]');
assert.match(await maya.textContent('#startErr'), /first name/);
await maya.fill('#name', 'Maya');
await maya.click('[data-pack="couples"]');
await maya.click('#startForm button[type=submit]');
await maya.waitForSelector('#build:not(.hide)');
assert.equal(await maya.locator('.qcard').count(), 10);
assert.equal(await maya.isDisabled('#createBtn'), true);
step('builder opened with 10 questions, create disabled');

const q1 = await maya.locator('.qcard h3').first().textContent();
await maya.locator('.qcard').first().getByText('↻ Swap question').click();
assert.notEqual(await maya.locator('.qcard h3').first().textContent(), q1);
// Write a custom question in slot 2.
await maya.locator('.qcard').nth(1).getByText('✎ Edit').click();
const edit = maya.locator('.qcard').nth(1);
await edit.locator('input').nth(0).fill("What's my dream city?");
for (const [k, v] of ['Paris', 'Tokyo', 'Lima', ''].entries()) await edit.locator('input').nth(k + 1).fill(v);
await edit.getByText('Done').click();
assert.equal(await maya.locator('.qcard h3').nth(1).textContent(), "What's my dream city?");
assert.equal(await maya.locator('.qcard').nth(1).locator('.opt').count(), 3);
// Add then remove a question.
await maya.click('#addQ');
assert.equal(await maya.locator('.qcard').count(), 11);
await maya.locator('.qcard').nth(10).getByText('Remove').click();
assert.equal(await maya.locator('.qcard').count(), 10);
step('swap, custom question, add and remove work');

for (let i = 0; i < 10; i++) await maya.locator('.qcard').nth(i).locator('.opt').nth(i % 2).click();
await shot(maya, '02-builder-phone');
assert.equal(await maya.isDisabled('#createBtn'), false);
await maya.click('#createBtn');
await maya.waitForURL(/\/q\/[A-Za-z0-9]+\?new=1/);
const id = new URL(maya.url()).pathname.split('/')[2];
await maya.waitForSelector('text=Your quiz is ready');
await shot(maya, '03-owner-new-phone');
const ownerToken = await maya.evaluate((qid) => JSON.parse(localStorage.getItem('kn_owner_' + qid)), id);
assert.ok(ownerToken);
step(`quiz ${id} created, owner view shown`);

const ownerApi = async (path) => (await fetch(`${BASE}/api/${path}`, { headers: { 'x-owner': ownerToken } })).json();
const full = await ownerApi(`quizzes/${id}`);
assert.equal(full.questions[1].q, "What's my dream city?");
assert.deepEqual(full.questions.map((q) => q.c), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
const publicView = await (await fetch(`${BASE}/api/quizzes/${id}`)).json();
assert.ok(publicView.questions.every((q) => q.c === undefined), 'public view must not leak answers');
step('answers stored; public API hides them');

// ---------- Sam plays in an Instagram in-app browser and gets 10/10 ----------
const { page: sam } = await ctxPage({ ...phone, userAgent: IG_UA }, 'sam');
await sam.goto(`${BASE}/q/${id}`);
await sam.waitForSelector('#nick');
assert.match(await sam.textContent('h1'), /How well do you know Maya\?/);
await shot(sam, '04-intro-phone');
await sam.fill('#nick', 'Sam');
await sam.click('text=Start the quiz');
for (let i = 0; i < 10; i++) {
  await sam.waitForSelector(`.progress >> text="${i + 1} / 10"`);
  if (i === 0) await shot(sam, '05-question-phone');
  await sam.locator('.answers .opt').nth(full.questions[i].c).click();
  await sam.waitForSelector('.feedback.good');
  if (i === 0) await shot(sam, '06-feedback-phone');
}
await sam.waitForSelector('.score .big');
assert.match(await sam.textContent('.score .big'), /^10\/10/);
assert.match(await sam.textContent('.score'), /#1 of 1 player/);
assert.equal(await sam.getAttribute('#makeOwn', 'href'), `/?from=${id}`);
await sam.waitForSelector('.board li.me');
await shot(sam, '07-result-phone');
await sam.click('text=Share my score');
await sam.waitForSelector('.modal img');
await shot(sam, '08-score-card-phone');
const cardSrc = await sam.getAttribute('.modal img', 'src');
fs.writeFileSync(`${SHOTS}/09-score-card.png`, Buffer.from(cardSrc.split(',')[1], 'base64'));
await sam.click('.modal >> text=Close');
// Reload keeps the result.
await sam.reload();
await sam.waitForSelector('.score .big');
step('Sam: 10/10, rank #1, result card, result survives reload');

// ---------- Lea plays on desktop, resumes after reload ----------
const { page: lea } = await ctxPage({ viewport: { width: 1280, height: 860 } }, 'lea');
await lea.goto(`${BASE}/q/${id}`);
await lea.fill('#nick', 'sam');
await lea.click('text=Start the quiz');
await lea.waitForSelector('text=already played with that nickname');
await lea.fill('#nick', 'loser');
await lea.click('text=Start the quiz');
await lea.waitForSelector("text=nickname has a word we don't allow");
await lea.fill('#nick', 'Lea');
await lea.click('text=Start the quiz');
const wrong = (q) => (q.c + 1) % q.a.length;
for (let i = 0; i < 3; i++) {
  await lea.waitForSelector(`.progress >> text="${i + 1} / 10"`);
  await lea.locator('.answers .opt').nth(i === 0 ? full.questions[0].c : wrong(full.questions[i])).click();
  await lea.waitForSelector(i === 0 ? '.feedback.good' : '.feedback.bad');
}
await lea.waitForSelector('.progress >> text="4 / 10"');
await lea.reload();
await lea.waitForSelector('.progress >> text="4 / 10"');
await shot(lea, '10-question-desktop');
for (let i = 3; i < 10; i++) {
  await lea.waitForSelector(`.progress >> text="${i + 1} / 10"`);
  await lea.locator('.answers .opt').nth(wrong(full.questions[i])).click();
  await lea.waitForSelector('.feedback.bad');
}
await lea.waitForSelector('.score .big');
assert.match(await lea.textContent('.score .big'), /^1\/10/);
assert.match(await lea.textContent('.score'), /#2 of 2 players/);
await lea.waitForSelector('.board li.me');
await shot(lea, '11-result-desktop');
step('Lea: duplicate and blocked nicknames rejected, resume after reload, 1/10 rank #2');

// ---------- Link preview ----------
const html = await (await fetch(`${BASE}/q/${id}`)).text();
assert.match(html, /<meta property="og:title" content="How well do you know Maya\?">/);
assert.match(html, /og:description" content="2 friends played · top score 10\/10\. 10 questions/);
const missing = await fetch(`${BASE}/q/zzzzzzzz`);
assert.equal(missing.status, 404);
step('OG preview shows live count and top score; unknown quiz is 404');

// ---------- Owner dashboard ----------
await maya.goto(`${BASE}/q/${id}`);
await maya.waitForSelector('#ownerBoard .board');
assert.equal(await maya.locator('#ownerBoard .board > li').count(), 2);
assert.match(await maya.locator('#ownerBoard .board > li').first().textContent(), /Sam.*10\/10/);
await maya.locator('#ownerBoard summary').first().click();
await shot(maya, '12-owner-board-phone');
await maya.locator('#ownerBoard .x').nth(1).click();
await maya.waitForFunction(() => document.querySelectorAll('#ownerBoard .board > li').length === 1);
step('owner sees scores and picks, removes Lea');

// Private link on a fresh device.
const { page: maya2 } = await ctxPage({ viewport: { width: 1280, height: 860 } }, 'maya2');
await maya2.goto(`${BASE}/q/${id}#k=${ownerToken}`);
await maya2.waitForSelector('#ownerBoard');
assert.equal(new URL(maya2.url()).hash, '');
await shot(maya2, '13-owner-desktop');
step('private link opens the dashboard on another device and strips the key from the URL');

// Report from a taker page.
await lea.goto(`${BASE}/q/${id}`);
await lea.waitForSelector('#reportBtn:not(.hide)');
await lea.click('#reportBtn');
await lea.waitForSelector('text=We got your report');
step('report accepted');

// HTML in names is shown as text.
const evil = await (await fetch(`${BASE}/api/quizzes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: '<img src=x onerror=alert(1)>', questions: Array.from({ length: 5 }, (_, i) => ({ q: `<b>Q${i}</b>`, a: ['<i>a</i>', 'b'], c: 0 })) }),
})).json();
await lea.goto(`${BASE}/q/${evil.id}`);
await lea.waitForSelector('#nick');
assert.match(await lea.textContent('h1'), /<img src=x/);
assert.equal(await lea.locator('main img').count(), 0);
await fetch(`${BASE}/api/quizzes/${evil.id}`, { method: 'DELETE', headers: { 'x-owner': evil.ownerToken } });
step('HTML in names and questions renders as text');

// Landing lists "Your quizzes" for the creator.
await maya.goto(BASE + '/');
await maya.waitForSelector('#mine:not(.hide)');
await shot(maya, '14-landing-returning-phone');

// Delete.
await maya.goto(`${BASE}/q/${id}`);
await maya.waitForSelector('text=Delete quiz now');
await maya.click('text=Delete quiz now');
await maya.waitForURL(BASE + '/');
await sam.goto(`${BASE}/q/${id}`);
await sam.waitForSelector('text=Quiz not found');
await shot(sam, '15-not-found-phone');
step('delete removes the quiz; link shows "Quiz not found"');

// Static pages.
for (const p of ['/privacy', '/about', '/og.png', '/icon-180.png', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest']) {
  const r = await fetch(BASE + p);
  assert.equal(r.status, 200, p);
}
const { page: desk } = await ctxPage({ viewport: { width: 1280, height: 860 } }, 'desk');
await desk.goto(BASE + '/');
await shot(desk, '16-landing-desktop');
await desk.goto(BASE + '/privacy');
await shot(desk, '17-privacy-desktop');
step('static pages 200');

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ALL PASSED, 0 console errors');
