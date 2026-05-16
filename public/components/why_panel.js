// Why panel — renders the scoring rationale as UI. Each item from the API
// carries a `kind` (src/scoring/why_this.js); this renders one typed view per
// kind. It never JSON.stringify's a value into the panel.
(function () {
  window.openWhyPanel = function (why) {
    const modal = document.getElementById('why-modal');
    const content = document.getElementById('why-modal-content');
    content.innerHTML = '';

    const h2 = document.createElement('h2');
    h2.textContent = why && why.payload_type === 'art' ? 'Why this sponsor match?' : 'Why this score?';
    content.appendChild(h2);

    if (why && why.header) {
      const intro = document.createElement('div');
      intro.className = 'modal-intro';
      intro.textContent = why.header;
      content.appendChild(intro);
    }

    for (const item of (why && why.items) || []) {
      const row = document.createElement('div');
      row.className = 'why-item';
      const lbl = document.createElement('div');
      lbl.className = 'why-label';
      lbl.textContent = item.label || '';
      row.appendChild(lbl);
      const val = document.createElement('div');
      val.className = 'why-value';
      renderItem(val, item);
      row.appendChild(val);
      content.appendChild(row);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const close = document.createElement('button');
    close.className = 'btn';
    close.textContent = 'Close';
    close.addEventListener('click', () => modal.classList.remove('open'));
    actions.appendChild(close);
    content.appendChild(actions);

    modal.classList.add('open');
  };

  function renderItem(el, item) {
    switch (item && item.kind) {
      case 'score': return renderScore(el, item);
      case 'bars': return renderBars(el, item);
      case 'chips': return renderChips(el, item);
      case 'entries': return renderEntries(el, item);
      case 'link': return renderLink(el, item);
      case 'action': return renderAction(el, item);
      case 'text':
      default: return renderText(el, item);
    }
  }

  function renderScore(el, item) {
    const wrap = document.createElement('div');
    wrap.className = 'why-score';
    const tier = String(item.tier || '').toLowerCase();
    const amber = tier === 'prime' || tier === 'strong';
    const num = document.createElement('span');
    num.className = 'score-num' + (amber ? ' prime' : '');
    num.textContent = item.score == null ? '—' : String(item.score);
    wrap.appendChild(num);
    if (item.tier) {
      const badge = document.createElement('span');
      badge.className = 'tier-badge ' + tier;
      badge.textContent = item.tier;
      wrap.appendChild(badge);
    }
    if (item.note) {
      const note = document.createElement('span');
      note.className = 'note';
      note.textContent = item.note;
      wrap.appendChild(note);
    }
    el.appendChild(wrap);
  }

  function renderBars(el, item) {
    const wrap = document.createElement('div');
    wrap.className = 'score-reveal';
    for (const r of item.rows || []) {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const label = document.createElement('span');
      label.textContent = (r.label || '') + (r.weight != null ? ` · ${r.weight}%` : '');
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = clampPct(r.score) + '%';
      track.appendChild(fill);
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = r.score == null ? '—' : String(r.score);
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(val);
      wrap.appendChild(row);
    }
    el.appendChild(wrap);
  }

  function renderChips(el, item) {
    const items = item.items || [];
    if (!items.length) { renderEmpty(el, item.empty); return; }
    const wrap = document.createElement('div');
    wrap.className = 'kw-tags';
    for (const k of items) {
      const chip = document.createElement('span');
      chip.className = 'kw-tag';
      chip.textContent = String(k);
      wrap.appendChild(chip);
    }
    el.appendChild(wrap);
  }

  function renderEntries(el, item) {
    const rows = item.rows || [];
    if (!rows.length) {
      renderEmpty(el, item.empty);
    } else {
      for (const r of rows) {
        const entry = document.createElement('div');
        entry.className = 'why-entry';
        const t = document.createElement('div');
        t.className = 't';
        t.textContent = r.title || '';
        entry.appendChild(t);
        if (r.meta) {
          const m = document.createElement('div');
          m.className = 'm';
          m.textContent = r.meta;
          entry.appendChild(m);
        }
        el.appendChild(entry);
      }
    }
    if (item.summary) {
      const s = document.createElement('div');
      s.className = 'why-summary';
      s.textContent = item.summary;
      el.appendChild(s);
    }
  }

  function renderText(el, item) {
    const text = item && item.text != null ? String(item.text) : '';
    el.textContent = text || '(none)';
  }

  function renderEmpty(el, msg) {
    const d = document.createElement('div');
    d.className = 'why-empty';
    d.textContent = msg || '(none)';
    el.appendChild(d);
  }

  function renderLink(el, item) {
    if (!item.url) { renderText(el, { text: item.text }); return; }
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = item.text || item.url;
    btn.addEventListener('click', () => {
      if (window.openExternalNotice) window.openExternalNotice(item.text || 'External link', item.url);
    });
    el.appendChild(btn);
  }

  function renderAction(el, item) {
    const wrap = document.createElement('div');
    wrap.className = 'why-action';
    if (item.hint) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = item.hint;
      wrap.appendChild(hint);
    }
    if (item.url) {
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = item.button || 'Open';
      btn.addEventListener('click', () => {
        if (window.openExternalNotice) window.openExternalNotice(item.button || 'External link', item.url);
      });
      wrap.appendChild(btn);
    } else if (item.disagree) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = item.button || 'This match looks wrong';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await fetch('/api/why/disagree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: item.disagree.kind, id: item.disagree.id }),
          });
        } catch (e) { /* the disagreement receipt is best-effort */ }
        const done = document.createElement('span');
        done.className = 'why-confirm';
        done.textContent = item.confirm || 'Got it; that signal is in the system.';
        btn.replaceWith(done);
      });
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
  }

  function clampPct(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  }
})();
