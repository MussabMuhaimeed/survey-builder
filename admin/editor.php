<?php
require __DIR__ . '/../inc/bootstrap.php';
require_login();

$s = survey_by_id((int) ($_GET['id'] ?? 0));
if (!$s) redirect(url('admin/index.php'));

$payload = [
    'id'        => (int) $s['id'],
    'uid'       => $s['uid'],
    'title'     => $s['title'],
    'status'    => $s['status'],
    'def'       => $s['def'],
    'publicUrl' => survey_url($s['uid']),
    'previewUrl' => survey_url($s['uid'], true, true),
    'fonts'     => array_keys(FONTS),
    'themes'    => all_themes(),
];
$curTheme = theme_config($s['def']['settings']['theme'] ?? null);

$pageTitle = 'Editor · ' . $s['title'];
$noTopbar = true;
$bodyClass = 'is-editor';
$extraHead = '<link rel="stylesheet" href="' . url('assets/css/survey.css') . '?v=' . APP_VERSION . '">';
foreach (FONTS as $name => $spec) {
    if ($name === $curTheme['font']) $extraHead .= '<link rel="stylesheet" data-font="' . e($name) . '" href="' . e(font_link($name)) . '">';
}
$extraFoot = '<script>window.EDITOR = ' . json_for_script($payload) . ';</script>'
    . '<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js"></script>'
    . '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>'
    . '<script src="' . url('assets/js/blocks.js') . '?v=' . APP_VERSION . '"></script>'
    . '<script src="' . url('assets/js/themes.js') . '?v=' . APP_VERSION . '"></script>'
    . '<script src="' . url('assets/js/editor.js') . '?v=' . APP_VERSION . '"></script>';
require __DIR__ . '/partials/header.php';
?>
<div class="ed" id="ed">
  <header class="ed-top">
    <a class="icon-btn" href="index.php" title="Volver a encuestas"><i class="ti ti-arrow-left"></i></a>
    <input class="ed-title" id="ed-title" value="<?= e($s['title']) ?>" maxlength="200" aria-label="Título de la encuesta">
    <span class="ed-save" id="ed-save"><i class="ti ti-cloud-check"></i><span>Guardado</span></span>
    <div class="ed-top-actions">
      <button class="icon-btn" id="ed-undo" title="Deshacer (Ctrl+Z)" disabled><i class="ti ti-arrow-back-up"></i></button>
      <button class="icon-btn" id="ed-redo" title="Rehacer (Ctrl+Shift+Z)" disabled><i class="ti ti-arrow-forward-up"></i></button>
      <div class="seg seg-sm hide-sm" id="ed-device">
        <button class="active" data-device="desktop" title="Escritorio"><i class="ti ti-device-desktop"></i></button>
        <button data-device="mobile" title="Móvil"><i class="ti ti-device-mobile"></i></button>
      </div>
      <button class="btn btn-ghost" id="ed-preview"><i class="ti ti-eye"></i><span class="hide-sm">Vista previa</span></button>
      <a class="btn btn-ghost hide-sm" href="report.php?id=<?= (int) $s['id'] ?>"><i class="ti ti-chart-bar"></i><span>Resultados</span></a>
      <button class="btn btn-ghost" id="ed-share" title="Compartir"><i class="ti ti-share"></i></button>
      <div class="status-wrap">
        <select id="ed-status" class="status-select" aria-label="Estado">
          <option value="draft">Borrador</option>
          <option value="published">Publicada</option>
          <option value="closed">Cerrada</option>
        </select>
      </div>
    </div>
  </header>

  <aside class="ed-palette" id="ed-palette" aria-label="Componentes"></aside>

  <main class="ed-main">
    <nav class="ed-steps" id="ed-steps" aria-label="Pasos"></nav>
    <div class="ed-stage" id="ed-stage">
      <div class="ed-frame" id="ed-frame">
        <div class="sv-root ed-canvas" id="ed-canvas"></div>
      </div>
    </div>
  </main>

  <aside class="ed-panel" id="ed-panel" aria-label="Propiedades">
    <div class="ed-panel-tabs" id="ed-panel-tabs">
      <button data-tab="props" class="active"><i class="ti ti-adjustments"></i> Propiedades</button>
      <button data-tab="design"><i class="ti ti-palette"></i> Diseño</button>
      <button data-tab="settings"><i class="ti ti-settings"></i> Ajustes</button>
    </div>
    <div class="ed-panel-body" id="ed-panel-body"></div>
  </aside>

  <div class="ed-mobilebar">
    <button data-mobile="palette"><i class="ti ti-plus"></i> Añadir</button>
    <button data-mobile="panel"><i class="ti ti-adjustments"></i> Editar</button>
  </div>
  <div class="ed-scrim" id="ed-scrim"></div>
</div>

<?php require __DIR__ . '/partials/share-modal.php'; ?>
<?php require __DIR__ . '/partials/footer.php'; ?>
