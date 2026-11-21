// Serves the quiz page with a live link preview: "How well do you know Maya? · 14 friends played · top score 9/10".
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL('/q', url.origin));
  let html = await page.text();
  let title = 'How well do you know me? · Knowsies';
  let desc = 'Take my quiz and see where you land on the leaderboard. No app, no sign-up.';
  let status = 200;
  try {
    const id = String(params.id || '');
    const q = /^[A-Za-z0-9]{6,16}$/.test(id) && (await env.DB.prepare('SELECT id, name, questions, hidden FROM quizzes WHERE id = ?1').bind(id).first());
    if (q && !q.hidden) {
      const total = JSON.parse(q.questions).length;
      const row = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(score) AS top FROM attempts WHERE quiz_id = ?1 AND done = 1').bind(id).first();
      title = `How well do you know ${q.name}?`;
      const played = row.n === 0 ? 'Be the first to play' : row.n === 1 ? '1 friend played' : `${row.n} friends played`;
      const top = row.n ? ` · top score ${row.top}/${total}` : '';
      desc = `${played}${top}. ${total} questions about ${q.name}, about a minute. No app, no sign-up.`;
    } else {
      title = 'Quiz not found · Knowsies';
      desc = 'This quiz does not exist or has expired. Make your own in 60 seconds.';
      status = 404;
    }
  } catch (e) {
    console.error(e);
  }
  const meta = `<title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Knowsies">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${url.origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(url.origin + url.pathname)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="noindex">`;
  html = html.replace('<!--META-->', meta);
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
