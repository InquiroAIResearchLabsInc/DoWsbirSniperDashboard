(function () {
  const DEBOUNCE_MS = 300;
  let timer = null;
  let placeholderLoaded = false;

  function debounce(fn) {
    return function () { clearTimeout(timer); timer = setTimeout(fn, DEBOUNCE_MS); };
  }

  function el(id) { return document.getElementById(id); }

  function defaults() {
    return { q: '', component: '', tier: '', band: '', min_score: '0' };
  }

  function current() {
    return {
      q: el('filter-q').value.trim(),
      component: el('filter-component').value,
      tier: el('filter-tier').value,
      band: el('filter-band').value,
      min_score: el('filter-score').value,
    };
  }

  function isDefault() {
    const c = current();
    const d = defaults();
    return c.q === d.q && c.component === d.component && c.tier === d.tier && c.band === d.band && c.min_score === d.min_score;
  }

  function reset() {
    el('filter-q').value = '';
    el('filter-component').value = '';
    el('filter-tier').value = '';
    el('filter-band').value = '';
    el('filter-score').value = '0';
    el('filter-score-val').textContent = '0';
  }

  function refreshActiveStyling() {
    const active = !isDefault();
    el('filter-clear').hidden = !active;
    el('opp-count').classList.toggle('active-filter', active);
  }

  async function loadPlaceholder() {
    if (placeholderLoaded) return;
    placeholderLoaded = true;
    try {
      const r = await fetch('/api/copy/search_placeholder');
      if (!r.ok) return;
      const { value } = await r.json();
      const text = (value || '').replace(/\s+/g, ' ').trim();
      if (text) el('filter-q').setAttribute('placeholder', text);
    } catch {}
  }

  window.wireFilterBar = function (onChange) {
    loadPlaceholder();
    const fire = () => { refreshActiveStyling(); onChange(); };
    const fireDebounced = debounce(fire);

    el('filter-q').addEventListener('input', fireDebounced);
    el('filter-component').addEventListener('change', fire);
    el('filter-tier').addEventListener('change', fire);
    el('filter-band').addEventListener('change', fire);
    el('filter-score').addEventListener('input', () => { el('filter-score-val').textContent = el('filter-score').value; });
    el('filter-score').addEventListener('change', fire);
    el('filter-clear').addEventListener('click', (e) => { e.preventDefault(); reset(); fire(); });

    refreshActiveStyling();
  };

  window.getFilters = function () {
    return current();
  };

  window.setFilterMode = function (mode) {
    el('filter-tier').hidden = mode !== 'topics';
    el('filter-band').hidden = mode !== 'art';
    const labels = { topics: 'Opportunities', art: 'ART Matches', patterns: 'Patterns', admin: 'Admin' };
    el('opp-label').textContent = labels[mode] || 'Opportunities';
  };

  window.refreshFilterBarStyling = refreshActiveStyling;
})();
