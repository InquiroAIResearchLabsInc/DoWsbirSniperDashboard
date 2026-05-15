#!/usr/bin/env node
const { resetSandboxTenant } = require('../src/learning/individual');
const out = resetSandboxTenant();
console.log(JSON.stringify(out, null, 2));
