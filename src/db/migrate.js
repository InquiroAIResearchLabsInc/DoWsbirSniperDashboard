const { getDb } = require('./index');
const { emitReceipt } = require('../core/receipt');

// "Open in DSIP" must always resolve. Older ingests (and the pre-fix fixture)
// stored fabricated sbir.gov topic/node links that 404. Repoint any stale
// sbir_gov link at the DoD SBIR/STTR Innovation Portal topics app. Idempotent:
// once rewritten the rows no longer match, so re-running is a no-op.
const DSIP_TOPICS_URL = 'https://www.dodsbirsttr.mil/topics-app/';

function backfillSourceUrls(db) {
  const res = db.prepare(`
    UPDATE opportunities
       SET source_url = ?, last_updated = ?
     WHERE source = 'sbir_gov'
       AND ( source_url IS NULL
          OR source_url LIKE 'http://www.sbir.gov/%'
          OR source_url LIKE 'https://www.sbir.gov/topics/%'
          OR source_url LIKE 'https://www.sbir.gov/node/%'
          OR source_url LIKE 'https://www.sbir.gov/solicitations/%' )
  `).run(DSIP_TOPICS_URL, new Date().toISOString());
  if (res.changes > 0) {
    emitReceipt('source_url_backfill', { tenant_id: 'admin', rows_fixed: res.changes, target: DSIP_TOPICS_URL });
    console.log(`Backfilled ${res.changes} stale opportunity source_url(s) -> DSIP topics app.`);
  }
  return res.changes;
}

function run() {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  const backfilled = backfillSourceUrls(db);
  emitReceipt('db_migrate_complete', {
    tenant_id: 'admin',
    tables,
    table_count: tables.length,
    source_url_backfilled: backfilled,
  });
  console.log(`Migrated ${tables.length} tables: ${tables.join(', ')}`);
}

if (require.main === module) run();
module.exports = { run, backfillSourceUrls };
