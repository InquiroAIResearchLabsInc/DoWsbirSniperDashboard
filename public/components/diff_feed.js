window.renderDiffFeed = function (rows) {
  const frag = document.createDocumentFragment();
  for (const d of rows || []) {
    const div = document.createElement('div');
    div.className = `diff-entry ${d.diff_type}`;
    div.innerHTML = `<div class="diff-type ${d.diff_type}">${d.diff_type}</div>
      <div style="font-weight:500;font-size:13px">${escape(d.opportunity_id)}</div>
      ${d.field_changed ? `<div class="diff-detail">${escape(d.field_changed)}: ${escape(d.old_value || '')} → ${escape(d.new_value || '')}</div>` : ''}`;
    frag.appendChild(div);
  }
  return frag;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
