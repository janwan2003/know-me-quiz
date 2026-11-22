// Landing page and quiz builder.
import { $, el, api, store, myQuizzes, rememberQuiz } from '/common.js';
import { PACKS } from '/bank.js';

const START_COUNT = 10;
const MIN = 5;
const MAX = 15;

let draft = store.get('kn_draft') || { name: '', pack: 'friends', questions: [], step: 'start' };
const save = () => store.set('kn_draft', draft);
const packOf = (id) => PACKS.find((p) => p.id === id) || PACKS[0];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks a question from the pack that is not on the list yet.
function freshQuestion() {
  const pack = packOf(draft.pack);
  const used = new Set(draft.questions.map((q) => q.q));
  const pool = pack.questions.filter((x) => !used.has(x.q));
  const all = pool.length ? pool : PACKS.flatMap((p) => p.questions).filter((x) => !used.has(x.q));
  const pick = all[Math.floor(Math.random() * all.length)];
  return { q: pick.q, a: [...pick.a], c: null };
}

// ---------- Start step ----------
function renderPacks() {
  const box = $('#packs');
  box.replaceChildren(
    ...PACKS.map((p) =>
      el(
        'button',
        { type: 'button', class: 'pack', 'aria-pressed': String(p.id === draft.pack), 'data-pack': p.id, onclick: () => { draft.pack = p.id; save(); renderPacks(); } },
        el('span', { class: 'e', 'aria-hidden': 'true', text: p.emoji }),
        el('b', { text: p.name }),
        el('small', { text: p.blurb })
      )
    )
  );
}

function renderMine() {
  const list = myQuizzes();
  $('#mine').classList.toggle('hide', !list.length);
  $('#mineList').replaceChildren(
    ...list.map((q) => el('a', { href: `/q/${q.id}` }, el('span', { text: `${q.name}'s quiz` }), el('span', { class: 'muted small', text: 'See results →' })))
  );
}

$('#startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#name').value.trim().replace(/\s+/g, ' ');
  if (!name) {
    $('#startErr').textContent = 'Type your first name so friends know whose quiz it is.';
    $('#name').focus();
    return;
  }
  $('#startErr').textContent = '';
  const packChanged = draft.builtPack !== draft.pack;
  draft.name = name;
  if (!draft.questions.length || packChanged) {
    draft.questions = [];
    shuffle(packOf(draft.pack).questions)
      .slice(0, START_COUNT)
      .forEach((x) => draft.questions.push({ q: x.q, a: [...x.a], c: null }));
    draft.builtPack = draft.pack;
  }
  draft.step = 'build';
  save();
  show();
  window.scrollTo(0, 0);
});

// ---------- Build step ----------
function questionCard(item, i) {
  const card = el('div', { class: 'card qcard', 'data-i': i });
  if (item.editing) {
    const qIn = el('input', { type: 'text', maxlength: '90', value: item.q, 'aria-label': 'Question', placeholder: 'Your question, e.g. What is my dream job?' });
    const aIns = [0, 1, 2, 3].map((k) =>
      el('input', { type: 'text', maxlength: '40', value: item.a[k] || '', 'aria-label': `Answer ${k + 1}`, placeholder: k < 2 ? `Answer ${k + 1}` : `Answer ${k + 1} (optional)` })
    );
    const err = el('p', { class: 'err', role: 'alert' });
    const done = () => {
      const q = qIn.value.trim();
      const a = aIns.map((x) => x.value.trim()).filter(Boolean);
      if (q.length < 3) return (err.textContent = 'Write a question first.');
      if (a.length < 2) return (err.textContent = 'Give at least two answers.');
      if (new Set(a.map((x) => x.toLowerCase())).size !== a.length) return (err.textContent = 'Two answers are the same.');
      const prevAnswer = item.c !== null ? item.a[item.c] : null;
      item.q = q;
      item.a = a;
      const keep = prevAnswer !== null ? a.indexOf(prevAnswer) : -1;
      item.c = keep >= 0 ? keep : null;
      item.editing = false;
      save();
      renderBuild();
    };
    card.append(
      el('span', { class: 'qn', text: `Question ${i + 1} · editing` }),
      el('div', { class: 'qedit', style: 'margin-top:8px' }, qIn, el('div', { class: 'row2' }, ...aIns), el('p', { class: 'hint', text: "Write it about yourself, like “What's my dream job?”. Then tap your answer." }), err),
      el('div', { class: 'qtools' }, el('button', { type: 'button', class: 'btn sm', onclick: done, text: 'Done' }))
    );
    return card;
  }
  card.append(
    el('span', { class: 'qn', text: `Question ${i + 1}` }),
    el('h3', { text: item.q }),
    el(
      'div',
      { class: 'opts' },
      ...item.a.map((ans, k) =>
        el('button', {
          type: 'button',
          class: 'opt',
          'aria-pressed': String(item.c === k),
          text: ans,
          onclick: () => { item.c = k; save(); renderBuild(); },
        })
      )
    ),
    el(
      'div',
      { class: 'qtools' },
      el('button', { type: 'button', class: 'btn ghost sm', onclick: () => { draft.questions[i] = freshQuestion(); save(); renderBuild(); }, text: '↻ Swap question' }),
      el('button', { type: 'button', class: 'btn ghost sm', onclick: () => { item.editing = true; save(); renderBuild(); }, text: '✎ Edit' }),
      draft.questions.length > MIN
        ? el('button', { type: 'button', class: 'btn line sm', 'aria-label': `Remove question ${i + 1}`, onclick: () => { draft.questions.splice(i, 1); save(); renderBuild(); }, text: 'Remove' })
        : null
    )
  );
  return card;
}

function renderBuild() {
  const qs = draft.questions;
  $('#buildTitle').textContent = `Hi ${draft.name}! Answer for yourself`;
  $('#qlist').replaceChildren(...qs.map(questionCard));
  const answered = qs.filter((q) => q.c !== null && !q.editing).length;
  $('#doneCount').textContent = `${answered} of ${qs.length} answered`;
  $('#meterFill').style.width = `${(answered / qs.length) * 100}%`;
  $('#createBtn').disabled = answered !== qs.length;
  $('#createBtn').textContent = answered === qs.length ? 'Create my quiz' : `Answer ${qs.length - answered} more`;
  $('#addQ').classList.toggle('hide', qs.length >= MAX);
}

$('#addQ').addEventListener('click', () => {
  if (draft.questions.length >= MAX) return;
  draft.questions.push(freshQuestion());
  save();
  renderBuild();
  const cards = document.querySelectorAll('.qcard');
  cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#backBtn').addEventListener('click', () => { draft.step = 'start'; save(); show(); });

$('#createBtn').addEventListener('click', async () => {
  const btn = $('#createBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  $('#buildErr').textContent = '';
  try {
    const res = await api('quizzes', {
      method: 'POST',
      body: { name: draft.name, pack: draft.pack, questions: draft.questions.map(({ q, a, c }) => ({ q, a, c })) },
    });
    store.set('kn_owner_' + res.id, res.ownerToken);
    rememberQuiz({ id: res.id, name: draft.name, at: Date.now() });
    store.del('kn_draft');
    location.href = `/q/${res.id}?new=1`;
  } catch (e) {
    $('#buildErr').textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Create my quiz';
  }
});

function show() {
  const building = draft.step === 'build' && draft.questions.length;
  $('#start').classList.toggle('hide', !!building);
  $('#how').classList.toggle('hide', !!building);
  $('#build').classList.toggle('hide', !building);
  $('#howLink').classList.toggle('hide', !!building);
  if (building) renderBuild();
  else { $('#name').value = draft.name || ''; renderPacks(); renderMine(); }
}

const params = new URLSearchParams(location.search);
if (params.get('pack') && PACKS.some((p) => p.id === params.get('pack'))) draft.pack = params.get('pack');
if (params.get('from')) draft.step = 'start';
show();
if (params.get('from')) setTimeout(() => $('#name').focus(), 50);
// Back from a quiz page restores this page from the back/forward cache with the old in-memory draft.
// Re-read it from storage so a quiz that was already created cannot be submitted twice.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  draft = store.get('kn_draft') || { name: draft.name, pack: draft.pack, questions: [], step: 'start' };
  const btn = $('#createBtn');
  btn.textContent = 'Create my quiz';
  show();
});
