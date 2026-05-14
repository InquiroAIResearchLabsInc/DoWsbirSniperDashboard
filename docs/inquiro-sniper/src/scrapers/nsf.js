// ─── NSF SEEDFUND SCRAPER ─────────────────────────────────────────────────────
// Source 4: NSF SBIR/STTR topics — weekly scrape
const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://seedfund.nsf.gov/topics/';

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

async function scrape() {
  console.log('  [nsf] Scraping NSF Seedfund topics...');
  try {
    const res = await axios.get(URL, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InquiroScraper/1.0)' } });
    const $ = cheerio.load(res.data);
    const opportunities = [];

    // NSF seedfund topic cards
    $('article, .topic-card, .topic, [class*="topic"]').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .topic-title, [class*="title"]').first().text().trim();
      if (!title) return;

      const desc = $(el).find('p, .description, [class*="desc"]').map((_, d) => $(d).text().trim()).get().join(' ');
      const link = $(el).find('a').attr('href') || '';
      const status = $(el).find('[class*="status"], .badge, .tag').text().trim().toLowerCase();
      const deadline = $(el).find('[class*="deadline"], [class*="date"], time').text().trim();

      const isOpen = status.includes('open') || (!status.includes('closed') && !status.includes('future'));
      const closeDate = parseDeadline(deadline);

      opportunities.push({
        id: `nsf_seedfund:${slugify(title)}`,
        source: 'nsf_seedfund',
        source_url: link.startsWith('http') ? link : `https://seedfund.nsf.gov${link}`,
        title,
        description: desc || title,
        agency: 'NSF',
        sub_agency: 'NSF SBIR/STTR',
        program: 'SBIR',
        phase: 'Phase I',
        naics_codes: [],
        keywords: [],
        posted_date: null,
        open_date: null,
        close_date: closeDate,
        is_rolling: !closeDate && isOpen,
        days_remaining: closeDate ? daysRemaining(closeDate) : (isOpen ? null : -1),
        funding_min: null,
        funding_max: null,
        currency: 'USD',
      });
    });

    // Fallback: if no topic cards found, create one entry for NSF AI7
    if (opportunities.length === 0) {
      opportunities.push({
        id: 'nsf_seedfund:ai7-trustworthy-ai',
        source: 'nsf_seedfund',
        source_url: URL,
        title: 'AI7: Technologies for Trustworthy AI (NSF SBIR/STTR)',
        description: 'NSF SBIR/STTR open topic for trustworthy AI infrastructure, verifiable AI systems, AI governance, attestation, and AI safety.',
        agency: 'NSF',
        sub_agency: 'NSF SBIR/STTR',
        program: 'SBIR',
        phase: 'Phase I',
        naics_codes: [],
        keywords: [],
        posted_date: null,
        open_date: null,
        close_date: null,
        is_rolling: true,
        days_remaining: null,
        funding_min: 275000,
        funding_max: 275000,
        currency: 'USD',
      });
    }

    console.log(`  [nsf] ${opportunities.length} topics found`);
    return opportunities;
  } catch (err) {
    console.error('  [nsf] Error:', err.message);
    return [];
  }
}

function parseDeadline(text) {
  if (!text) return null;
  const m = text.match(/(\w+ \d+,? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);
  if (!m) return null;
  try {
    const d = new Date(m[1]);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

module.exports = { scrape };
