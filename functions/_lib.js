// Shared logic for the Knowsies API (pure functions, unit-tested in tests/unit).

export const QUESTION_COUNT = { min: 5, max: 15 };
export const MAX_TAKERS = 500;
export const EXPIRE_DAYS = 90;

// A short blocklist for names, nicknames and custom questions. Each whitespace-separated word is
// lower-cased, de-accented, de-leeted (0->o, 1->i, ...) and stripped of punctuation ("b.i.t.c.h" -> "bitch").
// SUBSTR fragments match anywhere inside a word, WORDS only as the whole word (or plural),
// MILD only in strict mode (names and nicknames, where they are aimed at a person).
const SUBSTR = [
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'nigg', 'retard', 'porn', 'nazi', 'hitler', 'killyourself',
  'tranny', 'wank', 'twat', 'bastard', 'asshole', 'motherf', 'dildo', 'faggot', 'kurwa', 'pierdol', 'jebac', 'scheiss',
];
const WORDS = ['dick', 'cock', 'fag', 'rape', 'kys', 'penis', 'vagina', 'boob', 'tits', 'sex', 'sexy', 'nude', 'kike', 'spic', 'chink', 'paki', 'puta', 'mierda', 'chuj', 'cum', 'horny'];
const MILD = ['ugly', 'fat', 'fatass', 'loser', 'stupid', 'idiot', 'dumb', 'dumbass', 'moron', 'freak', 'weirdo'];
// Harmless words that contain a SUBSTR fragment.
const ALLOW = ['scunthorpe', 'shitake', 'shiitake', 'swank', 'swanky'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

export function normalise(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0134578@$!]/g, (c) => LEET[c] || c);
}

export function isBlocked(text, strict = false) {
  const tokens = normalise(text)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter(Boolean);
  // "f u c k" -> also check "fuck"; "fuuuck" -> also check "fuck".
  const singles = tokens.filter((t) => t.length === 1).join('');
  const all = [...tokens, singles, ...tokens.map((t) => t.replace(/(.)\1+/g, '$1'))].filter(Boolean);
  if (/kill\s*(your)?self|go\s*die|unalive/.test(tokens.join(' '))) return true;
  for (const t of all) {
    if (ALLOW.includes(t)) continue;
    if (SUBSTR.some((bad) => t.includes(bad))) return true;
    const base = t.endsWith('s') ? t.slice(0, -1) : t;
    if (WORDS.includes(t) || WORDS.includes(base)) return true;
    if (strict && (MILD.includes(t) || MILD.includes(base))) return true;
  }
  return false;
}

export function clean(v, max) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Validates a creator's questions. Returns { questions } or { error }.
export function validateQuestions(input) {
  if (!Array.isArray(input)) return { error: 'Questions are missing.' };
  if (input.length < QUESTION_COUNT.min) return { error: `Pick at least ${QUESTION_COUNT.min} questions.` };
  if (input.length > QUESTION_COUNT.max) return { error: `At most ${QUESTION_COUNT.max} questions.` };
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const item = input[i] || {};
    const q = clean(item.q, 90);
    if (q.length < 3) return { error: `Question ${i + 1} is empty.` };
    if (!Array.isArray(item.a) || item.a.length < 2 || item.a.length > 4) return { error: `Question ${i + 1} needs 2 to 4 answers.` };
    const a = item.a.map((x) => clean(x, 40));
    if (a.some((x) => !x)) return { error: `Question ${i + 1} has an empty answer.` };
    if (new Set(a.map((x) => x.toLowerCase())).size !== a.length) return { error: `Question ${i + 1} has the same answer twice.` };
    const c = typeof item.c === "number" ? item.c : NaN;
    if (!Number.isInteger(c) || c < 0 || c >= a.length) return { error: `Pick your answer for question ${i + 1}.` };
    if (isBlocked(q) || a.some(isBlocked)) return { error: `Question ${i + 1} has a word we don't allow. Keep it friendly.` };
    out.push({ q, a, c });
  }
  return { questions: out };
}

// Scores an attempt's answers against the quiz questions.
export function score(questions, answers) {
  let n = 0;
  for (let i = 0; i < answers.length && i < questions.length; i++) if (answers[i] === questions[i].c) n++;
  return n;
}

// Leaderboard order: higher score first, then whoever finished first. Ranks are shared on ties.
export function rankBoard(rows) {
  const sorted = [...rows].sort((x, y) => y.score - x.score || x.done_at - y.done_at);
  let rank = 0;
  let prev = null;
  return sorted.map((r, i) => {
    if (r.score !== prev) {
      rank = i + 1;
      prev = r.score;
    }
    return { ...r, rank };
  });
}

// One short verdict per score band, shown to the taker and on their result card.
export function verdict(scoreValue, total) {
  const p = total ? scoreValue / total : 0;
  if (p === 1) return 'Soulmate level. You know them inside out.';
  if (p >= 0.8) return 'Best-friend material.';
  if (p >= 0.6) return 'You know them pretty well.';
  if (p >= 0.4) return 'Getting there. Time to hang out more.';
  if (p >= 0.2) return 'Hmm. Do you two actually talk?';
  return 'Total stranger energy.';
}
