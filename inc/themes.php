<?php
// Sistema de temas: predefinidos + personalizados (tabla `themes`)

const THEME_DEFAULTS = [
    'name'        => 'Tema',
    'accent'      => '#6d5efc',
    'bgStyle'     => 'solid',   // solid | gradient | image
    'bg'          => '#f1f0fb',
    'bg2'         => '#fde7f3',
    'bgImage'     => '',
    'overlay'     => 30,        // % de oscurecimiento sobre la imagen
    'card'        => '#ffffff',
    'cardOpacity' => 100,       // < 100 = efecto cristal
    'text'        => '#16171d',
    'muted'       => '#696d7c',
    'border'      => '#e3e4ea',
    'input'       => '#ffffff',
    'font'        => 'Inter',
    'radius'      => 22,
    'shadow'      => true,
];

function preset_themes(): array
{
    $t = fn(array $c) => array_merge(THEME_DEFAULTS, $c);
    return [
        'lavanda'     => $t(['name' => __('Lavanda')]),
        'blanco'      => $t(['name' => __('Blanco limpio'), 'accent' => '#111827', 'bg' => '#ffffff', 'border' => '#e5e7eb', 'radius' => 14, 'shadow' => false]),
        'oceano'      => $t(['name' => __('Océano'), 'accent' => '#0284c7', 'bgStyle' => 'gradient', 'bg' => '#e0f2fe', 'bg2' => '#ecfeff', 'text' => '#0f172a', 'muted' => '#5b6b80', 'border' => '#dbe4ee', 'font' => 'Plus Jakarta Sans', 'radius' => 20]),
        'atardecer'   => $t(['name' => __('Atardecer'), 'accent' => '#ea580c', 'bgStyle' => 'gradient', 'bg' => '#ffedd5', 'bg2' => '#fce7f3', 'cardOpacity' => 88, 'text' => '#1c1917', 'muted' => '#78716c', 'border' => '#ebe3dc', 'font' => 'Poppins', 'radius' => 24]),
        'bosque'      => $t(['name' => __('Bosque'), 'accent' => '#15803d', 'bg' => '#ecf7f0', 'text' => '#0f2a1a', 'muted' => '#4b6355', 'border' => '#d3e6da', 'font' => 'DM Sans', 'radius' => 18]),
        'corporativo' => $t(['name' => __('Corporativo'), 'accent' => '#2563eb', 'bg' => '#f3f6fb', 'text' => '#0f172a', 'muted' => '#64748b', 'border' => '#e2e8f0', 'radius' => 10]),
        'rosa'        => $t(['name' => __('Chicle'), 'accent' => '#db2777', 'bgStyle' => 'gradient', 'bg' => '#fdf2f8', 'bg2' => '#ede9fe', 'muted' => '#6f6478', 'border' => '#eadff0', 'font' => 'Poppins', 'radius' => 26]),
        'papel'       => $t(['name' => __('Papel'), 'accent' => '#b45309', 'bg' => '#f5efe6', 'card' => '#fffdf8', 'text' => '#292524', 'muted' => '#78716c', 'border' => '#e7dfd2', 'input' => '#fffdf8', 'font' => 'Lora', 'radius' => 8]),
        'medianoche'  => $t(['name' => __('Medianoche'), 'accent' => '#8b5cf6', 'bg' => '#0e1016', 'card' => '#171a23', 'text' => '#eceef4', 'muted' => '#9aa0b3', 'border' => '#2a2f3d', 'input' => '#1d212c']),
        'neon'        => $t(['name' => __('Neón'), 'accent' => '#22d3ee', 'bgStyle' => 'gradient', 'bg' => '#0b1020', 'bg2' => '#24103d', 'card' => '#121527', 'cardOpacity' => 90, 'text' => '#f1f5f9', 'muted' => '#94a3b8', 'border' => '#2a3150', 'input' => '#181c33', 'font' => 'Space Grotesk', 'radius' => 16]),
    ];
}

function ensure_themes_table(): void
{
    db()->exec('CREATE TABLE IF NOT EXISTS themes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        config LONGTEXT NOT NULL,
        created_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

/** Temas personalizados: [ 'c12' => config ] */
function custom_themes(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    try {
        foreach (q('SELECT id, name, config FROM themes ORDER BY name')->fetchAll() as $r) {
            $c = json_decode($r['config'], true) ?: [];
            $cache['c' . $r['id']] = array_merge(THEME_DEFAULTS, $c, ['name' => $r['name']]);
        }
    } catch (Throwable $ex) {
        // La tabla aún no existe (instalaciones antiguas): sin temas personalizados
    }
    return $cache;
}

/** Lista para el frontend */
function all_themes(): array
{
    $out = [];
    foreach (preset_themes() as $k => $c) $out[] = ['key' => $k, 'name' => $c['name'], 'custom' => false, 'config' => $c];
    foreach (custom_themes() as $k => $c) $out[] = ['key' => $k, 'name' => $c['name'], 'custom' => true, 'id' => (int) substr($k, 1), 'config' => $c];
    return $out;
}

function theme_config(?string $key): array
{
    $presets = preset_themes();
    if ($key && isset($presets[$key])) return $presets[$key];
    if ($key && $key[0] === 'c') {
        $custom = custom_themes();
        if (isset($custom[$key])) return $custom[$key];
    }
    return $presets['lavanda'];
}

function sanitize_theme(array $c): array
{
    $out = THEME_DEFAULTS;
    $hex = fn($v, $d) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtolower($v) : $d;
    foreach (['accent', 'bg', 'bg2', 'card', 'text', 'muted', 'border', 'input'] as $k) $out[$k] = $hex($c[$k] ?? null, THEME_DEFAULTS[$k]);
    $out['name'] = mb_substr(trim((string) ($c['name'] ?? 'Tema')), 0, 120) ?: 'Tema';
    $out['bgStyle'] = in_array($c['bgStyle'] ?? '', ['solid', 'gradient', 'image'], true) ? $c['bgStyle'] : 'solid';
    $img = trim((string) ($c['bgImage'] ?? ''));
    $out['bgImage'] = (preg_match('#^https?://#i', $img) || (preg_match('#^uploads/[a-zA-Z0-9/_\-.]+$#', $img) && strpos($img, '..') === false)) ? $img : '';
    $out['overlay'] = max(0, min(85, (int) ($c['overlay'] ?? 30)));
    $out['cardOpacity'] = max(50, min(100, (int) ($c['cardOpacity'] ?? 100)));
    $out['font'] = array_key_exists((string) ($c['font'] ?? ''), FONTS) ? $c['font'] : 'Inter';
    $out['radius'] = max(0, min(36, (int) ($c['radius'] ?? 22)));
    $out['shadow'] = (bool) ($c['shadow'] ?? true);
    return $out;
}

/** Número de encuestas que usan un tema */
function theme_usage(string $key): int
{
    return (int) q('SELECT COUNT(*) FROM surveys WHERE definition LIKE ?', ['%"theme":"' . $key . '"%'])->fetchColumn();
}

/** Color de texto legible sobre un color de fondo (blanco u oscuro) */
function theme_ink(string $hex): string
{
    if (!preg_match('/^#([0-9a-f]{6})$/i', $hex, $m)) return '#ffffff';
    $c = array_map(function ($v) {
        $v /= 255;
        return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
    }, [hexdec(substr($m[1], 0, 2)), hexdec(substr($m[1], 2, 2)), hexdec(substr($m[1], 4, 2))]);
    return (0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2]) > 0.45 ? '#111827' : '#ffffff';
}
