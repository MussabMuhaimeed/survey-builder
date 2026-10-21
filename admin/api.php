<?php
require __DIR__ . '/../inc/bootstrap.php';
require APP_ROOT . '/inc/templates.php';
require APP_ROOT . '/inc/results.php';

$user = require_login(true);
$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') csrf_check();

$in = [];
if ($method === 'POST') {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false) {
        $in = json_decode((string) file_get_contents('php://input'), true) ?: [];
    } else {
        $in = $_POST;
    }
}

function need_survey(int $id): array
{
    $s = survey_by_id($id);
    if (!$s) json_out(['ok' => false, 'error' => __('Encuesta no encontrada')], 404);
    return $s;
}

function safe_url($u): string
{
    $u = trim((string) $u);
    if ($u === '') return '';
    if (preg_match('#^https?://#i', $u)) return $u;
    if (preg_match('#^data:image/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$#i', $u)) return $u;
    if (preg_match('#^uploads/[a-zA-Z0-9/_\-.]+$#', $u) && strpos($u, '..') === false) return $u;
    return '';
}

function clean_id($v, string $prefix): string
{
    $v = (string) $v;
    return preg_match('/^[a-zA-Z0-9_\-]{1,40}$/', $v) ? $v : $prefix . '_' . random_id(8);
}

/** Normaliza y sanea la definición enviada por el editor */
function sanitize_definition(array $d): array
{
    $urlKeys = ['src', 'image', 'logo', 'bgImage', 'url'];
    $walk = function ($node) use (&$walk, $urlKeys) {
        if (!is_array($node)) return $node;
        foreach ($node as $k => $v) {
            if (is_array($v)) $node[$k] = $walk($v);
            elseif (is_string($k) && in_array($k, $urlKeys, true)) $node[$k] = safe_url($v);
            elseif (is_string($v) && mb_strlen($v) > 20000) $node[$k] = mb_substr($v, 0, 20000);
        }
        return $node;
    };
    $d = $walk($d);

    $allowed = array_merge(QUESTION_TYPES, ['heading', 'paragraph', 'image', 'video', 'logos', 'divider', 'spacer']);
    $out = [
        'settings' => array_merge(default_settings(), is_array($d['settings'] ?? null) ? $d['settings'] : []),
        'welcome'  => is_array($d['welcome'] ?? null) ? $d['welcome'] : default_definition()['welcome'],
        'thanks'   => is_array($d['thanks'] ?? null) ? $d['thanks'] : default_definition()['thanks'],
        'steps'    => [],
    ];
    $s = &$out['settings'];
    $s['theme'] = preg_match('/^(c\d{1,10}|[a-z]{2,20})$/', (string) $s['theme']) ? $s['theme'] : 'lavanda';
    unset($s['accent'], $s['background'], $s['bgImage'], $s['font']);
    $s['lang'] = ($s['lang'] ?? 'es') === 'en' ? 'en' : 'es';
    $s['languages'] = array_values(array_unique(array_merge([$s['lang']], array_intersect((array) ($s['languages'] ?? []), array_keys(LANGS)))));
    if (isset($s['tr'])) $s['tr'] = sanitize_tr($s['tr']);
    $s['maxResponses'] = max(0, (int) $s['maxResponses']);
    foreach (['onePerBrowser', 'limitByIp', 'showProgress', 'showNumbers', 'allowBack'] as $k) $s[$k] = (bool) $s[$k];
    unset($s);

    $seen = [];
    foreach (($d['steps'] ?? []) as $step) {
        if (!is_array($step)) continue;
        $st = [
            'id'     => clean_id($step['id'] ?? '', 's'),
            'title'  => mb_substr((string) ($step['title'] ?? ''), 0, 200),
            'blocks' => [],
        ];
        if (isset($step['tr'])) $st['tr'] = sanitize_tr($step['tr']);
        foreach (($step['blocks'] ?? []) as $b) {
            if (!is_array($b) || !in_array($b['type'] ?? '', $allowed, true)) continue;
            $b['id'] = clean_id($b['id'] ?? '', 'b');
            if (isset($seen[$b['id']])) $b['id'] = 'b_' . random_id(8);
            $seen[$b['id']] = true;
            $st['blocks'][] = $b;
        }
        $out['steps'][] = $st;
    }
    if (!$out['steps']) $out['steps'][] = ['id' => 's_' . random_id(6), 'title' => $out['settings']['lang'] === 'en' ? 'Step 1' : 'Paso 1', 'blocks' => []];
    return $out;
}

/** Translations: ['en' => ['title' => '...']] — only known languages and string values */
function sanitize_tr($tr): array
{
    $out = [];
    if (!is_array($tr)) return $out;
    foreach ($tr as $lang => $fields) {
        if (!isset(LANGS[$lang]) || !is_array($fields)) continue;
        foreach ($fields as $k => $v) {
            if (is_string($k) && preg_match('/^[a-zA-Z]{1,30}$/', $k) && is_string($v)) $out[$lang][$k] = mb_substr($v, 0, 20000);
        }
    }
    return $out;
}

function unique_uid(): string
{
    do {
        $uid = random_id(10);
    } while (q('SELECT 1 FROM surveys WHERE uid = ?', [$uid])->fetchColumn());
    return $uid;
}

switch ($action) {

    case 'create': {
        $title = trim((string) ($in['title'] ?? ''));
        if ($title === '') $title = __('Nueva encuesta');
        $title = mb_substr($title, 0, 200);
        $tpl = (string) ($in['template'] ?? 'blank');
        if (!array_key_exists($tpl, survey_templates())) $tpl = 'blank';
        $lang = (string) ($in['lang'] ?? 'es');
        if (!in_array($lang, ['es', 'en', 'es+en', 'en+es'], true)) $lang = 'es';
        $def = build_template($tpl, $title, $lang);
        q('INSERT INTO surveys (uid, title, status, definition, created_by) VALUES (?, ?, ?, ?, ?)', [
            unique_uid(), $title, 'draft', json_encode($def, JSON_UNESCAPED_UNICODE), $user['id'],
        ]);
        json_out(['ok' => true, 'id' => (int) db()->lastInsertId()]);
    }

    case 'save': {
        $s = need_survey((int) ($in['id'] ?? 0));
        if (!is_array($in['definition'] ?? null)) json_out(['ok' => false, 'error' => __('Definición inválida')], 422);
        $def = sanitize_definition($in['definition']);
        $json = json_encode($def, JSON_UNESCAPED_UNICODE);
        if (strlen($json) > 4 * 1024 * 1024) json_out(['ok' => false, 'error' => __('La encuesta es demasiado grande. Sube las imágenes como archivo en lugar de incrustarlas.')], 413);
        $title = mb_substr(trim((string) ($in['title'] ?? $s['title'])), 0, 200) ?: __('Sin título');
        q('UPDATE surveys SET title = ?, definition = ?, updated_at = NOW() WHERE id = ?', [$title, $json, $s['id']]);
        json_out(['ok' => true, 'savedAt' => date('H:i:s')]);
    }

    case 'status': {
        $s = need_survey((int) ($in['id'] ?? 0));
        $status = (string) ($in['status'] ?? '');
        if (!in_array($status, ['draft', 'published', 'closed'], true)) json_out(['ok' => false, 'error' => __('Estado inválido')], 422);
        q('UPDATE surveys SET status = ? WHERE id = ?', [$status, $s['id']]);
        json_out(['ok' => true, 'status' => $status]);
    }

    case 'duplicate': {
        $s = need_survey((int) ($in['id'] ?? 0));
        $def = $s['def'];
        // Nuevos IDs de pasos (los de preguntas se conservan: no colisionan entre encuestas)
        foreach ($def['steps'] as &$st) $st['id'] = 's_' . random_id(6);
        unset($st);
        q('INSERT INTO surveys (uid, title, status, definition, created_by) VALUES (?, ?, ?, ?, ?)', [
            unique_uid(), mb_substr($s['title'] . ' ' . __('(copia)'), 0, 255), 'draft', json_encode($def, JSON_UNESCAPED_UNICODE), $user['id'],
        ]);
        json_out(['ok' => true, 'id' => (int) db()->lastInsertId()]);
    }

    case 'delete': {
        $s = need_survey((int) ($in['id'] ?? 0));
        q('DELETE FROM answers WHERE survey_id = ?', [$s['id']]);
        q('DELETE FROM surveys WHERE id = ?', [$s['id']]);
        json_out(['ok' => true]);
    }

    case 'reset': {
        $s = need_survey((int) ($in['id'] ?? 0));
        q('DELETE FROM answers WHERE survey_id = ?', [$s['id']]);
        q('DELETE FROM responses WHERE survey_id = ?', [$s['id']]);
        q('UPDATE surveys SET views = 0, starts = 0 WHERE id = ?', [$s['id']]);
        json_out(['ok' => true]);
    }

    case 'delete_response': {
        $rid = (int) ($in['id'] ?? 0);
        q('DELETE FROM answers WHERE response_id = ?', [$rid]);
        q('DELETE FROM responses WHERE id = ?', [$rid]);
        json_out(['ok' => true]);
    }

    case 'upload': {
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $code = $_FILES['file']['error'] ?? -1;
            $msg = in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? __('El archivo supera el tamaño máximo permitido por el servidor ({size}).', ['size' => ini_get('upload_max_filesize')])
                : __('No se recibió ningún archivo.');
            json_out(['ok' => false, 'error' => $msg], 400);
        }
        $f = $_FILES['file'];
        $maxMb = (int) config('upload_max_mb', 50);
        if ($f['size'] > $maxMb * 1024 * 1024) json_out(['ok' => false, 'error' => __('Máximo {n} MB.', ['n' => $maxMb])], 413);

        $types = [
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp',
            'image/svg+xml' => 'svg', 'video/mp4' => 'mp4', 'video/webm' => 'webm',
        ];
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
        $origExt = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if ($origExt === 'svg' && in_array($mime, ['text/xml', 'application/xml', 'text/plain', 'image/svg'], true)) $mime = 'image/svg+xml';
        if (!isset($types[$mime])) json_out(['ok' => false, 'error' => __('Formato no permitido. Usa JPG, PNG, GIF, WEBP, SVG, MP4 o WEBM.')], 415);

        if ($mime === 'image/svg+xml') {
            $svg = (string) file_get_contents($f['tmp_name']);
            if (stripos($svg, '<svg') === false || preg_match('/<script|javascript:|<foreignObject|\son[a-z]+\s*=/i', $svg)) {
                json_out(['ok' => false, 'error' => __('El SVG contiene elementos no permitidos (scripts o eventos).')], 415);
            }
        }

        $rel = 'uploads/' . date('Y/m');
        $dir = APP_ROOT . '/' . $rel;
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) json_out(['ok' => false, 'error' => __('No se pudo crear la carpeta de subidas.')], 500);
        $name = random_id(16) . '.' . $types[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) json_out(['ok' => false, 'error' => __('No se pudo guardar el archivo.')], 500);
        json_out(['ok' => true, 'url' => $rel . '/' . $name, 'kind' => strpos($mime, 'video/') === 0 ? 'video' : 'image']);
    }

    case 'theme_save': {
        ensure_themes_table();
        $cfg = sanitize_theme(is_array($in['config'] ?? null) ? $in['config'] : []);
        $id = (int) ($in['id'] ?? 0);
        $json = json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($id > 0) {
            if (!q('SELECT 1 FROM themes WHERE id = ?', [$id])->fetchColumn()) json_out(['ok' => false, 'error' => __('Tema no encontrado')], 404);
            q('UPDATE themes SET name = ?, config = ? WHERE id = ?', [$cfg['name'], $json, $id]);
        } else {
            q('INSERT INTO themes (name, config, created_by) VALUES (?, ?, ?)', [$cfg['name'], $json, $user['id']]);
            $id = (int) db()->lastInsertId();
        }
        json_out(['ok' => true, 'theme' => ['key' => 'c' . $id, 'id' => $id, 'name' => $cfg['name'], 'custom' => true, 'config' => $cfg]]);
    }

    case 'theme_delete': {
        $id = (int) ($in['id'] ?? 0);
        ensure_themes_table();
        q('DELETE FROM themes WHERE id = ?', [$id]);
        json_out(['ok' => true]);
    }

    case 'set_lang': {
        $lang = (string) ($in['lang'] ?? '');
        if (!isset(LANGS[$lang])) json_out(['ok' => false, 'error' => __('Idioma no válido')], 422);
        q('UPDATE users SET lang = ? WHERE id = ?', [$lang, $user['id']]);
        setcookie('svy_ui', $lang, ['expires' => time() + 31536000, 'path' => base_path() . '/', 'samesite' => 'Lax', 'secure' => is_https()]);
        json_out(['ok' => true]);
    }

    case 'export': {
        $s = need_survey((int) ($_GET['id'] ?? 0));
        export_csv($s);
        exit;
    }

    default:
        json_out(['ok' => false, 'error' => __('Acción desconocida')], 400);
}
