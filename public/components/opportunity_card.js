window.renderOpportunityCard = function (opp) {
  const tier = (opp.score_tier || 'SKIP').toLowerCase();
  const score = opp.fit_score == null ? '—' : Math.round(opp.fit_score);
  const deadlineCls = opp.days_remaining == null ? '' : (opp.days_remaining < 7 ? 'critical' : opp.days_remaining < 14 ? 'warning' : 'ok');
  const deadlineTxt = opp.days_remaining == null ? (opp.is_rolling ? 'Rolling' : '—') : `${opp.days_remaining}d`;
  const matched = (opp.keywords_matched || []).slice(0, 5).map(k => `<span class="kw-tag">${escape(k)}</span>`).join('');
  const div = document.createElement('div');
  div.className = `card opp ${tier}`;
  div.innerHTML = `
    <div class="card-top">
      <div>
        <span class="tier-badge ${tier}">${escape(opp.score_tier || 'SKIP')}</span>
        <span class="deadline ${deadlineCls}" style="margin-left:8px">${escape(deadlineTxt)}</span>
      </div>
      <div class="score-num ${tier}">${score}</div>
    </div>
    <div class="opp-title">${escape(opp.title || '')}</div>
    <div class="opp-meta">
      <span class="badge">${escape(opp.component || 'unknown')}</span>
      <span class="badge">${escape(opp.program || '')}</span>
      <span class="badge">${escape(opp.phase || '')}</span>
    </div>
    <div class="kw-tags">${matched}</div>
    <div class="card-actions">
      <button class="btn" data-action="why">Why this?</button>
      <button class="btn primary" data-action="pipeline">Add to Pipeline</button>
      <a class="btn" data-action="dsip" href="${escape(dsipUrl(opp))}" target="_blank" rel="noopener noreferrer">Open in DSIP →</a>
    </div>`;
  div.querySelector('[data-action="why"]').addEventListener('click', async () => {
    const r = await fetch(`/api/why/topic/${encodeURIComponent(opp.id)}`);
    const j = await r.json();
    if (j.why) window.openWhyPanel(j.why);
  });
  div.querySelector('[data-action="pipeline"]').addEventListener('click', () => {
    if (window.openPipelineModal) window.openPipelineModal(opp);
  });
  return div;
};

// "Open in DSIP" must never 404. Use the opportunity's source URL only when it
// is a real absolute link; otherwise fall back to the DoD SBIR/STTR Innovation
// Portal topics app, which always resolves.
function dsipUrl(opp) {
  const DSIP = 'https://www.dodsbirsttr.mil/topics-app/';
  const u = opp && opp.source_url;
  return (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) ? u.trim() : DSIP;
}

function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
