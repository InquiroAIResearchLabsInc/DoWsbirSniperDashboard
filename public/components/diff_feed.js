// Diff feed — what changed across the topic feed, in plain language. Each row
// shows a category, the topic title, its component/program/phase, and the
// deadline. Clicking a row opens that topic's Why panel.
(function () {
  const LABEL = {
    new: 'New',
    closed: 'Closed',
    changed: 'Changed',
    closing_soon: 'Closing soon',
    warning: 'Deadline',
  };

  window.renderDiffFeed = function (rows) {
    const frag = document.createDocumentFragment();
    const list = rows || [];
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'why-empty';
      empty.textContent = 'No topic changes in this window.';
      frag.appendChild(empty);
      return frag;
    }

    for (const d of list) {
      const type = d.diff_type || 'changed';
      const entry = document.createElement('div');
      entry.className = `diff-entry ${type}`;

      const head = document.createElement('div');
      head.className = 'diff-head';
      const badge = document.createElement('span');
      badge.className = `diff-type ${type}`;
      badge.textContent = LABEL[type] || type;
      head.appendChild(badge);
      if (type !== 'closed' && d.days_remaining != null && !d.is_rolling) {
        const dd = d.days_remaining;
        const days = document.createElement('span');
        days.className = 'diff-days deadline ' + (dd <= 7 ? 'critical' : dd <= 14 ? 'warning' : 'ok');
        days.textContent = dd < 0 ? 'closed' : `${dd}d left`;
        head.appendChild(days);
      }
      entry.appendChild(head);

      const title = document.createElement('div');
      title.className = 'diff-title';
      title.textContent = d.title || d.opportunity_id || '(unknown topic)';
      entry.appendChild(title);

      const meta = [d.component, d.program, d.phase].filter(Boolean).join(' · ');
      if (meta) {
        const m = document.createElement('div');
        m.className = 'diff-meta';
        m.textContent = meta;
        entry.appendChild(m);
      }

      if (type === 'changed' && d.field_changed) {
        const detail = document.createElement('div');
        detail.className = 'diff-detail';
        detail.textContent = `${d.field_changed}: ${trunc(d.old_value)} → ${trunc(d.new_value)}`;
        entry.appendChild(detail);
      }

      if (d.opportunity_id) {
        entry.style.cursor = 'pointer';
        entry.title = 'Open the Why-this panel';
        entry.addEventListener('click', () => openDiffWhy(d.opportunity_id));
      }
      frag.appendChild(entry);
    }
    return frag;
  };

  async function openDiffWhy(id) {
    try {
      const r = await fetch(`/api/why/topic/${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.why && window.openWhyPanel) window.openWhyPanel(j.why);
    } catch (e) { /* a feed-row click is best-effort */ }
  }

  function trunc(s) {
    const v = String(s == null ? '' : s);
    return v.length > 60 ? v.slice(0, 57) + '…' : v;
  }
})();
