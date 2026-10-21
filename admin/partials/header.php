<?php
/** @var string $pageTitle */
/** @var string $active */
$user = current_user();
$active = $active ?? '';
?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e($pageTitle ?? 'Panel') ?> · <?= e(config('app_name', 'Encuestas')) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="<?= url('assets/css/app.css') ?>?v=<?= APP_VERSION ?>">
<?= $extraHead ?? '' ?>
</head>
<body class="admin <?= e($bodyClass ?? '') ?>">
<?php if (empty($noTopbar)): ?>
<header class="topbar">
  <a class="brand" href="<?= url('admin/index.php') ?>"><span class="brand-mark"><i class="ti ti-chart-donut-3"></i></span><span><?= e(config('app_name', 'Encuestas')) ?></span></a>
  <nav class="topnav">
    <a href="<?= url('admin/index.php') ?>" class="<?= $active === 'surveys' ? 'active' : '' ?>"><i class="ti ti-layout-grid"></i><span>Encuestas</span></a>
    <a href="<?= url('admin/themes.php') ?>" class="<?= $active === 'themes' ? 'active' : '' ?>"><i class="ti ti-palette"></i><span>Temas</span></a>
  </nav>
  <div class="topbar-user">
    <span class="avatar" title="<?= e($user['email'] ?? '') ?>"><?= e(mb_strtoupper(mb_substr($user['name'] ?? '?', 0, 1))) ?></span>
    <a class="icon-btn" href="<?= url('admin/logout.php') ?>" title="Cerrar sesión"><i class="ti ti-logout"></i></a>
  </div>
</header>
<?php endif; ?>
