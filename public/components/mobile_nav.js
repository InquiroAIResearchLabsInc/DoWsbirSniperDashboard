// mobile_nav: on narrow viewports the 3-panel grid becomes a single column.
// The Opportunities panel leads (m-primary); Pipeline and Diff feed become
// tap-to-open sections (m-collapsible), collapsed until the user opens them.
(function () {
  const MQ = '(max-width: 720px)';

  function init() {
    const layout = document.querySelector('.layout');
    if (!layout) return;
    const panels = Array.from(layout.querySelectorAll('.panel'));
    const centerBody = document.getElementById('center-panel-body');
    const center = centerBody ? centerBody.closest('.panel') : null;
    if (!center) return;

    center.classList.add('m-primary');
    const sides = panels.filter(p => p !== center);
    const mq = window.matchMedia(MQ);

    for (const p of sides) {
      p.classList.add('m-collapsible');
      const header = p.querySelector('.panel-header');
      if (!header) continue;
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      const toggle = () => {
        if (!mq.matches) return;
        p.classList.toggle('m-collapsed');
        p.dataset.mTouched = '1';
        header.setAttribute('aria-expanded', String(!p.classList.contains('m-collapsed')));
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    function apply() {
      for (const p of sides) {
        if (mq.matches) {
          if (!p.dataset.mTouched) p.classList.add('m-collapsed');
        } else {
          p.classList.remove('m-collapsed');
        }
        const header = p.querySelector('.panel-header');
        if (header) header.setAttribute('aria-expanded', String(!p.classList.contains('m-collapsed')));
      }
    }
    apply();
    mq.addEventListener('change', apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
