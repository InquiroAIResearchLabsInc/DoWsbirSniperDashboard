const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { StopRule } = require('../core/stoprule');

const SEED_TOPIC = path.join(config.ROOT, 'seed', 'default_weights_topic.json');
const SEED_ART = path.join(config.ROOT, 'seed', 'default_weights_art.json');

function loadSeed(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

const DEFAULT_TOPIC = loadSeed(SEED_TOPIC).weights;
const DEFAULT_ART = loadSeed(SEED_ART).weights;
const ART_META = loadSeed(SEED_ART);

function ensureInitialWeights(engine, defaults, tenant_id = 'default') {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) c FROM weight_history WHERE engine = ? AND tenant_id = ?').get(engine, tenant_id);
  if (row.c === 0) {
    db.prepare(`INSERT INTO weight_history (id, tenant_id, engine, changed_at, trigger, dimension, old_weight, new_weight, reason, outcomes_count, weights_snapshot) VALUES (?, ?, ?, ?, 'initial', 'all', NULL, NULL, ?, 0, ?)`)
      .run(uid(), tenant_id, engine, now(), `Initial ${engine} weights per spec v0.2`, JSON.stringify(defaults));
    emitReceipt('weight_history_seeded', { tenant_id, engine, weights: defaults });
  }
}

function getWeights(engine, tenant_id = 'default') {
  const defaults = engine === 'art' ? DEFAULT_ART : DEFAULT_TOPIC;
  ensureInitialWeights(engine, defaults, tenant_id);
  const db = getDb();
  const row = db.prepare("SELECT weights_snapshot FROM weight_history WHERE engine = ? AND tenant_id = ? AND weights_snapshot IS NOT NULL ORDER BY changed_at DESC LIMIT 1").get(engine, tenant_id);
  if (!row || !row.weights_snapshot) return { ...defaults };
  try { return { ...defaults, ...JSON.parse(row.weights_snapshot) }; } catch { return { ...defaults }; }
}

function applyWeights({ engine, weights, tenant_id, trigger = 'manual', reason, outcomes_count = 0 }) {
  const defaults = engine === 'art' ? DEFAULT_ART : DEFAULT_TOPIC;
  const keys = Object.keys(defaults);
  const merged = { ...getWeights(engine, tenant_id) };
  for (const k of keys) {
    if (weights[k] != null) {
      const v = Number(weights[k]);
      if (Number.isNaN(v) || v < 0 || v > 1) throw new StopRule(`Invalid weight for ${k}: ${weights[k]}`);
      merged[k] = v;
    }
  }
  const sum = keys.reduce((s, k) => s + merged[k], 0);
  if (Math.abs(sum - 1) > 0.01) throw new StopRule(`Weights must sum to 1.0 (got ${sum.toFixed(3)})`);
  const db = getDb();
  db.prepare(`INSERT INTO weight_history (id, tenant_id, engine, changed_at, trigger, dimension, old_weight, new_weight, reason, outcomes_count, weights_snapshot) VALUES (?, ?, ?, ?, ?, 'all', NULL, NULL, ?, ?, ?)`)
    .run(uid(), tenant_id, engine, now(), trigger, reason || 'Manual weight update', outcomes_count, JSON.stringify(merged));
  emitReceipt('weights_applied', { tenant_id, engine, trigger, weights: merged });
  return merged;
}

function band(score) {
  if (score >= ART_META.bands.strong_min) return 'Strong';
  if (score >= ART_META.bands.promising_min) return 'Promising';
  return 'Weak';
}

function tier(score) {
  if (score >= 80) return 'PRIME';
  if (score >= 60) return 'EVALUATE';
  if (score >= 40) return 'STRETCH';
  return 'SKIP';
}

module.exports = { getWeights, applyWeights, band, tier, DEFAULT_TOPIC, DEFAULT_ART, ART_META };
