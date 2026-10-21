<?php
require __DIR__ . '/../inc/bootstrap.php';
require_login();

$themes = all_themes();
foreach ($themes as &$t) $t['usage'] = theme_usage($t['key']);
unset($t);
$custom = array_values(array_filter($themes, fn($t) => $t['custom']));
$presets = array_values(array_filter($themes, fn($t) => !$t['custom']));

$pageTitle = __('Temas');
$active = 'themes';
$extraHead = '<link rel="stylesheet" href="' . url('assets/css/survey.css') . '?v=' . APP_VERSION . '">';
$extraFoot = '<script>window.THEMES = ' . json_for_script(['list' => $themes, 'defaults' => THEME_DEFAULTS]) . ';</script>'
    . '<script src="' . url('assets/js/blocks.js') . '?v=' . APP_VERSION . '"></script>'
    . '<script src="' . url('assets/js/themes.js') . '?v=' . APP_VERSION . '"></script>'
    . '<script src="' . url('assets/js/themes-page.js') . '?v=' . APP_VERSION . '"></script>';
require __DIR__ . '/partials/header.php';
?>
<main class="page">
  <section class="page-head">
    <div>
      <h1><?= e(__('Temas')) ?></h1>
      <p class="muted"><?= e(__('Crea estilos reutilizables con tus colores de marca y aplícalos a cualquier encuesta.')) ?></p>
    </div>
    <button class="btn btn-primary btn-lg" data-theme-new><i class="ti ti-plus"></i> <?= e(__('Nuevo tema')) ?></button>
  </section>

  <h2 class="section-title"><?= e(__('Tus temas')) ?> <span class="count"><?= count($custom) ?></span></h2>
  <?php if (!$custom): ?>
    <div class="empty-inline">
      <i class="ti ti-palette"></i>
      <div><strong><?= e(__('Aún no has creado temas')) ?></strong><p class="muted small"><?= e(__('Parte de cero o personaliza uno de los predefinidos. Si editas un tema, se actualizan todas las encuestas que lo usan.')) ?></p></div>
    </div>
  <?php endif; ?>
  <div class="theme-grid" id="custom-grid"></div>

  <h2 class="section-title"><?= e(__('Predefinidos')) ?> <span class="count"><?= count($presets) ?></span></h2>
  <div class="theme-grid" id="preset-grid"></div>
</main>

<div class="studio" id="studio" aria-hidden="true">
  <div class="studio-panel">
    <div class="studio-head">
      <strong id="studio-title"><?= e(__('Nuevo tema')) ?></strong>
      <button class="icon-btn" data-studio-close title="<?= e(__('Cerrar')) ?>"><i class="ti ti-x"></i></button>
    </div>
    <div class="studio-form" id="studio-form"></div>
    <div class="studio-foot">
      <button class="btn btn-ghost" data-studio-close><?= e(__('Cancelar')) ?></button>
      <button class="btn btn-primary" id="studio-save"><i class="ti ti-device-floppy"></i> <?= e(__('Guardar tema')) ?></button>
    </div>
  </div>
  <div class="studio-preview">
    <div class="seg seg-sm studio-device" id="studio-device">
      <button class="active" data-device="desktop" title="<?= e(__('Escritorio')) ?>"><i class="ti ti-device-desktop"></i></button>
      <button data-device="mobile" title="<?= e(__('Móvil')) ?>"><i class="ti ti-device-mobile"></i></button>
    </div>
    <div class="studio-frame" id="studio-frame"><div class="sv-root" id="studio-canvas"></div></div>
  </div>
</div>

<?php require __DIR__ . '/partials/footer.php'; ?>
