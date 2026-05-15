const { getCopy } = require('../core/copy');

// "Open in DSIP" must always resolve. source_url is already DSIP-normalized at
// ingest (src/ingest/normalize.js) and back-filled on migrate, but guard here
// too so the Why-panel handoff button never points at a dead link.
const DSIP_URL = 'https://www.dodsbirsttr.mil/topics-app/';

function safeUrl(u) {
  return (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) ? u.trim() : null;
}
function round(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : null;
}
function fmtUsd(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
}

// Each item carries a `kind` that the Why panel (public/components/why_panel.js)
// renders with a typed renderer — score header, dimension bars, keyword chips,
// readable entry lists, links, actions. Nothing reaches the client as a raw
// object: the panel never falls back to JSON.stringify.

const TOPIC_DIMENSIONS = [
  ['Tech alignment', 'score_tech', 'tech_alignment'],
  ['Domain alignment', 'score_domain', 'domain_alignment'],
  ['Submission type', 'score_type', 'submission_type'],
  ['Timeline', 'score_timeline', 'timeline'],
  ['Funding efficiency', 'score_funding', 'funding_efficiency'],
];

function buildTopicWhy(score, weights, opp) {
  const w = weights || {};
  const sourceUrl = safeUrl(opp && opp.source_url);
  return {
    payload_type: 'topic',
    header: getCopy('why_panel_header'),
    items: [
      {
        kind: 'score',
        label: 'Final score and tier',
        score: round(score.fit_score),
        max: 100,
        tier: score.score_tier || null,
      },
      {
        kind: 'bars',
        label: 'Five-dimension breakdown with weights',
        rows: TOPIC_DIMENSIONS.map(([label, sk, wk]) => ({
          label,
          score: round(score[sk]),
          weight: Math.round((Number(w[wk]) || 0) * 100),
        })),
      },
      {
        kind: 'chips',
        label: 'Matched keywords',
        items: Array.isArray(score.keywords_matched) ? score.keywords_matched : [],
        empty: 'No keywords matched.',
      },
      {
        kind: 'text',
        label: 'Disqualifier hit (if any)',
        text: score.disqualified_by || 'None',
      },
      {
        kind: 'link',
        label: 'Source link',
        url: sourceUrl,
        text: sourceUrl || 'No source link on file.',
      },
      {
        kind: 'action',
        label: 'DSIP handoff',
        hint: getCopy('dsip_button_subtext'),
        button: getCopy('dsip_button_label'),
        url: sourceUrl || DSIP_URL,
      },
      {
        kind: 'action',
        label: 'Disagree with this score?',
        button: getCopy('disagreement_label'),
        confirm: getCopy('disagreement_confirmation'),
        disagree: { kind: 'topic', id: (opp && opp.id) || null },
      },
    ],
  };
}

const ART_DIMENSIONS = [
  ['Priority alignment', 'priority_alignment'],
  ['Transition history', 'transition_history'],
  ['Active scouting', 'active_scouting'],
  ['Tech maturity fit', 'tech_maturity_fit'],
  ['Recency boost', 'recency_boost'],
];

function buildArtWhy(match, sponsor, phase_ii_tech, weights) {
  const w = weights || {};
  const payload = match.payload || {};
  const sub = payload.sub_scores || {};
  const e = match.evidence || {};
  const priority = e.priority_alignment || {};
  const transition = e.transition_history || {};
  const scouting = e.active_scouting || {};
  const spons = sponsor || {};

  return {
    payload_type: 'art',
    header: getCopy('art_match_intro'),
    items: [
      {
        kind: 'score',
        label: 'Final match score and band',
        score: round(payload.match_score),
        max: 100,
        tier: payload.match_band || null,
        note: e.capped_reason || null,
      },
      {
        kind: 'bars',
        label: 'Five sub-score breakdown',
        rows: ART_DIMENSIONS.map(([label, k]) => ({
          label,
          score: round(sub[k]),
          weight: Math.round((Number(w[k]) || 0) * 100),
        })),
      },
      {
        kind: 'entries',
        label: 'Matched modernization priorities',
        rows: (priority.matches || []).map(m => ({
          title: m.priority_name || 'Modernization priority',
          meta: [
            m.tier ? `Tier ${m.tier}` : null,
            m.score != null ? `score ${round(m.score)}` : null,
            Array.isArray(m.matched_keywords) && m.matched_keywords.length
              ? m.matched_keywords.join(', ') : null,
          ].filter(Boolean).join(' · '),
        })),
        empty: 'No modernization priorities matched.',
      },
      {
        kind: 'entries',
        label: 'Historical transition table (≤5 most recent Phase III)',
        rows: (transition.sample || []).map(s => ({
          title: s.vendor || s.vendor_uei || s.recipient || s.title || 'Phase III award',
          meta: [
            s.award_date || null,
            s.amount_usd != null ? fmtUsd(s.amount_usd) : null,
          ].filter(Boolean).join(' · '),
        })),
        summary: transition.count != null
          ? `${transition.count} Phase III transitions · ${fmtUsd(transition.total_usd || 0)} total`
          : null,
        empty: 'No Phase III transition history on record.',
      },
      {
        kind: 'entries',
        label: 'Active scouting signals (≤90d)',
        rows: (scouting.notices || []).map(n => ({
          title: n.title || 'SAM.gov notice',
          meta: [n.notice_type || null, n.posted_date || null].filter(Boolean).join(' · '),
        })),
        empty: 'No active scouting signals in the last 90 days.',
      },
      {
        kind: 'link',
        label: 'Sponsor contact pathway (public sources only)',
        url: safeUrl(spons.public_url),
        text: [spons.name, spons.parent_command].filter(Boolean).join(' — ')
          || 'Sponsor contact pathway',
      },
      {
        kind: 'action',
        label: 'This sponsor is wrong',
        button: getCopy('disagreement_label'),
        confirm: getCopy('disagreement_confirmation'),
        disagree: { kind: 'art', id: match.id || null },
      },
    ],
  };
}

module.exports = { buildTopicWhy, buildArtWhy };
