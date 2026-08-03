-- Bilingual / linked dictionaries inside kk_tusindirme
-- EN (KAA→English) and RU (RU→KAA)

CREATE TABLE IF NOT EXISTS `bilingual_dict` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lang` enum('en','ru') NOT NULL,
  `word` varchar(255) NOT NULL,
  `word_fold` varchar(191) NOT NULL,
  `translation_html` mediumtext NOT NULL,
  `translation_text` mediumtext NOT NULL,
  `pos` varchar(64) DEFAULT NULL,
  `senses_json` json DEFAULT NULL,
  `title_id` varchar(64) DEFAULT NULL,
  `source` varchar(64) NOT NULL DEFAULT 'json-import',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bd_lang_fold` (`lang`, `word_fold`),
  KEY `idx_bd_lang_word` (`lang`, `word`(100)),
  KEY `idx_bd_title` (`title_id`),
  KEY `idx_bd_lang_title` (`lang`, `title_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
