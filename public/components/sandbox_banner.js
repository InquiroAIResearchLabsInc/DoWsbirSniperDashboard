// sandbox_banner: disabled. Banner removed from /demo to keep the header quiet.
(function () {
  return;

  const style = document.createElement('style');
  style.textContent = `
    #sandbox-banner {
      position: fixed; top: 0; left: 0; right: 0;
      height: 32px;
      background: #0a0a0a;
      color: #e8e3d4;
      border-bottom: 1px solid #2a2a2a;
      display: flex; align-items: center; justify-content: center;
      gap: 14px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-family: 'Inter', system-ui, sans-serif;
      z-index: 9999;
    }
    #sandbox-banner .label { color: #d6a23a; font-weight: 700; }
    #sandbox-banner .dot { color: #7a766c; }
    #sandbox-banner a { color: #d6a23a; text-decoration: none; border-bottom: 1px dotted #d6a23a; }
    #sandbox-banner a:hover { color: #e8e3d4; }
    body.has-sandbox-banner header { margin-top: 32px; }
    #sandbox-banner.placeholder-warn .cta-copy { color: #d6a23a; font-family: 'JetBrains Mono', ui-monospace, monospace; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'sandbox-banner';
  bar.innerHTML = `<span class="label">SANDBOX</span>
    <span>interactions here are reset hourly</span>
    <span class="dot">·</span>
    <span class="cta-copy" id="sandbox-cta">loading…</span>`;

  function place() {
    document.body.classList.add('has-sandbox-banner');
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) place();
  else document.addEventListener('DOMContentLoaded', place);

  fetch('/api/copy/sandbox_banner').then(r => r.ok ? r.json() : null).then(j => {
    const cta = document.getElementById('sandbox-cta');
    if (!cta) return;
    const v = (j && j.value) ? j.value : '<MISSING_COPY:sandbox_banner>';
    cta.textContent = v;
    if (/<(PLACEHOLDER|MISSING|EMPTY)_/i.test(v)) bar.classList.add('placeholder-warn');
  }).catch(() => { /* keep loading text */ });
})();
