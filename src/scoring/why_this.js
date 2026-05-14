const { getCopy } = require('../core/copy');

function buildTopicWhy(score, weights, opp) {
  return {
    payload_type: 'topic',
    header: getCopy('why_panel_header'),
    items: [
      { label: 'Final score and tier', value: { fit_score: score.fit_score, score_tier: score.score_tier } },
      { label: 'Five-dimension breakdown with weights', value: {
        tech_alignment: { sub_score: score.score_tech, weight: weights.tech_alignment },
        domain_alignment: { sub_score: score.score_domain, weight: weights.domain_alignment },
        submission_type: { sub_score: score.score_type, weight: weights.submission_type },
        timeline: { sub_score: score.score_timeline, weight: weights.timeline },
        funding_efficiency: { sub_score: score.score_funding, weight: weights.funding_efficiency },
      }},
      { label: 'Matched keywords', value: score.keywords_matched },
      { label: 'Disqualifier hit (if any)', value: score.disqualified_by || null },
      { label: 'Source link', value: opp ? opp.source_url || null : null },
      { label: 'DSIP handoff', value: { label: getCopy('dsip_handoff_microcopy'), url: opp ? opp.source_url || null : null } },
      { label: 'Disagree with this score?', value: { label: getCopy('disagreement_button'), action: 'POST /api/why/disagree' } },
    ],
  };
}

function buildArtWhy(match, sponsor, phase_ii_tech, weights) {
  const e = match.evidence;
  const sub = match.payload.sub_scores;
  return {
    payload_type: 'art',
    header: getCopy('art_match_intro'),
    items: [
      { label: 'Final match score and band', value: { score: match.payload.match_score, band: match.payload.match_band, capped_reason: e.capped_reason } },
      { label: 'Five sub-score breakdown', value: {
        priority_alignment: { score: sub.priority_alignment, weight: weights.priority_alignment },
        transition_history: { score: sub.transition_history, weight: weights.transition_history },
        active_scouting: { score: sub.active_scouting, weight: weights.active_scouting },
        tech_maturity_fit: { score: sub.tech_maturity_fit, weight: weights.tech_maturity_fit },
        recency_boost: { score: sub.recency_boost, weight: weights.recency_boost },
      }},
      { label: 'Matched modernization priorities', value: e.priority_alignment.matches },
      { label: 'Historical transition table (≤5 most recent Phase III)', value: e.transition_history.sample, summary: {
        count: e.transition_history.count,
        total_usd: e.transition_history.total_usd,
      }},
      { label: 'Active scouting signals (≤90d)', value: e.active_scouting.notices, has_signal: e.active_scouting.has_signal },
      { label: 'Sponsor contact pathway (public sources only)', value: { sponsor_name: sponsor.name, sponsor_url: sponsor.public_url, parent_command: sponsor.parent_command } },
      { label: 'This sponsor is wrong', value: { label: getCopy('disagreement_button'), action: 'POST /api/art-matches/:id/disagree' } },
    ],
  };
}

module.exports = { buildTopicWhy, buildArtWhy };
