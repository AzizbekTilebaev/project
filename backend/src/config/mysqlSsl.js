/**
 * Aiven / managed MySQL — TLS.
 * DB_SSL=REQUIRED|1  + optional DB_SSL_CA=/path/to/ca.pem
 */
import fs from 'fs';

export function mysqlSslOptions(env = process.env) {
  const mode = String(env.DB_SSL || env.MYSQL_SSL || '').trim().toLowerCase();
  if (!mode || mode === '0' || mode === 'false' || mode === 'off' || mode === 'disabled') {
    return undefined;
  }

  const ssl = {};
  const caPath = env.DB_SSL_CA || env.MYSQL_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    ssl.ca = fs.readFileSync(caPath);
  }
  // Aiven: CA bilan verify; CA yo‘q bo‘lsa ham TLS tunnel (REQUIRED)
  if (env.DB_SSL_REJECT_UNAUTHORIZED === '0' || env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    ssl.rejectUnauthorized = false;
  } else if (ssl.ca) {
    ssl.rejectUnauthorized = true;
  } else {
    // CA yo‘q — ulanish ishlashi uchun (prod da CA yuklang)
    ssl.rejectUnauthorized = false;
  }
  return ssl;
}
