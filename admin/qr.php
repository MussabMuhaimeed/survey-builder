<?php
require __DIR__ . '/../inc/bootstrap.php';
require_login();

$s = survey_by_id((int) ($_GET['id'] ?? 0));
if (!$s) redirect(url('admin/index.php'));

$st = array_merge(default_settings(), $s['def']['settings'] ?? []);
$t = theme_config($st['theme']);
$welcome = $s['def']['welcome'] ?? [];
$L = survey_langs($s['def']);

// Poster language: one of the survey languages, or both stacked for bilingual surveys
$mode = $_GET['lang'] ?? ($L['bilingual'] ? 'both' : $L['primary']);
if ($mode !== 'both' && !in_array($mode, $L['langs'], true)) $mode = $L['primary'];
if ($mode === 'both' && !$L['bilingual']) $mode = $L['primary'];
$posterLangs = $mode === 'both' ? $L['langs'] : [$mode];
$link = survey_url($s['uid']) . ($mode === 'both' || !$L['bilingual'] ? '' : (config('pretty_urls') ? '?' : '&') . 'lang=' . $mode);

$plain = fn(string $md): string => trim(strip_tags(preg_replace('/\*\*|\*|\[([^\]]+)\]\([^)]+\)/', '$1', $md)));
$POSTER = [
    'es' => ['kicker' => 'Tu opinión cuenta', 'sub' => 'Responde a nuestra breve encuesta. Solo te llevará un par de minutos.', 'cta' => 'Escanea con tu móvil'],
    'en' => ['kicker' => 'Your opinion matters', 'sub' => 'Answer our short survey. It only takes a couple of minutes.', 'cta' => 'Scan with your phone'],
];
$txt = [];
foreach ($posterLangs as $l) {
    $txt[$l] = [
        'kicker' => $POSTER[$l]['kicker'],
        'title'  => tr_field($welcome, 'title', $l, $L['primary']) ?: $s['title'],
        'sub'    => $plain(tr_field($welcome, 'text', $l, $L['primary'])) ?: $POSTER[$l]['sub'],
        'cta'    => $POSTER[$l]['cta'],
    ];
}
$join = fn(string $k): string => implode(' · ', array_unique(array_map(fn($l) => $txt[$l][$k], $posterLangs)));
$asset = fn($u) => $u && !preg_match('#^(https?:|data:)#', $u) ? url($u) : $u;

$bg = $t['bg'];
if ($t['bgStyle'] === 'gradient') $bg = "linear-gradient(160deg, {$t['bg']}, {$t['bg2']})";
if ($t['bgStyle'] === 'image' && $t['bgImage']) {
    $o = $t['overlay'] / 100;
    $bg = "linear-gradient(rgba(10,12,20,$o), rgba(10,12,20,$o)), url('" . e($asset($t['bgImage'])) . "') center / cover";
}
$onImage = $t['bgStyle'] === 'image' && $t['bgImage'];
?><!doctype html>
<html lang="<?= e($posterLangs[0]) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e(__('Cartel QR')) ?> · <?= e($s['title']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="<?= e(font_link($t['font'])) ?>">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="<?= url('assets/css/app.css') ?>?v=<?= APP_VERSION ?>">
<style>
  @page { size: A4 portrait; margin: 0; }
  body.poster-page { background: #e9eaef; }
  .poster-tools { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; padding: 12px 16px; background: rgba(255,255,255,.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
  .poster-tools .seg button { font-size: 13px; }
  .poster-tools .tip { font-size: 12.5px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
  .poster-wrap { padding: 28px 16px 60px; display: flex; justify-content: center; }
  .poster {
    --accent: <?= e($t['accent']) ?>; --text: <?= e($onImage ? '#ffffff' : $t['text']) ?>; --muted: <?= e($onImage ? 'rgba(255,255,255,.85)' : $t['muted']) ?>;
    width: 210mm; min-height: 297mm; max-width: 100%; background: <?= $bg ?>; color: var(--text);
    font-family: '<?= e($t['font']) ?>', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; text-align: center;
    padding: 22mm 18mm 16mm; box-shadow: 0 30px 70px -30px rgba(0,0,0,.4); position: relative; overflow: hidden;
  }
  .poster.is-plain { --text: #111827; --muted: #4b5563; background: #fff; }
  .poster::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 7mm; background: var(--accent); }
  .poster-logo { max-height: 22mm; max-width: 70mm; object-fit: contain; margin-bottom: 10mm; }
  .poster-kicker { font-size: 13pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 5mm; }
  .poster.is-image .poster-kicker { color: #fff; opacity: .9; }
  .poster h1 { font-size: 34pt; line-height: 1.08; letter-spacing: -.02em; font-weight: 800; margin: 0 0 6mm; max-width: 165mm; }
  .poster-sub { font-size: 14pt; line-height: 1.45; color: var(--muted); max-width: 150mm; margin: 0 0 12mm; }
  .poster-sub + .poster-sub { margin-top: -8mm; }
  .poster-sub.alt { font-style: italic; font-size: 12.5pt; }
  .poster-title-2 { font-size: 20pt; font-weight: 700; line-height: 1.15; margin: -3mm 0 6mm; opacity: .75; max-width: 165mm; }
  .seg a.btn-seg { display: inline-flex; align-items: center; padding: 6px 13px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; }
  .seg a.btn-seg.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(17, 19, 34, .12); }
  .poster-qr { background: #fff; padding: 7mm; border-radius: 9mm; box-shadow: 0 18px 40px -18px rgba(0,0,0,.35); }
  .poster-qr canvas { display: block; width: 92mm; height: 92mm; image-rendering: pixelated; }
  .poster-cta { margin-top: 10mm; display: inline-flex; align-items: center; gap: 3mm; font-size: 16pt; font-weight: 700; background: var(--accent); color: <?= e(theme_ink($t['accent'])) ?>; padding: 4mm 8mm; border-radius: 99px; }
  .poster-url { margin-top: auto; padding-top: 10mm; font-size: 11pt; color: var(--muted); word-break: break-all; }
  [contenteditable]:hover { outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent); outline-offset: 4px; border-radius: 6px; }
  [contenteditable]:focus { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 6px; }
  @media print {
    body.poster-page { background: #fff; }
    .poster-tools { display: none !important; }
    .poster-wrap { padding: 0; }
    .poster { box-shadow: none; width: 210mm; height: 297mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    [contenteditable] { outline: none !important; }
  }
</style>
</head>
<body class="poster-page">
<div class="poster-tools">
  <a class="btn btn-ghost btn-sm" href="report.php?id=<?= (int) $s['id'] ?>"><i class="ti ti-arrow-left"></i> <?= e(__('Volver')) ?></a>
  <?php if ($L['bilingual']): ?>
  <div class="seg" id="poster-lang">
    <?php foreach (array_merge($L['langs'], ['both']) as $m): ?>
      <a class="btn-seg<?= $m === $mode ? ' active' : '' ?>" href="?id=<?= (int) $s['id'] ?>&lang=<?= e($m) ?>"><?= e($m === 'both' ? __('Bilingüe') : LANGS[$m]) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
  <div class="seg" id="bg-mode">
    <button class="active" data-mode="theme"><?= e(__('Fondo del tema')) ?></button>
    <button data-mode="plain"><?= e(__('Fondo blanco')) ?></button>
  </div>
  <div class="seg" id="qr-color">
    <button class="active" data-color="#111111"><?= e(__('QR negro')) ?></button>
    <button data-color="<?= e($t['accent']) ?>"><?= e(__('QR color')) ?></button>
  </div>
  <button class="btn btn-soft btn-sm" data-dl="png"><i class="ti ti-photo"></i> QR PNG</button>
  <button class="btn btn-soft btn-sm" data-dl="svg"><i class="ti ti-vector"></i> QR SVG</button>
  <button class="btn btn-primary btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> <?= e(__('Imprimir / PDF')) ?></button>
  <span class="tip"><i class="ti ti-pencil"></i> <?= e(__('Haz clic en los textos para editarlos')) ?></span>
</div>

<div class="poster-wrap">
  <div class="poster<?= $onImage ? ' is-image' : '' ?>" id="poster">
    <?php if (!empty($st['logo'])): ?><img class="poster-logo" src="<?= e($asset($st['logo'])) ?>" alt=""><?php endif; ?>
    <div class="poster-kicker" contenteditable="true" spellcheck="false"><?= e($join('kicker')) ?></div>
    <?php $first = $posterLangs[0]; $second = $posterLangs[1] ?? null; ?>
    <h1 contenteditable="true" spellcheck="false" lang="<?= e($first) ?>"><?= e($txt[$first]['title']) ?></h1>
    <?php if ($second && $txt[$second]['title'] !== $txt[$first]['title']): ?><p class="poster-title-2" contenteditable="true" spellcheck="false" lang="<?= e($second) ?>"><?= e($txt[$second]['title']) ?></p><?php endif; ?>
    <?php foreach ($posterLangs as $i => $l): ?>
      <p class="poster-sub<?= $i ? ' alt' : '' ?>" contenteditable="true" spellcheck="false" lang="<?= e($l) ?>"><?= e($txt[$l]['sub']) ?></p>
    <?php endforeach; ?>
    <div class="poster-qr" id="poster-qr"></div>
    <div class="poster-cta" contenteditable="true" spellcheck="false">📱 <?= e($join('cta')) ?></div>
    <div class="poster-url"><?= e($link) ?></div>
  </div>
</div>

<div id="toast-root" class="toast-root"></div>
<script>window.APP = { base: <?= json_for_script(base_path()) ?>, csrf: <?= json_for_script(csrf_token()) ?>, lang: <?= json_for_script(admin_lang()) ?> };</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<?= i18n_script() ?>
<script src="<?= url('assets/js/i18n.js') ?>?v=<?= APP_VERSION ?>"></script>
<script src="<?= url('assets/js/admin.js') ?>?v=<?= APP_VERSION ?>"></script>
<script>
(function () {
  const link = <?= json_for_script($link) ?>;
  const title = <?= json_for_script($s['title'] . ($mode !== 'both' && $L['bilingual'] ? '-' . $mode : '')) ?>;
  let fg = '#111111';
  const box = document.getElementById('poster-qr');
  const draw = () => { box.replaceChildren(App.qrCanvas(link, { size: 1100, fg, margin: 1 })); };
  draw();
  document.getElementById('qr-color').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]'); if (!b) return;
    fg = b.dataset.color; draw();
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });
  document.getElementById('bg-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    document.getElementById('poster').classList.toggle('is-plain', b.dataset.mode === 'plain');
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });
  document.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => App.downloadQr(link, b.dataset.dl, title, { fg })));
})();
</script>
</body>
</html>
