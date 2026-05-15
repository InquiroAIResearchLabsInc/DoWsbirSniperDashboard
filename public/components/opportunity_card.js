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
      <button class="btn" data-action="dsip">Open in DSIP →</button>
      <button class="btn dismiss" data-action="dismiss" title="Hide this for 30 days">Dismiss</button>
    </div>`;
  div.querySelector('[data-action="why"]').addEventListener('click', async () => {
    const r = await fetch(`/api/why/topic/${encodeURIComponent(opp.id)}`);
    const j = await r.json();
    if (j.why) window.openWhyPanel(j.why);
  });
  div.querySelector('[data-action="pipeline"]').addEventListener('click', () => {
    if (window.openPipelineModal) window.openPipelineModal(opp);
  });
  div.querySelector('[data-action="dismiss"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    const r = await fetch(`/api/opportunities/${encodeURIComponent(opp.id)}/dismiss`, { method: 'POST' });
    if (r.ok) {
      div.remove();
      if (window.app && window.app.refreshAll) window.app.refreshAll();
    } else {
      btn.disabled = false;
    }
  });
  // "Open in DSIP" — the preview runs on sample topics, so a card cannot
  // deep-link to a real solicitation. Explain the feature in a popup instead.
  div.querySelector('[data-action="dsip"]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.openDsipNotice) window.openDsipNotice(opp);
  });
  return div;
};

function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
