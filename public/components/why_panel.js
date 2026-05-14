window.openWhyPanel = function (why) {
  const modal = document.getElementById('why-modal');
  const content = document.getElementById('why-modal-content');
  content.innerHTML = '';
  const h2 = document.createElement('h2');
  h2.textContent = why.payload_type === 'art' ? 'Why this sponsor match?' : 'Why this score?';
  content.appendChild(h2);
  if (why.header) {
    const intro = document.createElement('div');
    intro.style.color = 'var(--text-dim)';
    intro.style.fontSize = '13px';
    intro.style.marginBottom = '16px';
    intro.textContent = why.header;
    content.appendChild(intro);
  }
  for (const item of why.items || []) {
    const row = document.createElement('div');
    row.className = 'why-item';
    const lbl = document.createElement('div');
    lbl.className = 'why-label';
    lbl.textContent = item.label;
    row.appendChild(lbl);
    const val = document.createElement('div');
    val.className = 'why-value';
    val.innerHTML = renderValue(item.value);
    row.appendChild(val);
    content.appendChild(row);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.innerHTML = `<button class="btn" onclick="document.getElementById('why-modal').classList.remove('open')">Close</button>`;
  content.appendChild(actions);
  modal.classList.add('open');
};

function renderValue(v) {
  if (v == null) return '<em>(none)</em>';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '<em>(empty)</em>';
    if (typeof v[0] === 'string') return v.map(x => `<span class="kw-tag">${escapeHtml(x)}</span>`).join(' ');
    return '<pre>' + escapeHtml(JSON.stringify(v, null, 2)) + '</pre>';
  }
  return '<pre>' + escapeHtml(JSON.stringify(v, null, 2)) + '</pre>';
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
