const { route } = require('./component_router');

// DoD SBIR/STTR Innovation Portal — the live topics app. Used as the canonical
// outbound target ("Open in DSIP") and as the fallback when a feed does not
// supply a topic link. The base topics-app URL always resolves; deep links by
// topic number are not stable, so reviewers land on the searchable topic list.
const DSIP_TOPICS_URL = 'https://www.dodsbirsttr.mil/topics-app/';

function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
}

function daysRemaining(close_date) {
  if (!close_date) return null;
  const t = Date.parse(close_date);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function normalizeTopic(topic, sol, agency) {
  const topic_code = topic.topic_number || topic.topic_code || sol.solicitation_number || '';
  const id = `sbir_gov:${topic_code || sol.solicitation_number + '_' + (topic.topic_title || '')}`.replace(/\s+/g, '_').slice(0, 200);
  const close_date = (sol.application_due_date && sol.application_due_date[0]) || sol.close_date || null;
  const component = route({ topic_code, agency: sol.agency || agency, sub_agency: sol.branch || topic.branch });
  return {
    id,
    source: 'sbir_gov',
    source_url: isHttpUrl(topic.sbir_topic_link) ? topic.sbir_topic_link.trim() : DSIP_TOPICS_URL,
    title: topic.topic_title || sol.solicitation_title || '',
    description: [topic.topic_description || '', (topic.subtopics || []).map(s => s.subtopic_description || '').join(' ')].join(' '),
    agency: sol.agency || agency,
    sub_agency: sol.branch || topic.branch || '',
    component,
    program: sol.program || 'SBIR',
    phase: sol.phase || '',
    topic_code,
    naics_codes: [],
    keywords: [],
    posted_date: sol.release_date || null,
    open_date: sol.open_date || null,
    close_date,
    is_rolling: !close_date,
    days_remaining: daysRemaining(close_date),
    funding_min: null,
    funding_max: null,
    currency: 'USD',
  };
}

function normalizeSolicitation(sol, agency) {
  const close_date = (sol.application_due_date && sol.application_due_date[0]) || sol.close_date || null;
  const component = route({ topic_code: sol.solicitation_number, agency: sol.agency || agency, sub_agency: sol.branch });
  return {
    id: `sbir_gov:sol:${sol.solicitation_number}`,
    source: 'sbir_gov',
    source_url: isHttpUrl(sol.solicitation_url) ? sol.solicitation_url.trim() : DSIP_TOPICS_URL,
    title: sol.solicitation_title || '',
    description: `${sol.solicitation_title || ''} -- ${sol.program || ''} ${sol.phase || ''} solicitation for ${sol.agency || agency}`,
    agency: sol.agency || agency,
    sub_agency: sol.branch || '',
    component,
    program: sol.program || 'SBIR',
    phase: sol.phase || '',
    topic_code: sol.solicitation_number,
    naics_codes: [],
    keywords: [],
    posted_date: sol.release_date || null,
    open_date: sol.open_date || null,
    close_date,
    is_rolling: !close_date,
    days_remaining: daysRemaining(close_date),
    funding_min: null,
    funding_max: null,
    currency: 'USD',
  };
}

module.exports = { normalizeTopic, normalizeSolicitation, daysRemaining, DSIP_TOPICS_URL, isHttpUrl };
