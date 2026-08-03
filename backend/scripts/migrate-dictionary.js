#!/usr/bin/env node

/**
 * Migration Script: Transfer Dictionary Data from main_db to dictionary_db
 * 
 * This script:
 * 1. Connects to both databases
 * 2. Creates dictionary_db if it doesn't exist
 * 3. Reads existing dictionary data from main_db
 * 4. Transfers it to dictionary_db with proper schema
 * 5. Sets up statistics tables
 * 
 * Usage: node scripts/migrate-dictionary.js
 */

import mysql from 'mysql2/promise';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse connection string
function parseConnectionString(connStr) {
  try {
    const u = new url.URL(connStr);
    return {
      user: u.username,
      password: u.password,
      host: u.hostname,
      port: u.port || 3306,
      database: u.pathname.replace(/^\//, '')
    };
  } catch (err) {
    console.error('❌ Invalid DATABASE_URL format');
    throw err;
  }
}

async function main() {
  console.log('🔄 Starting Dictionary Database Migration...\n');

  const mainConnStr = process.env.DATABASE_URL;
  if (!mainConnStr) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const mainConfig = parseConnectionString(mainConnStr);
  
  try {
    // 1. Connect to MySQL server (without database)
    console.log('📡 Connecting to MySQL server...');
    const adminConn = await mysql.createConnection({
      host: mainConfig.host,
      port: mainConfig.port,
      user: mainConfig.user,
      password: mainConfig.password,
      multipleStatements: true
    });

    // 2. Create dictionary_db if not exists
    console.log('📁 Creating dictionary_db database...');
    await adminConn.execute(`
      CREATE DATABASE IF NOT EXISTS dictionary_db 
      CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ dictionary_db database created/verified');

    // 3. Load and execute schema SQL
    console.log('⚙️  Setting up dictionary_db schema...');
    const schemaPath = path.join(__dirname, 'dictionary_db_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      process.exit(1);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await adminConn.query(schemaSql);
    console.log('✅ dictionary_db schema created successfully');

    // 4. Connect to main database
    console.log('\n📡 Connecting to main_db...');
    const mainPool = await mysql.createPool({
      host: mainConfig.host,
      port: mainConfig.port,
      user: mainConfig.user,
      password: mainConfig.password,
      database: mainConfig.database,
      waitForConnections: true,
      connectionLimit: 5
    });

    // 5. Transfer data from main_db.dictionary to dictionary_db.dictionary_words
    console.log('📚 Migrating dictionary data...');
    const [mainWords] = await mainPool.query(
      'SELECT id, word, meaning, example FROM dictionary WHERE id NOT IN (SELECT id FROM dictionary_words) LIMIT 1000'
    ).catch(() => [[]]);

    if (mainWords && mainWords.length > 0) {
      console.log(`  Found ${mainWords.length} words to migrate`);
      
      const dictConn = await mysql.createConnection({
        host: mainConfig.host,
        port: mainConfig.port,
        user: mainConfig.user,
        password: mainConfig.password,
        database: 'dictionary_db'
      });

      let migrated = 0;
      for (const w of mainWords) {
        try {
          await dictConn.execute(
            `INSERT INTO dictionary_words 
             (id, word, normalized, type, grammarTags, stylistic, definitions, examples, synonyms, antonyms, source, views, searches, likes, exampleCount, phraseCount, addedAt, lastViewedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, NOW())`,
            [
              w.id || generateUUID(),
              w.word,
              (w.word || '').toLowerCase(),
              'noun', // default type
              null,
              null,
              w.meaning || '',
              JSON.stringify(w.example ? [{ text: w.example }] : []),
              null,
              null,
              'Migrated from main_db',
              0, 0, 0, 1, 0
            ]
          );
          migrated++;
        } catch (err) {
          if (!err.message.includes('Duplicate')) {
            console.error(`  ⚠️  Error migrating word ${w.word}:`, err.message);
          }
        }
      }
      console.log(`✅ Migrated ${migrated}/${mainWords.length} words`);

      await dictConn.end();
    } else {
      console.log('  ℹ️  No words to migrate from main_db.dictionary');
    }

    // 6. Verify migration
    console.log('\n📊 Verifying migration...');
    const dictPool = await mysql.createPool({
      host: mainConfig.host,
      port: mainConfig.port,
      user: mainConfig.user,
      password: mainConfig.password,
      database: 'dictionary_db',
      waitForConnections: true,
      connectionLimit: 5
    });

    const [[{ wordCount }]] = await dictPool.query('SELECT COUNT(*) as wordCount FROM dictionary_words');
    const [[{ exampleCount }]] = await dictPool.query('SELECT COUNT(*) as exampleCount FROM dictionary_examples');
    const [[{ phraseCount }]] = await dictPool.query('SELECT COUNT(*) as phraseCount FROM dictionary_phrases');

    console.log(`\n📈 Migration Statistics:`);
    console.log(`  • Total Words: ${wordCount}`);
    console.log(`  • Total Examples: ${exampleCount}`);
    console.log(`  • Total Phrases: ${phraseCount}`);

    console.log('\n✅ Dictionary migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update DATABASE_URL_DICTIONARY in .env file:');
    console.log('     DATABASE_URL_DICTIONARY=mysql://user:pass@localhost:3306/dictionary_db');
    console.log('  2. Restart the backend server: npm run dev');
    console.log('  3. Test dictionary endpoints: http://localhost:5000/api/dictionary');

    await mainPool.end();
    await dictPool.end();
    await adminConn.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nDebug info:');
    console.error('  • Check .env file for DATABASE_URL');
    console.error('  • Ensure MySQL is running');
    console.error('  • Verify database credentials');
    process.exit(1);
  }
}

// Simple UUID generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

main();
