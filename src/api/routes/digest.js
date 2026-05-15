const express = require('express');
const { generateDigest, getLatestDigest } = require('../../digest/digest');
const { requireAuth } = require('../../auth/middleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  let digest = getLatestDigest(req.tenant_id);
  if (!digest) digest = generateDigest(req.tenant_id);
  res.json({ digest });
});

router.post('/generate', requireAuth, (req, res) => {
  res.json({ digest: generateDigest(req.tenant_id) });
});

module.exports = router;
