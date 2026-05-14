window.renderComponentPatternsStatic = function (rows) {
  const wrap = document.createElement('div');
  wrap.className = 'patterns-list';
  if (!rows || rows.length === 0) {
    wrap.innerHTML = `<div class="card" style="color:var(--muted);font-size:13px">No patterns yet. Patterns emit only when at least 5 distinct tenants have terminal outcomes for a (component, dimension) pair. L1 is data capture only in v0.1 — no scores modified.</div>`;
    return wrap;
  }
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'pattern-row';
    const pv = typeof r.pattern_value === 'string' ? JSON.parse(r.pattern_value) : r.pattern_value;
    div.innerHTML = `<div><strong>${escape(r.component)}</strong> · ${escape(r.dimension)} — win avg ${pv.win_avg}, loss avg ${pv.loss_avg}, Δ ${pv.diff}</div>
      <div class="meta">n=${r.supporting_n}, k≥${r.kanon_min}</div>`;
    wrap.appendChild(div);
  }
  return wrap;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
