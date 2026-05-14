const { getDb } = require('./index');
const { emitReceipt } = require('../core/receipt');

function run() {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  emitReceipt('db_migrate_complete', {
    tenant_id: 'admin',
    tables,
    table_count: tables.length,
  });
  console.log(`Migrated ${tables.length} tables: ${tables.join(', ')}`);
}

if (require.main === module) run();
module.exports = { run };
