const { getCopy } = require('../core/copy');

function emptyStatePayload({ tenant_id, fallback_opps = [] } = {}) {
  return {
    empty_state: true,
    title: getCopy('empty_state').split('\n')[0] || 'No PRIME tier topics right now',
    body: getCopy('empty_state'),
    tenant_id,
    fallback: fallback_opps.slice(0, 3),
  };
}

module.exports = { emptyStatePayload };
