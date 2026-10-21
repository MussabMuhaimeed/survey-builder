<?php
/** @var string $pageTitle */
/** @var string $active */
$user = current_user();
$active = $active ?? '';
$uiLang = admin_lang();
?><!doctype html>
<html lang="<?= e($uiLang) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e($pageTitle ?? __('Panel')) ?> · <?= e(__(config('app_name', 'Encuestas'))) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="<?= url('assets/css/app.css') ?>?v=<?= APP_VERSION ?>">
<?= $extraHead ?? '' ?>
</head>
<body class="admin <?= e($bodyClass ?? '') ?>">
<?php if (!empty($GLOBALS['__migration_error']) && $user): ?>
<div class="alert alert-error migration-alert"><i class="ti ti-database-exclamation"></i> <span><?= e(__('No se pudo actualizar la base de datos: {error}', ['error' => $GLOBALS['__migration_error']])) ?></span></div>
<?php endif; ?>
<?php if (empty($noTopbar)): ?>
<header class="topbar">
  <a class="brand" href="<?= url('admin/index.php') ?>"><span class="brand-mark"><i class="ti ti-chart-donut-3"></i></span><span><?= e(__(config('app_name', 'Encuestas'))) ?></span></a>
  <nav class="topnav">
    <a href="<?= url('admin/index.php') ?>" class="<?= $active === 'surveys' ? 'active' : '' ?>"><i class="ti ti-layout-grid"></i><span><?= e(__('Encuestas')) ?></span></a>
    <a href="<?= url('admin/themes.php') ?>" class="<?= $active === 'themes' ? 'active' : '' ?>"><i class="ti ti-palette"></i><span><?= e(__('Temas')) ?></span></a>
  </nav>
  <div class="topbar-user">
    <div class="lang-switch" role="group" aria-label="<?= e(__('Idioma del panel')) ?>">
      <?php foreach (LANGS as $code => $name): ?>
        <button type="button" data-ui-lang="<?= e($code) ?>" class="<?= $code === $uiLang ? 'active' : '' ?>" title="<?= e($name) ?>"><?= e(strtoupper($code)) ?></button>
      <?php endforeach; ?>
    </div>
    <span class="avatar" title="<?= e($user['email'] ?? '') ?>"><?= e(mb_strtoupper(mb_substr($user['name'] ?? '?', 0, 1))) ?></span>
    <a class="icon-btn" href="<?= url('admin/logout.php') ?>" title="<?= e(__('Cerrar sesión')) ?>"><i class="ti ti-logout"></i></a>
  </div>
</header>
<?php endif; ?>
