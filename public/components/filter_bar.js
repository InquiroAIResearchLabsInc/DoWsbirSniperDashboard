window.wireFilterBar = function (onChange) {
  const score = document.getElementById('filter-score');
  const scoreVal = document.getElementById('filter-score-val');
  score.addEventListener('input', () => { scoreVal.textContent = score.value; });
  score.addEventListener('change', onChange);
  document.getElementById('filter-component').addEventListener('change', onChange);
  document.getElementById('filter-tier').addEventListener('change', onChange);
};
window.getFilters = function () {
  return {
    component: document.getElementById('filter-component').value,
    tier: document.getElementById('filter-tier').value,
    min_score: document.getElementById('filter-score').value,
  };
};
