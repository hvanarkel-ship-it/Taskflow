const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roots = ['api', 'scripts'];
const files = ['server.js'];

for (const root of roots) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith('.js')) files.push(target);
    }
  };
  visit(root);
}

for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Syntax OK: ${files.length} JavaScript files`);
