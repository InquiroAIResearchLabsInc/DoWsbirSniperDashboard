// tour.js — native, zero-dependency guided tour.
//
// Phase 1 (guided): a spotlight + tooltip walks the user through the four
// Golden-Path steps; each step advances on the real interaction, not a Next
// button. Phase 2 (free explore): three pulsing hotspots mark the remaining
// key elements for 45s, then fade permanently.
//
// The spotlight is a single element with a huge box-shadow — everything
// outside its rect is dimmed. It is pointer-events:none, so every click
// passes straight through to the page (the tour advances on the intended
// interaction; nothing is trapped). This module appends only .tour-* nodes
// and modifies no existing component. It writes no receipts. Tour state lives
// in localStorage so the tour runs once per browser. Entry point: initTour().
(function () {
  'use strict';

  var KEY_DONE = 'sentinel_tour_completed';
  var KEY_HOT = 'sentinel_tour_hotspots_dismissed';

  var PAD = 12;                 // spotlight padding around the target
  var ADMIN_HOLD_MS = 1500;     // dwell on Admin before Phase 1 auto-ends
  var TRANSITION_HOLD_MS = 3000;
  var BACKDROP_FADE_MS = 400;
  var HOTSPOT_LIFE_MS = 45000;
  var HOTSPOT_FADE_MS = 1000;
  var FADE_IN_MS = 20;
  var RELAYOUT_MS = 90;         // re-measure after a scroll-into-view settles
  var WHY_POLL_MS = 200;        // how often step 2 checks the Why panel state
  var WHY_POLL_MAX = 30;        // give up waiting for the panel after ~6s
  var MOBILE_MAX = 720;

  // phase: 0 idle · 1 guided · 2 transitioning · 3 hotspots · 4 done
  var state = {
    phase: 0, step: 0,
    spotlight: null, tooltip: null, tooltipBody: null, skipLink: null,
    transition: null, transitionMsg: null, replay: null,
    hotspots: [], stepTeardown: null,
    whyWatching: false, whySeenOpen: false, whyPolls: 0,
    timers: [], p1Listeners: [], p2Listeners: [],
  };

  var copyCache = {};

  // Step copy keys map to docs/copy/*.md atoms (loaded via /api/copy). The
  // "STEP n OF 4" indicator and the amber arrow prompt are structural and
  // rendered here — the copy atom is body prose only.
  var STEPS = [
    { copyKey: 'tour_step_1', prompt: 'Click any topic title to continue' },
    { copyKey: 'tour_step_2', prompt: 'Click "Why this?" to continue' },
    { copyKey: 'tour_step_3', prompt: 'Click ART Match to continue' },
    { copyKey: 'tour_step_4', prompt: 'Click Admin to see the ledger' },
  ];

  var HOTSPOTS = [
    { id: 'filter', primary: '#filter-component', fallback: '#filter-component', label: 'Filter by component or tier' },
    { id: 'pipeline', primary: '#left-rail', fallback: '#left-panel-header', label: 'Your pursuit pipeline' },
    { id: 'diff', primary: '#right-rail', fallback: '#right-panel-header', label: 'What changed since last scan' },
  ];

  // --- storage --------------------------------------------------------------
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ } }

  // --- small DOM helpers ----------------------------------------------------
  function mk(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function removeNode(n) {
    if (n && n.parentNode) { try { n.parentNode.removeChild(n); } catch (e) { /* gone */ } }
  }
  function fadeIn(n) {
    if (!n) return;
    var id = setTimeout(function () { if (n && n.classList) n.classList.add('tour-in'); }, FADE_IN_MS);
    state.timers.push(id);
  }
  function winW() { return (typeof window !== 'undefined' && window.innerWidth) || 1440; }
  function winH() { return (typeof window !== 'undefined' && window.innerHeight) || 900; }
  function isMobile() { return winW() <= MOBILE_MAX; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rectOf(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    return el.getBoundingClientRect();
  }
  function bindOne(el, type, fn, cleanup) {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener(type, fn);
    cleanup.push(function () { if (el.removeEventListener) el.removeEventListener(type, fn); });
  }
  function bindAll(list, type, fn, cleanup) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) bindOne(list[i], type, fn, cleanup);
  }
  function addWinListener(type, fn, bucket) {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener(type, fn);
    bucket.push({ type: type, fn: fn });
  }
  function dropWinListeners(bucket) {
    if (typeof window === 'undefined' || typeof window.removeEventListener !== 'function') { bucket.length = 0; return; }
    for (var i = 0; i < bucket.length; i++) window.removeEventListener(bucket[i].type, bucket[i].fn);
    bucket.length = 0;
  }
  function clearTimers() {
    for (var i = 0; i < state.timers.length; i++) { try { clearTimeout(state.timers[i]); } catch (e) { /* noop */ } }
    state.timers.length = 0;
  }
  // Bring the target into the viewport so the spotlight lands on something the
  // user can actually see — critical on mobile, where the feed scrolls.
  function scrollIntoView(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); }
    catch (e) { try { el.scrollIntoView(); } catch (e2) { /* noop */ } }
  }

  // --- copy -----------------------------------------------------------------
  function copyFor(key) { return copyCache[key] || ''; }

  function loadCopy() {
    if (typeof fetch !== 'function') return;
    var keys = ['tour_step_1', 'tour_step_2', 'tour_step_3', 'tour_step_4', 'tour_complete'];
    keys.forEach(function (k) {
      try {
        fetch('/api/copy/' + k)
          .then(function (r) { return r && r.ok ? r.json() : null; })
          .then(function (j) {
            if (j && typeof j.value === 'string') { copyCache[k] = j.value; refreshBody(k); }
          })
          .catch(function () { /* missing copy renders empty; not fatal */ });
      } catch (e) { /* relative URL unsupported (test env) */ }
    });
  }

  function refreshBody(key) {
    var idx = state.step - 1;
    if (state.tooltipBody && idx >= 0 && STEPS[idx] && STEPS[idx].copyKey === key) {
      state.tooltipBody.textContent = copyFor(key);
    }
    if (key === 'tour_complete' && state.transitionMsg) {
      state.transitionMsg.textContent = copyFor(key);
    }
  }

  // --- spotlight + tooltip geometry ----------------------------------------
  // The spotlight is a box whose oversized box-shadow dims everything around
  // it. A null/empty rect collapses the box to a point — a full-screen dim.
  function layoutSpotlight(rect) {
    var el = state.spotlight;
    if (!el) return;
    var W = winW(), H = winH();
    if (!rect || (!rect.width && !rect.height)) {
      el.style.left = Math.round(W / 2) + 'px';
      el.style.top = Math.round(H / 2) + 'px';
      el.style.width = '0px';
      el.style.height = '0px';
      return;
    }
    var xl = clamp(rect.left - PAD, 0, W);
    var yt = clamp(rect.top - PAD, 0, H);
    var xr = clamp(rect.right + PAD, 0, W);
    var yb = clamp(rect.bottom + PAD, 0, H);
    el.style.left = Math.round(xl) + 'px';
    el.style.top = Math.round(yt) + 'px';
    el.style.width = Math.round(Math.max(0, xr - xl)) + 'px';
    el.style.height = Math.round(Math.max(0, yb - yt)) + 'px';
  }

  // On mobile the tooltip docks to the bottom of the screen (CSS) so it can
  // never cover the target. On desktop it sits on whichever side of the
  // target has the most room, and is clamped inside the viewport.
  function placeTooltip(tip, rect) {
    if (isMobile()) {
      tip.classList.add('tour-tooltip-docked');
      tip.style.left = '';
      tip.style.top = '';
      return;
    }
    tip.classList.remove('tour-tooltip-docked');
    var W = winW(), H = winH(), M = 16;
    var tr = rectOf(tip) || { width: 0, height: 0 };
    var tw = tr.width || 320;
    var th = tr.height || 170;
    var left, top;
    if (!rect || (!rect.width && !rect.height)) {
      left = (W - tw) / 2; top = (H - th) / 2;
    } else {
      var wide = rect.width > W * 0.6;
      var lowThird = rect.top > H * 2 / 3;
      if (wide || lowThird) {
        left = (W - tw) / 2;
        top = (rect.top > H / 2) ? rect.top - th - M : rect.bottom + M;
      } else {
        var roomR = W - rect.right, roomL = rect.left;
        left = (roomR >= roomL) ? rect.right + M : rect.left - tw - M;
        top = rect.top;
      }
    }
    left = clamp(left, M, Math.max(M, W - tw - M));
    top = clamp(top, M, Math.max(M, H - th - M));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  // --- Phase 1 --------------------------------------------------------------
  function startPhase1() {
    if (state.phase !== 0) return;
    state.phase = 1;

    state.spotlight = mk('div', 'tour-spotlight');
    document.body.appendChild(state.spotlight);
    fadeIn(state.spotlight);

    state.skipLink = mk('a', 'tour-skip');
    state.skipLink.setAttribute('href', '#');
    state.skipLink.textContent = 'SKIP TOUR';
    state.skipLink.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      skip();
    });
    document.body.appendChild(state.skipLink);

    var reposition = function () { if (state.step) layoutStep(state.step); };
    addWinListener('resize', reposition, state.p1Listeners);
    addWinListener('scroll', reposition, state.p1Listeners);

    advanceStep(1);
  }

  function targetsFor(n) {
    if (n === 1) {
      var card = (document.querySelectorAll('#center-panel-body .card.opp') || [])[0]
        || document.querySelector('#center-panel-body .card')
        || document.querySelector('.panel.center');
      return { spot: card, anchor: card };
    }
    if (n === 2) {
      var why = document.querySelector('.card.opp.prime')
        || document.querySelector('.card.opp.evaluate')
        || (document.querySelectorAll('#center-panel-body .card.opp') || [])[0];
      return { spot: why, anchor: why };
    }
    if (n === 3) {
      return { spot: document.querySelector('.tabs'), anchor: document.querySelector('.tab[data-tab="art"]') };
    }
    return { spot: document.querySelector('.tabs'), anchor: document.querySelector('.tab[data-tab="admin"]') };
  }

  function buildTooltip(n) {
    var tip = mk('div', 'tour-tooltip');
    tip.setAttribute('data-step', String(n));

    var ind = mk('div', 'tour-step-indicator');
    var num = mk('span', 'tour-step-num');
    num.textContent = 'STEP ' + n + ' OF 4';
    ind.appendChild(num);
    var dashes = mk('span', 'tour-dashes');
    for (var i = 1; i <= 4; i++) {
      var d = mk('span', 'tour-dash ' + (i < n ? 'done' : i === n ? 'active' : 'upcoming'));
      dashes.appendChild(d);
    }
    ind.appendChild(dashes);
    tip.appendChild(ind);

    var body = mk('div', 'tour-body');
    body.textContent = copyFor(STEPS[n - 1].copyKey);
    tip.appendChild(body);
    state.tooltipBody = body;

    var prompt = mk('div', 'tour-prompt');
    prompt.textContent = '→ ' + STEPS[n - 1].prompt;
    tip.appendChild(prompt);

    return tip;
  }

  function layoutStep(n) {
    if (!state.spotlight) return;
    var t = targetsFor(n);
    var spotRect = rectOf(t.spot);
    layoutSpotlight(spotRect);
    if (state.tooltip) placeTooltip(state.tooltip, rectOf(t.anchor) || spotRect);
  }

  function wireStep(n) {
    var fired = false;
    var cleanup = [];
    var go = function () {
      if (fired) return;
      fired = true;
      advanceStep(n + 1);
    };
    if (n === 1) {
      bindAll(document.querySelectorAll('#center-panel-body .opp-title'), 'click', go, cleanup);
    } else if (n === 2) {
      // Opening the Why panel is async. Rather than race it, the tour steps
      // aside while the panel is up and resumes once the user closes it — so
      // they actually read the rationale and step 3's tab is never blocked.
      bindAll(document.querySelectorAll('#center-panel-body [data-action="why"]'), 'click', watchWhy, cleanup);
    } else if (n === 3) {
      bindOne(document.querySelector('.tab[data-tab="art"]'), 'click', go, cleanup);
    } else if (n === 4) {
      // Admin: end Phase 1 after a short dwell so the ledger is on screen.
      var go4 = function () {
        if (fired) return;
        fired = true;
        var id = setTimeout(function () { endPhase1(); }, ADMIN_HOLD_MS);
        state.timers.push(id);
      };
      bindOne(document.querySelector('.tab[data-tab="admin"]'), 'click', go4, cleanup);
    }
    state.stepTeardown = function () {
      for (var i = 0; i < cleanup.length; i++) { try { cleanup[i](); } catch (e) { /* noop */ } }
    };
  }

  // While the Why panel is open the tour hides itself so the panel — and its
  // Close button — are fully usable; the skip link stays as the escape hatch.
  function setTourVisible(visible) {
    var disp = visible ? '' : 'none';
    if (state.spotlight) state.spotlight.style.display = disp;
    if (state.tooltip) state.tooltip.style.display = disp;
  }

  function watchWhy() {
    if (state.whyWatching || state.phase !== 1 || state.step !== 2) return;
    state.whyWatching = true;
    state.whySeenOpen = false;
    state.whyPolls = 0;
    pollWhy();
  }

  function pollWhy() {
    if (state.phase !== 1 || state.step !== 2) { state.whyWatching = false; return; }
    var wm = document.getElementById('why-modal');
    var open = !!(wm && wm.classList && wm.classList.contains('open'));
    if (open && !state.whySeenOpen) {
      state.whySeenOpen = true;
      setTourVisible(false);
    } else if (state.whySeenOpen && !open) {
      state.whyWatching = false;
      advanceStep(3);
      return;
    }
    state.whyPolls += 1;
    if (!state.whySeenOpen && state.whyPolls > WHY_POLL_MAX) {
      state.whyWatching = false;
      advanceStep(3);
      return;
    }
    var id = setTimeout(pollWhy, WHY_POLL_MS);
    state.timers.push(id);
  }

  function advanceStep(n) {
    if (state.phase !== 1) return;
    if (n > 4) { endPhase1(); return; }
    if (state.stepTeardown) { try { state.stepTeardown(); } catch (e) { /* noop */ } state.stepTeardown = null; }
    state.step = n;
    state.whyWatching = false;
    if (state.spotlight) state.spotlight.style.display = '';
    // The Why panel opened in step 2 lives below the spotlight; close it once
    // the tour moves on so it does not surface uninvited later.
    if (n >= 3) {
      var wm = document.getElementById('why-modal');
      if (wm && wm.classList) wm.classList.remove('open');
    }
    if (state.tooltip) { removeNode(state.tooltip); state.tooltip = null; }
    state.tooltip = buildTooltip(n);
    document.body.appendChild(state.tooltip);
    fadeIn(state.tooltip);

    var t = targetsFor(n);
    scrollIntoView(t.spot || t.anchor);
    layoutStep(n);
    // Re-measure once the scroll-into-view has settled.
    var id = setTimeout(function () { if (state.step === n) layoutStep(n); }, RELAYOUT_MS);
    state.timers.push(id);

    wireStep(n);
  }

  function teardownPhase1() {
    if (state.stepTeardown) { try { state.stepTeardown(); } catch (e) { /* noop */ } state.stepTeardown = null; }
    removeNode(state.tooltip); state.tooltip = null; state.tooltipBody = null;
    removeNode(state.skipLink); state.skipLink = null;
    var wm = document.getElementById('why-modal');
    if (wm && wm.classList) wm.classList.remove('open');
    dropWinListeners(state.p1Listeners);
  }

  function endPhase1() {
    if (state.phase !== 1) return;
    state.phase = 2;
    lsSet(KEY_DONE, 'true');
    teardownPhase1();

    // Spotlight collapses to a full-screen dim under the transition card.
    layoutSpotlight(null);

    state.transition = mk('div', 'tour-transition');
    state.transitionMsg = mk('div', 'tour-transition-msg');
    state.transitionMsg.textContent = copyFor('tour_complete');
    state.transition.appendChild(state.transitionMsg);
    document.body.appendChild(state.transition);
    fadeIn(state.transition);

    var t1 = setTimeout(function () {
      if (state.transition) state.transition.classList.add('tour-out');
      if (state.spotlight) state.spotlight.classList.add('tour-out');
      var t2 = setTimeout(function () {
        removeNode(state.transition); state.transition = null; state.transitionMsg = null;
        removeNode(state.spotlight); state.spotlight = null;
        startPhase2();
      }, BACKDROP_FADE_MS);
      state.timers.push(t2);
    }, TRANSITION_HOLD_MS);
    state.timers.push(t1);
  }

  function skip() {
    if (state.phase !== 1) return;
    state.phase = 2;
    lsSet(KEY_DONE, 'true');
    teardownPhase1();
    removeNode(state.transition); state.transition = null; state.transitionMsg = null;
    removeNode(state.spotlight); state.spotlight = null;
    startPhase2();
  }

  // --- Phase 2 --------------------------------------------------------------
  function resolveHotspot(def) {
    var el = document.querySelector(def.primary);
    var r = rectOf(el);
    if (el && r && (r.width || r.height)) return el;
    el = document.querySelector(def.fallback);
    r = rectOf(el);
    if (el && r && (r.width || r.height)) return el;
    return null;
  }

  function placeHotspot(node, el) {
    var r = rectOf(el);
    if (!r) return;
    var sx = (typeof window !== 'undefined' && (window.scrollX || window.pageXOffset)) || 0;
    var sy = (typeof window !== 'undefined' && (window.scrollY || window.pageYOffset)) || 0;
    node.style.left = Math.round(r.left + sx + r.width / 2 - 5) + 'px';
    node.style.top = Math.round(r.top + sy + r.height / 2 - 5) + 'px';
  }

  function buildHotspot(def, el) {
    var node = mk('div', 'tour-hotspot');
    node.setAttribute('data-hotspot', def.id);
    var label = mk('span', 'tour-hotspot-label');
    label.textContent = def.label;
    node.appendChild(label);
    node.addEventListener('mouseenter', function () { label.classList.add('show'); });
    node.addEventListener('mouseleave', function () { label.classList.remove('show'); });
    node.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      dismissHotspot(def.id);
    });
    placeHotspot(node, el);
    return node;
  }

  function startPhase2() {
    if (state.phase === 3) return;
    state.phase = 3;
    if (lsGet(KEY_HOT) === 'true') { state.phase = 4; return; }

    state.hotspots = [];
    for (var i = 0; i < HOTSPOTS.length; i++) {
      var def = HOTSPOTS[i];
      var el = resolveHotspot(def);
      if (!el) continue;
      var node = buildHotspot(def, el);
      document.body.appendChild(node);
      fadeIn(node);
      state.hotspots.push({ def: def, node: node, target: el });
    }
    if (state.hotspots.length === 0) { endPhase2(); return; }

    var reposition = function () {
      for (var j = 0; j < state.hotspots.length; j++) {
        placeHotspot(state.hotspots[j].node, state.hotspots[j].target);
      }
    };
    addWinListener('resize', reposition, state.p2Listeners);
    addWinListener('scroll', reposition, state.p2Listeners);

    var id = setTimeout(autoDismissHotspots, HOTSPOT_LIFE_MS);
    state.timers.push(id);
  }

  function autoDismissHotspots() {
    for (var i = 0; i < state.hotspots.length; i++) {
      if (state.hotspots[i].node.classList) state.hotspots[i].node.classList.add('tour-out');
    }
    var id = setTimeout(endPhase2, HOTSPOT_FADE_MS);
    state.timers.push(id);
  }

  function dismissHotspot(id) {
    for (var i = 0; i < state.hotspots.length; i++) {
      if (state.hotspots[i].def.id === id) {
        removeNode(state.hotspots[i].node);
        state.hotspots.splice(i, 1);
        break;
      }
    }
    if (state.hotspots.length === 0) endPhase2();
  }

  function endPhase2() {
    state.phase = 4;
    for (var i = 0; i < state.hotspots.length; i++) removeNode(state.hotspots[i].node);
    state.hotspots = [];
    dropWinListeners(state.p2Listeners);
    lsSet(KEY_HOT, 'true');
  }

  // --- "Take the tour again" ------------------------------------------------
  // A single bone-white text link, mounted once into the center column and
  // shown only while the Admin tab is active. renderAdmin only ever touches
  // #center-panel-body, so a link on .panel.center survives every re-render.
  function syncReplay() {
    var link = document.querySelector('.tour-replay-link');
    if (!link) return;
    var admin = document.querySelector('.tab[data-tab="admin"]');
    var active = !!(admin && admin.classList && admin.classList.contains('active'));
    link.classList.toggle('is-visible', active);
  }

  function mountReplayLink() {
    var center = document.querySelector('.panel.center');
    if (!center || document.querySelector('.tour-replay-link')) { syncReplay(); return; }
    var link = mk('a', 'tour-replay-link');
    link.setAttribute('href', '#');
    link.textContent = 'Take the tour again';
    link.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      lsDel(KEY_DONE);
      lsDel(KEY_HOT);
      try { window.location.reload(); } catch (x) { /* noop */ }
    });
    center.appendChild(link);
    state.replay = link;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { setTimeout(syncReplay, 0); });
    }
    syncReplay();
  }

  // --- entry point ----------------------------------------------------------
  function initTour() {
    if (typeof document === 'undefined' || !document.body) return;
    loadCopy();
    mountReplayLink();

    var done = lsGet(KEY_DONE) === 'true';
    if (!done) { startPhase1(); return; }
    // Tour already taken: recover Phase 2 if a reload landed mid-hotspots,
    // otherwise show nothing.
    if (lsGet(KEY_HOT) !== 'true') { startPhase2(); return; }
  }

  var api = {
    initTour: initTour,
    startPhase1: startPhase1,
    advanceStep: advanceStep,
    endPhase1: endPhase1,
    startPhase2: startPhase2,
    dismissHotspot: dismissHotspot,
    endPhase2: endPhase2,
    skip: skip,
    _state: state,
    _clearTimers: clearTimers,
  };

  if (typeof window !== 'undefined') window.initTour = initTour;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
