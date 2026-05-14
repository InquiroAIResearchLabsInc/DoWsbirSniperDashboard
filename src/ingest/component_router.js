const fs = require('fs');
const path = require('path');
const config = require('../core/config');

const COMPONENTS = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'seed', 'components.json'), 'utf8'));

function classifyByTopicCode(topic_code) {
  if (!topic_code) return null;
  const up = String(topic_code).toUpperCase().trim();
  for (const c of COMPONENTS) {
    const prefixes = [c.topic_prefix, ...(c.topic_prefix_alt || [])];
    for (const p of prefixes) {
      if (!p) continue;
      if (up.startsWith(p.toUpperCase() + ' ') || up.startsWith(p.toUpperCase() + '-') || up.startsWith(p.toUpperCase()) && /[0-9]/.test(up.slice(p.length, p.length + 1) || '0')) {
        return c.id;
      }
    }
  }
  return null;
}

function classifyByAgency(agency, sub_agency) {
  const text = `${agency || ''} ${sub_agency || ''}`.toLowerCase();
  if (text.includes('space force') || text.includes('ussf') || text.includes('u.s. space force')) return 'space_force';
  if (text.includes('air force') || text.includes('usaf') || text.includes('daf')) return 'air_force';
  if (text.includes('army')) return 'army';
  if (text.includes('darpa')) return 'darpa';
  if (text.includes('dtra')) return 'dtra';
  if (text.includes('socom') || text.includes('special operations')) return 'socom';
  if (text.includes('cbd') || text.includes('chemical') || text.includes('biological')) return 'cbd';
  if (text.includes('dmea') || text.includes('microelectronics')) return 'dmea';
  return null;
}

function route({ topic_code, agency, sub_agency }) {
  return classifyByTopicCode(topic_code) || classifyByAgency(agency, sub_agency) || 'unknown';
}

module.exports = { route, classifyByTopicCode, classifyByAgency, COMPONENTS };
