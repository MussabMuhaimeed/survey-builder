<?php
// Copy this file to config.php (or run install.php, which generates it for you).
return [
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'encuestas',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
    ],
    // Public URL of the app, without trailing slash (e.g. https://surveys.example.com). Empty = auto-detect.
    'app_url'       => '',
    // Short links: https://surveys.example.com/Xk3mP9qa2B (requires mod_rewrite, see .htaccess)
    'pretty_urls'   => true,
    'app_name'      => 'Encuestas',   // shown in the panel (translated to "Surveys" in English)
    // Long random string, used to hash (anonymise) IP addresses.
    'secret'        => 'CAMBIA-ESTO-POR-UNA-CADENA-LARGA-Y-ALEATORIA',
    'upload_max_mb' => 50,
    'timezone'      => 'Europe/Madrid',
];
