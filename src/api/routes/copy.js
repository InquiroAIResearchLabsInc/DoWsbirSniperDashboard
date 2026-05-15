const express = require('express');
const { getCopy, listKeys } = require('../../core/copy');

const router = express.Router();
const KEY_RE = /^[a-z0-9_]+$/;

router.get('/', (req, res) => { res.json({ keys: listKeys() }); });

router.get('/:key', (req, res) => {
  const key = String(req.params.key || '');
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'invalid_key' });
  const value = getCopy(key);
  if (value.startsWith('<MISSING_COPY:')) return res.status(404).json({ error: 'not_found', key });
  res.json({ key, value });
});

module.exports = router;
