<?php
require __DIR__ . '/inc/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['ok' => false, 'error' => 'Método no permitido'], 405);

/* ---------- Registro de inicio (beacon) ---------- */
if (($_GET['action'] ?? '') === 'start') {
    $uid = (string) ($_POST['uid'] ?? '');
    if (preg_match('/^[a-zA-Z0-9]{4,16}$/', $uid) && empty($_SESSION['started'][$uid])) {
        $_SESSION['started'][$uid] = 1;
        q("UPDATE surveys SET starts = starts + 1 WHERE uid = ? AND status = 'published'", [$uid]);
    }
    http_response_code(204);
    exit;
}

/* ---------- Envío de respuestas ---------- */
$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) json_out(['ok' => false, 'error' => 'Petición inválida'], 400);

$uid = (string) ($in['uid'] ?? '');
$s = preg_match('/^[a-zA-Z0-9]{4,16}$/', $uid) ? survey_by_uid($uid) : null;
if (!$s) json_out(['ok' => false, 'error' => 'Encuesta no encontrada'], 404);

if (survey_availability($s) !== 'open') {
    json_out(['ok' => false, 'error' => $s['def']['settings']['closedMessage'] ?? 'La encuesta no acepta respuestas.'], 403);
}
if (already_answered($s)) {
    json_out(['ok' => false, 'error' => $s['def']['settings']['doneMessage'] ?? 'Ya has participado en esta encuesta.'], 409);
}

// Trampa anti-bots: si el campo oculto viene relleno, fingimos éxito
if (!empty($in['website'])) json_out(['ok' => true]);

// Freno básico: máx. 10 envíos por minuto desde la misma IP
$recent = (int) q('SELECT COUNT(*) FROM responses WHERE ip_hash = ? AND created_at >= (NOW() - INTERVAL 1 MINUTE)', [ip_hash()])->fetchColumn();
if ($recent >= 10) json_out(['ok' => false, 'error' => 'Demasiados envíos seguidos. Espera un momento.'], 429);

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

/** Valida y normaliza el valor de una pregunta. Devuelve [valor|null, otro|null] */
function clean_answer(array $q, $v, $other): array
{
    $qid = $q['id'];
    $type = $q['type'];
    if ($v === null || $v === '' || $v === []) return [null, null];
    $other = is_string($other) ? mb_substr(trim($other), 0, 1000) : null;

    switch ($type) {
        case 'short_text':
        case 'long_text':
            if (!is_scalar($v)) fail($qid, 'Respuesta no válida.');
            $limit = $type === 'long_text' ? ((int) ($q['maxLength'] ?? 0) ?: 10000) : 1000;
            $v = mb_substr(trim((string) $v), 0, $limit);
            return [$v === '' ? null : $v, null];

        case 'email':
            $v = trim((string) $v);
            if (!filter_var($v, FILTER_VALIDATE_EMAIL)) fail($qid, 'Introduce un email válido.');
            return [mb_substr($v, 0, 190), null];

        case 'date':
            if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) fail($qid, 'Fecha no válida.');
            return [$v, null];

        case 'number':
            if (!is_numeric($v)) fail($qid, 'Introduce un número válido.');
            $v = $v + 0;
            if (($q['min'] ?? '') !== '' && $v < (float) $q['min']) fail($qid, 'El valor mínimo es ' . $q['min'] . '.');
            if (($q['max'] ?? '') !== '' && $v > (float) $q['max']) fail($qid, 'El valor máximo es ' . $q['max'] . '.');
            return [$v, null];

        case 'single_choice':
        case 'dropdown':
            $valid = ids_of($q['options'] ?? []);
            if ($type === 'single_choice' && !empty($q['allowOther'])) $valid[] = '__other__';
            if (!is_string($v) || !in_array($v, $valid, true)) fail($qid, 'Opción no válida.');
            if ($v === '__other__' && !$other) fail($qid, 'Especifica tu respuesta en «Otro».');
            return [$v, $v === '__other__' ? $other : null];

        case 'yes_no':
            if (!in_array($v, ['yes', 'no'], true)) fail($qid, 'Opción no válida.');
            return [$v, null];

        case 'image_choice':
            if (empty($q['multiple'])) {
                if (!is_string($v) || !in_array($v, ids_of($q['options'] ?? []), true)) fail($qid, 'Opción no válida.');
                return [$v, null];
            }
            // múltiple: continúa abajo
        case 'multiple_choice':
            if (!is_array($v)) fail($qid, 'Respuesta no válida.');
            $valid = ids_of($q['options'] ?? []);
            if ($type === 'multiple_choice' && !empty($q['allowOther'])) $valid[] = '__other__';
            $v = array_values(array_unique(array_filter($v, fn($x) => is_string($x) && in_array($x, $valid, true))));
            if (!$v) return [null, null];
            $max = (int) ($q['maxSelect'] ?? 0);
            $min = (int) ($q['minSelect'] ?? 0);
            if ($max > 0 && count($v) > $max) fail($qid, "Puedes elegir como máximo $max opciones.");
            if ($min > 0 && count($v) < $min) fail($qid, "Selecciona al menos $min opciones.");
            $hasOther = in_array('__other__', $v, true);
            if ($hasOther && !$other) fail($qid, 'Especifica tu respuesta en «Otro».');
            return [$v, $hasOther ? $other : null];

        case 'rating':
            $max = ($q['icon'] ?? '') === 'emoji' ? 5 : min(10, max(3, (int) ($q['max'] ?? 5)));
            if (!is_numeric($v) || (int) $v != $v || $v < 1 || $v > $max) fail($qid, 'Valoración no válida.');
            return [(int) $v, null];

        case 'scale':
            $min = (int) ($q['min'] ?? 1);
            $max = (int) ($q['max'] ?? 5);
            if (!is_numeric($v) || (int) $v != $v || $v < $min || $v > $max) fail($qid, 'Valor no válido.');
            return [(int) $v, null];

        case 'nps':
            if (!is_numeric($v) || (int) $v != $v || $v < 0 || $v > 10) fail($qid, 'Valor no válido.');
            return [(int) $v, null];

        case 'slider':
            $min = (float) ($q['min'] ?? 0);
            $max = (float) ($q['max'] ?? 100);
            if (!is_numeric($v) || $v < $min || $v > $max) fail($qid, 'Valor no válido.');
            return [$v + 0, null];

        case 'ranking':
            if (!is_array($v)) fail($qid, 'Respuesta no válida.');
            $valid = ids_of($q['options'] ?? []);
            $v = array_values(array_unique(array_filter($v, fn($x) => is_string($x) && in_array($x, $valid, true))));
            return [$v ?: null, null];

        case 'matrix':
            if (!is_array($v)) fail($qid, 'Respuesta no válida.');
            $rows = ids_of($q['rows'] ?? []);
            $cols = ids_of($q['columns'] ?? []);
            $clean = [];
            foreach ($v as $r => $c) {
                if (in_array((string) $r, $rows, true) && in_array($c, $cols, true)) $clean[(string) $r] = $c;
            }
            if (!empty($q['required']) && count($clean) < count($rows)) fail($qid, 'Responde todas las filas.');
            return [$clean ?: null, null];
    }
    return [null, null];
}

$rows = [];
foreach (survey_questions($s['def']) as $qid => $q) {
    [$val, $oth] = clean_answer($q, $answersIn[$qid] ?? null, $othersIn[$qid] ?? null);
    if ($val === null) {
        if (!empty($q['required'])) fail($qid, 'Esta pregunta es obligatoria.');
        continue;
    }
    $rows[] = [$qid, json_encode($val, JSON_UNESCAPED_UNICODE), $oth];
}
if (!$rows) json_out(['ok' => false, 'error' => 'No has respondido ninguna pregunta.'], 422);

$token = bin2hex(random_bytes(16));
$pdo = db();
$pdo->beginTransaction();
try {
    q('INSERT INTO responses (survey_id, token, ip_hash, user_agent, duration_sec) VALUES (?, ?, ?, ?, ?)', [
        $s['id'], $token, ip_hash(), mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        max(0, min(86400, (int) ($in['duration'] ?? 0))),
    ]);
    $rid = (int) $pdo->lastInsertId();
    $st = $pdo->prepare('INSERT INTO answers (response_id, survey_id, question_id, value, other_text) VALUES (?, ?, ?, ?, ?)');
    foreach ($rows as [$qid, $val, $oth]) $st->execute([$rid, $s['id'], $qid, $val, $oth]);
    $pdo->commit();
} catch (Throwable $ex) {
    $pdo->rollBack();
    json_out(['ok' => false, 'error' => 'No se pudo guardar tu respuesta. Inténtalo de nuevo.'], 500);
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
