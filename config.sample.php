<?php
// Copia este archivo como config.php (o usa install.php, que lo genera por ti).
return [
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'encuestas',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
    ],
    // URL pública de la app (sin barra final). Vacío = autodetectar.
    'app_url'       => 'https://quiz.fourmartech.es',
    // Enlaces cortos: https://quiz.fourmartech.es/Xk3mP9qa2B (requiere mod_rewrite, ver .htaccess)
    'pretty_urls'   => true,
    'app_name'      => 'Encuestas',
    // Cadena larga y aleatoria. Se usa para anonimizar IPs (hash).
    'secret'        => 'CAMBIA-ESTO-POR-UNA-CADENA-LARGA-Y-ALEATORIA',
    'upload_max_mb' => 50,
    'timezone'      => 'Europe/Madrid',
];
