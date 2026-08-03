import dotenv from 'dotenv';
import './ensure-env.js';
import prisma from '../src/config/database.js';
import dictionaryService from '../src/services/dictionaryService.js';

dotenv.config();

async function run() {
  try {
    if (!process.env.DATABASE_URL_DICTIONARY && !process.env.DATABASE_URL) {
      console.error('No DATABASE_URL_DICTIONARY or DATABASE_URL found in environment. Set DATABASE_URL_DICTIONARY to your dictionary MySQL instance and retry.');
      process.exit(2);
    }
    console.log('Starting dictionary import from Prisma-managed DB into dictionary DB...');
    await dictionaryService.importFromPrisma(prisma);
    console.log('Dictionary import completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

run();
