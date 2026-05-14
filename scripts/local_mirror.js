#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const config = require('../src/core/config');

if (fs.existsSync(config.DEMO_SNAPSHOT_PATH) && !fs.existsSync(config.DB_PATH)) {
  fs.mkdirSync(path.dirname(config.DB_PATH), { recursive: true });
  fs.copyFileSync(config.DEMO_SNAPSHOT_PATH, config.DB_PATH);
  console.log(`Bootstrapped DB from snapshot: ${config.DEMO_SNAPSHOT_PATH} -> ${config.DB_PATH}`);
}

process.env.PORT = process.env.PORT || '3000';
console.log(`Local mirror mode. Render is the primary; this is the Render-fallback boot. Visit http://localhost:${process.env.PORT}`);
require('../src/api/server').start();
