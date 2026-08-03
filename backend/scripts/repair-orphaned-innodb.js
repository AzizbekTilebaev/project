/**
 * Orphan InnoDB (.ibd bor, engine yo‘q) jadvallarni tiklash.
 * 1) DROP orphan metadata
 * 2) CREATE (faqat PRIMARY KEY)
 * 3) DISCARD TABLESPACE → eski .ibd → IMPORT
 *
 * Ishlatish (MySQL ishlayotgan bo‘lsin):
 *   node scripts/repair-orphaned-innodb.js
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { SERVER_CONFIG } from '../src/config/db.js';

const DATA_DIR = process.env.MYSQL_DATA_DIR || 'C:\\xampp\\mysql\\data';
const BACKUP = path.join(DATA_DIR, '_recover_full');

/** [db, table, createSqlWithoutSecondaryIndexes] */
const TABLES = [
  // —— dictionary (kk_tusindirme) ——
  [
    'kk_tusindirme',
    'categorys',
    `CREATE TABLE categorys (
      id int(11) NOT NULL AUTO_INCREMENT,
      temp_id varchar(50) DEFAULT NULL,
      name varchar(100) NOT NULL,
      code varchar(50) DEFAULT NULL,
      description text DEFAULT NULL,
      questions text DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'titles',
    `CREATE TABLE titles (
      id varchar(36) NOT NULL,
      temp_id varchar(50) DEFAULT NULL,
      soz varchar(255) NOT NULL,
      normalized varchar(255) NOT NULL,
      search_key varchar(191) DEFAULT NULL,
      \`order\` int(11) DEFAULT 0,
      st_let char(1) DEFAULT NULL,
      status tinyint(4) DEFAULT 1,
      user_id int(11) DEFAULT NULL,
      views_count int(11) DEFAULT 0,
      search_count int(11) DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'description',
    `CREATE TABLE description (
      id varchar(36) NOT NULL,
      temp_id varchar(50) DEFAULT NULL,
      titles_id varchar(36) NOT NULL,
      sort_order int(11) DEFAULT 0,
      categorys_id int(11) DEFAULT NULL,
      description text NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'examples',
    `CREATE TABLE examples (
      id varchar(36) NOT NULL,
      temp_id varchar(50) DEFAULT NULL,
      descriptions_id varchar(36) NOT NULL,
      sort_order int(11) DEFAULT 0,
      example text NOT NULL,
      author varchar(255) DEFAULT NULL,
      author_id int(11) DEFAULT NULL,
      is_approved tinyint(4) DEFAULT 0,
      user_id int(11) DEFAULT NULL,
      target_start_index int(11) DEFAULT NULL,
      target_end_index int(11) DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'idioms',
    `CREATE TABLE idioms (
      id varchar(36) NOT NULL,
      sort_order int(11) DEFAULT NULL,
      temp_id varchar(50) DEFAULT NULL,
      descriptions_id varchar(36) NOT NULL,
      phrase varchar(255) NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'idiom_desc',
    `CREATE TABLE idiom_desc (
      id varchar(36) NOT NULL,
      temp_id varchar(50) DEFAULT NULL,
      idioms_id varchar(36) NOT NULL,
      description text NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'etimologiya',
    `CREATE TABLE etimologiya (
      id varchar(36) NOT NULL,
      temp_id varchar(50) DEFAULT NULL,
      title_id varchar(36) NOT NULL,
      etymology_type enum('native','borrowed','derivative','compound','unknown') DEFAULT 'native',
      original_language varchar(100) DEFAULT NULL,
      root_word varchar(255) DEFAULT NULL,
      description text DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'curated_words',
    `CREATE TABLE curated_words (
      id int unsigned NOT NULL AUTO_INCREMENT,
      title_id varchar(36) NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      note varchar(255) DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— literature ——
  [
    'kk_poetrys',
    'book_sections',
    `CREATE TABLE book_sections (
      id VARCHAR(80) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      paragraphs_json LONGTEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poetrys',
    'literature_pieces',
    `CREATE TABLE literature_pieces (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      writer_id INT UNSIGNED NULL,
      title_original VARCHAR(255) NOT NULL,
      title_latin VARCHAR(255) NOT NULL DEFAULT '',
      paragraphs_json LONGTEXT NOT NULL,
      paragraphs_cyrillic_json LONGTEXT NULL,
      paragraphs_latin_json LONGTEXT NULL,
      work_year SMALLINT NULL,
      work_date_label_original VARCHAR(120) NULL,
      work_date_label_latin VARCHAR(120) NULL,
      work_place_original VARCHAR(255) NULL,
      work_place_latin VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      content_hash CHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poetrys',
    'writer_creative_works',
    `CREATE TABLE writer_creative_works (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      writer_id INT UNSIGNED NOT NULL,
      slug VARCHAR(160) NOT NULL,
      title_original VARCHAR(255) NOT NULL,
      title_latin VARCHAR(255) NOT NULL DEFAULT '',
      work_type VARCHAR(40) NOT NULL DEFAULT 'qosıq',
      year_label VARCHAR(80) NOT NULL DEFAULT '',
      body_text MEDIUMTEXT NULL,
      body_text_cyrillic MEDIUMTEXT NULL,
      body_text_latin MEDIUMTEXT NULL,
      linked_book_id VARCHAR(64) NULL,
      linked_section_index INT NULL,
      availability ENUM('in_library','mentioned_only','not_imported') NOT NULL DEFAULT 'not_imported',
      sort_order INT NOT NULL DEFAULT 0,
      content_hash CHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poetrys',
    'book_lessons',
    `CREATE TABLE book_lessons (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      section_index INT NOT NULL DEFAULT 0,
      engine VARCHAR(40) NOT NULL DEFAULT 'local-reading-v1',
      lesson_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poets',
    'literature_writers',
    `CREATE TABLE literature_writers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source_id INT UNSIGNED NULL,
      slug VARCHAR(120) NOT NULL,
      poet_name_original VARCHAR(255) NOT NULL,
      poet_name_latin VARCHAR(255) NOT NULL DEFAULT '',
      life_span VARCHAR(100) NOT NULL DEFAULT '',
      birth_year SMALLINT NULL,
      death_year SMALLINT NULL,
      birth_month TINYINT UNSIGNED NULL,
      birth_day TINYINT UNSIGNED NULL,
      birth_date DATE NULL,
      birth_precision ENUM('year','month','day','approx') NOT NULL DEFAULT 'year',
      death_date DATE NULL,
      birthplace_original VARCHAR(255) NULL,
      birthplace_latin VARCHAR(255) NULL,
      birth_lat DECIMAL(9,6) NULL,
      birth_lng DECIMAL(9,6) NULL,
      geocode_status ENUM('none','pending','resolved','failed','manual') NOT NULL DEFAULT 'none',
      facts_json JSON NULL,
      biography_original MEDIUMTEXT NULL,
      biography_plain_original MEDIUMTEXT NULL,
      biography_latin MEDIUMTEXT NULL,
      source VARCHAR(120) NOT NULL DEFAULT 'writers-qq-cyrillic.json',
      content_hash CHAR(64) NULL,
      status ENUM('published','draft') NOT NULL DEFAULT 'published',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_jumbaqlar',
    'jumbaqlar',
    `CREATE TABLE jumbaqlar (
      id INT UNSIGNED NOT NULL PRIMARY KEY,
      jumbaq_original TEXT NOT NULL,
      jumbaq_cyrillic TEXT NULL,
      juwap_original VARCHAR(500) NOT NULL,
      juwap_cyrillic VARCHAR(500) NULL,
      topar INT NOT NULL DEFAULT 0,
      utopar INT NOT NULL DEFAULT 0,
      variant_group CHAR(64) NULL,
      content_hash CHAR(64) NULL,
      status ENUM('published','draft') NOT NULL DEFAULT 'published',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_quiz',
    'quizzes',
    `CREATE TABLE quizzes (
      id VARCHAR(32) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      level VARCHAR(32),
      category VARCHAR(64),
      time_mode ENUM('timed','untimed') NOT NULL DEFAULT 'untimed',
      time_limit_seconds INT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— poets links / photos ——
  [
    'kk_poets',
    'writer_aliases',
    `CREATE TABLE writer_aliases (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      writer_id INT UNSIGNED NOT NULL,
      alias_original VARCHAR(255) NOT NULL,
      alias_latin VARCHAR(255) NOT NULL DEFAULT '',
      alias_fold VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poets',
    'book_writers',
    `CREATE TABLE book_writers (
      book_id VARCHAR(64) NOT NULL,
      writer_id INT UNSIGNED NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'author',
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (book_id, writer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_poets',
    'writer_photos',
    `CREATE TABLE writer_photos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      writer_id INT UNSIGNED NOT NULL,
      year SMALLINT NULL,
      caption_original TEXT NULL,
      caption_latin TEXT NULL,
      image_url VARCHAR(500) NOT NULL,
      stored_name VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— AI / tutor ——
  [
    'kk_ai_db',
    'tutor_sessions',
    `CREATE TABLE tutor_sessions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      session_date DATE NOT NULL,
      plan_json JSON NOT NULL,
      status ENUM('active','completed') NOT NULL DEFAULT 'active',
      score INT NULL,
      total INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_ai_db',
    'mistake_bank',
    `CREATE TABLE mistake_bank (
      id CHAR(36) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      question_id INT NULL,
      dict_title_id VARCHAR(64) NULL,
      source ENUM('quiz','dict_game','adaptive','reading','crossword','immersion','jumbaq') NOT NULL,
      prompt TEXT NULL,
      wrong_count INT NOT NULL DEFAULT 1,
      correct_streak INT NOT NULL DEFAULT 0,
      box TINYINT NOT NULL DEFAULT 0,
      due_at DATETIME NOT NULL,
      last_seen_at TIMESTAMP NULL,
      resolved TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      unique_key VARCHAR(128) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_ai_db',
    'literature_tutor_events',
    `CREATE TABLE literature_tutor_events (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      payload_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_ai_db',
    'immersion_assets',
    `CREATE TABLE immersion_assets (
      id CHAR(36) NOT NULL PRIMARY KEY,
      title_id VARCHAR(64) NULL,
      kind ENUM('model3d','video','audio') NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'primary',
      original_name VARCHAR(255) NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NULL,
      file_size INT NULL,
      duration_ms INT NULL,
      status ENUM('processing','ready','rejected') NOT NULL DEFAULT 'ready',
      uploaded_by VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— quiz runtime ——
  [
    'kk_quiz',
    'quiz_instances',
    `CREATE TABLE quiz_instances (
      id CHAR(36) NOT NULL PRIMARY KEY,
      quiz_id VARCHAR(32) NOT NULL,
      question_order JSON NOT NULL,
      option_orders JSON NOT NULL,
      seed VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_quiz',
    'quiz_attempts',
    `CREATE TABLE quiz_attempts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      instance_id CHAR(36) NOT NULL,
      quiz_id VARCHAR(32) NOT NULL,
      actor_id BIGINT UNSIGNED NOT NULL,
      room_id CHAR(36) NULL,
      play_mode VARCHAR(32) NULL,
      status ENUM('in_progress','completed','partial','expired') NOT NULL DEFAULT 'in_progress',
      current_index INT NOT NULL DEFAULT 0,
      age_years TINYINT UNSIGNED NULL,
      age_consent TINYINT(1) NOT NULL DEFAULT 0,
      score INT NULL,
      total INT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      total_deadline_at TIMESTAMP NULL,
      is_adaptive TINYINT(1) NOT NULL DEFAULT 0,
      skill VARCHAR(64) NULL,
      theta_start DOUBLE NULL,
      theta_end DOUBLE NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_quiz',
    'quiz_attempt_questions',
    `CREATE TABLE quiz_attempt_questions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      attempt_id CHAR(36) NOT NULL,
      question_id INT NOT NULL,
      position INT NOT NULL,
      viewed TINYINT(1) NOT NULL DEFAULT 0,
      selected_option_index INT NULL,
      selected_original_index INT NULL,
      is_correct TINYINT(1) NULL,
      time_spent_ms INT NULL,
      question_started_at TIMESTAMP NULL,
      question_deadline_at TIMESTAMP NULL,
      answered_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_quiz',
    'game_rooms',
    `CREATE TABLE game_rooms (
      id CHAR(36) NOT NULL PRIMARY KEY,
      code CHAR(6) NOT NULL,
      game_type ENUM('quiz','crossword') NOT NULL,
      mode VARCHAR(32) NOT NULL,
      content_id VARCHAR(64) NOT NULL,
      host_actor_id BIGINT UNSIGNED NOT NULL,
      status ENUM('lobby','starting','in_progress','finished','cancelled') NOT NULL DEFAULT 'lobby',
      max_players TINYINT NOT NULL DEFAULT 4,
      min_players TINYINT NOT NULL DEFAULT 2,
      shared_state_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP NULL,
      finished_at TIMESTAMP NULL,
      expires_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_quiz',
    'game_room_members',
    `CREATE TABLE game_room_members (
      id CHAR(36) NOT NULL PRIMARY KEY,
      room_id CHAR(36) NOT NULL,
      actor_id BIGINT UNSIGNED NOT NULL,
      display_name VARCHAR(32) NOT NULL,
      role ENUM('host','player') NOT NULL DEFAULT 'player',
      ready TINYINT(1) NOT NULL DEFAULT 0,
      connected TINYINT(1) NOT NULL DEFAULT 1,
      attempt_id CHAR(36) NULL,
      score INT NULL,
      progress_json JSON NULL,
      finished_at TIMESTAMP NULL,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      left_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— crosswords / jumbaq ——
  [
    'kk_krasvord',
    'crossword_stats',
    `CREATE TABLE crossword_stats (
      id CHAR(36) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      crossword_id VARCHAR(64) NOT NULL,
      mode VARCHAR(32) NOT NULL,
      room_id CHAR(36) NULL,
      score INT NULL,
      duration_seconds INT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_krasvord',
    'dict_game_rounds',
    `CREATE TABLE dict_game_rounds (
      id CHAR(36) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      questions_json JSON NOT NULL,
      answers_json JSON NULL,
      score INT NULL,
      total INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      expires_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_jumbaqlar',
    'jumbaq_progress',
    `CREATE TABLE jumbaq_progress (
      actor_id BIGINT UNSIGNED NOT NULL,
      jumbaq_id INT UNSIGNED NOT NULL,
      revealed TINYINT(1) NOT NULL DEFAULT 0,
      favorited TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (actor_id, jumbaq_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— dictionary extras ——
  [
    'kk_tusindirme',
    'synonym_groups',
    `CREATE TABLE synonym_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'synonym_group_descriptions',
    `CREATE TABLE synonym_group_descriptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      group_id BIGINT UNSIGNED NOT NULL,
      description_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'description_antonyms',
    `CREATE TABLE description_antonyms (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      description_id_a VARCHAR(36) NOT NULL,
      description_id_b VARCHAR(36) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'compound_words',
    `CREATE TABLE compound_words (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      main_title_id VARCHAR(64) NOT NULL,
      component_title_id VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'community_suggestions',
    `CREATE TABLE community_suggestions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_key CHAR(64) NOT NULL,
      suggestion_type ENUM('synonym','antonym','compound') NOT NULL,
      description_id VARCHAR(36) NULL,
      main_title_id VARCHAR(64) NULL,
      suggested_word VARCHAR(191) NOT NULL,
      suggested_description_id VARCHAR(36) NULL,
      component_sort_order INT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      upvotes INT NOT NULL DEFAULT 0,
      downvotes INT NOT NULL DEFAULT 0,
      moderator_note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'community_suggestion_votes',
    `CREATE TABLE community_suggestion_votes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      suggestion_id BIGINT UNSIGNED NOT NULL,
      actor_key CHAR(64) NOT NULL,
      vote ENUM('up','down') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_tusindirme',
    'word_relations',
    `CREATE TABLE word_relations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source_title_id VARCHAR(64) NOT NULL,
      target_title_id VARCHAR(64) NOT NULL,
      relation_type ENUM('synonym','antonym') NOT NULL,
      note VARCHAR(255) NULL,
      source_kind ENUM('verified','manual','imported') NOT NULL DEFAULT 'verified',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— stats ——
  [
    'kk_statistika',
    'point_transactions',
    `CREATE TABLE point_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      amount INT NOT NULL,
      kind VARCHAR(40) NOT NULL,
      ref_id VARCHAR(64) NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'answer_review_unlocks',
    `CREATE TABLE answer_review_unlocks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      attempt_id CHAR(36) NOT NULL,
      cost INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'actor_time_spent',
    `CREATE TABLE actor_time_spent (
      actor_id BIGINT UNSIGNED NOT NULL,
      surface VARCHAR(32) NOT NULL,
      day DATE NOT NULL,
      duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (actor_id, surface, day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'exit_feedback',
    `CREATE TABLE exit_feedback (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_id BIGINT UNSIGNED NULL,
      user_id BIGINT UNSIGNED NULL,
      helpful TINYINT(1) NOT NULL,
      note VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'actor_ability',
    `CREATE TABLE actor_ability (
      actor_id BIGINT UNSIGNED NOT NULL,
      skill VARCHAR(64) NOT NULL DEFAULT 'global',
      theta DOUBLE NOT NULL DEFAULT 0,
      theta_se DOUBLE NOT NULL DEFAULT 1,
      attempts INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (actor_id, skill)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'book_progress',
    `CREATE TABLE book_progress (
      id CHAR(36) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      book_id VARCHAR(64) NOT NULL,
      section_index INT NOT NULL DEFAULT 0,
      paragraph_index INT NOT NULL DEFAULT 0,
      percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'content_manifest',
    `CREATE TABLE content_manifest (
      id TINYINT NOT NULL DEFAULT 1 PRIMARY KEY,
      schema_version VARCHAR(32) NOT NULL,
      content_version VARCHAR(32) NOT NULL,
      notes TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'reading_sessions',
    `CREATE TABLE reading_sessions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      book_id VARCHAR(64) NOT NULL,
      section_index INT NOT NULL DEFAULT 0,
      plan_json LONGTEXT NOT NULL,
      status ENUM('active','answered','completed') NOT NULL DEFAULT 'active',
      score INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_statistika',
    'reading_lesson_srs',
    `CREATE TABLE reading_lesson_srs (
      id CHAR(36) NOT NULL,
      actor_id BIGINT UNSIGNED NOT NULL,
      book_id VARCHAR(64) NOT NULL,
      section_index INT NOT NULL DEFAULT 0,
      box TINYINT NOT NULL DEFAULT 1,
      due_at DATETIME NOT NULL,
      last_completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_score INT NOT NULL DEFAULT 0,
      last_total INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reading_lesson_srs_actor_section (actor_id, book_id, section_index),
      KEY idx_reading_lesson_srs_due (actor_id, due_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  // —— users / auth / logs ——
  [
    'kk_users',
    'app_users',
    `CREATE TABLE app_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(190) NULL,
      password_hash VARCHAR(255) NULL,
      google_sub VARCHAR(64) NULL,
      display_name VARCHAR(80) NULL,
      avatar_url VARCHAR(500) NULL,
      bio TEXT NULL,
      interests JSON NULL,
      location VARCHAR(120) NULL,
      schools JSON NULL,
      birthday DATE NULL,
      phone VARCHAR(40) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_users',
    'app_sessions',
    `CREATE TABLE app_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_users',
    'admin_accounts',
    `CREATE TABLE admin_accounts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(190) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('owner','editor','uploader') NOT NULL DEFAULT 'editor',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_users',
    'api_clients',
    `CREATE TABLE api_clients (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      key_prefix CHAR(8) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      tier VARCHAR(32) NOT NULL DEFAULT 'partner',
      rpm INT NOT NULL DEFAULT 600,
      rpd INT NOT NULL DEFAULT 50000,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    'kk_logs',
    'app_errors',
    `CREATE TABLE app_errors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      level ENUM('error','warn','info') NOT NULL DEFAULT 'error',
      source VARCHAR(120) NULL,
      method VARCHAR(10) NULL,
      path VARCHAR(500) NULL,
      status_code INT NULL,
      message TEXT NULL,
      stack MEDIUMTEXT NULL,
      context_json JSON NULL,
      actor_key CHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
];

function ibdPath(db, table) {
  const candidates = [
    path.join(BACKUP, db, `${table}.ibd`),
    path.join(DATA_DIR, db, `${table}.ibd`),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function repairOne(conn, db, table, createSql) {
  const srcIbd = ibdPath(db, table);
  if (!srcIbd) {
    console.warn(`⚠️  ${db}.${table} — .ibd topilmadi`);
    return false;
  }

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query(`DROP TABLE IF EXISTS \`${db}\`.\`${table}\``);

  // diskdagi qoldiqlar
  const liveIbd = path.join(DATA_DIR, db, `${table}.ibd`);
  const liveFrm = path.join(DATA_DIR, db, `${table}.frm`);
  for (const f of [liveIbd, liveFrm]) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }

  await conn.query(`USE \`${db}\``);
  await conn.query(createSql);
  await conn.query(`ALTER TABLE \`${table}\` DISCARD TABLESPACE`);

  fs.copyFileSync(srcIbd, liveIbd);
  await conn.query(`ALTER TABLE \`${table}\` IMPORT TABLESPACE`);

  // IMPORT dan keyin AUTO_INCREMENT ko‘pincha 1 ga tushadi — yangi INSERT duplicate beradi
  try {
    const [[ai]] = await conn.query(
      `SELECT COLUMN_NAME AS col FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA LIKE '%auto_increment%'
       LIMIT 1`,
      [db, table]
    );
    if (ai?.col) {
      const [[mx]] = await conn.query(
        `SELECT COALESCE(MAX(\`${ai.col}\`), 0) + 1 AS nextId FROM \`${db}\`.\`${table}\``
      );
      await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` AUTO_INCREMENT = ?`, [mx.nextId]);
    }
  } catch {
    /* PK composite / no AI — ignore */
  }

  const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${table}\``);
  console.log(`✅ ${db}.${table} ← ${row.n} qator`);
  return true;
}

async function connect() {
  return mysql.createConnection({
    ...SERVER_CONFIG,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
}

let ok = 0;
let fail = 0;
let skip = 0;

for (const [db, table, sql] of TABLES) {
  let conn;
  try {
    conn = await connect();
    try {
      const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${table}\``);
      console.log(`↷ ${db}.${table} — allaqachon OK (${row.n})`);
      skip += 1;
      await conn.end();
      continue;
    } catch {
      /* broken — repair */
    }

    const done = await repairOne(conn, db, table, sql);
    if (done) ok += 1;
    else fail += 1;
    await conn.end();
  } catch (e) {
    fail += 1;
    console.error(`❌ ${db}.${table}: ${e.message}`);
    try {
      await conn?.end();
    } catch {
      /* ignore */
    }
    // Crashdan keyin MySQL qayta ochilishini kutamiz
    await new Promise((r) => setTimeout(r, 3000));
    for (let i = 0; i < 15; i++) {
      try {
        const probe = await connect();
        await probe.end();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

console.log(`\nTiklash: ${ok} yangi, ${skip} skip, ${fail} xato`);
