-- Authoritative schema for tusindirme_sozlik (Sozlik)
-- Idempotent CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS `categorys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `temp_id` varchar(50) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `questions` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `titles` (
  `id` varchar(36) NOT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `soz` varchar(255) NOT NULL,
  `normalized` varchar(255) NOT NULL,
  `search_key` varchar(191) DEFAULT NULL,
  `order` int(11) DEFAULT 0,
  `st_let` char(1) DEFAULT NULL,
  `status` tinyint(4) DEFAULT 1,
  `user_id` int(11) DEFAULT NULL,
  `views_count` int(11) DEFAULT 0,
  `search_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_soz` (`soz`),
  KEY `idx_normalized` (`normalized`),
  KEY `idx_st_let` (`st_let`),
  KEY `idx_created_at_titles` (`created_at`),
  KEY `idx_user_id_titles` (`user_id`),
  KEY `idx_titles_search_key` (`search_key`),
  KEY `idx_titles_status_order` (`status`,`order`),
  KEY `idx_titles_status_letter_order` (`status`,`st_let`,`order`),
  KEY `idx_titles_views` (`views_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `description` (
  `id` varchar(36) NOT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `titles_id` varchar(36) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `categorys_id` int(11) DEFAULT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_titles_id` (`titles_id`),
  KEY `idx_categorys_id` (`categorys_id`),
  KEY `idx_created_at_description` (`created_at`),
  KEY `idx_order_description` (`sort_order`),
  KEY `idx_description_title_order` (`titles_id`,`sort_order`),
  CONSTRAINT `description_ibfk_1` FOREIGN KEY (`titles_id`) REFERENCES `titles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `description_ibfk_2` FOREIGN KEY (`categorys_id`) REFERENCES `categorys` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `examples` (
  `id` varchar(36) NOT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `descriptions_id` varchar(36) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `example` text NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `author_id` int(11) DEFAULT NULL,
  `is_approved` tinyint(4) DEFAULT 0,
  `user_id` int(11) DEFAULT NULL,
  `target_start_index` int(11) DEFAULT NULL,
  `target_end_index` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_descriptions_id` (`descriptions_id`),
  KEY `idx_is_approved` (`is_approved`),
  KEY `idx_order_examples` (`sort_order`),
  KEY `idx_user_id_examples` (`user_id`),
  KEY `idx_examples_description_approved_order` (`descriptions_id`,`is_approved`,`sort_order`),
  CONSTRAINT `examples_ibfk_1` FOREIGN KEY (`descriptions_id`) REFERENCES `description` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `idioms` (
  `id` varchar(36) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `descriptions_id` varchar(36) NOT NULL,
  `phrase` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_description_id` (`descriptions_id`),
  KEY `idx_phrase` (`phrase`),
  CONSTRAINT `idioms_ibfk_1` FOREIGN KEY (`descriptions_id`) REFERENCES `description` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `idiom_desc` (
  `id` varchar(36) NOT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `idioms_id` varchar(36) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_idioms_id` (`idioms_id`),
  CONSTRAINT `idiom_desc_ibfk_1` FOREIGN KEY (`idioms_id`) REFERENCES `idioms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `etimologiya` (
  `id` varchar(36) NOT NULL,
  `temp_id` varchar(50) DEFAULT NULL,
  `title_id` varchar(36) NOT NULL,
  `etymology_type` enum('native','borrowed','derivative','compound','unknown') DEFAULT 'native',
  `original_language` varchar(100) DEFAULT NULL,
  `root_word` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_temp_id` (`temp_id`),
  KEY `idx_title_id` (`title_id`),
  KEY `idx_etymology_type` (`etymology_type`),
  CONSTRAINT `etimologiya_ibfk_1` FOREIGN KEY (`title_id`) REFERENCES `titles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `word_relations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `source_title_id` varchar(64) NOT NULL,
  `target_title_id` varchar(64) NOT NULL,
  `relation_type` enum('synonym','antonym') NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `source_kind` enum('verified','manual','imported') NOT NULL DEFAULT 'verified',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_word_relation` (`source_title_id`,`target_title_id`,`relation_type`),
  KEY `idx_relation_source` (`source_title_id`,`relation_type`),
  KEY `idx_relation_target` (`target_title_id`,`relation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ma'no (description) darajasidagi sinonim guruhlari
CREATE TABLE IF NOT EXISTS `synonym_groups` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `synonym_group_descriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint(20) unsigned NOT NULL,
  `description_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_desc` (`group_id`,`description_id`),
  KEY `idx_sgd_description` (`description_id`),
  CONSTRAINT `sgd_group_fk` FOREIGN KEY (`group_id`) REFERENCES `synonym_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sgd_desc_fk` FOREIGN KEY (`description_id`) REFERENCES `description` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Antonim juftliklari (canonical: description_id_a < description_id_b)
CREATE TABLE IF NOT EXISTS `description_antonyms` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `description_id_a` varchar(36) NOT NULL,
  `description_id_b` varchar(36) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_antonym_pair` (`description_id_a`,`description_id_b`),
  KEY `idx_antonym_b` (`description_id_b`),
  CONSTRAINT `ant_a_fk` FOREIGN KEY (`description_id_a`) REFERENCES `description` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ant_b_fk` FOREIGN KEY (`description_id_b`) REFERENCES `description` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Qurma so'zlar (titles self-reference)
CREATE TABLE IF NOT EXISTS `compound_words` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `main_title_id` varchar(64) NOT NULL,
  `component_title_id` varchar(64) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_compound` (`main_title_id`,`component_title_id`),
  KEY `idx_compound_component` (`component_title_id`),
  KEY `idx_compound_main_order` (`main_title_id`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crowdsourcing takliflar (actor_key = quiz_db HMAC, FK yo'q — cross-DB)
CREATE TABLE IF NOT EXISTS `community_suggestions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor_key` char(64) NOT NULL,
  `suggestion_type` enum('synonym','antonym','compound') NOT NULL,
  `description_id` varchar(36) DEFAULT NULL,
  `main_title_id` varchar(64) DEFAULT NULL,
  `suggested_word` varchar(191) NOT NULL,
  `suggested_description_id` varchar(36) DEFAULT NULL,
  `component_sort_order` int(11) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `upvotes` int(11) NOT NULL DEFAULT 0,
  `downvotes` int(11) NOT NULL DEFAULT 0,
  `moderator_note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sug_status_type` (`status`,`suggestion_type`),
  KEY `idx_sug_description` (`description_id`),
  KEY `idx_sug_actor` (`actor_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `community_suggestion_votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `suggestion_id` bigint(20) unsigned NOT NULL,
  `actor_key` char(64) NOT NULL,
  `vote` enum('up','down') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sug_vote` (`suggestion_id`,`actor_key`),
  CONSTRAINT `sug_vote_fk` FOREIGN KEY (`suggestion_id`) REFERENCES `community_suggestions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
