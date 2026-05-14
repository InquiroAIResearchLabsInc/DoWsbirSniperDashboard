#!/usr/bin/env node
const { verifyChain, getCurrentMerkleRoot } = require('../src/core/receipt');
const r = verifyChain();
const out = { ...r, merkle_root: getCurrentMerkleRoot() };
console.log(JSON.stringify(out, null, 2));
if (!r.ok) process.exit(1);
