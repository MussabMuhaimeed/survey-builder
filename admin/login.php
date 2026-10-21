<?php
require __DIR__ . '/../inc/bootstrap.php';

if (current_user()) redirect(url('admin/index.php'));

$error = '';
$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $pass = (string) ($_POST['password'] ?? '');

    // Simple brute-force brake (per session)
    $_SESSION['login_attempts'] = ($_SESSION['login_attempts'] ?? 0) + 1;
    if ($_SESSION['login_attempts'] > 5) usleep(min(5, $_SESSION['login_attempts'] - 5) * 500000);

    $u = q('SELECT * FROM users WHERE email = ?', [$email])->fetch();
    if ($u && password_verify($pass, $u['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $u['id'];
        $_SESSION['login_attempts'] = 0;
        // A language picked on the login screen becomes the user's panel language
        $picked = $_GET['ui'] ?? ($_COOKIE['svy_ui'] ?? '');
        if (isset(LANGS[$picked]) && $picked !== ($u['lang'] ?? 'es')) q('UPDATE users SET lang = ? WHERE id = ?', [$picked, $u['id']]);
        redirect(url('admin/index.php'));
    }
    $error = __('Email o contraseña incorrectos.');
}
?><!doctype html>
<html lang="<?= e(admin_lang()) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e(__('Acceder')) ?> · <?= e(__(config('app_name', 'Encuestas'))) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="<?= url('assets/css/app.css') ?>?v=<?= APP_VERSION ?>">
</head>
<body class="auth-page">
<form class="auth-card" method="post">
  <div class="lang-switch" role="group" aria-label="Language / Idioma">
    <?php foreach (LANGS as $code => $name): ?><a class="<?= $code === admin_lang() ? 'active' : '' ?>" href="?ui=<?= e($code) ?>" title="<?= e($name) ?>"><?= e(strtoupper($code)) ?></a><?php endforeach; ?>
  </div>
  <div class="auth-brand"><span class="brand-mark"><i class="ti ti-chart-donut-3"></i></span> <?= e(__(config('app_name', 'Encuestas'))) ?></div>
  <h1><?= e(__('Bienvenido de nuevo')) ?></h1>
  <p class="muted"><?= e(__('Accede para crear y gestionar tus encuestas.')) ?></p>
  <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
  <label class="field"><span><?= e(__('Email')) ?></span><input type="email" name="email" value="<?= e($email) ?>" required autofocus autocomplete="username"></label>
  <label class="field"><span><?= e(__('Contraseña')) ?></span><input type="password" name="password" required autocomplete="current-password"></label>
  <button class="btn btn-primary btn-block" type="submit"><?= e(__('Entrar')) ?> <i class="ti ti-arrow-right"></i></button>
</form>
</body>
</html>
