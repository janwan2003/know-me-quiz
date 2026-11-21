// Knowsies API: create a quiz, take it one answer at a time, leaderboard, owner tools, reports.
import { clean, isBlocked, validateQuestions, score, rankBoard, verdict, MAX_TAKERS, EXPIRE_DAYS } from '../_lib.js';

const PACKS = ['friends', 'couples', 'family', 'year', 'deep', 'custom'];
const LIMITS = {
  create: [15, 3600], // new quizzes per IP per hour
  attempt: [60, 3600], // quiz starts per IP per hour
  write: [1500, 3600], // answers, deletes per IP per hour
  read: [3000, 3600], // state reads per IP per hour
  report: [20, 3600],
};
const REPORTS_TO_HIDE = 3;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const err = (status, message) => json({ error: message }, status);
const now = () => Math.floor(Date.now() / 1000);

function randomId(len) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ipOf = (request) => request.headers.get('cf-connecting-ip') || 'local';

// Fixed-window counter per IP and action. Returns the new count.
async function bump(env, key, windowSec) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, n, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT(k) DO UPDATE SET
       n = CASE WHEN reset_at < ?3 THEN 1 ELSE n + 1 END,
       reset_at = CASE WHEN reset_at < ?3 THEN ?2 ELSE reset_at END
     RETURNING n`
  )
    .bind(key, t + windowSec, t)
    .first();
  return row ? row.n : 0;
}
async function limited(env, request, action) {
  const [max, windowSec] = LIMITS[action];
  return (await bump(env, action + ':' + ipOf(request), windowSec)) > max;
}

// Quizzes older than EXPIRE_DAYS are deleted with their attempts; stale rate rows go too.
async function cleanup(env) {
  const t = now();
  const old = t - EXPIRE_DAYS * 86400;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE created_at < ?1)').bind(old),
    env.DB.prepare('DELETE FROM quizzes WHERE created_at < ?1').bind(old),
    env.DB.prepare('DELETE FROM rate WHERE reset_at < ?1').bind(t),
  ]);
}

async function body(request) {
  try {
    const text = await request.text();
    if (text.length > 30000) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

async function loadQuiz(env, id) {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id || '')) return null;
  const q = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?1').bind(id).first();
  if (!q) return null;
  q.questions = JSON.parse(q.questions);
  return q;
}

async function isOwner(request, quiz) {
  const token = request.headers.get('x-owner');
  return !!token && (await sha256(token)) === quiz.owner_hash;
}

async function loadAttempt(env, request, aid) {
  if (!/^[A-Za-z0-9]{6,20}$/.test(aid || '')) return null;
  const token = request.headers.get('x-token');
  if (!token) return null;
  const a = await env.DB.prepare('SELECT * FROM attempts WHERE id = ?1').bind(aid).first();
  if (!a || a.token_hash !== (await sha256(token))) return null;
  a.answers = JSON.parse(a.answers);
  return a;
}

async function board(env, quiz) {
  const { results } = await env.DB.prepare(
    'SELECT id, nick, score, answers, done_at FROM attempts WHERE quiz_id = ?1 AND done = 1 ORDER BY score DESC, done_at ASC LIMIT ?2'
  )
    .bind(quiz.id, MAX_TAKERS)
    .all();
  return rankBoard(results);
}

async function quizView(env, request, quiz) {
  const owner = await isOwner(request, quiz);
  const ranked = await board(env, quiz);
  const total = quiz.questions.length;
  const view = {
    id: quiz.id,
    name: quiz.name,
    pack: quiz.pack,
    total,
    created_at: quiz.created_at,
    expires_at: quiz.created_at + EXPIRE_DAYS * 86400,
    plays: ranked.length,
    top: ranked.length ? ranked[0].score : null,
    owner,
    questions: quiz.questions.map((x) => (owner ? x : { q: x.q, a: x.a })),
    board: ranked.map((r) => ({
      nick: r.nick,
      score: r.score,
      rank: r.rank,
      ...(owner ? { id: r.id, answers: JSON.parse(r.answers) } : {}),
    })),
  };
  if (owner) {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ?1 AND done = 0').bind(quiz.id).first();
    view.in_progress = row.n;
  }
  return view;
}

function attemptView(quiz, a, ranked) {
  const total = quiz.questions.length;
  const view = {
    id: a.id,
    nick: a.nick,
    answered: a.answers.length,
    total,
    score: a.score,
    done: !!a.done,
    // Correct answers are revealed only for questions this taker has already answered.
    results: a.answers.map((choice, i) => ({ choice, c: quiz.questions[i].c })),
  };
  if (a.done) {
    const me = ranked.find((r) => r.id === a.id);
    view.rank = me ? me.rank : null;
    view.of = ranked.length;
    view.verdict = verdict(a.score, total);
  }
  return view;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;
  try {
    // POST /api/quizzes
    if (parts.length === 1 && parts[0] === 'quizzes' && method === 'POST') {
      if (await limited(env, request, 'create')) return err(429, 'Too many quizzes from this network. Try again in an hour.');
      const b = await body(request);
      if (!b) return err(400, 'Bad request.');
      const name = clean(b.name, 24);
      if (name.length < 1) return err(400, 'Type your name first.');
      if (isBlocked(name, true)) return err(400, "That name has a word we don't allow.");
      const pack = PACKS.includes(b.pack) ? b.pack : 'custom';
      const v = validateQuestions(b.questions);
      if (v.error) return err(400, v.error);
      context.waitUntil(cleanup(env).catch(() => {}));
      const id = randomId(8);
      const token = randomId(24);
      await env.DB.prepare('INSERT INTO quizzes (id, owner_hash, name, pack, questions, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(id, await sha256(token), name, pack, JSON.stringify(v.questions), now())
        .run();
      return json({ id, ownerToken: token }, 201);
    }

    // /api/quizzes/:id...
    if (parts[0] === 'quizzes' && parts[1]) {
      const quiz = await loadQuiz(env, parts[1]);
      if (!quiz) return err(404, 'This quiz does not exist or has expired.');
      if (quiz.hidden && !(await isOwner(request, quiz))) return err(410, 'This quiz was removed after reports.');

      if (parts.length === 2 && method === 'GET') {
        if (await limited(env, request, 'read')) return err(429, 'Slow down a little.');
        return json(await quizView(env, request, quiz));
      }

      if (parts.length === 2 && method === 'DELETE') {
        if (!(await isOwner(request, quiz))) return err(403, 'Only the creator can delete this quiz.');
        await env.DB.batch([
          env.DB.prepare('DELETE FROM attempts WHERE quiz_id = ?1').bind(quiz.id),
          env.DB.prepare('DELETE FROM quizzes WHERE id = ?1').bind(quiz.id),
        ]);
        return json({ ok: true });
      }

      if (parts.length === 3 && parts[2] === 'attempts' && method === 'POST') {
        if (await limited(env, request, 'attempt')) return err(429, 'Too many tries from this network. Try again later.');
        const b = await body(request);
        if (!b) return err(400, 'Bad request.');
        const nick = clean(b.nick, 20);
        if (nick.length < 1) return err(400, 'Type a nickname first.');
        if (isBlocked(nick, true)) return err(400, "That nickname has a word we don't allow.");
        const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ?1').bind(quiz.id).first();
        if (count.n >= MAX_TAKERS) return err(409, 'This quiz is full.');
        const id = randomId(12);
        const token = randomId(24);
        try {
          await env.DB.prepare('INSERT INTO attempts (id, quiz_id, nick, nick_key, token_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
            .bind(id, quiz.id, nick, nick.toLowerCase(), await sha256(token), now())
            .run();
        } catch (e) {
          if (String(e).includes('UNIQUE')) return err(409, 'Someone already played with that nickname. Pick another.');
          throw e;
        }
        return json({ id, token }, 201);
      }

      if (parts.length === 4 && parts[2] === 'attempts' && method === 'DELETE') {
        if (!(await isOwner(request, quiz))) return err(403, 'Only the creator can remove players.');
        await env.DB.prepare('DELETE FROM attempts WHERE id = ?1 AND quiz_id = ?2').bind(parts[3], quiz.id).run();
        return json({ ok: true });
      }

      if (parts.length === 3 && parts[2] === 'report' && method === 'POST') {
        if (await limited(env, request, 'report')) return err(429, 'Too many reports.');
        // One report per network per quiz.
        const n = await bump(env, `rq:${quiz.id}:${ipOf(request)}`, EXPIRE_DAYS * 86400);
        if (n === 1) {
          await env.DB.prepare('UPDATE quizzes SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ?2 THEN 1 ELSE hidden END WHERE id = ?1')
            .bind(quiz.id, REPORTS_TO_HIDE)
            .run();
        }
        return json({ ok: true });
      }
    }

    // /api/attempts/:aid and /api/attempts/:aid/answer
    if (parts[0] === 'attempts' && parts[1]) {
      const a = await loadAttempt(env, request, parts[1]);
      if (!a) return err(404, 'Attempt not found.');
      const quiz = await loadQuiz(env, a.quiz_id);
      if (!quiz) return err(404, 'This quiz does not exist or has expired.');
      if (quiz.hidden) return err(410, 'This quiz was removed after reports.');

      if (parts.length === 2 && method === 'GET') {
        if (await limited(env, request, 'read')) return err(429, 'Slow down a little.');
        return json(attemptView(quiz, a, a.done ? await board(env, quiz) : []));
      }

      if (parts.length === 3 && parts[2] === 'answer' && method === 'POST') {
        if (await limited(env, request, 'write')) return err(429, 'Slow down a little.');
        const b = await body(request);
        if (!b) return err(400, 'Bad request.');
        const i = Number(b.i);
        const choice = Number(b.choice);
        if (a.done) return err(409, 'You already finished this quiz.');
        if (i !== a.answers.length) return err(409, 'Answer the questions in order.');
        const q = quiz.questions[i];
        if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.a.length) return err(400, 'Pick one of the answers.');
        const answers = [...a.answers, choice];
        const s = score(quiz.questions, answers);
        const done = answers.length === quiz.questions.length ? 1 : 0;
        const res = await env.DB.prepare('UPDATE attempts SET answers = ?1, score = ?2, done = ?3, done_at = ?4 WHERE id = ?5 AND answers = ?6')
          .bind(JSON.stringify(answers), s, done, done ? now() : null, a.id, JSON.stringify(a.answers))
          .run();
        if (!res.meta.changes) return err(409, 'That question was already answered.');
        Object.assign(a, { answers, score: s, done });
        const view = attemptView(quiz, a, done ? await board(env, quiz) : []);
        return json({ ...view, correct: choice === q.c, c: q.c });
      }
    }

    return err(404, 'Not found.');
  } catch (e) {
    console.error(e);
    return err(500, 'Something went wrong. Try again.');
  }
}
