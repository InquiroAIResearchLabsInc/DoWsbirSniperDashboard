const express = require('express');
const { getDb, safeJson } = require('../../db');
const { requireAdmin, requireAdminOrSandbox, requireAuth } = require('../../auth/middleware');
const aggregator = require('../../learning/component_aggregator');
const { listDiffs } = require('../../diff/engine');
const { emitReceipt, readReceipts, anchorBatch, getCurrentMerkleRoot } = require('../../core/receipt');
const { startScrape, getScrapeState } = require('../../ingest/refresh');

const router = express.Router();

// Live refresh — the dashboard "Refresh" button. Any signed-in session
// (including the public sandbox demo) may trigger it; it pulls the live SBIR
// feed, re-diffs and re-scores. The UI polls /scrape/status for completion.
router.post('/scrape', requireAuth, (req, res) => {
  const started = startScrape();
  res.status(started ? 202 : 409).json({ started, state: getScrapeState() });
});

router.get('/scrape/status', requireAuth, (req, res) => {
  res.json(getScrapeState());
});

router.get('/component-patterns', (req, res) => {
  res.json({ patterns: aggregator.listPatterns(req.query) });
});

router.post('/aggregator/run', requireAdmin, (req, res) => {
  const r = aggregator.run();
  res.json(r);
});

router.get('/diffs', (req, res) => {
  const days = parseInt(req.query.days || '7', 10);
  res.json({ diffs: listDiffs(days) });
});

router.get('/source-status', (req, res) => {
  res.json({ sources: getDb().prepare('SELECT * FROM source_status').all() });
});

router.get('/recent-receipts', requireAdminOrSandbox, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json({ receipts: readReceipts({ limit }), merkle_root: getCurrentMerkleRoot() });
});

router.post('/anchor', requireAdmin, (req, res) => {
  const a = anchorBatch();
  res.json({ anchor: a, merkle_root: getCurrentMerkleRoot() });
});

router.get('/stats', (req, res) => {
  const db = getDb();
  res.json({
    opportunities: db.prepare('SELECT COUNT(*) c FROM opportunities').get().c,
    tenants: db.prepare('SELECT COUNT(*) c FROM tenants').get().c,
    pipeline: db.prepare('SELECT COUNT(*) c FROM pipeline').get().c,
    outcomes: db.prepare('SELECT COUNT(*) c FROM outcomes').get().c,
    art_matches: db.prepare('SELECT COUNT(*) c FROM art_matches').get().c,
    sponsor_candidates: db.prepare('SELECT COUNT(*) c FROM sponsor_candidates').get().c,
    component_patterns: db.prepare('SELECT COUNT(*) c FROM component_patterns').get().c,
  });
});

module.exports = router;
