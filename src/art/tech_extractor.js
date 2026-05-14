const fs = require('fs');
const path = require('path');
const config = require('../core/config');

const KEYWORDS = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'seed', 'default_keywords.json'), 'utf8'));

function normalize(s) { return (s || '').toLowerCase(); }

function extractKeywords(text) {
  const lc = normalize(text);
  const found = { tier_a: [], tier_b: [], tier_c: [] };
  for (const kw of KEYWORDS.tier_a) if (lc.includes(kw)) found.tier_a.push(kw);
  for (const kw of KEYWORDS.tier_b) if (lc.includes(kw)) found.tier_b.push(kw);
  for (const kw of KEYWORDS.tier_c) if (lc.includes(kw)) found.tier_c.push(kw);
  return found;
}

function combineProfileAndTech(profile, phase_ii_tech) {
  const text = [
    phase_ii_tech.title || '',
    phase_ii_tech.description || '',
    (phase_ii_tech.tech_keywords || []).join(' '),
    (profile && profile.tech_keywords ? profile.tech_keywords.join(' ') : ''),
  ].join(' ');
  const found = extractKeywords(text);
  const declared = new Set([
    ...(phase_ii_tech.tech_keywords || []).map(s => s.toLowerCase()),
    ...((profile && profile.tech_keywords) || []).map(s => s.toLowerCase()),
  ]);
  return {
    found,
    declared: [...declared],
    raw_text: text,
  };
}

module.exports = { extractKeywords, combineProfileAndTech };
