// ─── CRON SCHEDULER ───────────────────────────────────────────────────────────
// Runs scrapes on schedule per Section 7 of the spec.
// Starts the Express server on the same process.
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const config = require('./config');

const SCRAPE_CMD = (args) => `node "${path.join(__dirname, 'scrape.js')}" ${args}`;

function run(label, args = '') {
  console.log(`\n[CRON] ${new Date().toISOString()} — Running: ${label}`);
  const child = exec(SCRAPE_CMD(args));
  child.stdout.on('data', d => process.stdout.write(d));
  child.stderr.on('data', d => process.stderr.write(d));
  child.on('exit', code => console.log(`[CRON] ${label} exited with code ${code}`));
}

// Daily 05:00 UTC — all daily API sources (SBIR.gov, SAM.gov, Grants.gov).
// scrape.js with no --source arg runs DAILY_SOURCES sequentially in one process,
// which is what the spec's 05:00/05:15/05:30 staggered table is meant to express.
cron.schedule('0 5 * * *', () => run('Daily API scrape', ''), { timezone: 'UTC' });

// Weekly Monday 06:00–06:50 UTC — page scrapers
cron.schedule('0 6 * * 1',  () => run('NSF weekly',       '--source nsf_seedfund'), { timezone: 'UTC' });
cron.schedule('15 6 * * 1', () => run('DIU weekly',       '--source diu'),          { timezone: 'UTC' });
cron.schedule('30 6 * * 1', () => run('SpaceWERX weekly', '--source spacewerx'),    { timezone: 'UTC' });
cron.schedule('45 6 * * 1', () => run('AFWERX weekly',    '--source afwerx'),       { timezone: 'UTC' });
// DASA at 06:50 (was 07:00 — moved to clear the digest window)
cron.schedule('50 6 * * 1', () => run('DASA watch',       '--source dasa_uk'),      { timezone: 'UTC' });

// Monthly 1st 07:15 UTC — DIANA watch
cron.schedule('15 7 1 * *', () => run('DIANA monthly',    '--source diana_nato'),   { timezone: 'UTC' });

// Daily 07:00 UTC — digest (after all scrapes complete)
cron.schedule('0 7 * * *',  () => run('Daily digest',     '--digest-only'),         { timezone: 'UTC' });

// Start the dashboard server
process.env.START_SERVER = '1';
require('./server');

console.log(`
${'='.repeat(60)}
INQUIRO SNIPER SCHEDULER STARTED
${'='.repeat(60)}
Dashboard: http://localhost:${config.PORT}
Scrape schedule (UTC):
  Daily 05:00      — SBIR.gov, SAM.gov, Grants.gov
  Mon   06:00–06:50 — NSF, DIU, SpaceWERX, AFWERX, DASA
  1st   07:15       — NATO DIANA
  Daily 07:00       — Digest generation
${'='.repeat(60)}
`);
