<?php
// Lightweight schema migrations for existing installations.
// The applied version is cached in uploads/.schema-version so the check is a single file read.

const SCHEMA_VERSION = 2;

/** Last migration error (shown to administrators in the panel) */
$GLOBALS['__migration_error'] = null;

function column_exists(string $table, string $column): bool
{
    // information_schema instead of SHOW COLUMNS: placeholders are not allowed in SHOW statements
    return (int) q(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [$table, $column]
    )->fetchColumn() > 0;
}

/** Cached check used to degrade gracefully if a migration could not be applied */
function has_lang_column(): bool
{
    static $has = null;
    if ($has === null) {
        try { $has = column_exists('responses', 'lang'); } catch (Throwable $ex) { $has = false; }
    }
    return $has;
}

function run_migrations(): void
{
    $flag = APP_ROOT . '/uploads/.schema-version';
    $current = is_file($flag) ? (int) file_get_contents($flag) : 1;
    if ($current >= SCHEMA_VERSION) return;

    try {
        // v2: bilingual surveys and per-user panel language
        if (!column_exists('users', 'lang')) db()->exec("ALTER TABLE users ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'es'");
        if (!column_exists('responses', 'lang')) db()->exec('ALTER TABLE responses ADD COLUMN lang VARCHAR(5) NULL AFTER user_agent');
        ensure_themes_table();

        if (@file_put_contents($flag, (string) SCHEMA_VERSION) === false) {
            error_log('[encuestas] could not write ' . $flag . ' (migrations will be re-checked on every request)');
        }
    } catch (Throwable $ex) {
        $GLOBALS['__migration_error'] = $ex->getMessage();
        error_log('[encuestas] migration failed: ' . $ex->getMessage());
    }
}
