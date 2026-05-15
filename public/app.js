(function () {
  const state = { tab: 'topics', tenant: null, role: null, auth_kind: null };

  async function api(p, opts) { const r = await fetch(p, opts); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); }

  async function loadCopy() {
    const el = document.getElementById('product-tagline');
    try {
      const { value } = await api('/api/copy/product_tagline');
      el.textContent = (value || '').replace(/\s+/g, ' ').trim() || '<PLACEHOLDER_PRODUCT_TAGLINE>';
    } catch { el.textContent = '<PLACEHOLDER_PRODUCT_TAGLINE>'; }
  }

  function isAuthed() { return !!state.role && state.role !== 'anonymous'; }
  function isAdmin() { return state.role === 'admin'; }
  function isSandbox() { return state.auth_kind === 'sandbox' || state.tenant === 'sandbox'; }
  // The public demo gets the read-only Admin view so reviewers see the audit trail.
  function canSeeAdmin() { return isAdmin() || isSandbox(); }

  async function refreshHeaderStats() {
    try {
      const stats = await api('/api/admin/stats');
      const pl = document.getElementById('stat-pipeline'); if (pl) pl.textContent = stats.pipeline || 0;
      const ar = document.getElementById('stat-art'); if (ar) ar.textContent = stats.art_matches || 0;
    } catch {}
    try {
      const opps = await api('/api/opportunities');
      const list = opps.opportunities || [];
      const primes = list.filter(o => o.score_tier === 'PRIME').length;
      const evals = list.filter(o => o.score_tier === 'EVALUATE').length;
      const closing = list.filter(o => o.days_remaining != null && o.days_remaining <= 14).length;
      const pr = document.getElementById('stat-primes'); if (pr) pr.textContent = primes;
      const ev = document.getElementById('stat-evaluates'); if (ev) ev.textContent = evals;
      const cl = document.getElementById('stat-closing'); if (cl) cl.textContent = closing;
    } catch {}
  }

  async function whoami() {
    try {
      const me = await api('/api/whoami');
      state.tenant = me.tenant_id; state.role = me.role; state.auth_kind = me.auth_kind;
    } catch {}
  }

  async function renderTopics() {
    if (window.setFilterMode) window.setFilterMode('topics');
    const f = window.getFilters();
    const params = new URLSearchParams();
    for (const k of ['q', 'component', 'tier', 'min_score']) {
      if (f[k] && f[k] !== '0') params.set(k, f[k]);
    }
    const data = await api(`/api/opportunities?${params.toString()}`).catch(() => ({ opportunities: [] }));
    const opps = data.opportunities || [];
    document.getElementById('opp-count').textContent = opps.length;
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    if (opps.length === 0) {
      center.appendChild(await renderZeroResults());
    } else if (data.empty_state) {
      const banner = document.createElement('div');
      banner.className = 'card';
      banner.style.borderLeft = '2px solid var(--amber)';
      banner.innerHTML = `<div style="font-weight:700;color:var(--amber);font-size:13px;text-transform:uppercase;letter-spacing:0.06em">${escape(data.title || '')}</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">${escape(data.body || '')}</div>`;
      center.appendChild(banner);
    }
    for (const o of opps) center.appendChild(window.renderOpportunityCard(o));

    // left: pipeline (authed only)
    const left = document.getElementById('left-panel-body');
    left.innerHTML = '';
    if (isAuthed()) {
      try {
        const pl = await api('/api/pipeline');
        document.getElementById('pipeline-count').textContent = (pl.pipeline || []).length;
        left.appendChild(window.renderPipelinePanel(pl.pipeline || []));
      } catch { document.getElementById('pipeline-count').textContent = 0; }
      try {
        const prof = await api('/api/profile');
        if (prof.profile) left.appendChild(window.renderYourLens(prof.profile));
      } catch {}
    } else {
      document.getElementById('pipeline-count').textContent = 0;
      left.appendChild(renderSignedOutBanner('pipeline and your-lens require a pilot token'));
    }

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
    if (window.setFilterMode) window.setFilterMode('art');
    const center = document.getElementById('center-panel-body');
    const left = document.getElementById('left-panel-body');
    left.innerHTML = '';

    if (!isAuthed()) {
      center.innerHTML = '';
      center.appendChild(renderSignedOutBanner('ART matches require a pilot token. Mint one with scripts/issue_demo_token.js.'));
      document.getElementById('opp-count').textContent = '—';
      return;
    }

    center.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px">Loading ART matches…</div>';
    const techs = await api('/api/art-matches/techs').catch(() => ({ techs: [] }));
    const phaseIITechs = techs.techs || [];

    // Trigger compute for each tech once (so the matches table is populated for filtering)
    for (const t of phaseIITechs) {
      try {
        await api('/api/art-matches/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase_ii_tech_id: t.id }) });
      } catch {}
    }

    const f = window.getFilters();
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.component) params.set('component', f.component);
    if (f.band) params.set('band', f.band);
    if (f.min_score && f.min_score !== '0') params.set('min_score', f.min_score);

    const data = await api(`/api/art-matches?${params.toString()}`).catch(() => ({ matches: [] }));
    const matches = data.matches || [];
    document.getElementById('opp-count').textContent = matches.length;

    center.innerHTML = '';
    if (phaseIITechs.length === 0) {
      center.innerHTML = `<div class="card" style="color:var(--muted);font-size:13px">No Phase II techs declared. Declare one via POST /api/art-matches/techs.</div>`;
    } else if (matches.length === 0) {
      center.appendChild(await renderZeroResults());
    } else {
      // Group by tech for readability
      const byTech = new Map();
      for (const m of matches) {
        if (!byTech.has(m.phase_ii_tech_id)) byTech.set(m.phase_ii_tech_id, []);
        byTech.get(m.phase_ii_tech_id).push(m);
      }
      for (const t of phaseIITechs) {
        const forTech = byTech.get(t.id) || [];
        if (forTech.length === 0) continue;
        const header = document.createElement('div');
        header.className = 'card';
        header.innerHTML = `<div style="font-weight:600">${escape(t.title)}</div>
          <div class="opp-meta"><span class="badge">${escape(t.topic_code)}</span><span class="badge">${escape(t.originating_component)}</span><span class="badge">TRL ${t.trl || '?'}</span></div>`;
        center.appendChild(header);
        for (const m of forTech.slice(0, 5)) center.appendChild(window.renderArtMatchCard(m));
      }
    }

    // SBA flag in left panel
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
  }

  async function renderZeroResults() {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.borderLeft = '2px solid var(--muted)';
    let title = 'No results';
    let body = '';
    try {
      const [t, b] = await Promise.all([
        api('/api/copy/empty_state_title').catch(() => null),
        api('/api/copy/empty_state_body').catch(() => null),
      ]);
      if (t && t.value) title = t.value;
      if (b && b.value) body = b.value;
    } catch {}
    wrap.innerHTML = `<div style="font-weight:700;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:0.06em">${escape(title)}</div>
      ${body ? `<div style="font-size:13px;color:var(--text-dim);margin-top:4px">${escape(body)}</div>` : ''}`;
    return wrap;
  }

  async function renderPatterns() {
    if (window.setFilterMode) window.setFilterMode('patterns');
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    const r = await api('/api/admin/component-patterns').catch(() => ({ patterns: [] }));
    const f = window.getFilters ? window.getFilters() : {};
    const patterns = (r.patterns || []).filter(p => !f.component || p.component === f.component);
    document.getElementById('opp-count').textContent = patterns.length;
    center.appendChild(window.renderComponentPatternsStatic(patterns));
  }

  async function renderAdmin() {
    if (window.setFilterMode) window.setFilterMode('admin');
    const center = document.getElementById('center-panel-body');
    center.innerHTML = '';
    if (!canSeeAdmin()) {
      center.appendChild(renderSignedOutBanner('Admin tab requires an admin token.'));
      return;
    }
    const r = await api('/api/admin/recent-receipts?limit=20').catch(() => ({ receipts: [], merkle_root: null }));
    const m = await api('/api/admin/stats').catch(() => ({}));
    const STAT_LABELS = {
      opportunities: 'Opportunities', tenants: 'Tenants', pipeline: 'Pipeline items',
      outcomes: 'Outcomes', art_matches: 'ART matches', sponsor_candidates: 'Sponsors',
      component_patterns: 'Component patterns',
    };
    const statRows = Object.entries(STAT_LABELS)
      .map(([k, label]) => `<div class="learn-stat"><span class="v">${escape(String(m[k] ?? '—'))}</span><span class="k">${escape(label)}</span></div>`)
      .join('');
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = `<h4 style="text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:4px;font-size:11px">Audit view</h4>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px">Every action writes a receipt to an append-only ledger. This is the live chain.</div>
      <div class="learn-stats">${statRows}</div>
      ${r.merkle_root ? `<div style="font-size:11px;color:var(--muted);margin-top:8px;word-break:break-all">Merkle root: ${escape(String(r.merkle_root))}</div>` : ''}`;
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

  function renderSignedOutBanner(msg) {
    const d = document.createElement('div');
    d.className = 'card';
    d.style.borderLeft = '2px solid var(--muted)';
    d.innerHTML = `<div style="font-size:13px;color:var(--text-dim)">${escape(msg)}</div>`;
    return d;
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

  // Live refresh — pulls the SBIR feed server-side, then re-renders. Mirrors
  // Sniper's "Scrape Now": one button, the team taps it, fresh data appears.
  function pollScrape() {
    return new Promise((resolve) => {
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        try {
          const s = await api('/api/admin/scrape/status');
          if (s.state === 'idle') { clearInterval(iv); resolve(s); }
        } catch (e) { clearInterval(iv); resolve(null); }
        if (tries > 75) { clearInterval(iv); resolve(null); }
      }, 2000);
    });
  }

  async function runRefresh(btn) {
    if (btn.disabled) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    const label = btn.dataset.label;
    btn.disabled = true;
    btn.textContent = '↻ Refreshing…';
    let result = null;
    try {
      // 202 = started, 409 = already running — either way, poll to completion.
      await fetch('/api/admin/scrape', { method: 'POST' });
      result = await pollScrape();
    } catch (e) {
      result = { error: e.message };
    }
    btn.disabled = false;
    if (result && result.error) {
      btn.textContent = '↻ Refresh failed';
      window.alert('Live refresh failed: ' + result.error);
      setTimeout(() => { btn.textContent = label; }, 5000);
    } else {
      btn.textContent = label;
      refreshAll();
    }
  }

  function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  window.app = { refreshAll, setTab };

  document.addEventListener('DOMContentLoaded', async () => {
    await whoami();
    await loadCopy();
    window.wireFilterBar(() => setTab(state.tab));
    for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setTab(t.dataset.tab));
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => runRefresh(refreshBtn));
      if (isAuthed()) refreshBtn.hidden = false;
    }
    setTab('topics');
    refreshHeaderStats();
    setInterval(refreshHeaderStats, 30000);
  });
})();
