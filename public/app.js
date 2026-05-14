(function () {
  const state = { tab: 'topics', tenant: null, role: null };

  async function api(p, opts) { const r = await fetch(p, opts); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); }

  async function loadCopy() {
    try {
      const r = await fetch('/api/admin/stats');
      // tagline + headers via getCopy keys are surfaced inline via API for now.
      const tagline = await fetch('/docs/copy/product_tagline.md').then(r => r.ok ? r.text() : '');
      document.getElementById('product-tagline').textContent = stripHeading(tagline) || '<PLACEHOLDER_PRODUCT_TAGLINE>';
    } catch { document.getElementById('product-tagline').textContent = '<PLACEHOLDER_PRODUCT_TAGLINE>'; }
  }

  function stripHeading(s) {
    return (s || '').split('\n').filter(l => !l.startsWith('#') && !l.includes('<!--') && !l.includes('-->') && l.trim()).join(' ').trim();
  }

  async function refreshHeaderStats() {
    try {
      const stats = await api('/api/admin/stats');
      document.getElementById('stat-pipeline').textContent = stats.pipeline || 0;
      document.getElementById('stat-art').textContent = stats.art_matches || 0;
    } catch {}
    try {
      const opps = await api('/api/opportunities?tier=SNIPER');
      const snipers = (opps.opportunities || []).filter(o => o.score_tier === 'SNIPER').length;
      const evals = (opps.opportunities || []).filter(o => o.score_tier === 'EVALUATE').length;
      const closing = (opps.opportunities || []).filter(o => o.days_remaining != null && o.days_remaining <= 14).length;
      document.getElementById('stat-snipers').textContent = snipers;
      document.getElementById('stat-evaluates').textContent = evals;
      document.getElementById('stat-closing').textContent = closing;
    } catch {}
    try {
      const v = await api('/api/receipts/verify');
      document.getElementById('footer-chain').textContent = v.ok ? `ok (n=${v.count})` : 'BROKEN';
      const m = await api('/api/receipts/merkle');
      document.getElementById('footer-merkle').textContent = (m.merkle_root || '—').slice(0, 16) + '…';
    } catch {}
  }

  async function whoami() {
    try {
      const me = await api('/api/whoami');
      state.tenant = me.tenant_id; state.role = me.role;
      document.getElementById('footer-tenant').textContent = me.tenant_id;
      document.getElementById('footer-role').textContent = me.role;
    } catch {}
  }

  async function renderTopics() {
    const f = window.getFilters();
    const q = new URLSearchParams();
    for (const k of Object.keys(f)) if (f[k]) q.set(k, f[k]);
    const data = await api(`/api/opportunities?${q.toString()}`).catch(() => ({ opportunities: [] }));
    const opps = data.opportunities || [];
    document.getElementById('opp-count').textContent = opps.length;
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    if (data.empty_state) {
      const banner = document.createElement('div');
      banner.className = 'card';
      banner.style.borderLeft = '2px solid var(--amber)';
      banner.innerHTML = `<div style="font-weight:700;color:var(--amber);font-size:13px;text-transform:uppercase;letter-spacing:0.06em">${escape(data.title || '')}</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">${escape(data.body || '')}</div>`;
      center.appendChild(banner);
    }
    for (const o of opps) center.appendChild(window.renderOpportunityCard(o));

    // left: pipeline
    const left = document.getElementById('left-panel-body');
    left.innerHTML = '';
    try {
      const pl = await api('/api/pipeline');
      document.getElementById('pipeline-count').textContent = (pl.pipeline || []).length;
      left.appendChild(window.renderPipelinePanel(pl.pipeline || []));
    } catch { document.getElementById('pipeline-count').textContent = 0; }
    try {
      const prof = await api('/api/profile');
      if (prof.profile) left.appendChild(window.renderYourLens(prof.profile));
    } catch {}

    // right: diffs
    const right = document.getElementById('right-panel-body');
    right.innerHTML = '';
    try {
      const diffs = await api('/api/admin/diffs?days=14');
      document.getElementById('diff-count').textContent = (diffs.diffs || []).length;
      right.appendChild(window.renderDiffFeed(diffs.diffs || []));
    } catch {}
  }

  async function renderArt() {
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px">Loading ART matches…</div>';
    const techs = await api('/api/art-matches/techs').catch(() => ({ techs: [] }));
    const phaseIITechs = techs.techs || [];
    if (phaseIITechs.length === 0) {
      center.innerHTML = `<div class="card" style="color:var(--muted);font-size:13px">No Phase II techs declared. Declare one via POST /api/art-matches/techs.</div>`;
    } else {
      center.innerHTML = '';
      for (const t of phaseIITechs) {
        // Trigger match computation
        try {
          await api('/api/art-matches/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase_ii_tech_id: t.id }) });
        } catch {}
        const header = document.createElement('div');
        header.className = 'card';
        header.innerHTML = `<div style="font-weight:600">${escape(t.title)}</div>
          <div class="opp-meta"><span class="badge">${escape(t.topic_code)}</span><span class="badge">${escape(t.originating_component)}</span><span class="badge">TRL ${t.trl || '?'}</span></div>`;
        center.appendChild(header);
        const matches = await api('/api/art-matches').catch(() => ({ matches: [] }));
        const forTech = (matches.matches || []).filter(m => m.phase_ii_tech_id === t.id).slice(0, 5);
        for (const m of forTech) center.appendChild(window.renderArtMatchCard(m));
      }
    }
    // SBA flag in left panel
    const left = document.getElementById('left-panel-body');
    left.innerHTML = '';
    try {
      const cri = await api('/api/sba-eligibility/criteria');
      try { await api('/api/sba-eligibility/compute', { method: 'POST' }); } catch {}
      const e = await api('/api/sba-eligibility');
      left.appendChild(window.renderSbaFlag(e.eligibility, cri.explainer));
    } catch {}
    try {
      const sp = await api('/api/sponsor-pipeline');
      left.appendChild(window.renderSponsorPipelinePanel(sp.sponsor_pipeline || []));
    } catch {}
    document.getElementById('opp-count').textContent = (phaseIITechs.length || 0) + ' techs';
  }

  async function renderPatterns() {
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    const r = await api('/api/admin/component-patterns').catch(() => ({ patterns: [] }));
    center.appendChild(window.renderComponentPatternsStatic(r.patterns || []));
  }

  async function renderAdmin() {
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    const r = await api('/api/admin/recent-receipts?limit=20').catch(() => ({ receipts: [] }));
    const m = await api('/api/admin/stats').catch(() => ({}));
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="card"><h4 style="text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:8px;font-size:11px">Admin</h4>
      <div style="font-size:13px;color:var(--text-dim)">${escape(JSON.stringify(m))}</div></div>`;
    center.appendChild(wrap);
    for (const rec of r.receipts || []) {
      const div = document.createElement('div');
      div.className = 'diff-entry';
      div.innerHTML = `<div class="diff-type">${escape(rec.receipt_type)}</div>
        <div style="font-size:12px;color:var(--text-dim)">tenant=${escape(rec.tenant_id)} · ts=${escape(rec.ts)}</div>
        <pre style="font-size:11px;color:var(--text-dim);background:var(--surface-3);padding:6px;border-radius:3px;margin-top:6px;overflow-x:auto">${escape(JSON.stringify(rec.body || {}, null, 2))}</pre>`;
      center.appendChild(div);
    }
  }

  function setTab(name) {
    state.tab = name;
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name);
    if (name === 'topics') renderTopics();
    if (name === 'art') renderArt();
    if (name === 'patterns') renderPatterns();
    if (name === 'admin') renderAdmin();
  }

  function refreshAll() {
    refreshHeaderStats();
    setTab(state.tab);
  }

  function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  window.app = { refreshAll, setTab };

  document.addEventListener('DOMContentLoaded', async () => {
    await whoami();
    await loadCopy();
    window.wireFilterBar(() => setTab(state.tab));
    for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setTab(t.dataset.tab));
    setTab('topics');
    refreshHeaderStats();
    setInterval(refreshHeaderStats, 30000);
  });
})();
