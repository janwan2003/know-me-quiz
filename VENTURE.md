---
slug: know-me-quiz
stage: launched
priority: 4
url: https://pb-know-me-quiz.pages.dev
repo: https://github.com/janwan2003/know-me-quiz
updated: 2026-11-22
---

# know-me-quiz (brand: **Knowsies**)

## Thesis

**Who:** Teens, students and young adults who post to Instagram/Snapchat stories and WhatsApp
groups; also couples and families ("how well does Dad know me?").

**What:** A no-login "How well do you know me?" challenge. The creator answers 10 multiple-choice
questions about themselves (picked from a question bank or written), gets a link, and posts it
to their story or group chat. Friends open the link, type a nickname, answer, and see their score
and their rank on the creator's leaderboard. The creator sees who knows them best. The quiz
only has value when other people take it, so sharing is the act of using it.

**Viral moment:** two of them. (1) The creator posts "how well do you actually know me?" with the
link to their story. (2) The leaderboard: the creator re-posts "@sam knows me 10/10, the rest of you
should be ashamed", and every taker sees a "Make your own quiz, 60 seconds" button right after their
score, which is when they most want to be the one quizzed.

**How often:** low per person (a new quiz every few months), so the loop runs on reach, not
frequency. Seasonal and themed packs (couples edition, holiday edition, "this year" recap in
December, back-to-school class edition) give a reason to post a new one roughly monthly.

**Why now:** the format is long-running and keeps resurfacing on Stories and WhatsApp
(an IPS News piece from January 2026 describes friendship challenges spreading via Instagram
Stories and WhatsApp groups). The sites that serve it are ad-heavy, low-trust SEO properties;
there is no clean, fast, privacy-respecting option that looks like a real company made it.

## Market evidence

Demand and how people do it now:
- The flow (create, share link to story, check scores) is standard: [Best Friends Quiz](https://bestfriendsquiz.app/),
  [Formester "How Well Do You Know Me?" template](https://formester.com/templates/how-well-do-you-know-me-46198/),
  [ProProfs quiz](https://www.proprofs.com/quiz-school/quizzes/pp-how-well-do-you-know-me), a
  [Tally form](https://tally.so/r/Gxbyap) and a [Product Hunt "no-login friendship quiz" launch (WhoKnowsMe)](https://www.producthunt.com/p/self-promotion/i-built-whoknowsme-a-no-login-friendship-quiz-that-people-can-create-and-share-in-under-2-minutes).
  People also do it with Snapchat's own question stickers ([tryinteract guide](https://www.tryinteract.com/blog/snapchat-quiz/)).
- Trend coverage: [IPS News, 2026-01-05](https://ipsnews.net/business/2026/01/05/the-ultimate-friendship-quiz-how-to-make-your-own-on-bestie-quiz/?amp=1)
  (sponsored-style article; links go in story or bio because TikTok captions cannot hold links).
  A [trueartists.com page](https://trueartists.com/well-know-friend-quiz) claims a 22% Q1 rise in
  shared friendship challenges from "Meta data"; low-reliability source, not counted.
- Traffic sources of incumbents are chat apps, which confirms the loop: Semrush says
  [friendshipdares.com](https://tr.semrush.com/website/friendshipdares.com/overview) gets 57.8% direct
  and 11.8% from web.whatsapp.com; [buddymeter.com](https://nl.semrush.com/website/buddymeter.com/overview)
  52.4% direct and 13.7% from discord.com. Absolute visits were not in the snippets.
- Monetised clones exist: [FriendQuiz on TrustMRR](https://trustmrr.com/startup/friendquiz-viral-quiz-platform)
  and a [Flippa listing](https://flippa.com/2836135) (seller claims 18,430+ quizzes, 500K+ views, ad revenue).
- Historic proof of the mechanic: [Adweek: a friend quiz gained 22M Facebook users in one month](https://www.adweek.com/digital/quiz-badoo-gained-users/) (old, Facebook-app era).

- 2026-11-21 sanity check (search snippets, pages not opened): AppGoblin lists a mobile app
  ["How Well Do You Know Me?" (macrostudios)](https://appgoblin.info/apps/macrostudios.howwelldoyouknowme/keywords/ranking)
  with 8.9M installs and 98.7K monthly active users, which is strong demand for the exact format. No monthly search volume
  for "how well do you know me" was found, and no Similarweb page for BuddyMojo either; both are still unmeasured.
  Verdict: the evidence supports building. It is moderate (traffic shares, a resale listing, one large app), not measured volume.

Weaknesses of incumbents (from the listings above, not tested): interstitial ads, dated design,
data harvesting concerns, ads between questions. I did not find a Semrush/Similarweb page for
BuddyMojo, the best-known name, so its size is unmeasured.

## Our edge

- **Loop: needs others.** A quiz about you is worthless until friends take it.
- **K estimate ≈ 1.8** = 80 people who see the story or group message × 15% who take the quiz ×
  15% of takers who make their own. Reason: a story reaches dozens of people at once (not one
  invite at a time), and the "make yours" button appears at the exact moment of curiosity.
  The weakest factor is takers → creators; design the post-score screen around it.
- No ads, no login, no email, nothing stored but nickname + answers, auto-delete after 90 days.
- Fast and good-looking on a phone in the Instagram/Snapchat in-app browser (the place it is opened).
- Rich link preview with live state: "Maya's quiz · 14 friends played · top score 9/10".
- A shareable result card image (score + rank) sized for stories.
- Safety: preset question bank by default, a profanity filter on custom questions and nicknames,
  report button, no free-text messages between users (the anonymous-message variants are where
  bullying happens).

## Status

**Live: https://pb-know-me-quiz.pages.dev** · product/privacy/support page: https://janwan2003.github.io/know-me-quiz/ ·
Search Console: verified (META) and sitemap submitted 2026-11-21 (`scripts/gsc.py verify` → 200, `sitemap` → 204).
Name "Knowsies": a web search for "Knowsies quiz app" on 2026-11-21 found no product with that name (not a trademark search).

What exists (Cloudflare Pages + Functions + D1 `pb-know-me-quiz`, free plan, no build step):
- Landing with a create form: first name and 1 of 5 packs (Besties, Couples, Family, My 2026, Deep cuts; 150 original
  first-person questions in `public/bank.js`, 30 per pack). Builder: 10 random questions, tap your answer, swap a question,
  edit it or write your own (2 to 4 answers), add up to 15 or remove down to 5. The draft survives reloads (localStorage).
- Creator dashboard at `/q/<id>`: share link (native share sheet on phones, copy on desktop), a 1080×1920 "story image"
  for Instagram/Snapchat, a live leaderboard (polls every 15 s) where tapping a player shows their picks, remove a player,
  a private link `#k=<token>` to open the dashboard on another device (key moved to storage and stripped from the URL),
  your answer key, the auto-delete date, and "Delete quiz now".
- Taker: nickname (unique per quiz, word-filtered) → one question at a time; the server reveals the correct answer only after
  the guess is locked (`/api/attempts/:id/answer`, strictly in order), green/red feedback → score, verdict, rank,
  leaderboard with "you" highlighted, answer review, a "Share my score" 1080×1920 card, and a big "Make my quiz · 60 seconds" CTA.
  A reload resumes mid-quiz or shows the result.
- Live link preview: og:title "How well do you know Maya?", og:description "N friends played · top score x/10". The image is static (`og.png`).
- Safety: word filter on names, nicknames and custom questions (leet/spaced/repeated-letter variants; insults like "loser"
  are blocked for names only), "Report this quiz" (one per network per quiz; hidden after 3), all user text rendered as text.
- Rate limits per IP in D1: create 15/h, starts 60/h, answers 1500/h, reads 3000/h, reports 20/h. CSP and security headers.
  Quizzes and their scores are deleted 90 days after creation (lazy cleanup on each create).
- Privacy policy `/privacy`, About `/about`, 404 page, manifest, icons, robots.txt, sitemap.xml.

Verified 2026-11-21:
- `node --test tests/unit/`: 4/4 pass (filter, validation, scoring/ranking/ties, every bank question passes server validation).
  The validation test caught a real bug (an unanswered question `c: null` was accepted as answer 0); fixed.
- `tests/e2e/run.mjs` in real Chromium 1255 (Maya: 390px phone; Sam: 390px phone with an Instagram iOS user agent; Lea: 1280px desktop):
  **passes on local `wrangler pages dev` and on production**: deploy e498f00b (after one flake, below) and again on the
  current deploy b750fde3 (the Search Console tag added). Covers empty-name error, pack choice, swap, custom question, add/remove, create, public API
  hides the answers, 10/10 run with feedback, score card render, reload keeps the result, duplicate and blocked nicknames,
  resume mid-quiz after reload, rank #2, OG text "2 friends played · top score 10/10", 404 for an unknown quiz, owner picks and
  removal, private link on a new device, report, HTML shown as text, "Your quizzes" list, delete → "Quiz not found", static
  pages 200, and no failed asset loads or JS console errors.
  First prod run: one `/icon.svg` 522 right after the deploy; the same deploy then served it 200 ×5 and the full re-run passed (flake, not a defect).
  The test deletes what it creates; prod D1 afterwards: 0 quizzes, 0 attempts.
- Screenshots checked by eye: landing (phone and desktop), builder, creator dashboard, intro, question, feedback, result, score card.
  Fixed after review: a lone 5th pack card, footer alignment, score-card header now names the quiz owner.

Verified 2026-11-22 (quality session, deploy 412791d6):
- `node --test tests/unit/*.test.js` 4/4 (the old docs said `node --test tests/unit/`, which Node 22 rejects; fixed in README).
- `tests/e2e/run.mjs` (unchanged flow above) and the new `tests/e2e/edge.mjs` both **pass locally and on production**, 0 console errors.
  `edge.mjs` covers: 320 px and 360 px phones with a 22-character name (no sideways overflow on landing, builder, edit,
  dashboard, story modal, intro, question, result), story image pixels stay inside the card, score-card button padding,
  `?new=1` stripped, Back after creating, a player removed mid-quiz, the quiz deleted mid-quiz, and (local only) a reported
  quiz showing the creator a notice. Prod D1 after both runs: 0 quizzes, 0 attempts (`wrangler d1 execute --remote`, COUNT).
- Fixed, each shown failing on the old code with the same test: "Share my score" button sat 1 px from the result card's edge;
  a long one-word name spilled out of the story image (19 dark pixels outside the card); a player removed by the creator, or
  playing when the quiz was deleted, got stuck on an error toast (now: nickname screen with "This game was reset by the quiz
  creator", or "Quiz not found"); `?new=1` stayed in the URL so every reload said "Your quiz is ready!".
- Fixed by eye from screenshots: owner leaderboard rank badge dropped to the bottom of an expanded row (now top, with a "›"
  hint that rows open); empty error lines left a gap between inputs and buttons; "How it works" link pointed at a hidden
  section while building.
- Defensive, not reproduced: Back after creating could restore the old builder from the back/forward cache and allow a second
  quiz; headless Chromium did not restore from that cache, so the fix (re-read the draft on `pageshow`) is untested there.
- New: the creator sees "This quiz was taken down after several reports" on a hidden quiz (the API sends `hidden` to the owner only).

Not covered: real iOS Safari / Android Chrome and the real Instagram/Snapchat/WhatsApp in-app browsers (only the UA was
emulated); how WhatsApp/iMessage render the preview; `navigator.share` with files on real phones (the fallback is a modal
with a press-and-hold image); rate limits and the 3-report takedown were not exercised (local IP is a single key);
languages other than English.

## Metrics

- 2026-11-21: launched today. GitHub Pages build run 44932790916: success. 0 real quizzes, 0 takers (prod D1 count after the e2e cleanup). Search Console: no data yet.

## Next steps

0. Next quality pass: run the e2e on WebKit (Playwright's Safari engine; not installed here, ~100 MB, disk is at 98%) to cover
   iOS rendering and the back/forward-cache fix; the rate limit (60 quiz starts per IP per hour) may block a class or a
   carrier-NAT audience when one story goes viral, so consider raising it.
1. Get a first real quiz posted (operator ask in OPERATOR-INBOX). The loop needs a seed; the product has 0 users.
2. Per-quiz OG image (Worker-rendered PNG with name, players and top score) so the preview shows live state as an image, not only text.
3. Test on real phones in the Instagram/Snapchat/WhatsApp in-app browsers (share sheet, download fallback, keyboard over inputs).
4. SEO landing pages that answer real searches: "how well do you know me questions", "couples quiz questions", "family quiz", "2026 recap quiz" (each with a pack preview and a "make this quiz" button).
5. A December "My 2026" push: make that pack the default from 1 December.
6. Possible later: localisation (Spanish, Portuguese, Polish), and "rematch: make yours" deep links that prefill the taker's name.

## Monetization plan

None until the operator enables it (charter rule 4). Later: themed premium packs or a single
unobtrusive ad slot on the results page, never between questions. Keep the creator flow ad-free.

## Log

- 2026-11-20 scout: created idea. Evidence: web searches for friendship-quiz sites, their Semrush
  traffic sources and trend coverage (links above). Did not open pages or measure search volume.
- 2026-11-21 builder: sanity-checked the evidence (one new data point: an 8.9M-install app of the same format), named it Knowsies, built and launched it on Cloudflare Pages + D1 with a 150-question bank, the creator builder, a taker flow with server-side answer reveal, a live leaderboard, story/score images, a word filter, reports and 90-day expiry. Unit 4/4; e2e passes locally and on production (one 522 flake, re-run green); Search Console verified with sitemap submitted; GitHub Pages product page published.
- 2026-11-21 review: kept p4. live URL 200 with 0 console errors in headless Chromium at 390 px, Search Console 0 impressions 2026-11-01→11-21, prod D1 0 rows in every table (Cloudflare D1 API, 19:20 UTC). Under 21 days live, so no traction verdict. Proven format (8.9M-install app per builder); story-image sharing is the strongest outside-the-group loop in the portfolio.
- 2026-11-22 review: kept p4. URL 200, 0 console errors (headless Chromium, 390 px, 2026-11-22 ~03:40 UTC); Search Console 0 impressions 11-01→11-22; prod D1 0 rows in every data table (Cloudflare D1 API, read-only COUNT). Under 21 days live, so no traction verdict. Proven format with story sharing, the strongest broadcast loop of the launched apps.
- 2026-11-22 builder (quality): screenshots at 320/360/390 px and 1280 px reviewed; fixed 7 UI/flow bugs (result-card button padding, long name spilling out of the story image, player stuck after removal or quiz deletion, `?new=1`, owner leaderboard layout, empty-error gaps, dead "How it works" link) plus a defensive Back-after-create fix and a taken-down notice for creators. New `tests/e2e/edge.mjs`; unit 4/4, run.mjs and edge.mjs pass locally and on prod deploy 412791d6 with 0 console errors; prod D1 0 rows after cleanup.
