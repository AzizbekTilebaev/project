/**
 * Shoir rasmlari (vaqt mashinasi) — kk_poets.writer_photos
 */
import { pools } from '../src/config/db.js';

const db = pools.poets;

await db.query(`
  CREATE TABLE IF NOT EXISTS writer_photos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    writer_id INT UNSIGNED NOT NULL,
    year SMALLINT NULL,
    caption_original TEXT NULL,
    caption_latin TEXT NULL,
    image_url VARCHAR(500) NOT NULL,
    stored_name VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_writer_photos_writer (writer_id),
    INDEX idx_writer_photos_year (writer_id, year),
    CONSTRAINT fk_writer_photos_writer
      FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

console.log('✓ writer_photos jadvali tayar');
process.exit(0);
