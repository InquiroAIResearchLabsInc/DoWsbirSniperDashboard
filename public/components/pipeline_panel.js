window.renderPipelinePanel = function (rows) {
  const frag = document.createDocumentFragment();
  const TERMINAL = ['awarded', 'rejected', 'withdrawn', 'no_response'];
  const STATUSES = ['watching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn', 'no_response'];

  // Learnings entry — the feedback loop, one tap away.
  const bar = document.createElement('div');
  bar.className = 'pipeline-toolbar';
  bar.innerHTML = `<button class="btn" data-act="learnings">View Learnings →</button>`;
  bar.querySelector('[data-act="learnings"]').addEventListener('click', () => {
    if (window.openLearningsModal) window.openLearningsModal();
  });
  frag.appendChild(bar);

  if (!rows || !rows.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '13px';
    empty.textContent = 'No tracked opportunities yet. Add one from Topics to start the loop.';
    frag.appendChild(empty);
    return frag;
  }

  for (const p of rows) {
    const div = document.createElement('div');
    div.className = 'card pipeline-card';
    const dd = p.days_to_deadline;
    const ddTxt = dd == null ? '' : (dd < 0 ? `closed ${-dd}d ago` : `${dd}d left`);
    const ddCls = dd == null ? '' : (dd < 0 ? 'critical' : dd < 7 ? 'critical' : dd < 14 ? 'warning' : 'ok');
    const fund = p.funding_amount ? `$${Number(p.funding_amount).toLocaleString()}` : '';
    const opts = STATUSES.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('');
    div.innerHTML = `
      <div class="pipeline-title">${escape(p.title)}</div>
      <div class="opp-meta">
        <span class="badge">${escape(p.source)}</span>
        ${p.component ? `<span class="badge">${escape(p.component)}</span>` : ''}
        ${p.score_tier ? `<span class="badge">${escape(p.score_tier)}</span>` : ''}
        ${ddTxt ? `<span class="deadline ${ddCls}">${escape(ddTxt)}</span>` : ''}
        ${fund ? `<span class="badge">${escape(fund)}</span>` : ''}
      </div>
      ${p.notes ? `<div class="pipeline-notes">${escape(p.notes)}</div>` : ''}
      <div class="pipeline-actions">
        <select class="pipeline-status" aria-label="pipeline status">${opts}</select>
        ${p.is_terminal && p.has_outcome ? '<span class="outcome-done">✓ outcome recorded</span>' : ''}
        ${p.is_terminal && !p.has_outcome ? '<button class="btn" data-act="outcome">Record outcome</button>' : ''}
      </div>`;

    const sel = div.querySelector('.pipeline-status');
    sel.addEventListener('change', async () => {
      const v = sel.value;
      if (TERMINAL.includes(v)) {
        if (window.openOutcomeModal) window.openOutcomeModal(Object.assign({}, p, { status: v }));
      } else {
        await fetch(`/api/pipeline/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: v }),
        });
        if (window.app && window.app.refreshAll) window.app.refreshAll();
      }
    });
    const ob = div.querySelector('[data-act="outcome"]');
    if (ob) ob.addEventListener('click', () => { if (window.openOutcomeModal) window.openOutcomeModal(p); });

    frag.appendChild(div);
  }
  return frag;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
