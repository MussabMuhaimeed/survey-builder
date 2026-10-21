<?php
require __DIR__ . '/inc/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['ok' => false, 'error' => ptext('no_method', 'en')], 405);

/* ---------- Start tracking (beacon) ---------- */
if (($_GET['action'] ?? '') === 'start') {
    $uid = (string) ($_POST['uid'] ?? '');
    if (preg_match('/^[a-zA-Z0-9]{4,16}$/', $uid) && empty($_SESSION['started'][$uid])) {
        $_SESSION['started'][$uid] = 1;
        q("UPDATE surveys SET starts = starts + 1 WHERE uid = ? AND status = 'published'", [$uid]);
    }
    http_response_code(204);
    exit;
}

/* ---------- Response submission ---------- */
$in = json_decode((string) file_get_contents('php://input'), true);
$LANG = is_array($in) && isset(LANGS[$in['lang'] ?? '']) ? $in['lang'] : 'es';
if (!is_array($in)) json_out(['ok' => false, 'error' => ptext('bad_request', $LANG)], 400);

$uid = (string) ($in['uid'] ?? '');
$s = preg_match('/^[a-zA-Z0-9]{4,16}$/', $uid) ? survey_by_uid($uid) : null;
if (!$s) json_out(['ok' => false, 'error' => ptext('not_found', $LANG)], 404);

$SL = survey_langs($s['def']);
if (!in_array($LANG, $SL['langs'], true)) $LANG = $SL['primary'];

function m(string $key, array $vars = []): string
{
    return ptext($key, $GLOBALS['LANG'], $vars);
}

if (survey_availability($s) !== 'open') {
    json_out(['ok' => false, 'error' => survey_message($s['def'], 'closed', $LANG)], 403);
}
if (already_answered($s)) {
    json_out(['ok' => false, 'error' => survey_message($s['def'], 'done', $LANG)], 409);
}

// Honeypot: if the hidden field is filled in, pretend everything went fine
if (!empty($in['website'])) json_out(['ok' => true]);

// Basic throttle: at most 10 submissions per minute from the same IP
$recent = (int) q('SELECT COUNT(*) FROM responses WHERE ip_hash = ? AND created_at >= (NOW() - INTERVAL 1 MINUTE)', [ip_hash()])->fetchColumn();
if ($recent >= 10) json_out(['ok' => false, 'error' => m('too_many')], 429);

$answersIn = is_array($in['answers'] ?? null) ? $in['answers'] : [];
$othersIn = is_array($in['others'] ?? null) ? $in['others'] : [];

function fail(string $qid, string $msg): void
{
    json_out(['ok' => false, 'error' => $msg, 'field' => $qid], 422);
}

function ids_of(array $list): array
{
    return array_map(fn($o) => (string) ($o['id'] ?? ''), $list);
}

/** Validates and normalises a question value. Returns [value|null, other|null] */
function clean_answer(array $q, $v, $other): array
{
    $qid = $q['id'];
    $type = $q['type'];
    if ($v === null || $v === '' || $v === []) return [null, null];
    $other = is_string($other) ? mb_substr(trim($other), 0, 1000) : null;

    switch ($type) {
        case 'short_text':
        case 'long_text':
            if (!is_scalar($v)) fail($qid, m('invalid'));
            $limit = $type === 'long_text' ? ((int) ($q['maxLength'] ?? 0) ?: 10000) : 1000;
            $v = mb_substr(trim((string) $v), 0, $limit);
            return [$v === '' ? null : $v, null];

        case 'email':
            $v = trim((string) $v);
            if (!filter_var($v, FILTER_VALIDATE_EMAIL)) fail($qid, m('email'));
            return [mb_substr($v, 0, 190), null];

        case 'date':
            if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) fail($qid, m('date'));
            return [$v, null];

        case 'number':
            if (!is_numeric($v)) fail($qid, m('number'));
            $v = $v + 0;
            if (($q['min'] ?? '') !== '' && $v < (float) $q['min']) fail($qid, m('min', ['n' => $q['min']]));
            if (($q['max'] ?? '') !== '' && $v > (float) $q['max']) fail($qid, m('max', ['n' => $q['max']]));
            return [$v, null];

        case 'single_choice':
        case 'dropdown':
            $valid = ids_of($q['options'] ?? []);
            if ($type === 'single_choice' && !empty($q['allowOther'])) $valid[] = '__other__';
            if (!is_string($v) || !in_array($v, $valid, true)) fail($qid, m('bad_option'));
            if ($v === '__other__' && !$other) fail($qid, m('specify'));
            return [$v, $v === '__other__' ? $other : null];

        case 'yes_no':
            if (!in_array($v, ['yes', 'no'], true)) fail($qid, m('bad_option'));
            return [$v, null];

        case 'image_choice':
            if (empty($q['multiple'])) {
                if (!is_string($v) || !in_array($v, ids_of($q['options'] ?? []), true)) fail($qid, m('bad_option'));
                return [$v, null];
            }
            // multiple: falls through
        case 'multiple_choice':
            if (!is_array($v)) fail($qid, m('invalid'));
            $valid = ids_of($q['options'] ?? []);
            if ($type === 'multiple_choice' && !empty($q['allowOther'])) $valid[] = '__other__';
            $v = array_values(array_unique(array_filter($v, fn($x) => is_string($x) && in_array($x, $valid, true))));
            if (!$v) return [null, null];
            $max = (int) ($q['maxSelect'] ?? 0);
            $min = (int) ($q['minSelect'] ?? 0);
            if ($max > 0 && count($v) > $max) fail($qid, m('max_sel', ['n' => $max]));
            if ($min > 0 && count($v) < $min) fail($qid, m('min_sel', ['n' => $min]));
            $hasOther = in_array('__other__', $v, true);
            if ($hasOther && !$other) fail($qid, m('specify'));
            return [$v, $hasOther ? $other : null];

        case 'rating':
            $max = ($q['icon'] ?? '') === 'emoji' ? 5 : min(10, max(3, (int) ($q['max'] ?? 5)));
            if (!is_numeric($v) || (int) $v != $v || $v < 1 || $v > $max) fail($qid, m('rating'));
            return [(int) $v, null];

        case 'scale':
            $min = (int) ($q['min'] ?? 1);
            $max = (int) ($q['max'] ?? 5);
            if (!is_numeric($v) || (int) $v != $v || $v < $min || $v > $max) fail($qid, m('value'));
            return [(int) $v, null];

        case 'nps':
            if (!is_numeric($v) || (int) $v != $v || $v < 0 || $v > 10) fail($qid, m('value'));
            return [(int) $v, null];

        case 'slider':
            $min = (float) ($q['min'] ?? 0);
            $max = (float) ($q['max'] ?? 100);
            if (!is_numeric($v) || $v < $min || $v > $max) fail($qid, m('value'));
            return [$v + 0, null];

        case 'ranking':
            if (!is_array($v)) fail($qid, m('invalid'));
            $valid = ids_of($q['options'] ?? []);
            $v = array_values(array_unique(array_filter($v, fn($x) => is_string($x) && in_array($x, $valid, true))));
            return [$v ?: null, null];

        case 'matrix':
            if (!is_array($v)) fail($qid, m('invalid'));
            $rows = ids_of($q['rows'] ?? []);
            $cols = ids_of($q['columns'] ?? []);
            $clean = [];
            foreach ($v as $r => $c) {
                if (in_array((string) $r, $rows, true) && in_array($c, $cols, true)) $clean[(string) $r] = $c;
            }
            if (!empty($q['required']) && count($clean) < count($rows)) fail($qid, m('rows'));
            return [$clean ?: null, null];
    }
    return [null, null];
}

$rows = [];
foreach (survey_questions($s['def']) as $qid => $q) {
    [$val, $oth] = clean_answer($q, $answersIn[$qid] ?? null, $othersIn[$qid] ?? null);
    if ($val === null) {
        if (!empty($q['required'])) fail($qid, m('required'));
        continue;
    }
    $rows[] = [$qid, json_encode($val, JSON_UNESCAPED_UNICODE), $oth];
}
if (!$rows) json_out(['ok' => false, 'error' => m('empty')], 422);

$token = bin2hex(random_bytes(16));
$pdo = db();
$pdo->beginTransaction();
try {
    $ua = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    $dur = max(0, min(86400, (int) ($in['duration'] ?? 0)));
    if (has_lang_column()) {
        q('INSERT INTO responses (survey_id, token, ip_hash, user_agent, lang, duration_sec) VALUES (?, ?, ?, ?, ?, ?)', [$s['id'], $token, ip_hash(), $ua, $LANG, $dur]);
    } else {
        q('INSERT INTO responses (survey_id, token, ip_hash, user_agent, duration_sec) VALUES (?, ?, ?, ?, ?)', [$s['id'], $token, ip_hash(), $ua, $dur]);
    }
    $rid = (int) $pdo->lastInsertId();
    $st = $pdo->prepare('INSERT INTO answers (response_id, survey_id, question_id, value, other_text) VALUES (?, ?, ?, ?, ?)');
    foreach ($rows as [$qid, $val, $oth]) $st->execute([$rid, $s['id'], $qid, $val, $oth]);
    $pdo->commit();
} catch (Throwable $ex) {
    $pdo->rollBack();
    json_out(['ok' => false, 'error' => m('save_error')], 500);
}

if (!empty($s['def']['settings']['onePerBrowser'])) {
    setcookie(cookie_name($s['uid']), $token, [
        'expires'  => time() + 60 * 60 * 24 * 365,
        'path'     => base_path() . '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => is_https() ? 'None' : 'Lax',
    ]);
}

json_out(['ok' => true]);
