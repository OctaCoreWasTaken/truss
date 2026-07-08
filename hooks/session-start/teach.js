const fs = require('fs');
const path = require('path');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '../..');

function stripFrontmatter(content) {
  if (!content.startsWith('---\n')) return content;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return content;
  return content.slice(end + 4).replace(/^\n+/, '');
}

module.exports = function teach(input, projectRoot = process.cwd(), pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const overridePath = path.join(projectRoot, 'truss-skills', 'plain-speak.md');
  if (fs.existsSync(overridePath)) {
    return { additionalContext: fs.readFileSync(overridePath, 'utf8').trim() };
  }
  const skillPath = path.join(pluginRoot, 'skills', 'plain-speak', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  return { additionalContext: stripFrontmatter(content).trim() };
};
