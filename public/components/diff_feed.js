// Diff feed — what changed across the topic feed, in plain language. Each row
// shows a category badge, the topic title, its component/program/phase, and
// the deadline. Clicking a row opens that topic's Why panel.
//
// renderDiffFeedHTML is the single source of truth for the markup and is pure
// (string in, string out) so it runs unchanged in the browser and in tests.
// The opportunity_id is an internal key — it is used ONLY to wire the click
// handler and is NEVER emitted into the HTML or shown as text.
(function () {
  const CATEGORY = {
    new:          { label: 'NEW',          cls: 'cat-new' },
    closed:       { label: 'CLOSED',       cls: 'cat-closed' },
    changed:      { label: 'CHANGED',      cls: 'cat-changed' },
    closing_soon: { label: 'CLOSING SOON', cls: 'cat-closing' },
    warning:      { label: 'CLOSING SOON', cls: 'cat-closing' },
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function trunc(s, n) {
    const v = String(s == null ? '' : s);
    return v.length > n ? v.slice(0, n - 1) + '…' : v;
  }

  // The text shown for a diff row. NEVER the opportunity_id — a row whose
  // opportunity could not be joined falls back to its topic code, then to a
  // neutral label, so a raw `source:id` key can never reach the screen.
  function diffTitle(d) {
    return trunc(d.title || d.topic_code || '(topic unavailable)', 60);
  }

  function daysClass(dd) {
    return dd <= 7 ? 'days-critical' : dd <= 14 ? 'days-warn' : 'days-ok';
  }

  function renderDiffRowHTML(d, idx) {
    const type = d.diff_type || 'changed';
    const cat = CATEGORY[type] || CATEGORY.changed;
    const showDays = type !== 'closed' && d.days_remaining != null && !d.is_rolling;
    const dd = d.days_remaining;
    const daysHTML = showDays
      ? `<span class="diff-days ${daysClass(dd)}">${dd < 0 ? 'closed' : esc(dd + 'd')}</span>`
      : '';
    const meta = [d.component, d.program, d.phase].filter(Boolean).join(' · ');
    const metaHTML = meta ? `<div class="diff-meta">${esc(meta)}</div>` : '';
    const detailHTML = (type === 'changed' && d.field_changed)
      ? `<div class="diff-detail">${esc(d.field_changed)}: ${esc(trunc(d.old_value, 30))} → ${esc(trunc(d.new_value, 30))}</div>`
      : '';
    // data-diff-idx is a row index, not an identifier — the click handler maps
    // it back to rows[idx].opportunity_id in the browser.
    const idxAttr = (idx != null) ? ` data-diff-idx="${idx}"` : '';
    return `<div class="diff-entry ${esc(type)}"${idxAttr}>` +
             '<div class="diff-row">' +
               `<span class="diff-cat ${cat.cls}">${cat.label}</span>` +
               `<span class="diff-title">${esc(diffTitle(d))}</span>` +
               daysHTML +
             '</div>' +
             metaHTML +
             detailHTML +
           '</div>';
  }

  function renderDiffFeedHTML(rows) {
    const list = rows || [];
    if (!list.length) {
      return '<div class="why-empty">No topic changes in this window.</div>';
    }
    return list.map((d, i) => renderDiffRowHTML(d, i)).join('');
  }

  if (typeof window !== 'undefined') {
    window.renderDiffFeed = function (rows) {
      const list = rows || [];
      const wrap = document.createElement('div');
      wrap.innerHTML = renderDiffFeedHTML(list);
      wrap.querySelectorAll('.diff-entry[data-diff-idx]').forEach(el => {
        const d = list[Number(el.getAttribute('data-diff-idx'))];
        if (d && d.opportunity_id) {
          el.style.cursor = 'pointer';
          el.title = 'Open the Why-this panel';
          el.addEventListener('click', () => openDiffWhy(d.opportunity_id));
        }
      });
      const frag = document.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      return frag;
    };
  }

  async function openDiffWhy(id) {
    try {
      const r = await fetch(`/api/why/topic/${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.why && window.openWhyPanel) window.openWhyPanel(j.why);
    } catch (e) { /* a feed-row click is best-effort */ }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderDiffFeedHTML, renderDiffRowHTML, diffTitle };
  }
})();
