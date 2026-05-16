window.renderArtMatchCard = function (m) {
  const band = (m.match_band || 'Weak').toLowerCase();
  const score = m.match_score == null ? '—' : Math.round(m.match_score);
  const ev = typeof m.evidence === 'string' ? JSON.parse(m.evidence || '{}') : (m.evidence || {});
  const div = document.createElement('div');
  div.className = `art-card ${band}`;
  div.innerHTML = `
    <div class="header">
      <div class="score ${band === 'strong' ? 'strong' : ''}">${score}</div>
      <div>
        <div class="sponsor">${escape(m.sponsor_name || '')} <span class="component">${escape(m.sponsor_component || '')}</span></div>
        <div class="band ${band === 'strong' ? 'strong' : ''}">${m.match_band || 'Weak'}</div>
      </div>
    </div>
    <div class="row"><span class="key">Priority alignment</span><span>${Math.round(m.sub_score_priority || 0)}</span></div>
    <div class="row"><span class="key">Transition history</span><span>${Math.round(m.sub_score_transition || 0)} (${(ev.transition_history || {}).count || 0} Phase III, $${formatUsd((ev.transition_history || {}).total_usd || 0)})</span></div>
    <div class="row"><span class="key">Active scouting (≤90d)</span><span>${Math.round(m.sub_score_scouting || 0)} (${((ev.active_scouting || {}).notices || []).length} notices)</span></div>
    <div class="row"><span class="key">Tech maturity fit</span><span>${Math.round(m.sub_score_maturity || 0)}</span></div>
    <div class="row"><span class="key">Recency boost</span><span>${Math.round(m.sub_score_recency || 0)}</span></div>
    <div class="card-actions">
      <button class="btn" data-action="why">Why this?</button>
      <button class="btn" data-action="sam">Open SAM.gov</button>
      <button class="btn primary" data-action="pursue">Add to Sponsor Pipeline</button>
      <button class="btn danger" data-action="wrong">This sponsor is wrong</button>
    </div>
    <div class="art-reveal" data-reveal></div>`;
  div.querySelector('[data-action="sam"]').addEventListener('click', () => {
    if (window.openExternalNotice) window.openExternalNotice('Open SAM.gov', m.sponsor_url || '');
  });
  div.querySelector('[data-action="why"]').addEventListener('click', async () => {
    const r = await fetch(`/api/why/art/${encodeURIComponent(m.id)}`);
    const j = await r.json();
    if (j.why) window.openWhyPanel(j.why);
  });
  div.querySelector('[data-action="pursue"]').addEventListener('click', async () => {
    await fetch('/api/sponsor-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase_ii_tech_id: m.phase_ii_tech_id, sponsor_id: m.sponsor_candidate_id }) });
    window.app && window.app.refreshAll && window.app.refreshAll();
  });
  div.querySelector('[data-action="wrong"]').addEventListener('click', async () => {
    const reason = prompt('Why is this sponsor wrong?');
    if (reason == null) return;
    await fetch(`/api/art-matches/${encodeURIComponent(m.id)}/disagree`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    window.app && window.app.refreshAll && window.app.refreshAll();
  });
  setTimeout(() => {
    const target = div.querySelector('[data-reveal]');
    if (target && window.scoreReveal) window.scoreReveal(target, {
      sub_scores: {
        priority_alignment: m.sub_score_priority,
        transition_history: m.sub_score_transition,
        active_scouting: m.sub_score_scouting,
        tech_maturity_fit: m.sub_score_maturity,
        recency_boost: m.sub_score_recency,
      },
      weights: { priority_alignment: 0.35, transition_history: 0.25, active_scouting: 0.20, tech_maturity_fit: 0.10, recency_boost: 0.10 },
      composite: m.match_score,
      band: m.match_band,
    });
  }, 50);
  return div;
};

function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function formatUsd(n) { if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'; if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'; return String(n); }
