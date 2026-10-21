<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
define('APP_VERSION', '1.1.0');

$GLOBALS['__config'] = is_file(APP_ROOT . '/config.php') ? require APP_ROOT . '/config.php' : null;

function config(string $key, $default = null)
{
    $cfg = $GLOBALS['__config'];
    if (!is_array($cfg)) return $default;
    $node = $cfg;
    foreach (explode('.', $key) as $part) {
        if (!is_array($node) || !array_key_exists($part, $node)) return $default;
        $node = $node[$part];
    }
    return $node;
}

date_default_timezone_set((string) config('timezone', 'Europe/Madrid'));

/* ---------- URLs ---------- */

function base_path(): string
{
    static $bp = null;
    if ($bp !== null) return $bp;
    $appUrl = (string) config('app_url', '');
    if ($appUrl !== '') {
        return $bp = rtrim((string) (parse_url($appUrl, PHP_URL_PATH) ?? ''), '/');
    }
    $dir = str_replace('\\', '/', dirname(str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/')));
    $dir = rtrim($dir, '/');
    if (substr($dir, -6) === '/admin') $dir = substr($dir, 0, -6);
    return $bp = $dir;
}

function url(string $path = ''): string
{
    return base_path() . '/' . ltrim($path, '/');
}

function abs_url(string $path = ''): string
{
    $appUrl = (string) config('app_url', '');
    if ($appUrl !== '') return rtrim($appUrl, '/') . '/' . ltrim($path, '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https' : 'http') . '://' . $host . url($path);
}

/** Enlace público de una encuesta. Con 'pretty_urls' activo: https://dominio/XXXXXXXXXX */
function survey_url(string $uid, bool $absolute = true, bool $preview = false): string
{
    $pretty = (bool) config('pretty_urls', false);
    $p = $pretty ? rawurlencode($uid) : 's.php?id=' . rawurlencode($uid);
    if ($preview) $p .= ($pretty ? '?' : '&') . 'preview=1';
    return $absolute ? abs_url($p) : url($p);
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function redirect(string $to): void
{
    header('Location: ' . $to);
    exit;
}

/* ---------- Instalación ---------- */

if ($GLOBALS['__config'] === null && !defined('INSTALLING')) {
    redirect(url('install.php'));
}

/* ---------- Sesión ---------- */

if (session_status() === PHP_SESSION_NONE && !defined('NO_SESSION')) {
    session_name('svy_sess');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => base_path() . '/',
        'httponly' => true,
        'secure'   => is_https(),
        'samesite' => 'Lax',
    ]);
    session_start();
}

/* ---------- Base de datos ---------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config('db');
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $c['host'], (int) ($c['port'] ?? 3306), $c['name'], $c['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $pdo->exec("SET time_zone = '" . (new DateTime())->format('P') . "'");
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

/* ---------- Utilidades ---------- */

function e($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_for_script($data): string
{
    // JSON seguro para incrustar dentro de <script>
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}

function random_id(int $len = 10): string
{
    $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $out = '';
    $max = strlen($chars) - 1;
    for ($i = 0; $i < $len; $i++) $out .= $chars[random_int(0, $max)];
    return $out;
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function ip_hash(): string
{
    return hash('sha256', client_ip() . '|' . config('secret', 'svy'));
}

function fmt_date(?string $dt, bool $time = true): string
{
    if (!$dt) return '—';
    $ts = strtotime($dt);
    return $time ? date('d/m/Y H:i', $ts) : date('d/m/Y', $ts);
}

function time_ago(?string $dt): string
{
    if (!$dt) return __('nunca');
    $d = time() - strtotime($dt);
    if ($d < 60) return __('hace un momento');
    if ($d < 3600) return __('hace {n} min', ['n' => floor($d / 60)]);
    if ($d < 86400) return __('hace {n} h', ['n' => floor($d / 3600)]);
    if ($d < 86400 * 30) return __('hace {n} d', ['n' => floor($d / 86400)]);
    return fmt_date($dt, false);
}

/* ---------- Autenticación y CSRF ---------- */

function current_user(): ?array
{
    static $user = false;
    if ($user !== false) return $user;
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return $user = null;
    $u = q('SELECT id, name, email FROM users WHERE id = ?', [$id])->fetch();
    return $user = ($u ?: null);
}

function require_login(bool $api = false): array
{
    $u = current_user();
    if ($u) return $u;
    if ($api) json_out(['ok' => false, 'error' => __('Sesión caducada. Vuelve a iniciar sesión.')], 401);
    redirect(url('admin/login.php'));
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf'] ?? '');
    if (!is_string($sent) || !hash_equals(csrf_token(), $sent)) {
        json_out(['ok' => false, 'error' => __('Token CSRF inválido. Recarga la página.')], 419);
    }
}

/* ---------- Encuestas ---------- */

function survey_by_id(int $id): ?array
{
    $s = q('SELECT * FROM surveys WHERE id = ?', [$id])->fetch();
    if (!$s) return null;
    $s['def'] = json_decode($s['definition'], true) ?: default_definition($s['title']);
    return $s;
}

function survey_by_uid(string $uid): ?array
{
    $s = q('SELECT * FROM surveys WHERE uid = ?', [$uid])->fetch();
    if (!$s) return null;
    $s['def'] = json_decode($s['definition'], true) ?: default_definition($s['title']);
    return $s;
}

function default_settings(): array
{
    return [
        'description'   => '',
        'theme'         => 'lavanda',
        'logo'          => '',
        'onePerBrowser' => true,
        'limitByIp'     => false,
        'showProgress'  => true,
        'showNumbers'   => true,
        'allowBack'     => true,
        'startAt'       => '',
        'endAt'         => '',
        'maxResponses'  => 0,
        'closedMessage' => '',          // empty = built-in message in the participant's language
        'doneMessage'   => '',
        'lang'          => 'es',        // primary content language
        'languages'     => ['es'],      // ['es', 'en'] = bilingual survey
    ];
}

function default_definition(string $title = 'Nueva encuesta', string $lang = 'es'): array
{
    $en = $lang === 'en';
    $settings = default_settings();
    $settings['lang'] = $en ? 'en' : 'es';
    $settings['languages'] = [$settings['lang']];
    return [
        'settings' => $settings,
        'welcome'  => [
            'enabled' => true,
            'title'   => $title,
            'text'    => $en ? "We'd love to hear your opinion. It will only take a couple of minutes." : 'Nos encantaría conocer tu opinión. Solo te llevará un par de minutos.',
            'image'   => '',
            'button'  => '',
        ],
        'thanks' => [
            'title'  => $en ? 'Thank you very much!' : '¡Muchas gracias!',
            'text'   => $en ? 'Your answers have been recorded.' : 'Tus respuestas se han registrado correctamente.',
            'image'  => '',
            'button' => '',
            'url'    => '',
        ],
        'steps' => [
            ['id' => 's_' . random_id(6), 'title' => $en ? 'Step 1' : 'Paso 1', 'blocks' => []],
        ],
    ];
}

/** Devuelve [questionId => block] con todas las preguntas de la encuesta */
function survey_questions(array $def): array
{
    $out = [];
    foreach ($def['steps'] ?? [] as $step) {
        foreach ($step['blocks'] ?? [] as $b) {
            if (in_array($b['type'] ?? '', QUESTION_TYPES, true)) $out[$b['id']] = $b;
        }
    }
    return $out;
}

const QUESTION_TYPES = [
    'short_text', 'long_text', 'email', 'number', 'date',
    'single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'image_choice',
    'rating', 'scale', 'nps', 'slider', 'ranking', 'matrix',
];

/** Estado de disponibilidad de una encuesta: 'open' | 'draft' | 'closed' | 'not_started' | 'ended' | 'full' */
function survey_availability(array $s): string
{
    if ($s['status'] === 'draft') return 'draft';
    if ($s['status'] === 'closed') return 'closed';
    $st = $s['def']['settings'] ?? [];
    $now = time();
    if (!empty($st['startAt']) && strtotime($st['startAt']) > $now) return 'not_started';
    if (!empty($st['endAt']) && strtotime($st['endAt']) < $now) return 'ended';
    $max = (int) ($st['maxResponses'] ?? 0);
    if ($max > 0) {
        $n = (int) q('SELECT COUNT(*) FROM responses WHERE survey_id = ?', [$s['id']])->fetchColumn();
        if ($n >= $max) return 'full';
    }
    return 'open';
}

function cookie_name(string $uid): string
{
    return 'svy_done_' . preg_replace('/[^a-zA-Z0-9]/', '', $uid);
}

function already_answered(array $s): bool
{
    $st = $s['def']['settings'] ?? [];
    if (!empty($st['onePerBrowser']) && !empty($_COOKIE[cookie_name($s['uid'])])) return true;
    if (!empty($st['limitByIp'])) {
        $n = q('SELECT COUNT(*) FROM responses WHERE survey_id = ? AND ip_hash = ?', [$s['id'], ip_hash()])->fetchColumn();
        if ($n > 0) return true;
    }
    return false;
}

const FONTS = [
    'Inter'            => 'Inter:wght@400;500;600;700;800',
    'Poppins'          => 'Poppins:wght@400;500;600;700;800',
    'DM Sans'          => 'DM+Sans:wght@400;500;600;700;800',
    'Plus Jakarta Sans'=> 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
    'Space Grotesk'    => 'Space+Grotesk:wght@400;500;600;700',
    'Playfair Display' => 'Playfair+Display:wght@400;600;700;800',
    'Lora'             => 'Lora:wght@400;500;600;700',
];

function font_link(string $font): string
{
    $spec = FONTS[$font] ?? FONTS['Inter'];
    return 'https://fonts.googleapis.com/css2?family=' . $spec . '&display=swap';
}

require __DIR__ . '/themes.php';
require __DIR__ . '/i18n.php';
require __DIR__ . '/migrate.php';

if ($GLOBALS['__config'] !== null && !defined('INSTALLING')) run_migrations();

// ?ui=es|en switches the panel language; resolve it before any output so the cookie can be set
if (isset($_GET['ui'])) admin_lang();
