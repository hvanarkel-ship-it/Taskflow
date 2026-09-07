const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');

test('deal deletion verifies ownership before deleting notes', () => {
  const source = read('api/opportunities.js');
  const ownership = source.indexOf('SELECT id FROM opportunities WHERE id=${id} AND user_id=${user.id} FOR UPDATE');
  const notesDelete = source.indexOf('DELETE FROM opp_notes WHERE opp_id=${id}');
  assert.ok(ownership >= 0, 'ownership lock is missing');
  assert.ok(notesDelete > ownership, 'notes are deleted before ownership is verified');
  assert.match(source, /sql\.begin/);
});

test('public registration never auto-approves an account', () => {
  const source = read('api/auth.js');
  assert.match(source, /VALUES \(\$\{email\}, \$\{hash\}, \$\{name\.trim\(\)\}, false\)/);
  assert.doesNotMatch(source, /\bisAdmin\b/);
});

test('admin authorization checks current database state', () => {
  const source = read('api/auth.js');
  assert.match(source, /SELECT id, email, approved FROM users WHERE id = \$\{caller\.id\}/);
  assert.match(source, /!dbUser\.approved/);
  assert.match(source, /process\.env\.ADMIN_EMAIL \|\| ''/);
});

test('secrets and local environment files stay ignored', () => {
  const ignore = read('.gitignore');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.local$/m);
});
