window.renderYourLens = function (profile) {
  if (!profile) return document.createDocumentFragment();
  const div = document.createElement('div');
  div.className = 'lens';
  const kws = (profile.tech_keywords || []).map(k => `<span class="kw-tag">${escape(k)}</span>`).join('');
  div.innerHTML = `<h4>Your lens</h4>
    <div style="font-size:13px;color:var(--text-dim);margin-bottom:6px">${escape(profile.company_name || '—')}</div>
    <div>${kws || '<em style="color:var(--muted)">No keywords set</em>'}</div>`;
  return div;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
