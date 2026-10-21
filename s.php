<?php
require __DIR__ . '/inc/bootstrap.php';

$uid = (string) ($_GET['id'] ?? '');
$s = preg_match('/^[a-zA-Z0-9]{4,16}$/', $uid) ? survey_by_uid($uid) : null;

if (!$s) {
    http_response_code(404);
    $state = 'missing';
    $def = default_definition('Encuesta no encontrada');
} else {
    $def = $s['def'];
    $preview = !empty($_GET['preview']) && current_user();
    $avail = survey_availability($s);
    $st = $def['settings'];

    if ($preview) {
        $state = 'open';
    } elseif ($avail !== 'open') {
        $state = 'closed';
    } elseif (already_answered($s)) {
        $state = 'done';
    } else {
        $state = 'open';
        if (empty($_SESSION['viewed'][$s['id']])) {
            $_SESSION['viewed'][$s['id']] = 1;
            q('UPDATE surveys SET views = views + 1 WHERE id = ?', [$s['id']]);
        }
    }

    $messages = [
        'draft'       => 'Esta encuesta todavía no está disponible.',
        'not_started' => 'Esta encuesta aún no ha comenzado. Abre el ' . (!empty($st['startAt']) ? date('d/m/Y \a \l\a\s H:i', strtotime($st['startAt'])) : 'próximamente') . '.',
        'closed'      => $st['closedMessage'] ?? 'Esta encuesta ya no acepta respuestas.',
        'ended'       => $st['closedMessage'] ?? 'Esta encuesta ya no acepta respuestas.',
        'full'        => $st['closedMessage'] ?? 'Esta encuesta ha alcanzado el máximo de respuestas.',
    ];
}

$settings = array_merge(default_settings(), $def['settings'] ?? []);
$theme = theme_config($settings['theme']);
$title = $s['title'] ?? 'Encuesta no encontrada';
$desc = $settings['description'] ?: strip_tags((string) ($def['welcome']['text'] ?? ''));
$ogImage = $def['welcome']['image'] ?? '' ?: ($settings['logo'] ?? '');
if ($ogImage && !preg_match('#^https?://#', $ogImage)) $ogImage = preg_match('#^uploads/#', $ogImage) ? abs_url($ogImage) : '';

$payload = [
    'uid'     => $s['uid'] ?? '',
    'title'   => $title,
    'state'   => $state,
    'preview' => !empty($preview),
    'message' => $state === 'closed' ? ($messages[$avail] ?? $messages['closed']) : ($state === 'done' ? $settings['doneMessage'] : ($state === 'missing' ? 'El enlace no es válido o la encuesta ha sido eliminada.' : '')),
    'def'     => $state === 'open' ? $def : ['settings' => $settings, 'welcome' => [], 'thanks' => [], 'steps' => []],
    'theme'   => $theme,
    'submit'  => url('submit.php'),
];
?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="<?= e($theme['accent']) ?>">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e(mb_substr($desc, 0, 160)) ?>">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e(mb_substr($desc, 0, 200)) ?>">
<?php if ($ogImage): ?><meta property="og:image" content="<?= e($ogImage) ?>"><?php endif; ?>
<?php if (!empty($preview) || $state !== 'open'): ?><meta name="robots" content="noindex"><?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="<?= e(font_link($theme['font'])) ?>">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="<?= url('assets/css/survey.css') ?>?v=<?= APP_VERSION ?>">
</head>
<body class="sv-page">
<div class="sv-root" id="sv">
  <div class="sv-progress" hidden><div class="sv-progress-bar"></div></div>
  <?php if (!empty($preview)): ?>
    <div class="sv-preview-banner"><i class="ti ti-eye"></i> Vista previa · las respuestas no se guardarán</div>
  <?php endif; ?>
  <main class="sv-shell">
    <header class="sv-header" id="sv-header"></header>
    <section class="sv-card" id="sv-card" aria-live="polite">
      <noscript><p>Necesitas activar JavaScript para responder esta encuesta.</p></noscript>
    </section>
  </main>
</div>
<script>window.APP = { base: <?= json_for_script(base_path()) ?> }; window.SURVEY = <?= json_for_script($payload) ?>;</script>
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js"></script>
<script src="<?= url('assets/js/blocks.js') ?>?v=<?= APP_VERSION ?>"></script>
<script src="<?= url('assets/js/survey.js') ?>?v=<?= APP_VERSION ?>"></script>
</body>
</html>
