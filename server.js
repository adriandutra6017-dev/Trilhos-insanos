'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'runs.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ runs: [] }, null, 2));
const rate = new Map();
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
function readData() { try { const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); return d && Array.isArray(d.runs) ? d : { runs: [] }; } catch { return { runs: [] }; } }
function writeData(data) { const tmp = DATA_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, DATA_FILE); }
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'" }); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
function cleanName(value) { return String(value || 'Jogador').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'Jogador'; }
function limited(req) { const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim(); const now = Date.now(); const entry = rate.get(ip) || { start: now, count: 0 }; if (now - entry.start > 60000) { entry.start = now; entry.count = 0; } entry.count++; rate.set(ip, entry); return entry.count > 30; }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'Trilhos Insanos leaderboard', week: weekKey() });
  if (req.method === 'GET' && url.pathname === '/api/leaderboards') {
    const wk = weekKey(); const runs = readData().runs.filter(r => r.week === wk);
    const bestScore = new Map(), bestNoCoin = new Map();
    for (const r of runs) { const key = r.name.toLowerCase(); const a = bestScore.get(key); if (!a || r.score > a.value) bestScore.set(key, { name: r.name, value: r.score }); const b = bestNoCoin.get(key); if (!b || r.noCoinSeconds > b.value) bestNoCoin.set(key, { name: r.name, value: r.noCoinSeconds }); }
    const score = [...bestScore.values()].sort((a,b)=>b.value-a.value).slice(0,10);
    const noCoin = [...bestNoCoin.values()].sort((a,b)=>b.value-a.value).slice(0,10);
    return send(res, 200, { week: wk, score, noCoin });
  }
  if (req.method === 'POST' && url.pathname === '/api/runs') {
    if (limited(req)) return send(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
    let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 8192) req.destroy(); });
    req.on('end', () => {
      let body; try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'JSON inválido.' }); }
      const score = Number(body.score), noCoinSeconds = Number(body.noCoinSeconds);
      if (!Number.isFinite(score) || !Number.isFinite(noCoinSeconds) || score < 0 || noCoinSeconds < 0 || score > 100000000 || noCoinSeconds > 86400) return send(res, 400, { error: 'Resultado inválido.' });
      const name = cleanName(body.name); const week = weekKey(); const data = readData();
      const existing = data.runs.find(r => r.week === week && r.name.toLowerCase() === name.toLowerCase());
      if (existing) { existing.score = Math.max(existing.score, Math.floor(score)); existing.noCoinSeconds = Math.max(existing.noCoinSeconds, Math.floor(noCoinSeconds)); existing.updatedAt = new Date().toISOString(); }
      else data.runs.push({ id: crypto.randomUUID(), week, name, score: Math.floor(score), noCoinSeconds: Math.floor(noCoinSeconds), createdAt: new Date().toISOString() });
      // Keep storage bounded while retaining current and recent weeks.
      const keepWeeks = new Set([week]);
      for (let i=1;i<=8;i++) { const d=new Date(); d.setUTCDate(d.getUTCDate()-7*i); keepWeeks.add(weekKey(d)); }
      data.runs = data.runs.filter(r => keepWeeks.has(r.week)).slice(-20000); writeData(data);
      return send(res, 201, { ok: true, week });
    });
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const file = fs.readFileSync(path.join(ROOT, 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'" }); return res.end(file);
  }
  return send(res, 404, { error: 'Não encontrado.' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Trilhos Insanos server rodando em http://localhost:${PORT}`));
