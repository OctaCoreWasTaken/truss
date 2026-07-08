const fs = require('fs');
const path = require('path');

function eventToDir(event) {
  return event.replace(/([A-Z])/g, (match, letter, offset) =>
    (offset > 0 ? '-' : '') + letter.toLowerCase()
  );
}

function runHandlers(event, input, hooksDir = __dirname) {
  const dir = path.join(hooksDir, eventToDir(event));
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const contexts = [];

  for (const file of files) {
    let result;
    try {
      const handler = require(path.join(dir, file));
      result = handler(input);
    } catch (e) {
      process.stderr.write(`[truss] handler error in ${file}: ${e.message}\n`);
      continue;
    }
    if (result && result.block) return result;
    if (result && result.additionalContext) contexts.push(result.additionalContext);
  }

  return contexts.length > 0 ? { additionalContext: contexts.join('\n\n') } : null;
}

function formatOutput(result) {
  if (result && result.block) {
    return { stdout: JSON.stringify({ decision: 'block', reason: result.message }) + '\n', exitCode: 0 };
  }
  if (result && result.additionalContext) {
    return { stdout: JSON.stringify({ additionalContext: result.additionalContext }) + '\n', exitCode: 0 };
  }
  return { stdout: '', exitCode: 0 };
}

if (require.main === module) {
  const event = process.argv[2];
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw || '{}');
  const result = runHandlers(event, input);
  const { stdout, exitCode } = formatOutput(result);
  if (stdout) process.stdout.write(stdout);
  process.exit(exitCode);
}

module.exports = { runHandlers, eventToDir, formatOutput };
