<?php
// Internationalisation: admin panel language (__), participant texts (ptext) and survey languages

const LANGS = ['es' => 'Español', 'en' => 'English'];

/* ---------- Admin panel ---------- */

/** Panel language: user preference > cookie > browser */
function admin_lang(): string
{
    static $lang = null;
    if ($lang !== null) return $lang;
    if (isset($_GET['ui']) && isset(LANGS[$_GET['ui']])) {
        $lang = $_GET['ui'];
        setcookie('svy_ui', $lang, ['expires' => time() + 31536000, 'path' => base_path() . '/', 'samesite' => 'Lax', 'secure' => is_https()]);
        return $lang;
    }
    if (!empty($_SESSION['uid'])) {
        try {
            $l = q('SELECT lang FROM users WHERE id = ?', [$_SESSION['uid']])->fetchColumn();
            if ($l && isset(LANGS[$l])) return $lang = $l;
        } catch (Throwable $ex) {
            // column not migrated yet
        }
    }
    if (isset($_COOKIE['svy_ui']) && isset(LANGS[$_COOKIE['svy_ui']])) return $lang = $_COOKIE['svy_ui'];
    return $lang = browser_lang(array_keys(LANGS), 'es');
}

function browser_lang(array $allowed, string $fallback): string
{
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    foreach (explode(',', $accept) as $part) {
        $code = substr(trim($part), 0, 2);
        if (in_array($code, $allowed, true)) return $code;
    }
    return $fallback;
}

/** English dictionary for the panel: Spanish source text => English */
function i18n_dict(): array
{
    static $dict = null;
    if ($dict === null) {
        $file = APP_ROOT . '/inc/lang/en.json';
        $dict = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    }
    return $dict;
}

/** Translates a panel string (Spanish source) into the admin language */
function __(string $s, array $vars = []): string
{
    if (admin_lang() === 'en') {
        $d = i18n_dict();
        if (isset($d[$s])) $s = $d[$s];
    }
    foreach ($vars as $k => $v) $s = str_replace('{' . $k . '}', (string) $v, $s);
    return $s;
}

/** <script> that exposes the dictionary to the panel JS (only when needed) */
function i18n_script(): string
{
    $out = '<script>window.I18N_EN = ' . (admin_lang() === 'en' ? json_for_script(i18n_dict()) : '{}') . ';</script>';
    return $out;
}

/* ---------- Participant-facing texts (server side) ---------- */

function ptext(string $key, string $lang, array $vars = []): string
{
    static $T = [
        'es' => [
            'closed'       => 'Esta encuesta ya no acepta respuestas. ¡Gracias por tu interés!',
            'done'         => 'Ya has participado en esta encuesta. ¡Gracias por tu tiempo!',
            'draft'        => 'Esta encuesta todavía no está disponible.',
            'not_started'  => 'Esta encuesta aún no ha comenzado. Abre el {date} a las {time}.',
            'soon'         => 'Esta encuesta aún no ha comenzado.',
            'full'         => 'Esta encuesta ha alcanzado el máximo de respuestas.',
            'missing'      => 'El enlace no es válido o la encuesta ha sido eliminada.',
            'preview'      => 'Vista previa · las respuestas no se guardarán',
            'noscript'     => 'Necesitas activar JavaScript para responder esta encuesta.',
            'not_found'    => 'Encuesta no encontrada',
            'bad_request'  => 'Petición inválida',
            'no_method'    => 'Método no permitido',
            'too_many'     => 'Demasiados envíos seguidos. Espera un momento.',
            'invalid'      => 'Respuesta no válida.',
            'bad_option'   => 'Opción no válida.',
            'specify'      => 'Especifica tu respuesta en «Otro».',
            'email'        => 'Introduce un email válido.',
            'date'         => 'Fecha no válida.',
            'number'       => 'Introduce un número válido.',
            'min'          => 'El valor mínimo es {n}.',
            'max'          => 'El valor máximo es {n}.',
            'max_sel'      => 'Puedes elegir como máximo {n} opciones.',
            'min_sel'      => 'Selecciona al menos {n} opciones.',
            'rating'       => 'Valoración no válida.',
            'value'        => 'Valor no válido.',
            'rows'         => 'Responde todas las filas.',
            'required'     => 'Esta pregunta es obligatoria.',
            'empty'        => 'No has respondido ninguna pregunta.',
            'save_error'   => 'No se pudo guardar tu respuesta. Inténtalo de nuevo.',
        ],
        'en' => [
            'closed'       => 'This survey is no longer accepting responses. Thank you for your interest!',
            'done'         => 'You have already taken part in this survey. Thank you for your time!',
            'draft'        => 'This survey is not available yet.',
            'not_started'  => 'This survey has not started yet. It opens on {date} at {time}.',
            'soon'         => 'This survey has not started yet.',
            'full'         => 'This survey has reached its maximum number of responses.',
            'missing'      => 'This link is not valid or the survey has been deleted.',
            'preview'      => 'Preview · responses will not be saved',
            'noscript'     => 'Please enable JavaScript to answer this survey.',
            'not_found'    => 'Survey not found',
            'bad_request'  => 'Invalid request',
            'no_method'    => 'Method not allowed',
            'too_many'     => 'Too many submissions in a row. Please wait a moment.',
            'invalid'      => 'Invalid answer.',
            'bad_option'   => 'Invalid option.',
            'specify'      => 'Please specify your answer in “Other”.',
            'email'        => 'Please enter a valid email address.',
            'date'         => 'Invalid date.',
            'number'       => 'Please enter a valid number.',
            'min'          => 'The minimum value is {n}.',
            'max'          => 'The maximum value is {n}.',
            'max_sel'      => 'You can choose at most {n} options.',
            'min_sel'      => 'Please select at least {n} options.',
            'rating'       => 'Invalid rating.',
            'value'        => 'Invalid value.',
            'rows'         => 'Please answer every row.',
            'required'     => 'This question is required.',
            'empty'        => 'You have not answered any question.',
            'save_error'   => 'Your response could not be saved. Please try again.',
        ],
    ];
    $s = $T[$lang][$key] ?? $T['es'][$key] ?? $key;
    foreach ($vars as $k => $v) $s = str_replace('{' . $k . '}', (string) $v, $s);
    return $s;
}

/* ---------- Survey languages ---------- */

/** ['primary' => 'es', 'langs' => ['es','en'], 'bilingual' => bool] */
function survey_langs(array $def): array
{
    $st = $def['settings'] ?? [];
    $primary = ($st['lang'] ?? 'es') === 'en' ? 'en' : 'es';
    $langs = array_values(array_filter((array) ($st['languages'] ?? [$primary]), fn($l) => isset(LANGS[$l])));
    if (!in_array($primary, $langs, true)) array_unshift($langs, $primary);
    $langs = array_values(array_unique($langs));
    return ['primary' => $primary, 'langs' => $langs, 'bilingual' => count($langs) > 1];
}

/** Text of a field in a language, falling back to the primary text */
function tr_field(array $obj, string $field, string $lang, string $primary): string
{
    if ($lang !== $primary) {
        $t = $obj['tr'][$lang][$field] ?? '';
        if (is_string($t) && trim($t) !== '') return $t;
    }
    return (string) ($obj[$field] ?? '');
}

/** A survey message: custom text (localised) or the built-in default */
function survey_message(array $def, string $key, string $lang): string
{
    $L = survey_langs($def);
    $custom = tr_field($def['settings'] ?? [], $key . 'Message', $lang, $L['primary']);
    // Legacy surveys stored the Spanish default text: treat it as "not customised"
    if ($custom === '' || $custom === ptext($key, 'es')) return ptext($key, $lang);
    return $custom;
}

/** Language the participant sees first: ?lang= > browser > primary */
function participant_lang(array $def): array
{
    $L = survey_langs($def);
    $forced = isset($_GET['lang']) && in_array($_GET['lang'], $L['langs'], true);
    $lang = $forced ? $_GET['lang'] : browser_lang($L['langs'], $L['primary']);
    return [$lang, $forced];
}

/** Number formatted for the panel language (1.234 / 1,234) */
function nfmt($n, int $decimals = 0): string
{
    return admin_lang() === 'en' ? number_format((float) $n, $decimals, '.', ',') : number_format((float) $n, $decimals, ',', '.');
}
