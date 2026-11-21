// Shared helpers for Knowsies pages.
export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch('/api/' + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('No connection. Check your internet and try again.'), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

// localStorage can throw in some in-app browsers and private modes; fall back to memory.
const mem = {};
export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v === null ? mem[k] ?? null : JSON.parse(v); } catch { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch {} },
};

let toastTimer;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.remove('hide');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hide'), 2600);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = el('textarea', { style: 'position:fixed;opacity:0' });
  ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

// Native share sheet on phones; copy on desktop.
export async function shareLink(url, text) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  toast((await copyText(text ? `${text} ${url}` : url)) ? 'Link copied. Paste it in your story or group chat.' : 'Copy the link above.');
}

// Quizzes this browser created: [{id, name, token, at}]
export const myQuizzes = () => store.get('kn_mine') || [];
export function rememberQuiz(entry) {
  const list = myQuizzes().filter((q) => q.id !== entry.id);
  list.unshift(entry);
  store.set('kn_mine', list.slice(0, 20));
}
export function forgetQuiz(id) { store.set('kn_mine', myQuizzes().filter((q) => q.id !== id)); }
