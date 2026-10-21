<?php
define('INSTALLING', true);
require __DIR__ . '/inc/bootstrap.php';

$locked = false;
if (is_file(APP_ROOT . '/config.php')) {
    try {
        $locked = (int) q('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
    } catch (Throwable $ex) {
        $locked = false;
    }
}

$errors = [];
$done = false;
$v = [
    'host' => $_POST['host'] ?? 'localhost',
    'port' => $_POST['port'] ?? '3306',
    'name' => $_POST['name'] ?? 'encuestas',
    'user' => $_POST['user'] ?? 'root',
    'pass' => $_POST['pass'] ?? '',
    'app_url'     => $_POST['app_url'] ?? (is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . base_path(),
    'pretty_urls' => $_SERVER['REQUEST_METHOD'] === 'POST' ? !empty($_POST['pretty_urls']) : true,
    'admin_name'  => $_POST['admin_name'] ?? '',
    'admin_email' => $_POST['admin_email'] ?? '',
];

if (!$locked && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pwd = (string) ($_POST['admin_pass'] ?? '');
    $v['app_url'] = rtrim(trim((string) $v['app_url']), '/');
    if (!preg_match('#^https?://[^/\s]+(/[^\s]*)?$#i', $v['app_url'])) $errors[] = __('La URL pública no es válida (ej: https://surveys.example.com).');
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $v['name'])) $errors[] = __('El nombre de la base de datos solo puede contener letras, números y guiones bajos.');
    if (trim($v['admin_name']) === '') $errors[] = __('Indica el nombre del administrador.');
    if (!filter_var($v['admin_email'], FILTER_VALIDATE_EMAIL)) $errors[] = __('El email del administrador no es válido.');
    if (strlen($pwd) < 8) $errors[] = __('La contraseña debe tener al menos 8 caracteres.');
    if (!is_writable(APP_ROOT)) $errors[] = __('PHP no puede escribir en {dir} para crear config.php. Revisa los permisos.', ['dir' => APP_ROOT]);

    if (!$errors) {
        try {
            $pdo = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $v['host'], (int) $v['port']), $v['user'], $v['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            try {
                $pdo->exec('USE `' . $v['name'] . '`');
            } catch (PDOException $ex) {
                // No existe todavía: intentamos crearla (en Plesk/cPanel suele crearse desde el panel)
                $pdo->exec('CREATE DATABASE `' . $v['name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
                $pdo->exec('USE `' . $v['name'] . '`');
            }
            $sql = file_get_contents(APP_ROOT . '/schema.sql');
            $sql = preg_replace('/^--.*$/m', '', $sql);
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                $pdo->exec($stmt);
            }
            $st = $pdo->prepare('INSERT INTO users (name, email, password_hash, lang) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)');
            $st->execute([trim($v['admin_name']), strtolower(trim($v['admin_email'])), password_hash($pwd, PASSWORD_DEFAULT), admin_lang()]);

            $config = [
                'db' => [
                    'host' => $v['host'], 'port' => (int) $v['port'], 'name' => $v['name'],
                    'user' => $v['user'], 'pass' => $v['pass'], 'charset' => 'utf8mb4',
                ],
                'app_url'       => $v['app_url'],
                'pretty_urls'   => (bool) $v['pretty_urls'],
                'app_name'      => 'Encuestas',
                'secret'        => bin2hex(random_bytes(32)),
                'upload_max_mb' => 50,
                'timezone'      => 'Europe/Madrid',
            ];
            $php = "<?php\n// Generado por install.php el " . date('Y-m-d H:i') . "\nreturn " . var_export($config, true) . ";\n";
            if (file_put_contents(APP_ROOT . '/config.php', $php) === false) {
                throw new RuntimeException('No se pudo escribir config.php');
            }
            if (!is_dir(APP_ROOT . '/uploads')) @mkdir(APP_ROOT . '/uploads', 0755, true);
            $done = true;
        } catch (Throwable $ex) {
            $errors[] = 'Error: ' . $ex->getMessage();
        }
    }
}
?><!doctype html>
<html lang="<?= e(admin_lang()) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e(__('Instalación')) ?> · <?= e(__('Encuestas')) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="assets/css/app.css?v=<?= APP_VERSION ?>">
</head>
<body class="auth-page">
<div class="auth-card wide">
  <div class="lang-switch" role="group" aria-label="Language / Idioma">
    <?php foreach (LANGS as $code => $name): ?><a class="<?= $code === admin_lang() ? 'active' : '' ?>" href="?ui=<?= e($code) ?>" title="<?= e($name) ?>"><?= e(strtoupper($code)) ?></a><?php endforeach; ?>
  </div>
  <div class="auth-brand"><span class="brand-mark"><i class="ti ti-chart-donut-3"></i></span> Encuestas</div>
  <?php if ($locked): ?>
    <h1><?= e(__('Ya está instalado')) ?></h1>
    <p class="muted"><?= __('La aplicación ya está configurada. Por seguridad, elimina <code>install.php</code> del servidor.') ?></p>
    <a class="btn btn-primary btn-block" href="admin/login.php"><?= e(__('Ir al panel')) ?></a>
  <?php elseif ($done): ?>
    <div class="success-icon"><i class="ti ti-check"></i></div>
    <h1><?= e(__('¡Instalación completada!')) ?></h1>
    <p class="muted"><?= __('Se ha creado la base de datos y el usuario administrador. <strong>Elimina <code>install.php</code></strong> del servidor por seguridad.') ?></p>
    <a class="btn btn-primary btn-block" href="admin/login.php"><?= e(__('Entrar al panel')) ?></a>
  <?php else: ?>
    <h1><?= e(__('Instalación')) ?></h1>
    <p class="muted"><?= e(__('Configura la conexión MySQL y crea tu cuenta de administrador.')) ?></p>
    <?php foreach ($errors as $err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endforeach; ?>
    <form method="post" class="form-grid">
      <h3 class="form-section"><?= e(__('Base de datos')) ?></h3>
      <label class="field"><span><?= e(__('Servidor')) ?></span><input name="host" value="<?= e($v['host']) ?>" required></label>
      <label class="field"><span><?= e(__('Puerto')) ?></span><input name="port" type="number" value="<?= e($v['port']) ?>" required></label>
      <label class="field"><span><?= e(__('Nombre de la base de datos')) ?></span><input name="name" value="<?= e($v['name']) ?>" required></label>
      <label class="field"><span><?= e(__('Usuario')) ?></span><input name="user" value="<?= e($v['user']) ?>" required></label>
      <label class="field full"><span><?= e(__('Contraseña')) ?></span><input name="pass" type="password" value="<?= e($v['pass']) ?>" autocomplete="off"></label>
      <h3 class="form-section"><?= e(__('Dirección web')) ?></h3>
      <label class="field full"><span><?= e(__('URL pública')) ?></span><input name="app_url" type="url" value="<?= e($v['app_url']) ?>" placeholder="https://surveys.example.com" required></label>
      <label class="toggle-row full">
        <span class="toggle-text"><strong><?= e(__('Enlaces cortos')) ?></strong><small><?= e(__('tudominio.com/Xk3mP9qa2B en lugar de …/s.php?id=Xk3mP9qa2B. Requiere mod_rewrite (activo en casi todos los hostings Apache).')) ?></small></span>
        <span class="switch"><input type="checkbox" name="pretty_urls" value="1" <?= $v['pretty_urls'] ? 'checked' : '' ?>><span class="slider"></span></span>
      </label>
      <h3 class="form-section"><?= e(__('Administrador')) ?></h3>
      <label class="field"><span><?= e(__('Nombre')) ?></span><input name="admin_name" value="<?= e($v['admin_name']) ?>" required></label>
      <label class="field"><span><?= e(__('Email')) ?></span><input name="admin_email" type="email" value="<?= e($v['admin_email']) ?>" required></label>
      <label class="field full"><span><?= e(__('Contraseña (mín. 8 caracteres)')) ?></span><input name="admin_pass" type="password" minlength="8" required autocomplete="new-password"></label>
      <button class="btn btn-primary btn-block full" type="submit"><i class="ti ti-rocket"></i> <?= e(__('Instalar')) ?></button>
    </form>
  <?php endif; ?>
</div>
</body>
</html>
