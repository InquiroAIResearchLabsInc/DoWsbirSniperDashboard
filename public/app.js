(function () {
  const state = { tab: 'topics', tenant: null, role: null, auth_kind: null, scanLabel: 'Scan' };

  async function api(p, opts) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(p, { signal: ctrl.signal, ...opts });
      if (!r.ok) throw new Error(`${p} ${r.status}`);
      return r.json();
    } finally { clearTimeout(t); }
  }

  // The scan button's label comes from docs/copy/scan_button.md via getCopy().
  // A copy file that is missing, empty, or still holding a placeholder token
  // resolves to an angle-bracket token (e.g. <PLACEHOLDER_SCAN_BUTTON>) — never
  // put that on the button; fall back to "Scan".
  async function loadScanLabel() {
    const btn = document.getElementById('refresh-btn');
    try {
      const { value } = await api('/api/copy/scan_button');
      let label = (value || '').replace(/\s+/g, ' ').trim();
      if (/^<.*>$/.test(label)) label = '';
      state.scanLabel = label || '⟳ SCAN DoW TOPICS';
    } catch { state.scanLabel = '⟳ SCAN DoW TOPICS'; }
    if (btn) btn.textContent = state.scanLabel;
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
    } catch {}
    try {
      // "ART Strong" = this tenant's Strong-band matches, not a global row count.
      const ar = document.getElementById('stat-art');
      if (ar) {
        if (isAuthed()) {
          const am = await api('/api/art-matches?band=STRONG&limit=200');
          ar.textContent = am.total_returned || 0;
        } else {
          ar.textContent = 0;
        }
      }
    } catch {}
    try {
      const opps = await api('/api/opportunities');
      const list = opps.opportunities || [];
      const primes = list.filter(o => o.score_tier === 'PRIME').length;
      const evals = list.filter(o => o.score_tier === 'EVALUATE').length;
      const closing = list.filter(o => o.days_remaining != null && o.days_remaining <= 14).length;
      // PRIMES goes amber only while there is a prime to act on; at zero it
      // drops to bone so it stops competing for attention.
      const pr = document.getElementById('stat-primes');
      if (pr) { pr.textContent = primes; pr.className = 'stat-val' + (primes > 0 ? ' amber' : ' primes-zero'); }
      const ev = document.getElementById('stat-evaluates'); if (ev) ev.textContent = evals;
      // CLOSING counter is red only while there is something closing; at zero
      // it drops to a muted bone so it stops competing for attention.
      const cl = document.getElementById('stat-closing');
      if (cl) { cl.textContent = closing; cl.className = 'stat-val ' + (closing > 0 ? 'red' : 'closing-zero'); }
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
    const f = window.getFilters ? window.getFilters() : {};
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
      banner.className = 'empty-banner';
      banner.innerHTML = `<div class="empty-banner-title">${escape(data.title || '')}</div><div class="empty-banner-body">${escape(data.body || '')}</div>`;
      center.appendChild(banner);
    }
    for (const o of opps) center.appendChild(window.renderOpportunityCard(o));

    // left: pipeline (authed only)
    const left = document.getElementById('left-panel-body');
    left.innerHTML = '';
    if (isAuthed()) {
      try {
        const pl = await api('/api/pipeline');
        const plCount = (pl.pipeline || []).length;
        document.getElementById('pipeline-count').textContent = plCount;
        railSync('left', plCount, plCount > 0);
        left.appendChild(window.renderPipelinePanel(pl.pipeline || []));
      } catch { document.getElementById('pipeline-count').textContent = 0; railSync('left', 0, false); }
      try {
        const prof = await api('/api/profile');
        if (prof.profile) left.appendChild(window.renderYourLens(prof.profile));
      } catch {}
    } else {
      document.getElementById('pipeline-count').textContent = 0;
      railSync('left', 0, false);
      left.appendChild(renderSignedOutBanner('pipeline and your-lens require a pilot token'));
    }

    // right: diffs
    const right = document.getElementById('right-panel-body');
    right.innerHTML = '';
    try {
      const diffs = await api('/api/admin/diffs?days=14');
      const list = diffs.diffs || [];
      document.getElementById('diff-count').textContent = list.length;
      // While the diff feed is collapsed its badge is the only ambient signal:
      // amber when something is closing soon (≤14d), bone white otherwise.
      const closingSoon = list.some(d => d.days_remaining != null && d.days_remaining >= 0 && d.days_remaining <= 14);
      railSync('right', list.length, closingSoon);
      right.appendChild(window.renderDiffFeed(list));
    } catch { railSync('right', 0, false); }
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

    const f = window.getFilters ? window.getFilters() : {};
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
    if (name === 'topics') renderTopics().catch(e => console.error('[sentinel] renderTopics:', e));
    if (name === 'art') renderArt().catch(e => console.error('[sentinel] renderArt:', e));
    if (name === 'patterns') renderPatterns().catch(e => console.error('[sentinel] renderPatterns:', e));
    if (name === 'admin') renderAdmin().catch(e => console.error('[sentinel] renderAdmin:', e));
  }

  function refreshAll() {
    refreshHeaderStats();
    setTab(state.tab);
  }

  function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  function railSync(side, count, alert) {
    if (window.setPanelRail) window.setPanelRail(side, count, alert);
  }

  window.app = { refreshAll, setTab };

  document.addEventListener('DOMContentLoaded', async () => {
    await whoami();
    await loadScanLabel();
    window.wireFilterBar(() => setTab(state.tab));
    for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setTab(t.dataset.tab));
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.textContent = '⟳ SCANNING...';
        refreshBtn.classList.add('scanning');
        refreshBtn.disabled = true;
        if (window.openScanNotice) window.openScanNotice();
        setTimeout(() => {
          refreshBtn.textContent = state.scanLabel;
          refreshBtn.classList.remove('scanning');
          refreshBtn.disabled = false;
        }, 3000);
      });
      if (isAuthed()) refreshBtn.hidden = false;
    }
    const digestBtn = document.getElementById('digest-btn');
    if (digestBtn) {
      digestBtn.addEventListener('click', () => { if (window.openDigestModal) window.openDigestModal(); });
      if (isAuthed()) digestBtn.hidden = false;
    }
    setTab('topics');
    refreshHeaderStats();
    setInterval(refreshHeaderStats, 30000);
  });
})();
