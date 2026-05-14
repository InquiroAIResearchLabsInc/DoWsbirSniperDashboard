window.renderSbaFlag = function (eligibility, explainer) {
  const div = document.createElement('div');
  if (!eligibility) {
    div.className = 'sba-flag ineligible';
    div.innerHTML = `<div class="title">Strategic Breakthrough Award eligibility</div>
      <div class="body">Not yet computed for this tenant. POST /api/sba-eligibility/compute to evaluate against P.L. 119-83 §3 criteria.</div>`;
    return div;
  }
  div.className = `sba-flag ${eligibility.eligible ? '' : 'ineligible'}`;
  const missing = eligibility.missing_criteria || [];
  div.innerHTML = `<div class="title">${eligibility.eligible ? 'SBA eligible' : 'SBA not yet eligible'}</div>
    <div class="body">${explainer || ''}</div>
    ${missing.length ? `<div class="body">Missing: ${missing.map(m => `<span class="kw-tag">${escape(m.label)}</span>`).join(' ')}</div>` : ''}`;
  return div;
};
function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
