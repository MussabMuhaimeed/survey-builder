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
    // Programación horaria (solo informativa en la tarjeta)
    $r['schedule'] = '';
    $now = time();
    $sa = !empty($def['settings']['startAt']) ? strtotime($def['settings']['startAt']) : null;
    $ea = !empty($def['settings']['endAt']) ? strtotime($def['settings']['endAt']) : null;
    if ($sa && $sa > $now) $r['schedule'] = 'Abre ' . date('d/m H:i', $sa);
    elseif ($ea && $ea < $now) $r['schedule'] = 'Cerró ' . date('d/m H:i', $ea);
    elseif ($ea) $r['schedule'] = 'Cierra ' . date('d/m H:i', $ea);
    unset($r['definition']);
    $totalResponses += (int) $r['responses'];
    if ($r['status'] === 'published') $published++;
}
unset($r);
$week = (int) q('SELECT COUNT(*) FROM responses WHERE created_at >= (NOW() - INTERVAL 7 DAY)')->fetchColumn();

$statusLabels = ['draft' => 'Borrador', 'published' => 'Publicada', 'closed' => 'Cerrada'];
$pageTitle = 'Encuestas';
$active = 'surveys';
$extraFoot = '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>'
    . '<script src="' . url('assets/js/dashboard.js') . '?v=' . APP_VERSION . '"></script>';
require __DIR__ . '/partials/header.php';
?>
<main class="page">
  <section class="page-head">
    <div>
      <h1>Hola, <?= e(explode(' ', $user['name'])[0]) ?> 👋</h1>
      <p class="muted">Diseña encuestas visuales, compártelas y analiza los resultados en tiempo real.</p>
    </div>
    <button class="btn btn-primary btn-lg" data-open="modal-new"><i class="ti ti-plus"></i> Nueva encuesta</button>
  </section>

  <section class="kpis">
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-clipboard-list"></i></span><div><div class="kpi-label">Encuestas</div><div class="kpi-value"><?= count($rows) ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-broadcast"></i></span><div><div class="kpi-label">Publicadas</div><div class="kpi-value"><?= $published ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-users"></i></span><div><div class="kpi-label">Respuestas totales</div><div class="kpi-value"><?= number_format($totalResponses, 0, ',', '.') ?></div></div></div>
    <div class="kpi"><span class="kpi-icon"><i class="ti ti-trending-up"></i></span><div><div class="kpi-label">Últimos 7 días</div><div class="kpi-value"><?= number_format($week, 0, ',', '.') ?></div></div></div>
  </section>

  <?php if (!$rows): ?>
    <section class="empty-state">
      <div class="empty-illus"><i class="ti ti-sparkles"></i></div>
      <h2>Crea tu primera encuesta</h2>
      <p class="muted">Empieza desde cero o usa una plantilla. Podrás añadir pasos, imágenes, vídeos, logos y todo tipo de preguntas.</p>
      <button class="btn btn-primary btn-lg" data-open="modal-new"><i class="ti ti-plus"></i> Nueva encuesta</button>
    </section>
  <?php else: ?>
    <section class="toolbar">
      <div class="seg" id="status-filter">
        <button class="active" data-status="">Todas</button>
        <button data-status="published">Publicadas</button>
        <button data-status="draft">Borradores</button>
        <button data-status="closed">Cerradas</button>
      </div>
      <label class="search"><i class="ti ti-search"></i><input id="search" type="search" placeholder="Buscar encuesta…"></label>
    </section>

    <section class="survey-grid" id="survey-grid">
      <?php foreach ($rows as $r):
        $rate = $r['views'] > 0 ? round($r['responses'] / $r['views'] * 100) : 0; ?>
        <article class="survey-card" data-status="<?= e($r['status']) ?>" data-title="<?= e(mb_strtolower($r['title'])) ?>" style="--card-accent: <?= e($r['accent']) ?>">
          <div class="survey-card-top">
            <span class="pill pill-<?= e($r['status']) ?>"><?= e($statusLabels[$r['status']] ?? $r['status']) ?></span>
            <div class="dropdown">
              <button class="icon-btn" data-dropdown aria-label="Más acciones"><i class="ti ti-dots"></i></button>
              <div class="dropdown-menu">
                <a href="<?= e(survey_url($r['uid'], false, true)) ?>" target="_blank"><i class="ti ti-eye"></i> Vista previa</a>
                <a href="qr.php?id=<?= (int) $r['id'] ?>" target="_blank"><i class="ti ti-qrcode"></i> Código QR / cartel</a>
                <button data-action="duplicate" data-id="<?= (int) $r['id'] ?>"><i class="ti ti-copy"></i> Duplicar</button>
                <button class="danger" data-action="delete" data-id="<?= (int) $r['id'] ?>" data-title="<?= e($r['title']) ?>"><i class="ti ti-trash"></i> Eliminar</button>
              </div>
            </div>
          </div>
          <a class="survey-card-title" href="editor.php?id=<?= (int) $r['id'] ?>"><?= e($r['title']) ?></a>
          <div class="survey-card-meta">
            <span><i class="ti ti-stack-2"></i> <?= $r['steps'] ?> paso<?= $r['steps'] == 1 ? '' : 's' ?></span>
            <span><i class="ti ti-help-circle"></i> <?= $r['questions'] ?> pregunta<?= $r['questions'] == 1 ? '' : 's' ?></span>
            <span><i class="ti ti-clock"></i> <?= e(time_ago($r['updated_at'])) ?></span>
            <?php if ($r['schedule']): ?><span class="sched"><i class="ti ti-calendar-time"></i> <?= e($r['schedule']) ?></span><?php endif; ?>
          </div>
          <div class="survey-card-stats">
            <div><strong><?= number_format((int) $r['responses'], 0, ',', '.') ?></strong><span>respuestas</span></div>
            <div><strong><?= number_format((int) $r['views'], 0, ',', '.') ?></strong><span>visitas</span></div>
            <div><strong><?= $rate ?>%</strong><span>conversión</span></div>
          </div>
          <div class="survey-card-actions">
            <a class="btn btn-soft" href="editor.php?id=<?= (int) $r['id'] ?>"><i class="ti ti-pencil"></i> Editar</a>
            <a class="btn btn-soft" href="report.php?id=<?= (int) $r['id'] ?>"><i class="ti ti-chart-bar"></i> Resultados</a>
            <button class="btn btn-icon btn-soft" title="Compartir" data-share="<?= e(survey_url($r['uid'])) ?>" data-status="<?= e($r['status']) ?>" data-id="<?= (int) $r['id'] ?>" data-title="<?= e($r['title']) ?>"><i class="ti ti-share"></i></button>
          </div>
        </article>
      <?php endforeach; ?>
    </section>
    <p class="muted center hidden" id="no-results">No hay encuestas que coincidan con la búsqueda.</p>
  <?php endif; ?>
</main>

<!-- Modal: nueva encuesta -->
<div class="modal" id="modal-new" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <form class="modal-dialog modal-lg" id="form-new">
    <div class="modal-head">
      <h2>Nueva encuesta</h2>
      <button type="button" class="icon-btn" data-close><i class="ti ti-x"></i></button>
    </div>
    <div class="modal-body">
      <label class="field"><span>Título</span><input name="title" required maxlength="200" placeholder="Ej: Encuesta de satisfacción 2026"></label>
      <div class="field"><span>Punto de partida</span></div>
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
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" class="btn btn-primary"><i class="ti ti-sparkles"></i> Crear y diseñar</button>
    </div>
  </form>
</div>

<?php require __DIR__ . '/partials/share-modal.php'; ?>
<?php require __DIR__ . '/partials/footer.php'; ?>
