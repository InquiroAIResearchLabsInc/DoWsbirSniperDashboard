const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');

const FIXTURE_PATH = path.join(config.ROOT, 'tests', 'fixtures', 'sam_sources_sought_sample.json');
const NINETY_DAYS_MS = 90 * 86400 * 1000;

function loadFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) return { notices: [] };
  try { return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')); } catch { return { notices: [] }; }
}

function relevance(notice, sponsor, tech_keywords) {
  const text = `${notice.title || ''} ${notice.synopsis || ''}`.toLowerCase();
  const techs = (tech_keywords || []).map(t => t.toLowerCase()).filter(Boolean);
  // Relevance is driven by tech_keywords. A notice is only "active scouting for this tech"
  // when at least one of the tech's keywords appears in the notice text. Sponsor priority
  // tags do not earn relevance on their own — otherwise an off-topic Phase II tech could
  // inherit credit from the sponsor's general posture.
  if (techs.length === 0) return 0;
  let hits = 0;
  for (const t of techs) if (text.includes(t)) hits++;
  return hits;
}

function scoreFor({ sponsor, tech_keywords, tenant_id = 'default', use_fixture = config.SAM_USE_FIXTURE }) {
  if (!use_fixture && config.SAM_API_KEY) {
    emitReceipt('sam_live_attempted', { tenant_id, sponsor_id: sponsor.id });
  }
  const data = loadFixture();
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const relevant = (data.notices || []).filter(n => {
    if (n.sponsor_id && n.sponsor_id !== sponsor.id && n.component && n.component !== sponsor.component) return false;
    if (n.sponsor_id !== sponsor.id && n.component !== sponsor.component) return false;
    const d = Date.parse(n.posted_date || '');
    if (Number.isNaN(d) || d < cutoff) return false;
    return relevance(n, sponsor, tech_keywords) > 0;
  });

  const count = relevant.length;
  let score = 0;
  if (count >= 3) score = 100;
  else if (count === 2) score = 75;
  else if (count === 1) score = 50;
  else score = 0;

  emitReceipt('scouting_signals_computed', {
    tenant_id,
    sponsor_id: sponsor.id,
    component: sponsor.component,
    relevant_count: count,
    score,
    source_mode: use_fixture ? 'fixture' : 'live',
  });

  return {
    score,
    relevant_notices: relevant.map(n => ({
      title: n.title,
      posted_date: n.posted_date,
      url: n.url,
      notice_id: n.notice_id,
      notice_type: n.notice_type,
    })),
    has_signal: count > 0,
  };
}

module.exports = { scoreFor };
