const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../core/config');
const { getDb } = require('../../db');
const { getCopy } = require('../../core/copy');
const { emitReceipt } = require('../../core/receipt');
const demo = require('../../auth/demo_token');

const router = express.Router();

const LANDING_PATH = path.join(config.ROOT, 'public', 'landing.html');

function renderLanding() {
  let html = fs.readFileSync(LANDING_PATH, 'utf8');
  const keys = ['product_tagline', 'readme_positioning'];
  for (const k of keys) {
    const v = getCopy(k);
    html = html.split(`{{${k}}}`).join(escapeHtml(v));
  }
  return html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getToken(req) {
  if (req.query && req.query.token) return String(req.query.token);
  if (req.query && req.query.t) return String(req.query.t);
  return null;
}

router.get('/', (req, res) => {
  const token = getToken(req);
  if (token) {
    const v = demo.verify(token);
    if (v.ok) {
      emitReceipt('landing_token_redirect', { tenant_id: v.tenant_id, role: v.role });
      return res.redirect(302, `/dashboard?t=${encodeURIComponent(token)}`);
    }
  }
  emitReceipt('landing_page_view', {
    tenant_id: 'public',
    referrer: req.headers['referer'] || null,
    user_agent: (req.headers['user-agent'] || '').slice(0, 200),
    had_invalid_token: !!token,
  });
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderLanding());
});

router.get('/api/stats', (req, res) => {
  const db = getDb();
  const topicsScored = db.prepare("SELECT COUNT(*) c FROM scores WHERE tenant_id != 'sandbox'").get().c;
  const components = db.prepare("SELECT COUNT(DISTINCT component) c FROM opportunities WHERE component IS NOT NULL").get().c;
  const artMatches = db.prepare("SELECT COUNT(*) c FROM art_matches WHERE tenant_id != 'sandbox'").get().c;
  res.json({
    topics_scored: topicsScored,
    components,
    art_matches: artMatches,
  });
});

module.exports = { router, renderLanding };
