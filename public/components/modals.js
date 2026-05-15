// Sentinel modals — the interaction loop ported from Sniper:
//   1. Add to Pipeline  — captures the questions (deadline, funding, read).
//   2. Record Outcome   — closes the loop; writes a lesson + feeds calibration.
//   3. Learnings        — calibration, ROI and lessons in one place.
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const TERMINAL = ['awarded', 'rejected', 'withdrawn', 'no_response'];

  function refresh() { if (window.app && window.app.refreshAll) window.app.refreshAll(); }

  function showModal(bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    const box = document.createElement('div');
    box.className = 'modal scrollbar-thin';
    box.innerHTML = bodyHtml;
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onEsc); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  async function postJson(url, body, method) {
    const r = await fetch(url, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r;
  }

  // ── 1. ADD TO PIPELINE ──────────────────────────────────────────────────
  window.openPipelineModal = function (opp) {
    const presetDeadline = opp.close_date ? String(opp.close_date).slice(0, 10) : '';
    const overlay = showModal(`
      <h2>Add to Pipeline</h2>
      <div class="modal-intro">Tracking an opportunity captures the questions Sentinel learns from later — your deadline, the funding you expect, and your read going in.</div>
      <div class="modal-field"><label>Topic</label><div class="modal-readonly">${esc(opp.title || '')}</div></div>
      <div class="modal-field"><label>Proposal deadline</label><input type="date" id="pm-deadline" value="${esc(presetDeadline)}"></div>
      <div class="modal-field"><label>Expected funding ($)</label><input type="number" id="pm-funding" inputmode="numeric" placeholder="e.g. 1750000"></div>
      <div class="modal-field"><label>Notes — why this, your approach, contacts</label><textarea id="pm-notes" placeholder="Initial read, teaming, government POC, differentiators..."></textarea></div>
      <div class="actions">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">Add to Pipeline</button>
      </div>`);
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const body = {
        opportunity_id: opp.id,
        title: opp.title,
        source: opp.source || 'sbir_gov',
        deadline: overlay.querySelector('#pm-deadline').value || null,
        funding_amount: parseFloat(overlay.querySelector('#pm-funding').value) || null,
        notes: overlay.querySelector('#pm-notes').value.trim() || null,
      };
      const btn = overlay.querySelector('[data-act="save"]');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const r = await postJson('/api/pipeline', body);
        if (!r.ok) throw new Error(`pipeline ${r.status}`);
        overlay.remove();
        refresh();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Add to Pipeline';
        alert('Could not add to pipeline. A pilot or sandbox session is required.');
      }
    });
  };

  // ── 2. RECORD OUTCOME ───────────────────────────────────────────────────
  // `item` is a pipeline row from /api/pipeline (carries the original score
  // breakdown joined from scores, so calibration sees real dimensions).
  window.openOutcomeModal = function (item) {
    const preset = TERMINAL.includes(item.status) ? item.status : '';
    const radio = v => `<label class="radio"><input type="radio" name="om-result" value="${v}" ${preset === v ? 'checked' : ''}> ${v.replace('_', ' ')}</label>`;
    const overlay = showModal(`
      <h2>Record Outcome</h2>
      <div class="modal-intro">This is the learning loop. What you record here trains Sentinel's score calibration and writes a lesson to the team's shared memory.</div>
      <div class="modal-field"><label>Topic</label><div class="modal-readonly">${esc(item.title || '')}</div></div>
      <div class="modal-field"><label>Result</label>
        <div class="radio-row">${radio('awarded')}${radio('rejected')}${radio('withdrawn')}${radio('no_response')}</div>
      </div>
      <div class="modal-field"><label>If rejected or withdrawn — why?</label><textarea id="om-reason" placeholder="Budget mismatch, TRL gap, wrong domain, deadline conflict..."></textarea></div>
      <div class="modal-field"><label>What worked?</label><textarea id="om-worked" placeholder="Sandbox validation was the differentiator; receipts answered the audit question..."></textarea></div>
      <div class="modal-field"><label>What didn't work?</label><textarea id="om-failed" placeholder="Budget too low, needed a university partner, scope too broad..."></textarea></div>
      <div class="modal-field"><label>Would you submit again?</label>
        <select id="om-again"><option value="yes">Yes</option><option value="no">No</option></select></div>
      <div class="modal-field"><label>Hours spent on this proposal</label><input type="number" id="om-hours" inputmode="numeric" placeholder="e.g. 45"></div>
      <div class="modal-field"><label>Actual funding if awarded ($)</label><input type="number" id="om-funding" inputmode="numeric" placeholder="e.g. 1750000" value="${item.funding_amount != null ? item.funding_amount : ''}"></div>
      <div class="actions">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">Save Outcome</button>
      </div>`);
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => { overlay.remove(); refresh(); });
    overlay.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const result = (overlay.querySelector('input[name="om-result"]:checked') || {}).value;
      if (!result) { alert('Select a result.'); return; }
      const btn = overlay.querySelector('[data-act="save"]');
      btn.disabled = true; btn.textContent = 'Saving…';
      const outcome = {
        opportunity_id: item.opportunity_id,
        pipeline_id: item.id,
        terminal_status: result,
        component: item.component || null,
        agency: item.agency || null,
        sub_agency: item.sub_agency || null,
        program: item.program || null,
        phase: item.phase || null,
        topic_number: item.topic_code || null,
        title: item.title,
        source: item.source || 'sbir_gov',
        keywords_matched: item.keywords_matched || [],
        original_score: item.fit_score != null ? item.fit_score : null,
        original_tier: item.score_tier || null,
        original_tech_alignment: item.score_tech != null ? item.score_tech : null,
        original_domain_alignment: item.score_domain != null ? item.score_domain : null,
        original_submission_type: item.score_type != null ? item.score_type : null,
        original_timeline: item.score_timeline != null ? item.score_timeline : null,
        original_funding_efficiency: item.score_funding != null ? item.score_funding : null,
        funding_amount: parseFloat(overlay.querySelector('#om-funding').value) || item.funding_amount || null,
        rejection_reason: overlay.querySelector('#om-reason').value.trim() || null,
        what_worked: overlay.querySelector('#om-worked').value.trim() || null,
        what_failed: overlay.querySelector('#om-failed').value.trim() || null,
        would_submit_again: overlay.querySelector('#om-again').value === 'yes',
        actual_effort_hours: parseFloat(overlay.querySelector('#om-hours').value) || null,
      };
      try {
        const r = await postJson('/api/outcomes', outcome);
        if (!r.ok) throw new Error(`outcome ${r.status}`);
        await postJson(`/api/pipeline/${item.id}`, { status: result }, 'PUT');
        overlay.remove();
        refresh();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Save Outcome';
        alert('Could not save the outcome. A pilot or sandbox session is required.');
      }
    });
  };

  // ── 3. LEARNINGS (calibration + ROI + lessons) ──────────────────────────
  window.openLearningsModal = async function () {
    const overlay = showModal(`
      <h2>Learnings</h2>
      <div class="modal-intro">Sentinel's feedback loop. Every recorded outcome sharpens the score weights and adds to the lessons below.</div>
      <div id="learn-body"><div class="learn-loading">Loading…</div></div>
      <div class="actions"><button class="btn" data-act="cancel">Close</button></div>`);
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());

    const [cal, roi, les] = await Promise.all([
      fetch('/api/outcomes/calibration').then(r => r.json()).catch(() => ({})),
      fetch('/api/outcomes/roi').then(r => r.json()).catch(() => ({})),
      fetch('/api/outcomes/lessons?limit=40').then(r => r.json()).catch(() => ({})),
    ]);
    const body = overlay.querySelector('#learn-body');
    body.innerHTML = renderCalibration(cal.calibration) + renderRoi(roi.roi) + renderLessons(les.lessons || []);
  };

  function renderCalibration(c) {
    if (!c) {
      return `<h3>Calibration</h3>
        <div class="learn-empty">Record 5 terminal outcomes (awarded or rejected) to unlock score calibration.</div>`;
    }
    const dims = Object.entries(c.dimension_analysis || {}).map(([name, d]) => `
      <tr>
        <td>${esc(name.replace(/_/g, ' '))}</td>
        <td>${d.win_avg}</td><td>${d.loss_avg}</td>
        <td class="${d.diff >= 0 ? 'pos' : 'neg'}">${d.diff >= 0 ? '+' : ''}${d.diff}</td>
        <td>${d.predictive ? '<span class="tag-yes">predictive</span>' : '<span class="tag-no">weak</span>'}</td>
      </tr>`).join('');
    const recs = (c.recommendations || []).map(r => `<li>${esc(r.suggestion)}</li>`).join('');
    return `<h3>Calibration</h3>
      <div class="learn-stats">
        <div class="learn-stat"><span class="v">${c.win_rate}%</span><span class="k">win rate</span></div>
        <div class="learn-stat"><span class="v">${c.wins}/${c.outcomes_count}</span><span class="k">wins</span></div>
        <div class="learn-stat"><span class="v">${c.overall_accuracy == null ? '—' : c.overall_accuracy + '%'}</span><span class="k">score accuracy</span></div>
      </div>
      <table class="learn-table">
        <thead><tr><th>Dimension</th><th>Win avg</th><th>Loss avg</th><th>Δ</th><th></th></tr></thead>
        <tbody>${dims}</tbody>
      </table>
      ${recs ? `<ul class="learn-recs">${recs}</ul>` : ''}`;
  }

  function renderRoi(r) {
    if (!r || !r.submitted) {
      return `<h3>Return on effort</h3><div class="learn-empty">No submitted outcomes yet.</div>`;
    }
    const dph = r.dollars_per_hour == null ? '—' : '$' + Number(r.dollars_per_hour).toLocaleString();
    const fund = '$' + Number(r.total_funding_won || 0).toLocaleString();
    const rows = (r.by_component || []).map(c => `
      <tr><td>${esc(c.component)}</td><td>${c.won}/${c.submitted}</td><td>${c.hours}h</td>
      <td>$${Number(c.funding_won).toLocaleString()}</td><td>$${Number(c.dollars_per_hour).toLocaleString()}/h</td></tr>`).join('');
    return `<h3>Return on effort</h3>
      <div class="learn-stats">
        <div class="learn-stat"><span class="v">${r.won}/${r.submitted}</span><span class="k">submitted</span></div>
        <div class="learn-stat"><span class="v">${fund}</span><span class="k">funding won</span></div>
        <div class="learn-stat"><span class="v">${r.total_hours}h</span><span class="k">total effort</span></div>
        <div class="learn-stat"><span class="v">${dph}/h</span><span class="k">$ per hour</span></div>
      </div>
      ${rows ? `<table class="learn-table">
        <thead><tr><th>Component</th><th>Won</th><th>Effort</th><th>Funding</th><th>$/hour</th></tr></thead>
        <tbody>${rows}</tbody></table>` : ''}`;
  }

  function renderLessons(lessons) {
    if (!lessons.length) {
      return `<h3>Lessons</h3><div class="learn-empty">Lessons are written automatically when you record an outcome.</div>`;
    }
    const items = lessons.map(l => `
      <div class="lesson lesson-${esc(l.outcome)}">
        <div class="lesson-head">${esc(l.title)}</div>
        <div class="lesson-body">${esc(l.lesson)}</div>
      </div>`).join('');
    return `<h3>Lessons <span class="learn-count">${lessons.length}</span></h3>${items}`;
  }
})();
