const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  gates:    { auto_compact: true, model_routing: true },
  model:    { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:      { events: true, decisions: true },
  context:  { context_max: 200000, threshold: 0.6 },
  research: { decide: 'user', max_rounds: 3 },
};

function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(v => parseValue(v.trim()));
  }
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

function parseToml(content) {
  const result = {};
  let section = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) {
      const m = trimmed.match(/^\[(\w+)\]$/);
      if (!m) throw new Error(`Invalid section header: ${trimmed}`);
      section = m[1];
      result[section] = {};
      continue;
    }
    if (!trimmed.includes('=')) throw new Error(`Invalid line: ${trimmed}`);
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim().replace(/#.*$/, '').trim();
    if (!key.match(/^\w+$/)) throw new Error(`Invalid key: ${key}`);
    if (section === null) throw new Error('Key-value pair before any section');
    result[section][key] = parseValue(rawVal);
  }
  return result;
}

function mergeWithDefaults(parsed) {
  const result = {};
  for (const [section, vals] of Object.entries(DEFAULTS)) {
    result[section] = { ...vals, ...(parsed[section] || {}) };
  }
  return result;
}

function loadConfig(projectRoot) {
  const tomlPath = path.join(projectRoot, 'truss.toml');
  if (!fs.existsSync(tomlPath)) return { config: mergeWithDefaults({}), warning: null };
  try {
    const parsed = parseToml(fs.readFileSync(tomlPath, 'utf8'));
    return { config: mergeWithDefaults(parsed), warning: null };
  } catch (e) {
    return { config: mergeWithDefaults({}), warning: `malformed truss.toml — using defaults (${e.message})` };
  }
}

module.exports = { loadConfig };
