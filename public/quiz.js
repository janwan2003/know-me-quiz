// Quiz page: creator dashboard, taking the quiz one question at a time, results and share cards.
import { $, el, api, store, toast, copyText, shareLink, rememberQuiz, forgetQuiz } from '/common.js';

const id = location.pathname.split('/')[2] || '';
const app = $('#app');
const origin = location.origin;
const quizUrl = `${origin}/q/${id}`;
const params = new URLSearchParams(location.search);

// The creator's secret link is /q/<id>#k=<token>. Move the token into storage and out of the address bar.
const hashKey = new URLSearchParams(location.hash.slice(1)).get('k');
if (hashKey) {
  store.set('kn_owner_' + id, hashKey);
  history.replaceState(null, '', location.pathname + location.search);
}
let ownerToken = store.get('kn_owner_' + id);
let attempt = store.get('kn_att_' + id); // { id, token }
let quiz = null;
let pollTimer = null;

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function loadQuiz() {
  return api(`quizzes/${id}`, { headers: ownerToken ? { 'x-owner': ownerToken } : {} });
}

function notFound(message) {
  document.title = 'Quiz not found · Knowsies';
  app.replaceChildren(
    el('div', { class: 'qhero' }, el('div', { class: 'avatar', text: '?' }), el('h1', { style: 'font-size:2rem', text: 'Quiz not found' }), el('p', { class: 'muted', text: message })),
    el('div', { class: 'cta' }, el('h2', { text: 'Make your own instead' }), el('p', { text: 'Answer 10 questions about yourself and find out who knows you best.' }), el('a', { class: 'btn block', href: '/?from=404', text: 'Make my quiz · 60 seconds' }))
  );
}

function boardList(rows, { meNick, owner } = {}) {
  if (!rows.length) return el('p', { class: 'muted', style: 'margin:0', text: owner ? 'Nobody has played yet. Share your link to get the first score.' : 'Nobody has played yet. Be the first!' });
  return el(
    'ol',
    { class: 'board' },
    ...rows.map((r) => {
      const me = meNick && r.nick.toLowerCase() === meNick.toLowerCase();
      const scoreText = `${r.score}/${quiz.total}`;
      if (owner) {
        const picks = el(
          'ul',
          { class: 'picks' },
          ...quiz.questions.map((q, i) => {
            const ok = r.answers[i] === q.c;
            return el('li', {}, el('span', { class: `tag ${ok ? 'ok' : 'no'}`, text: ok ? '✓' : '✗' }), ` ${q.q} `, el('b', { text: q.a[r.answers[i]] ?? '–' }));
          })
        );
        return el(
          'li',
          {},
          el('span', { class: 'r', text: r.rank }),
          el('details', {}, el('summary', {}, el('span', { class: 'nm', text: r.nick }), el('span', { class: 'sc', text: scoreText })), picks),
          el('button', {
            class: 'x',
            type: 'button',
            title: `Remove ${r.nick}`,
            'aria-label': `Remove ${r.nick}`,
            text: '✕',
            onclick: async () => {
              if (!confirm(`Remove ${r.nick} from your leaderboard?`)) return;
              try {
                await api(`quizzes/${id}/attempts/${r.id}`, { method: 'DELETE', headers: { 'x-owner': ownerToken } });
                toast(`${r.nick} removed.`);
                refreshOwner();
              } catch (e) { toast(e.message); }
            },
          })
        );
      }
      return el('li', { class: me ? 'me' : '' }, el('span', { class: 'r', text: r.rank }), el('span', { class: 'nm', text: me ? `${r.nick} (you)` : r.nick }), el('span', { class: 'sc', text: scoreText }));
    })
  );
}

// ---------- Creator view ----------
function ownerView() {
  document.title = `Your quiz · Knowsies`;
  $('#makeTop').classList.add('hide');
  const fresh = params.get('new') === '1';
  const shareText = `How well do you know me? Take my quiz 👀`;
  const privateUrl = `${quizUrl}#k=${ownerToken}`;
  const linkInput = el('input', { type: 'text', readonly: true, value: quizUrl, 'aria-label': 'Your quiz link', onfocus: (e) => e.target.select() });
  const boardBox = el('div', { id: 'ownerBoard' });
  app.replaceChildren(
    el(
      'div',
      { class: 'qhero' },
      el('div', { class: 'avatar', text: initial(quiz.name) }),
      el('h1', { style: 'font-size:2rem', text: fresh ? 'Your quiz is ready! 🎉' : `${quiz.name}'s quiz` }),
      el('p', { class: 'muted', style: 'margin:0', text: 'Share the link. Scores show up here as your friends play.' })
    ),
    el(
      'div',
      { class: 'card stack', style: 'margin-top:18px' },
      el('label', { for: 'link', text: 'Your quiz link' }),
      el('div', { class: 'share' }, linkInput),
      el(
        'div',
        { class: 'sharebtns' },
        el('button', { class: 'btn', type: 'button', id: 'shareBtn', onclick: () => shareLink(quizUrl, shareText), text: 'Share link' }),
        el('button', { class: 'btn ghost', type: 'button', id: 'storyBtn', onclick: () => storyCard(), text: 'Story image' })
      ),
      el('p', { class: 'small muted', style: 'margin:0', text: 'Posting to Instagram or Snapchat? Save the story image, post it, then add your link with the Link sticker.' })
    ),
    el('div', { class: 'card', style: 'margin-top:14px' }, el('h2', { text: 'Leaderboard' }), boardBox),
    el(
      'div',
      { class: 'card stack', style: 'margin-top:14px' },
      el('h3', { text: 'Your private results link' }),
      el('p', { class: 'small muted', style: 'margin:0', text: 'Open this on another phone or laptop to see your results there. Keep it to yourself: anyone with it can manage your quiz.' }),
      el('button', { class: 'btn line sm', type: 'button', onclick: async () => toast((await copyText(privateUrl)) ? 'Private link copied.' : privateUrl), text: 'Copy private link' })
    ),
    el(
      'details',
      { class: 'card', style: 'margin-top:14px' },
      el('summary', { style: 'font-weight:700;cursor:pointer', text: 'Your answers' }),
      el('ul', { class: 'review', style: 'margin-top:8px' }, ...quiz.questions.map((q) => el('li', {}, el('div', { class: 'rq', text: q.q }), el('div', { class: 'ra', text: q.a[q.c] }))))
    ),
    el(
      'div',
      { class: 'center', style: 'margin-top:18px' },
      el('p', { class: 'small muted', text: `This quiz and its scores are deleted automatically on ${new Date(quiz.expires_at * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.` }),
      el('button', {
        class: 'btn danger sm',
        type: 'button',
        text: 'Delete quiz now',
        onclick: async () => {
          if (!confirm('Delete this quiz and every score? This cannot be undone.')) return;
          try {
            await api(`quizzes/${id}`, { method: 'DELETE', headers: { 'x-owner': ownerToken } });
            store.del('kn_owner_' + id);
            forgetQuiz(id);
            location.href = '/';
          } catch (e) { toast(e.message); }
        },
      })
    )
  );
  linkInput.id = 'link';
  renderOwnerBoard();
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshOwner(); }, 15000);
}

function renderOwnerBoard() {
  const box = $('#ownerBoard');
  if (!box) return;
  const extra = quiz.in_progress ? el('p', { class: 'small muted', style: 'margin:10px 0 0', text: `${plural(quiz.in_progress, 'friend is', 'friends are')} playing right now.` }) : null;
  box.replaceChildren(boardList(quiz.board, { owner: true }), extra || '');
}

async function refreshOwner() {
  try {
    quiz = await loadQuiz();
    renderOwnerBoard();
  } catch {}
}

// ---------- Taker: intro ----------
function introView() {
  document.title = `How well do you know ${quiz.name}? · Knowsies`;
  $('#reportBtn').classList.remove('hide');
  const nick = el('input', { type: 'text', id: 'nick', maxlength: '20', autocomplete: 'nickname', placeholder: 'e.g. Sam', enterkeyhint: 'go' });
  const err = el('p', { class: 'err', role: 'alert' });
  const btn = el('button', { class: 'btn block', type: 'submit', text: 'Start the quiz' });
  const form = el(
    'form',
    {
      class: 'card stack',
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const v = nick.value.trim();
        if (!v) { err.textContent = 'Type a nickname so you show up on the leaderboard.'; nick.focus(); return; }
        btn.disabled = true;
        btn.textContent = 'Starting…';
        err.textContent = '';
        try {
          const res = await api(`quizzes/${id}/attempts`, { method: 'POST', body: { nick: v } });
          attempt = { id: res.id, token: res.token, nick: v };
          store.set('kn_att_' + id, attempt);
          playView({ answered: 0, score: 0, results: [] });
        } catch (e2) {
          err.textContent = e2.message;
          btn.disabled = false;
          btn.textContent = 'Start the quiz';
        }
      },
    },
    el('div', {}, el('label', { for: 'nick', text: 'Your nickname' }), nick),
    err,
    btn
  );
  const stats = [plural(quiz.total, 'question', 'questions'), quiz.plays ? plural(quiz.plays, 'friend played', 'friends played') : 'Be the first to play'];
  if (quiz.plays) stats.push(`Top score ${quiz.top}/${quiz.total}`);
  app.replaceChildren(
    el(
      'div',
      { class: 'qhero' },
      el('div', { class: 'avatar', text: initial(quiz.name) }),
      el('h1', { style: 'font-size:2.1rem' }, `How well do you know ${quiz.name}?`),
      el('div', { class: 'stats' }, ...stats.map((s) => el('span', { text: s })))
    ),
    form,
    quiz.plays ? el('div', { class: 'card', style: 'margin-top:14px' }, el('h3', { text: 'Leaderboard' }), boardList(quiz.board.slice(0, 10))) : ''
  );
}

// ---------- Taker: playing ----------
function playView(state) {
  let i = state.answered;
  let score = state.score;
  const results = [...state.results];
  $('#reportBtn').classList.remove('hide');

  const render = () => {
    const q = quiz.questions[i];
    const feedback = el('p', { class: 'feedback', 'aria-live': 'polite' });
    const answers = el('div', { class: 'answers' });
    let locked = false;
    q.a.forEach((text, k) => {
      answers.append(
        el('button', {
          type: 'button',
          class: 'opt',
          text,
          onclick: async (e) => {
            if (locked) return;
            locked = true;
            answers.classList.add('locked');
            e.currentTarget.setAttribute('aria-pressed', 'true');
            try {
              const res = await api(`attempts/${attempt.id}/answer`, { method: 'POST', headers: { 'x-token': attempt.token }, body: { i, choice: k } });
              const buttons = answers.querySelectorAll('.opt');
              buttons[res.c].classList.add('right');
              if (!res.correct) buttons[k].classList.add('wrong');
              feedback.className = `feedback ${res.correct ? 'good' : 'bad'}`;
              feedback.textContent = res.correct ? pick(['Nailed it!', 'Correct!', 'Yes!', 'You know it!']) : `Nope, it's “${q.a[res.c]}”.`;
              score = res.score;
              results.push({ choice: k, c: res.c });
              setTimeout(() => {
                if (res.done) resultView(res);
                else { i += 1; render(); window.scrollTo({ top: 0 }); }
              }, res.correct ? 900 : 1500);
            } catch (err) {
              if (err.status === 409) return resume();
              locked = false;
              answers.classList.remove('locked');
              e.currentTarget.setAttribute('aria-pressed', 'false');
              toast(err.message);
            }
          },
        })
      );
    });
    app.replaceChildren(
      el(
        'div',
        { class: 'play' },
        el('div', { class: 'progress' }, el('span', { text: `${i + 1} / ${quiz.total}` }), el('div', { class: 'meter', 'aria-hidden': 'true' }, el('i', { style: `width:${(i / quiz.total) * 100}%` })), el('span', { text: `${score} ✓` })),
        el('p', { class: 'muted small', style: 'margin:0 0 4px;font-weight:700', text: `${quiz.name} says…` }),
        el('h2', { text: q.q }),
        answers,
        feedback
      )
    );
  };
  render();
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- Taker: result ----------
function resultView(res) {
  document.title = `${res.score}/${res.total} · How well do you know ${quiz.name}?`;
  $('#reportBtn').classList.remove('hide');
  $('#makeTop').classList.add('hide');
  const rankText = res.rank ? `#${res.rank} of ${plural(res.of, 'player', 'players')}` : '';
  const review = el(
    'ul',
    { class: 'review' },
    ...quiz.questions.map((q, i) => {
      const r = res.results[i];
      const ok = r && r.choice === r.c;
      return el(
        'li',
        {},
        el('div', { class: 'rq' }, el('span', { class: `tag ${ok ? 'ok' : 'no'}`, text: ok ? '✓' : '✗' }), ` ${q.q}`),
        el('div', { class: 'ra', text: ok ? q.a[r.c] : `${quiz.name}: ${q.a[r.c]} · you: ${q.a[r.choice]}` })
      );
    })
  );
  const boardBox = el('div', {}, el('div', { class: 'spinner', style: 'margin:20px auto' }));
  app.replaceChildren(
    el(
      'div',
      { class: 'score card' },
      el('p', { class: 'muted', style: 'margin:0 0 6px;font-weight:700', text: `You know ${quiz.name}` }),
      el('div', { class: 'big' }, String(res.score), el('small', { text: `/${res.total}` })),
      el('p', { class: 'verdict', text: res.verdict }),
      rankText ? el('p', { class: 'muted', style: 'margin:0 0 14px', text: rankText }) : '',
      el('button', { class: 'btn block ghost', type: 'button', onclick: () => resultCard(res), text: 'Share my score' })
    ),
    el(
      'div',
      { class: 'cta', style: 'margin-top:14px' },
      el('h2', { text: "Now it's your turn" }),
      el('p', { text: `Make your own quiz and see if ${quiz.name} knows you as well as you know them.` }),
      el('a', { class: 'btn block', href: `/?from=${id}`, id: 'makeOwn', text: 'Make my quiz · 60 seconds' })
    ),
    el('div', { class: 'card', style: 'margin-top:14px' }, el('h3', { text: `${quiz.name}'s leaderboard` }), boardBox),
    el('details', { class: 'card', style: 'margin-top:14px' }, el('summary', { style: 'font-weight:700;cursor:pointer', text: 'See all answers' }), el('div', { style: 'margin-top:8px' }, review))
  );
  loadQuiz()
    .then((q) => { quiz = q; boardBox.replaceChildren(boardList(quiz.board.slice(0, 50), { meNick: res.nick })); })
    .catch(() => boardBox.replaceChildren(el('p', { class: 'muted', text: 'Could not load the leaderboard.' })));
}

// ---------- Story images (1080×1920) ----------
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function canvasBase() {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1080, 1920);
  g.addColorStop(0, '#5b3df5');
  g.addColorStop(0.55, '#8a4df2');
  g.addColorStop(1, '#ff6b5e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 90, 380, 900, 1060, 64);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  return { c, ctx };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function footer(ctx, line1, header = 'How well do you know me?') {
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(line1, 540, 1580);
  ctx.font = `600 40px ${FONT}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(quizUrl.replace(/^https?:\/\//, ''), 540, 1650);
  ctx.globalAlpha = 1;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('Knowsies', 540, 1800);
  ctx.font = `800 52px ${FONT}`;
  wrapLines(ctx, header, 900).slice(0, 2).forEach((l, k, all) => ctx.fillText(l, 540, 250 - (all.length - 1) * 33 + k * 66));
}

function storyCard() {
  const { c, ctx } = canvasBase();
  ctx.fillStyle = '#efebff';
  ctx.beginPath();
  ctx.arc(540, 560, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b3df5';
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText(initial(quiz.name), 540, 603);
  ctx.fillStyle = '#1c1a2e';
  ctx.font = `900 96px ${FONT}`;
  wrapLines(ctx, `How well do you know ${quiz.name}?`, 780).slice(0, 3).forEach((l, k) => ctx.fillText(l, 540, 820 + k * 110));
  ctx.fillStyle = '#807c96';
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText(`${quiz.total} questions · about a minute`, 540, 1180);
  ctx.fillStyle = '#ff6b5e';
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText('Prove it 👀', 540, 1320);
  footer(ctx, 'Tap the link to play');
  showImage(c, `knowsies-${id}-story.png`, 'Post this to your story, then add your quiz link with the Link sticker.', `How well do you know me? Take my quiz 👀 ${quizUrl}`);
}

function resultCard(res) {
  const { c, ctx } = canvasBase();
  ctx.fillStyle = '#807c96';
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(`I know ${quiz.name}`, 540, 560);
  const g = ctx.createLinearGradient(300, 0, 780, 0);
  g.addColorStop(0, '#5b3df5');
  g.addColorStop(1, '#ff6b5e');
  ctx.fillStyle = g;
  ctx.font = `900 300px ${FONT}`;
  ctx.fillText(`${res.score}/${res.total}`, 540, 860);
  ctx.fillStyle = '#1c1a2e';
  ctx.font = `800 58px ${FONT}`;
  wrapLines(ctx, res.verdict, 760).slice(0, 2).forEach((l, k) => ctx.fillText(l, 540, 1010 + k * 72));
  if (res.rank) {
    ctx.fillStyle = '#efebff';
    roundRect(ctx, 290, 1200, 500, 110, 55);
    ctx.fill();
    ctx.fillStyle = '#5b3df5';
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText(`#${res.rank} of ${res.of}`, 540, 1273);
  }
  footer(ctx, 'Can you beat me?', `How well do you know ${quiz.name}?`);
  showImage(c, `knowsies-${id}-score.png`, 'Share it to your story or the group chat.', `I got ${res.score}/${res.total} on ${quiz.name}'s quiz. Can you beat me? ${quizUrl}`);
}

function showImage(canvas, filename, hint, text) {
  const url = canvas.toDataURL('image/png');
  const close = () => modal.remove();
  const shareBtn = el('button', {
    class: 'btn block',
    type: 'button',
    text: 'Share image',
    onclick: () =>
      canvas.toBlob(async (blob) => {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); } catch {}
        } else {
          const a = el('a', { href: url, download: filename });
          document.body.append(a);
          a.click();
          a.remove();
          toast('Image saved. If nothing happened, press and hold the image to save it.');
        }
      }, 'image/png'),
  });
  const modal = el(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Share image', onclick: (e) => { if (e.target === modal) close(); } },
    el(
      'div',
      { class: 'card stack' },
      el('img', { src: url, alt: 'Share image preview' }),
      el('p', { class: 'small muted', style: 'margin:8px 0 0', text: `${hint} On iPhone you can also press and hold the image to save it.` }),
      shareBtn,
      el('button', { class: 'btn line block', type: 'button', onclick: async () => toast((await copyText(text)) ? 'Text and link copied.' : text), text: 'Copy text + link' }),
      el('button', { class: 'linkbtn', type: 'button', onclick: close, text: 'Close' })
    )
  );
  document.body.append(modal);
}

// ---------- Report ----------
$('#reportBtn').addEventListener('click', async () => {
  if (!confirm('Report this quiz as mean, unsafe or spam? Quizzes with several reports are taken down.')) return;
  try {
    await api(`quizzes/${id}/report`, { method: 'POST', body: {} });
    toast('Thanks. We got your report.');
  } catch (e) { toast(e.message); }
});

// ---------- Boot ----------
async function resume() {
  try {
    const st = await api(`attempts/${attempt.id}`, { headers: { 'x-token': attempt.token } });
    if (st.done) resultView(st);
    else playView(st);
  } catch (e) {
    if (e.status === 404) {
      store.del('kn_att_' + id);
      attempt = null;
      introView();
    } else if (e.status === 410) notFound(e.message);
    else toast(e.message);
  }
}

async function boot() {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return notFound('Check the link and try again.');
  try {
    quiz = await loadQuiz();
  } catch (e) {
    if (e.status === 404 || e.status === 410) return notFound(e.message);
    app.replaceChildren(el('div', { class: 'qhero' }, el('h2', { text: 'Could not load the quiz' }), el('p', { class: 'muted', text: e.message }), el('button', { class: 'btn', type: 'button', onclick: () => location.reload(), text: 'Try again' })));
    return;
  }
  if (quiz.owner) {
    rememberQuiz({ id, name: quiz.name, at: Date.now() });
    return ownerView();
  }
  if (ownerToken) { store.del('kn_owner_' + id); ownerToken = null; }
  if (attempt) return resume();
  introView();
}

boot();
