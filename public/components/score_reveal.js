// score_reveal: five sub-score bars fill staggered, then composite counts up.
// Demo hero animation per spec §15. No green. Amber for Strong.
// ?annotate=true URL flag adds bone-white aria-label overlays for recording.
window.scoreReveal = function (container, { sub_scores, weights, composite, band }) {
  const annotate = new URLSearchParams(location.search).get('annotate') === 'true';
  container.innerHTML = '';
  const rows = [
    { key: 'priority_alignment', label: 'Priority alignment' },
    { key: 'transition_history', label: 'Transition history' },
    { key: 'active_scouting', label: 'Active scouting' },
    { key: 'tech_maturity_fit', label: 'Tech maturity fit' },
    { key: 'recency_boost', label: 'Recency boost' },
  ];
  const wrap = document.createElement('div');
  wrap.className = 'score-reveal';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<span>${r.label} · ${Math.round((weights[r.key] || 0) * 100)}%</span><div class="bar-track"><div class="bar-fill ${band === 'Strong' ? '' : 'bone'}"></div></div><span class="val">0</span>`;
    wrap.appendChild(row);
  }
  container.appendChild(wrap);
  const bars = wrap.querySelectorAll('.bar-fill');
  const vals = wrap.querySelectorAll('.val');
  rows.forEach((r, i) => {
    setTimeout(() => {
      const target = sub_scores[r.key] || 0;
      bars[i].style.width = target + '%';
      animateCount(vals[i], target, 600);
    }, 220 + i * 220);
  });
  const total = document.createElement('div');
  total.className = 'art-card';
  total.classList.add(band.toLowerCase());
  total.innerHTML = `<div class="header"><div class="score ${band === 'Strong' ? 'strong' : ''}" id="composite-score">0</div><div><div class="band ${band === 'Strong' ? 'strong' : ''}">${band}</div></div></div>`;
  container.appendChild(total);
  if (annotate) {
    wrap.setAttribute('data-annotate', 'sub-scores');
    wrap.setAttribute('aria-label', '5-dim score');
    total.setAttribute('data-annotate', 'composite');
    total.setAttribute('aria-label', 'composite score');
  }
  setTimeout(() => animateCount(total.querySelector('#composite-score'), composite, 900), 220 + rows.length * 220);
};

function animateCount(el, target, duration) {
  const start = performance.now();
  function tick(t) {
    const k = Math.min(1, (t - start) / duration);
    const v = Math.round(k * target);
    el.textContent = v;
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
