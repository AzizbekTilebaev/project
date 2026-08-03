// Script to load books from umitjagisi.json into the database
// Usage: node backend/scripts/load-books.js

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadBooks() {
  try {
    console.log('📚 Starting to load books from JSON...');
    
    // Read JSON file
    const jsonPath = path.join(__dirname, '../../umitjagisi.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const books = JSON.parse(jsonData);
    
    console.log(`✅ Loaded ${books.length} books from JSON`);
    
    // For each book, we could create ebook entries in the database
    // This is optional - you can keep the JSON approach or migrate to DB
    
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      
      // Check if book already exists
      const existingBook = await prisma.ebook.findFirst({
        where: { title: book.name }
      });
      
      if (!existingBook) {
        // Create ebook entry
        await prisma.ebook.create({
          data: {
            title: book.name,
            description: book.desc,
            fileUrl: `/books/${i}`, // Reference to JSON index
            format: 'json' // Custom format to indicate JSON source
          }
        });
        console.log(`✅ Created database entry for: ${book.name}`);
      } else {
        console.log(`⏭️  Skipped (already exists): ${book.name}`);
      }
    }
    
    console.log('✅ Books migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error loading books:', error);
    process.exit(1);
  }
}

// Run the migration
loadBooks();
