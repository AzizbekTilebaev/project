import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function ensureKey(content, key, value) {
  if (new RegExp(`^${key}=`, 'm').test(content)) return content;
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

const defaults = {
  PORT: '5000',
  NODE_ENV: 'development',
  FRONTEND_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000',
  SITE_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: '"mysql://root:@127.0.0.1:3306/qaraqalpaq_db"',
  DATABASE_QUIZ: '"mysql://root:@127.0.0.1:3306/quiz_db"',
  DATABASE_TUSINDIRME: '"mysql://root:@127.0.0.1:3306/tusindirme_sozlik"',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASS: '',
  DB_NAME: 'tusindirme_sozlik',
};

if (!fs.existsSync(envPath)) {
  let content = '';
  for (const [k, v] of Object.entries(defaults)) content += `${k}=${v}\n`;
  content += `JWT_SECRET=${randomSecret()}\n`;
  content += `IMPORT_API_KEY=${crypto.randomBytes(32).toString('hex')}\n`;
  content += `ACTOR_HMAC_SECRET=${randomSecret()}\n`;
  content += `ADMIN_SESSION_SECRET=${randomSecret()}\n`;
  content += `ADMIN_PASSWORD=change-me-admin-password\n`;
  content += `BOOKS_MAX_UPLOAD_MB=25\n`;
  fs.writeFileSync(envPath, content);
  console.log('✅ .env yaratildi (random secrets + DB_* + DATABASE_QUIZ/TUSINDIRME)');
} else {
  let envContent = fs.readFileSync(envPath, 'utf-8');
  for (const [k, v] of Object.entries(defaults)) {
    envContent = ensureKey(envContent, k, v);
  }
  if (!/^JWT_SECRET=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'JWT_SECRET', randomSecret());
  }
  if (!/^IMPORT_API_KEY=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'IMPORT_API_KEY', crypto.randomBytes(32).toString('hex'));
  }
  if (!/^ACTOR_HMAC_SECRET=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'ACTOR_HMAC_SECRET', randomSecret());
  }
  if (!/^ADMIN_SESSION_SECRET=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'ADMIN_SESSION_SECRET', randomSecret());
  }
  if (!/^ADMIN_PASSWORD=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'ADMIN_PASSWORD', 'change-me-admin-password');
  }
  if (!/^BOOKS_MAX_UPLOAD_MB=/m.test(envContent)) {
    envContent = ensureKey(envContent, 'BOOKS_MAX_UPLOAD_MB', '25');
  }
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env tekshirildi / yetishmayotgan kalitlar qo‘shildi');
}

console.log('\n✅ Environment setup complete!\n');
