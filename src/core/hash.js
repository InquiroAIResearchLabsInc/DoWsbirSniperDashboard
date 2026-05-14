const crypto = require('crypto');

let _blake3 = null;
try { _blake3 = require('blake3'); } catch (_) { _blake3 = null; }

function sha256Hex(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function blake3Hex(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));
  if (_blake3 && typeof _blake3.hash === 'function') {
    return Buffer.from(_blake3.hash(buf)).toString('hex');
  }
  return crypto.createHash('sha256').update(buf).update('::blake3-fallback').digest('hex');
}

function dualHash(input) {
  return `${sha256Hex(input)}:${blake3Hex(input)}`;
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function merkleRoot(items) {
  if (!items || items.length === 0) return dualHash('empty');
  let layer = items.map(i => dualHash(stableStringify(i)));
  while (layer.length > 1) {
    if (layer.length % 2 === 1) layer.push(layer[layer.length - 1]);
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(dualHash(layer[i] + layer[i + 1]));
    layer = next;
  }
  return layer[0];
}

module.exports = { sha256Hex, blake3Hex, dualHash, stableStringify, merkleRoot };
