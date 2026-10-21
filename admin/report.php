<?php
require __DIR__ . '/../inc/bootstrap.php';
require APP_ROOT . '/inc/results.php';
require_login();

$s = survey_by_id((int) ($_GET['id'] ?? 0));
if (!$s) redirect(url('admin/index.php'));

$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : '';
$to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : '';

[$responses, $answers] = results_load($s, $from ?: null, $to ?: null);
$stats = results_aggregate($s['def'], $responses, $answers);
$questions = survey_questions($s['def']);
$totalAll = (int) q('SELECT COUNT(*) FROM responses WHERE survey_id = ?', [$s['id']])->fetchColumn();
$L = survey_langs($s['def']);

// KPIs
$durations = array_values(array_filter(array_map(fn($r) => (int) $r['duration_sec'], $responses), fn($d) => $d > 0));
sort($durations);
$medianDur = $durations ? $durations[intdiv(count($durations), 2)] : 0;
$completion = $s['starts'] > 0 ? min(100, round($totalAll / $s['starts'] * 100)) : null;
$conversion = $s['views'] > 0 ? min(100, round($totalAll / $s['views'] * 100)) : null;

// Daily series
$byDay = [];
foreach ($responses as $r) {
    $d = substr($r['created_at'], 0, 10);
    $byDay[$d] = ($byDay[$d] ?? 0) + 1;
}
$timeline = [];
if ($byDay) {
    $start = new DateTime($from ?: min(array_keys($byDay)));
    $end = new DateTime($to ?: max(max(array_keys($byDay)), date('Y-m-d')));
    if ($start->diff($end)->days > 365) $start = (clone $end)->modify('-365 days');
    if ($start->diff($end)->days < 6) $start = (clone $end)->modify('-6 days');
    for ($d = clone $start; $d <= $end; $d->modify('+1 day')) {
        $k = $d->format('Y-m-d');
        $timeline[] = ['d' => $k, 'n' => $byDay[$k] ?? 0];
    }
}

// Responses by language (bilingual surveys)
$byLang = [];
if ($L['bilingual']) {
    foreach ($L['langs'] as $l) $byLang[$l] = 0;
    foreach ($responses as $r) {
        $l = $r['lang'] ?: $L['primary'];
        $byLang[$l] = ($byLang[$l] ?? 0) + 1;
    }
}

// Individual responses (latest 500)
$individual = [];
foreach (array_slice($responses, 0, 500) as $r) {
    $map = $answers[(int) $r['id']] ?? [];
    $items = [];
    foreach ($questions as $qid => $qq) {
        if (!isset($map[$qid])) continue;
        $items[] = ['q' => $qq['title'] ?? '', 'a' => answer_text($qq, $map[$qid]['v'], $map[$qid]['o']), 't' => $qq['type']];
    }
    $individual[] = ['id' => (int) $r['id'], 'date' => fmt_date($r['created_at']), 'dur' => (int) $r['duration_sec'], 'lang' => $L['bilingual'] ? ($r['lang'] ?: $L['primary']) : '', 'items' => $items];
}

$fmtDur = function (int $sec): string {
    if ($sec <= 0) return '—';
    if ($sec < 60) return $sec . ' s';
    return floor($sec / 60) . ' min ' . str_pad((string) ($sec % 60), 2, '0', STR_PAD_LEFT) . ' s';
};

$statusLabels = ['draft' => __('Borrador'), 'published' => __('Publicada'), 'closed' => __('Cerrada')];
$qs = http_build_query(array_filter(['id' => $s['id'], 'from' => $from, 'to' => $to]));
$shareAttrs = 'data-share="' . e(survey_url($s['uid'])) . '" data-status="' . e($s['status']) . '" data-id="' . (int) $s['id'] . '" data-title="' . e($s['title']) . '" data-langs="' . e(implode(',', $L['langs'])) . '"';
$pageTitle = __('Resultados') . ' · ' . $s['title'];
$active = 'surveys';
$bodyClass = 'is-report';
$extraFoot = '<script>window.REPORT = ' . json_for_script([
    'id' => (int) $s['id'], 'title' => $s['title'], 'stats' => $stats, 'timeline' => $timeline, 'responses' => $individual,
    'accent' => theme_config($s['def']['settings']['theme'] ?? null)['accent'],
    'byLang' => $byLang, 'langNames' => LANGS,
]) . ';</script>'
    . '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>'
    . '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>'
    . '<script src="' . url('assets/js/blocks.js') . '?v=' . APP_VERSION . '"></script>'
    . '<script src="' . url('assets/js/report.js') . '?v=' . APP_VERSION . '"></script>';
require __DIR__ . '/partials/header.php';
?>
<main class="page">
  <a class="back-link" href="index.php"><i class="ti ti-arrow-left"></i> <?= e(__('Encuestas')) ?></a>
  <section class="page-head">
    <div>
      <div class="title-row">
        <h1><?= e($s['title']) ?></h1>
        <span class="pill pill-<?= e($s['status']) ?>"><?= e($statusLabels[$s['status']]) ?></span>
        <?php if ($L['bilingual']): ?><span class="lang-badge"><i class="ti ti-language"></i> <?= e(strtoupper(implode('·', $L['langs']))) ?></span><?php endif; ?>
      </div>
      <p class="muted"><?= e(__('Resultados actualizados a {date}', ['date' => date('d/m/Y H:i')])) ?><?= $from || $to ? ' · ' . e(__('filtrado por fechas')) : '' ?></p>
    </div>
    <div class="head-actions">
      <a class="btn btn-ghost" href="editor.php?id=<?= (int) $s['id'] ?>"><i class="ti ti-pencil"></i> <?= e(__('Editar')) ?></a>
      <button class="btn btn-ghost" <?= $shareAttrs ?>><i class="ti ti-share"></i> <?= e(__('Compartir')) ?></button>
      <a class="btn btn-soft" href="api.php?action=export&<?= e($qs) ?>"><i class="ti ti-file-spreadsheet"></i> <?= e(__('Exportar CSV')) ?></a>
      <button class="btn btn-soft" onclick="window.print()"><i class="ti ti-printer"></i> <span class="hide-sm"><?= e(__('Imprimir / PDF')) ?></span></button>
      <div class="dropdown">
        <button class="icon-btn" data-dropdown aria-label="<?= e(__('Más')) ?>"><i class="ti ti-dots-vertical"></i></button>
        <div class="dropdown-menu right">
          <button class="danger" id="btn-reset"><i class="ti ti-eraser"></i> <?= e(__('Borrar todas las respuestas')) ?></button>
        </div>
      </div>
    </div>
  </section>

  <form class="filters" method="get">
    <input type="hidden" name="id" value="<?= (int) $s['id'] ?>">
    <label><span><?= e(__('Desde')) ?></span><input type="date" name="from" value="<?= e($from) ?>"></label>
    <label><span><?= e(__('Hasta')) ?></span><input type="date" name="to" value="<?= e($to) ?>"></label>
    <button class="btn btn-soft btn-sm" type="submit"><i class="ti ti-filter"></i> <?= e(__('Filtrar')) ?></button>
    <?php if ($from || $to): ?><a class="btn btn-ghost btn-sm" href="report.php?id=<?= (int) $s['id'] ?>"><i class="ti ti-x"></i> <?= e(__('Quitar filtro')) ?></a><?php endif; ?>
  </form>

  <section class="kpis">
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-users"></i></span><div><div class="kpi-label"><?= e(__('Respuestas')) ?><?= $from || $to ? ' (' . e(__('periodo')) . ')' : '' ?></div><div class="kpi-value"><?= nfmt(count($responses)) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-eye"></i></span><div><div class="kpi-label"><?= e(__('Visitas')) ?></div><div class="kpi-value"><?= nfmt((int) $s['views']) ?></div><div class="kpi-sub"><?= $conversion !== null ? e(__('{n}% responde', ['n' => $conversion])) : e(__('sin datos')) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-player-play"></i></span><div><div class="kpi-label"><?= e(__('Tasa de finalización')) ?></div><div class="kpi-value"><?= $completion !== null ? $completion . '%' : '—' ?></div><div class="kpi-sub"><?= e(__('{n} empezaron', ['n' => nfmt((int) $s['starts'])])) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-clock"></i></span><div><div class="kpi-label"><?= e(__('Tiempo medio')) ?></div><div class="kpi-value"><?= e($fmtDur($medianDur)) ?></div><div class="kpi-sub"><?= e(__('Última: {when}', ['when' => time_ago($responses[0]['created_at'] ?? null)])) ?></div></div></div>
  </section>

  <div class="tabs" id="report-tabs">
    <button class="active" data-tab="summary"><i class="ti ti-chart-pie"></i> <?= e(__('Resumen')) ?></button>
    <button data-tab="responses"><i class="ti ti-list-details"></i> <?= e(__('Respuestas individuales')) ?> <span class="count"><?= count($responses) ?></span></button>
  </div>

  <section id="tab-summary">
    <?php if (!$responses): ?>
      <div class="empty-state">
        <div class="empty-illus"><i class="ti ti-chart-dots-3"></i></div>
        <h2><?= e(__('Todavía no hay respuestas')) ?></h2>
        <p class="muted"><?= e(__('Comparte el enlace de la encuesta y los resultados aparecerán aquí en tiempo real.')) ?></p>
        <?php if ($s['status'] !== 'published'): ?><p class="muted small"><i class="ti ti-alert-triangle"></i> <?= e(__('Recuerda publicarla desde el editor.')) ?></p><?php endif; ?>
        <button class="btn btn-primary" <?= $shareAttrs ?>><i class="ti ti-share"></i> <?= e(__('Compartir encuesta')) ?></button>
      </div>
    <?php else: ?>
      <div class="report-top<?= $byLang ? ' has-langs' : '' ?>">
        <div class="card chart-card">
          <div class="card-head"><h3><?= e(__('Respuestas por día')) ?></h3></div>
          <div class="chart-box chart-timeline"><canvas id="chart-timeline" aria-label="<?= e(__('Respuestas por día')) ?>" role="img"></canvas></div>
        </div>
        <?php if ($byLang): ?>
          <div class="card lang-card">
            <div class="card-head"><h3><?= e(__('Por idioma')) ?></h3></div>
            <div id="lang-split"></div>
          </div>
        <?php endif; ?>
      </div>
      <?php if ($L['bilingual']): ?><p class="muted small report-note"><i class="ti ti-language"></i> <?= e(__('Los resultados combinan las respuestas de todos los idiomas y se muestran con los textos en {lang}.', ['lang' => LANGS[$L['primary']]])) ?></p><?php endif; ?>
      <div class="q-grid" id="q-grid"></div>
    <?php endif; ?>
  </section>

  <section id="tab-responses" hidden>
    <div class="card">
      <div class="card-head">
        <h3><?= e(__('Respuestas individuales')) ?></h3>
        <label class="search"><i class="ti ti-search"></i><input type="search" id="resp-search" placeholder="<?= e(__('Buscar en respuestas…')) ?>"></label>
      </div>
      <div id="resp-list" class="resp-list"></div>
      <?php if (count($responses) > 500): ?><p class="muted small center"><?= e(__('Se muestran las 500 más recientes. Exporta a CSV para verlas todas.')) ?></p><?php endif; ?>
    </div>
  </section>
</main>

<div class="modal" id="modal-response" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-dialog modal-lg">
    <div class="modal-head"><h2 id="resp-title"><?= e(__('Respuesta')) ?></h2><button class="icon-btn" data-close><i class="ti ti-x"></i></button></div>
    <div class="modal-body" id="resp-body"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost danger" id="resp-delete"><i class="ti ti-trash"></i> <?= e(__('Eliminar respuesta')) ?></button>
      <button class="btn btn-primary" data-close><?= e(__('Cerrar')) ?></button>
    </div>
  </div>
</div>

<?php require __DIR__ . '/partials/share-modal.php'; ?>
<?php require __DIR__ . '/partials/footer.php'; ?>
