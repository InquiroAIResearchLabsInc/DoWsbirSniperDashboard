window.renderSponsorPipelinePanel = function (rows) {
  const frag = document.createDocumentFragment();
  for (const p of rows || []) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div style="font-weight:600;font-size:14px">${escape(p.sponsor_name || p.sponsor_candidate_id)}</div>
      <div class="opp-meta"><span class="badge">${escape(p.status)}</span><span class="badge">${escape(p.phase_ii_tech_id)}</span></div>`;
    frag.appendChild(div);
  }
  return frag;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
