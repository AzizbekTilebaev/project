/**
 * Loyiha setup: env + quiz_db + tusindirme_sozlik schema.
 * Ma’lumot seed emas — dictionary uchun backup/restore yoki import kerak.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

function run(script) {
  console.log(`\n▶ node scripts/${script}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: backendDir,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

run('ensure-env.js');
run('setup-quiz-db.js');
run('setup-dictionary-db.js');
run('setup-books-db.js');
run('setup-literature-db.js');
console.log('\n✅ Setup tamamlandı.\n');
