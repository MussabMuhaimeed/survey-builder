<?php
require __DIR__ . '/../inc/bootstrap.php';
require APP_ROOT . '/inc/templates.php';
$user = require_login();

$rows = q('SELECT s.id, s.uid, s.title, s.status, s.views, s.starts, s.definition, s.created_at, s.updated_at,
                  COUNT(r.id) AS responses, MAX(r.created_at) AS last_response
           FROM surveys s LEFT JOIN responses r ON r.survey_id = s.id
           GROUP BY s.id ORDER BY s.updated_at DESC')->fetchAll();

$totalResponses = 0;
$published = 0;
foreach ($rows as &$r) {
    $def = json_decode($r['definition'], true) ?: [];
    $r['theme'] = theme_config($def['settings']['theme'] ?? null);
    $r['accent'] = $r['theme']['accent'];
    $r['questions'] = count(survey_questions($def));
    $r['steps'] = count($def['steps'] ?? []);
    $r['langs'] = survey_langs($def)['langs'];
    // Scheduling (informative only)
    $r['schedule'] = '';
    $now = time();
    $sa = !empty($def['settings']['startAt']) ? strtotime($def['settings']['startAt']) : null;
    $ea = !empty($def['settings']['endAt']) ? strtotime($def['settings']['endAt']) : null;
    if ($sa && $sa > $now) $r['schedule'] = __('Abre {date}', ['date' => date('d/m H:i', $sa)]);
    elseif ($ea && $ea < $now) $r['schedule'] = __('Cerró {date}', ['date' => date('d/m H:i', $ea)]);
    elseif ($ea) $r['schedule'] = __('Cierra {date}', ['date' => date('d/m H:i', $ea)]);
    unset($r['definition']);
    $totalResponses += (int) $r['responses'];
    if ($r['status'] === 'published') $published++;
}
unset($r);
$week = (int) q('SELECT COUNT(*) FROM responses WHERE created_at >= (NOW() - INTERVAL 7 DAY)')->fetchColumn();

$statusLabels = ['draft' => __('Borrador'), 'published' => __('Publicada'), 'closed' => __('Cerrada')];
$pageTitle = __('Encuestas');
$active = 'surveys';
$extraFoot = '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>'
    . '<script src="' . url('assets/js/dashboard.js') . '?v=' . APP_VERSION . '"></script>';
require __DIR__ . '/partials/header.php';
?>
<main class="page">
  <section class="page-head">
    <div>
      <h1><?= e(__('Hola, {name}', ['name' => explode(' ', $user['name'])[0]])) ?> 👋</h1>
      <p class="muted"><?= e(__('Diseña encuestas visuales, compártelas y analiza los resultados en tiempo real.')) ?></p>
    </div>
    <button class="btn btn-primary btn-lg" data-open="modal-new"><i class="ti ti-plus"></i> <?= e(__('Nueva encuesta')) ?></button>
  </section>

  <section class="kpis">
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-clipboard-list"></i></span><div><div class="kpi-label"><?= e(__('Encuestas')) ?></div><div class="kpi-value"><?= nfmt(count($rows)) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-broadcast"></i></span><div><div class="kpi-label"><?= e(__('Publicadas')) ?></div><div class="kpi-value"><?= nfmt($published) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-users"></i></span><div><div class="kpi-label"><?= e(__('Respuestas totales')) ?></div><div class="kpi-value"><?= nfmt($totalResponses) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-trending-up"></i></span><div><div class="kpi-label"><?= e(__('Últimos 7 días')) ?></div><div class="kpi-value"><?= nfmt($week) ?></div></div></div>
  </section>

  <?php if (!$rows): ?>
    <section class="empty-state">
      <div class="empty-illus"><i class="ti ti-sparkles"></i></div>
      <h2><?= e(__('Crea tu primera encuesta')) ?></h2>
      <p class="muted"><?= e(__('Empieza desde cero o usa una plantilla. Podrás añadir pasos, imágenes, vídeos, logos y todo tipo de preguntas.')) ?></p>
      <button class="btn btn-primary btn-lg" data-open="modal-new"><i class="ti ti-plus"></i> <?= e(__('Nueva encuesta')) ?></button>
    </section>
  <?php else: ?>
    <section class="toolbar">
      <div class="seg" id="status-filter">
        <button class="active" data-status=""><?= e(__('Todas')) ?></button>
        <button data-status="published"><?= e(__('Publicadas')) ?></button>
        <button data-status="draft"><?= e(__('Borradores')) ?></button>
        <button data-status="closed"><?= e(__('Cerradas')) ?></button>
      </div>
      <label class="search"><i class="ti ti-search"></i><input id="search" type="search" placeholder="<?= e(__('Buscar encuesta…')) ?>"></label>
    </section>

    <section class="survey-grid" id="survey-grid">
      <?php foreach ($rows as $r):
        $rate = $r['views'] > 0 ? round($r['responses'] / $r['views'] * 100) : 0; ?>
        <article class="survey-card" data-status="<?= e($r['status']) ?>" data-title="<?= e(mb_strtolower($r['title'])) ?>" style="--card-accent: <?= e($r['accent']) ?>">
          <div class="survey-card-top">
            <div class="survey-card-badges">
              <span class="pill pill-<?= e($r['status']) ?>"><?= e($statusLabels[$r['status']] ?? $r['status']) ?></span>
              <span class="lang-badge" title="<?= e(implode(' · ', array_map(fn($l) => LANGS[$l], $r['langs']))) ?>"><i class="ti ti-language"></i> <?= e(strtoupper(implode('·', $r['langs']))) ?></span>
            </div>
            <div class="dropdown">
              <button class="icon-btn" data-dropdown aria-label="<?= e(__('Más acciones')) ?>"><i class="ti ti-dots"></i></button>
              <div class="dropdown-menu">
                <a href="<?= e(survey_url($r['uid'], false, true)) ?>" target="_blank"><i class="ti ti-eye"></i> <?= e(__('Vista previa')) ?></a>
                <a href="qr.php?id=<?= (int) $r['id'] ?>" target="_blank"><i class="ti ti-qrcode"></i> <?= e(__('Código QR / cartel')) ?></a>
                <button data-action="duplicate" data-id="<?= (int) $r['id'] ?>"><i class="ti ti-copy"></i> <?= e(__('Duplicar')) ?></button>
                <button class="danger" data-action="delete" data-id="<?= (int) $r['id'] ?>" data-title="<?= e($r['title']) ?>"><i class="ti ti-trash"></i> <?= e(__('Eliminar')) ?></button>
              </div>
            </div>
          </div>
          <a class="survey-card-title" href="editor.php?id=<?= (int) $r['id'] ?>"><?= e($r['title']) ?></a>
          <div class="survey-card-meta">
            <span><i class="ti ti-stack-2"></i> <?= e(__($r['steps'] == 1 ? '{n} paso' : '{n} pasos', ['n' => $r['steps']])) ?></span>
            <span><i class="ti ti-help-circle"></i> <?= e(__($r['questions'] == 1 ? '{n} pregunta' : '{n} preguntas', ['n' => $r['questions']])) ?></span>
            <span><i class="ti ti-clock"></i> <?= e(time_ago($r['updated_at'])) ?></span>
            <?php if ($r['schedule']): ?><span class="sched"><i class="ti ti-calendar-time"></i> <?= e($r['schedule']) ?></span><?php endif; ?>
          </div>
          <div class="survey-card-stats">
            <div><strong><?= nfmt((int) $r['responses']) ?></strong><span><?= e(__('respuestas')) ?></span></div>
            <div><strong><?= nfmt((int) $r['views']) ?></strong><span><?= e(__('visitas')) ?></span></div>
            <div><strong><?= $rate ?>%</strong><span><?= e(__('conversión')) ?></span></div>
          </div>
          <div class="survey-card-actions">
            <a class="btn btn-soft" href="editor.php?id=<?= (int) $r['id'] ?>"><i class="ti ti-pencil"></i> <?= e(__('Editar')) ?></a>
            <a class="btn btn-soft" href="report.php?id=<?= (int) $r['id'] ?>"><i class="ti ti-chart-bar"></i> <?= e(__('Resultados')) ?></a>
            <button class="btn btn-icon btn-soft" title="<?= e(__('Compartir')) ?>" data-share="<?= e(survey_url($r['uid'])) ?>" data-status="<?= e($r['status']) ?>" data-id="<?= (int) $r['id'] ?>" data-title="<?= e($r['title']) ?>" data-langs="<?= e(implode(',', $r['langs'])) ?>"><i class="ti ti-share"></i></button>
          </div>
        </article>
      <?php endforeach; ?>
    </section>
    <p class="muted center hidden" id="no-results"><?= e(__('No hay encuestas que coincidan con la búsqueda.')) ?></p>
  <?php endif; ?>
</main>

<!-- New survey modal -->
<div class="modal" id="modal-new" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <form class="modal-dialog modal-lg" id="form-new">
    <div class="modal-head">
      <h2><?= e(__('Nueva encuesta')) ?></h2>
      <button type="button" class="icon-btn" data-close><i class="ti ti-x"></i></button>
    </div>
    <div class="modal-body">
      <label class="field"><span><?= e(__('Título')) ?></span><input name="title" required maxlength="200" placeholder="<?= e(__('Ej: Encuesta de satisfacción 2026')) ?>"></label>
      <div class="field"><span><?= e(__('Idioma de la encuesta')) ?></span>
        <?php $ui = admin_lang(); $other = $ui === 'en' ? 'es' : 'en'; ?>
        <div class="lang-options">
          <label class="lang-option"><input type="radio" name="lang" value="<?= e($ui) ?>" checked><span><strong><?= e(LANGS[$ui]) ?></strong><small><?= e(__('Un solo idioma')) ?></small></span></label>
          <label class="lang-option"><input type="radio" name="lang" value="<?= e($other) ?>"><span><strong><?= e(LANGS[$other]) ?></strong><small><?= e(__('Un solo idioma')) ?></small></span></label>
          <label class="lang-option"><input type="radio" name="lang" value="<?= e($ui . '+' . $other) ?>"><span><strong><i class="ti ti-language"></i> <?= e(__('Bilingüe')) ?></strong><small><?= e(LANGS[$ui]) ?> + <?= e(LANGS[$other]) ?></small></span></label>
        </div>
        <small class="hint"><?= e(__('En las encuestas bilingües cada participante elige su idioma y los resultados se suman en un único informe. Las plantillas ya vienen traducidas.')) ?></small>
      </div>
      <div class="field"><span><?= e(__('Punto de partida')) ?></span></div>
      <div class="template-grid">
        <?php $first = true; foreach (survey_templates() as $key => $t): ?>
          <label class="template-card">
            <input type="radio" name="template" value="<?= e($key) ?>" <?= $first ? 'checked' : '' ?>>
            <span class="template-icon"><i class="ti <?= e($t['icon']) ?>"></i></span>
            <strong><?= e($t['name']) ?></strong>
            <small><?= e($t['desc']) ?></small>
          </label>
        <?php $first = false; endforeach; ?>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-close><?= e(__('Cancelar')) ?></button>
      <button type="submit" class="btn btn-primary"><i class="ti ti-sparkles"></i> <?= e(__('Crear y diseñar')) ?></button>
    </div>
  </form>
</div>

<?php require __DIR__ . '/partials/share-modal.php'; ?>
<?php require __DIR__ . '/partials/footer.php'; ?>
