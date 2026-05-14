const { StopRule } = require('./stoprule');

const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/i;
const ADMIN_TENANT = 'admin';
const DEFAULT_TENANT = 'default';

function validateTenantId(id) {
  if (typeof id !== 'string' || !TENANT_ID_PATTERN.test(id)) {
    throw new StopRule(`Invalid tenant_id: ${id}`, { tenant_id: id });
  }
  return id;
}

function isAdminTenant(id) {
  return id === ADMIN_TENANT;
}

module.exports = {
  TENANT_ID_PATTERN,
  ADMIN_TENANT,
  DEFAULT_TENANT,
  validateTenantId,
  isAdminTenant,
};
