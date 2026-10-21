<?php
// Lightweight schema migrations for existing installations.
// The applied version is cached in uploads/.schema-version so the check is a single file read.

const SCHEMA_VERSION = 2;

function run_migrations(): void
{
    $flag = APP_ROOT . '/uploads/.schema-version';
    $current = is_file($flag) ? (int) file_get_contents($flag) : 1;
    if ($current >= SCHEMA_VERSION) return;

    try {
        $has = fn(string $table, string $col): bool => (bool) q("SHOW COLUMNS FROM `$table` LIKE ?", [$col])->fetch();

        // v2: bilingual surveys and per-user panel language
        if (!$has('users', 'lang')) db()->exec("ALTER TABLE users ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'es'");
        if (!$has('responses', 'lang')) db()->exec('ALTER TABLE responses ADD COLUMN lang VARCHAR(5) NULL AFTER user_agent');
        ensure_themes_table();

        @file_put_contents($flag, (string) SCHEMA_VERSION);
    } catch (Throwable $ex) {
        error_log('[encuestas] migration failed: ' . $ex->getMessage());
    }
}
