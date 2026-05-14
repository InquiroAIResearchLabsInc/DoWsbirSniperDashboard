const express = require('express');
const { readReceipts, verifyChain, getCurrentMerkleRoot } = require('../../core/receipt');

const router = express.Router();

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const tenant_id = req.query.tenant_id || req.tenant_id;
  res.json({ receipts: readReceipts({ tenant_id, receipt_type: req.query.receipt_type, limit }), merkle_root: getCurrentMerkleRoot() });
});

router.get('/verify', (req, res) => {
  res.json(verifyChain());
});

router.get('/merkle', (req, res) => {
  res.json({ merkle_root: getCurrentMerkleRoot() });
});

module.exports = router;
