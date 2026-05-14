const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');

const PRIORITIES = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'seed', 'component_priorities.json'), 'utf8'));
const TIER_VALUE = { A: 100, B: 75, C: 50 };

function lc(s) { return (s || '').toLowerCase(); }

function getComponentPriorities(component_id) {
  return (PRIORITIES.components && PRIORITIES.components[component_id]) || [];
}

function matchPriorities({ sponsor, tech_extracted, tenant_id = 'default', emit_receipt = true }) {
  const priorities = getComponentPriorities(sponsor.component);
  const declaredKw = new Set((tech_extracted.declared || []).map(lc));
  const foundFlat = new Set([
    ...(tech_extracted.found.tier_a || []).map(lc),
    ...(tech_extracted.found.tier_b || []).map(lc),
    ...(tech_extracted.found.tier_c || []).map(lc),
  ]);
  const allKw = new Set([...declaredKw, ...foundFlat]);

  const matches = [];
  let bestScore = 0;
  for (const p of priorities) {
    const matchedKw = [];
    for (const kw of p.keywords || []) {
      const klc = lc(kw);
      if (allKw.has(klc)) matchedKw.push(klc);
      else {
        for (const u of allKw) {
          if (u.includes(klc) || klc.includes(u)) { matchedKw.push(klc); break; }
        }
      }
    }
    if (matchedKw.length > 0) {
      const tierVal = TIER_VALUE[p.tier] || 50;
      const density = Math.min(1, matchedKw.length / Math.max(1, p.keywords.length));
      const sponsorTagBonus = (sponsor.priority_tags || []).some(t => matchedKw.includes(lc(t))) ? 10 : 0;
      const score = Math.min(100, Math.round(tierVal * (0.5 + 0.5 * density) + sponsorTagBonus));
      matches.push({
        priority_name: p.priority_name,
        tier: p.tier,
        matched_keywords: matchedKw,
        source_doc: p.source_doc,
        source_url: p.source_url,
        score,
      });
      if (score > bestScore) bestScore = score;
    }
  }
  if (emit_receipt) {
    emitReceipt('sponsor_priority_match', {
      tenant_id,
      sponsor_id: sponsor.id,
      component: sponsor.component,
      best_priority_score: bestScore,
      match_count: matches.length,
    });
  }
  return {
    score: bestScore,
    matches: matches.sort((a, b) => b.score - a.score),
  };
}

module.exports = { matchPriorities, getComponentPriorities };
