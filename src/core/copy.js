const fs = require('fs');
const path = require('path');
const config = require('./config');

const COPY_DIR = path.join(config.ROOT, 'docs', 'copy');
const CACHE = new Map();
const CACHE_TTL_MS = 60000;

function getCopy(key) {
  const cached = CACHE.get(key);
  const now = Date.now();
  if (cached && now - cached.fetched < CACHE_TTL_MS) return cached.value;
  const file = path.join(COPY_DIR, `${key}.md`);
  let value;
  if (!fs.existsSync(file)) {
    value = `<MISSING_COPY:${key}>`;
  } else {
    const raw = fs.readFileSync(file, 'utf8');
    value = stripHeadingAndComments(raw).trim();
    if (!value) value = `<EMPTY_COPY:${key}>`;
  }
  CACHE.set(key, { value, fetched: now });
  return value;
}

function stripHeadingAndComments(raw) {
  const lines = raw.split('\n');
  const out = [];
  let inHtmlComment = false;
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (line.includes('<!--')) inHtmlComment = true;
    if (!inHtmlComment) out.push(line);
    if (line.includes('-->')) inHtmlComment = false;
  }
  return out.join('\n');
}

function clearCache() { CACHE.clear(); }

function listKeys() {
  if (!fs.existsSync(COPY_DIR)) return [];
  return fs.readdirSync(COPY_DIR).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
}

function hasUnsubstitutedPlaceholders(value) {
  return /<PLACEHOLDER_[A-Z_]+>/.test(value);
}

module.exports = { getCopy, clearCache, listKeys, hasUnsubstitutedPlaceholders, COPY_DIR };
