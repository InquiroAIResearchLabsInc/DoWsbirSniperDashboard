// panel_collapse: the Pipeline (left) and Diff feed (right) panels start
// collapsed to a 32px rail so the centre opportunities feed leads on load.
// Clicking a rail expands the panel; the ‹ control in the panel header
// collapses it again. The open/closed choice is persisted in localStorage,
// so a user who has expanded a panel before sees it open next session.
//
// Width itself is pure CSS (a `width` transition on `.panel.side`): this
// module only toggles the `collapsed` class. Mobile keeps its own
// tap-to-open behaviour (mobile_nav.js) — the rails are CSS-hidden there.
(function () {
  const PANELS = [
    { panelId: 'left-panel',  railId: 'left-rail',  badgeId: 'pipeline-rail-badge', key: 'sentinel_pipeline_open', side: 'left' },
    { panelId: 'right-panel', railId: 'right-rail', badgeId: 'diff-rail-badge',     key: 'sentinel_diff_open',     side: 'right' },
  ];

  // A panel starts expanded ONLY if the user has explicitly opened it before:
  // localStorage holds the exact string 'true'. Anything else (missing key,
  // 'false', stale value) → the collapsed default.
  function shouldExpand(storedValue) {
    return storedValue === 'true';
  }

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, open) {
    try { window.localStorage.setItem(key, open ? 'true' : 'false'); } catch (e) { /* private mode */ }
  }

  function applyState(panel, open) {
    if (panel) panel.classList.toggle('collapsed', !open);
  }

  function initPanel(cfg) {
    const panel = document.getElementById(cfg.panelId);
    if (!panel) return;
    let open = shouldExpand(read(cfg.key));
    applyState(panel, open);

    function setOpen(next) {
      open = next;
      applyState(panel, open);
      write(cfg.key, open);
    }

    const rail = document.getElementById(cfg.railId);
    if (rail) rail.addEventListener('click', function () { setOpen(true); });

    const collapse = panel.querySelector('.panel-collapse');
    if (collapse) collapse.addEventListener('click', function () { setOpen(false); });
  }

  function init() {
    for (const cfg of PANELS) initPanel(cfg);
  }

  // setPanelRail — app.js reports each side's count and whether it carries an
  // attention signal. The rail badge shows the count and goes amber when the
  // alert flag is set (pipeline: any items; diff feed: anything closing soon).
  function setPanelRail(side, count, alert) {
    const cfg = PANELS.find(function (p) { return p.side === side; });
    if (!cfg || typeof document === 'undefined') return;
    const badge = document.getElementById(cfg.badgeId);
    if (!badge) return;
    badge.textContent = (count == null ? 0 : count);
    badge.classList.toggle('alert', !!alert);
  }

  if (typeof window !== 'undefined') {
    window.setPanelRail = setPanelRail;
    window.initPanelCollapse = init;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { shouldExpand, init, setPanelRail };
  }
})();
