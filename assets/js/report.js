/* Results and charts */
(function () {
  'use strict';
  const R = window.REPORT;
  const h = SV.h;
  const C = {
    series: '#2a78d6',
    seriesSoft: 'rgba(42,120,214,.10)',
    grid: '#eceae6',
    text: '#52514e',
    good: '#1a9c5b',
    warn: '#d99a06',
    bad: '#e34948',
    neutral: '#b4b2ab',
  };
  const LOCALE = SV.adminLang === 'en' ? 'en-GB' : 'es-ES';
  const fmtN = (n) => Number(n).toLocaleString(LOCALE, { maximumFractionDigits: 2 });

  if (window.Chart) {
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = C.text;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#111827';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }

  /* ---------- pestañas ---------- */
  document.getElementById('report-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    document.getElementById('tab-summary').hidden = b.dataset.tab !== 'summary';
    document.getElementById('tab-responses').hidden = b.dataset.tab !== 'responses';
  });

  /* ---------- serie temporal ---------- */
  const tl = document.getElementById('chart-timeline');
  if (tl && window.Chart && R.timeline.length) {
    new Chart(tl, {
      type: 'line',
      data: {
        labels: R.timeline.map((p) => p.d),
        datasets: [{
          data: R.timeline.map((p) => p.n), borderColor: C.series, backgroundColor: C.seriesSoft, fill: true,
          borderWidth: 2, tension: 0.3, pointRadius: R.timeline.length > 40 ? 0 : 3, pointHoverRadius: 5,
          pointBackgroundColor: C.series, pointBorderColor: '#fff', pointBorderWidth: 2,
        }],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, callback(v) { const d = this.getLabelForValue(v); return d.slice(8, 10) + '/' + d.slice(5, 7); } } },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (it) => new Date(it[0].label + 'T00:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }),
              label: (it) => _t(it.parsed.y === 1 ? '{n} respuesta' : '{n} respuestas', { n: it.parsed.y }),
            },
          },
        },
      },
    });
  }

  /* ---------- tarjetas por pregunta ---------- */

  function questionCard(s, n) {
    const cat = SV.catalog[s.type] || { label: s.type, icon: 'ti-help' };
    const skipped = s.total - s.answered;
    const wide = ['matrix', 'image_choice', 'long_text', 'nps'].includes(s.type) || (s.options && s.options.length > 6);
    const card = h('article', { class: 'card q-card' + (wide ? ' is-wide' : '') },
      h('div', { class: 'q-card-head' },
        h('span', { class: 'q-card-num' }, n),
        h('div', null,
          h('div', { class: 'q-card-type' }, h('i', { class: 'ti ' + cat.icon }), cat.label),
          h('h3', null, s.title || _t('Sin título')),
          h('div', { class: 'q-card-meta' }, _t(s.answered === 1 ? '{n} respuesta' : '{n} respuestas', { n: fmtN(s.answered) }), skipped > 0 ? ' · ' + _t('{n} sin responder', { n: fmtN(skipped) }) : ''))));
    const body = h('div', { class: 'q-card-body' });
    card.append(body);
    if (!s.answered) {
      body.append(h('p', { class: 'muted small' }, _t('Nadie ha respondido a esta pregunta todavía.')));
      return card;
    }
    const r = renderers[s.type] || renderers.text;
    r(s, body);
    return card;
  }

  function bars(items, opts) {
    opts = opts || {};
    const max = Math.max(...items.map((i) => i.value), 0) || 1;
    const top = Math.max(...items.map((i) => i.value));
    return h('div', { class: 'hbars' }, items.map((it) => {
      const lead = opts.highlight && it.value === top && top > 0;
      return h('div', { class: 'hbar' + (lead ? ' is-lead' : ''), title: `${it.label}: ${it.title || it.value}` },
        h('div', { class: 'hbar-top' },
          h('span', { class: 'hbar-label' }, lead ? h('i', { class: 'ti ti-trophy' }) : null, it.label),
          h('span', { class: 'hbar-val' }, h('strong', null, it.display), it.sub ? h('small', null, it.sub) : null)),
        h('div', { class: 'hbar-track' }, h('div', { class: 'hbar-fill', style: { width: (it.value / max) * 100 + '%', background: it.color || '' } })));
    }));
  }

  function othersList(s, el) {
    if (!s.others || !s.others.length) return;
    const det = h('details', { class: 'others' },
      h('summary', null, _t('Ver respuestas «Otro» ({n})', { n: s.others.length })),
      h('ul', { class: 'text-list' }, s.others.map((o) => h('li', null, h('span', null, o.text || '—'), h('small', null, fmtDate(o.date))))));
    el.append(det);
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d.replace(' ', 'T'));
    return dt.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' }) + ' ' + dt.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  }

  function columnChart(el, labels, values, colors, opts) {
    opts = opts || {};
    if (!window.Chart) return;
    const box = h('div', { class: 'chart-box' }, h('canvas', { role: 'img', 'aria-label': _t('Distribución') }));
    el.append(box);
    const total = values.reduce((a, b) => a + b, 0) || 1;
    new Chart(box.firstChild, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: colors || C.series, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 24, categoryPercentage: 0.8, barPercentage: 0.9 }] },
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, title: opts.xTitle ? { display: true, text: opts.xTitle } : undefined },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 } },
        },
        plugins: { tooltip: { callbacks: { title: (it) => (opts.prefix || '') + it[0].label, label: (it) => `${it.parsed.y} (${Math.round((it.parsed.y / total) * 100)}%)` } } },
      },
    });
  }

  function statRow(items) {
    return h('div', { class: 'stat-row' }, items.filter(Boolean).map(([label, value]) => h('div', { class: 'stat' }, h('span', null, label), h('strong', null, value))));
  }

  const renderers = {
    single_choice: choice,
    multiple_choice: choice,
    dropdown: choice,
    yes_no(s, el) {
      const yes = s.options.find((o) => o.id === 'yes') || { count: 0, pct: 0, label: _t('Sí') };
      const no = s.options.find((o) => o.id === 'no') || { count: 0, pct: 0, label: _t('No') };
      el.append(h('div', { class: 'split' },
        h('div', { class: 'split-bar' },
          h('div', { class: 'split-seg', style: { flex: yes.count || 0.0001, background: C.good }, title: `${yes.label}: ${yes.count}` }),
          h('div', { class: 'split-seg', style: { flex: no.count || 0.0001, background: C.bad }, title: `${no.label}: ${no.count}` })),
        h('div', { class: 'split-legend' },
          h('div', null, h('i', { class: 'dot', style: { background: C.good } }), h('i', { class: 'ti ti-thumb-up' }), ` ${yes.label}`, h('strong', null, ` ${fmtN(yes.pct)}%`), h('small', null, ` (${yes.count})`)),
          h('div', null, h('i', { class: 'dot', style: { background: C.bad } }), h('i', { class: 'ti ti-thumb-down' }), ` ${no.label}`, h('strong', null, ` ${fmtN(no.pct)}%`), h('small', null, ` (${no.count})`)))));
    },
    image_choice(s, el) {
      const max = Math.max(...s.options.map((o) => o.count));
      const sorted = s.options.slice().sort((a, b) => b.count - a.count);
      const rank = {};
      sorted.forEach((o, i) => (rank[o.id] = i + 1));
      el.append(h('div', { class: 'img-results' }, s.options.map((o) => h('div', { class: 'img-result' + (o.count === max && max > 0 ? ' is-lead' : '') },
        h('div', { class: 'img-result-media' + (o.image ? '' : ' empty') }, o.image ? h('img', { src: SV.asset(o.image), alt: o.label }) : h('i', { class: 'ti ti-photo' }),
          h('span', { class: 'img-rank' }, o.count === max && max > 0 ? h('i', { class: 'ti ti-trophy' }) : '#' + rank[o.id])),
        h('div', { class: 'img-result-label' }, o.label),
        h('div', { class: 'hbar-track' }, h('div', { class: 'hbar-fill', style: { width: (max ? (o.count / max) * 100 : 0) + '%' } })),
        h('div', { class: 'img-result-val' }, h('strong', null, fmtN(o.pct) + '%'), h('small', null, _t(o.count === 1 ? '{n} voto' : '{n} votos', { n: o.count })))))));
      if (s.multi) el.append(h('p', { class: 'muted small' }, _t('Selección múltiple: los porcentajes se calculan sobre quienes respondieron y pueden sumar más de 100%.')));
    },
    rating(s, el) {
      const max = s.icon === 'emoji' ? 5 : s.scaleMax || 5;
      const icon = s.icon === 'heart' ? 'ti-heart-filled' : 'ti-star-filled';
      const stars = [];
      for (let i = 1; i <= max; i++) {
        const fill = Math.max(0, Math.min(1, (s.avg || 0) - (i - 1)));
        stars.push(h('span', { class: 'star', style: { '--fill': fill * 100 + '%' } }, h('i', { class: 'ti ' + icon })));
      }
      el.append(h('div', { class: 'hero-metric' },
        h('div', { class: 'hero-num' }, fmtN(s.avg), h('small', null, ' / ' + max)),
        h('div', { class: 'stars is-' + (s.icon || 'star') }, stars)));
      const keys = Object.keys(s.dist).sort((a, b) => b - a);
      el.append(bars(keys.map((k) => ({
        label: s.icon === 'emoji' ? ['😞', '🙁', '😐', '🙂', '😄'][k - 1] || k : `${k} ${s.icon === 'heart' ? '♥' : '★'}`,
        value: s.dist[k], display: Math.round((s.dist[k] / s.answered) * 100) + '%', sub: String(s.dist[k]),
      }))));
    },
    nps(s, el) {
      const n = s.nps;
      const tone = n.score >= 50 ? 'good' : n.score >= 0 ? 'warn' : 'bad';
      const label = _t(n.score >= 70 ? 'Excelente' : n.score >= 50 ? 'Muy bueno' : n.score >= 0 ? 'Mejorable' : 'Crítico');
      const tot = n.promoters + n.passives + n.detractors || 1;
      const pct = (x) => Math.round((x / tot) * 100);
      el.append(h('div', { class: 'nps-wrap' },
        h('div', { class: 'nps-score tone-' + tone },
          h('div', { class: 'hero-num' }, (n.score > 0 ? '+' : '') + n.score),
          h('div', { class: 'nps-label' }, h('i', { class: 'ti ' + (tone === 'good' ? 'ti-mood-happy' : tone === 'warn' ? 'ti-mood-empty' : 'ti-mood-sad') }), ' NPS · ' + label)),
        h('div', { class: 'nps-side' },
          h('div', { class: 'split-bar' },
            h('div', { class: 'split-seg', style: { flex: n.detractors || 0.0001, background: C.bad }, title: _t('Detractores') + ': ' + n.detractors }),
            h('div', { class: 'split-seg', style: { flex: n.passives || 0.0001, background: C.neutral }, title: _t('Pasivos') + ': ' + n.passives }),
            h('div', { class: 'split-seg', style: { flex: n.promoters || 0.0001, background: C.good }, title: _t('Promotores') + ': ' + n.promoters })),
          h('div', { class: 'split-legend' },
            h('div', null, h('i', { class: 'dot', style: { background: C.bad } }), _t('Detractores') + ' (0-6) ', h('strong', null, pct(n.detractors) + '%'), h('small', null, ` (${n.detractors})`)),
            h('div', null, h('i', { class: 'dot', style: { background: C.neutral } }), _t('Pasivos') + ' (7-8) ', h('strong', null, pct(n.passives) + '%'), h('small', null, ` (${n.passives})`)),
            h('div', null, h('i', { class: 'dot', style: { background: C.good } }), _t('Promotores') + ' (9-10) ', h('strong', null, pct(n.promoters) + '%'), h('small', null, ` (${n.promoters})`))))));
      const keys = Object.keys(s.dist);
      columnChart(el, keys, keys.map((k) => s.dist[k]), keys.map((k) => (k <= 6 ? C.bad : k <= 8 ? C.neutral : C.good)), { prefix: _t('Puntuación') + ' ' });
    },
    scale: numeric,
    slider: numeric,
    number: numeric,
    ranking(s, el) {
      el.append(h('ol', { class: 'rank-results' }, s.options.map((o, i) => h('li', { class: i === 0 ? 'is-lead' : '' },
        h('span', { class: 'rank-pos' }, i === 0 ? h('i', { class: 'ti ti-trophy' }) : i + 1),
        h('div', { class: 'rank-main' },
          h('div', { class: 'hbar-top' }, h('span', { class: 'hbar-label' }, o.label),
            h('span', { class: 'hbar-val' }, h('small', null, _t('posición media') + ' '), h('strong', null, o.avg != null ? fmtN(o.avg) : '—'))),
          h('div', { class: 'hbar-track' }, h('div', { class: 'hbar-fill', style: { width: o.score + '%' } })),
          h('small', { class: 'muted' }, _t('{n}× en primer lugar', { n: o.firsts })))))));
    },
    matrix(s, el) {
      const table = h('table', { class: 'heat' },
        h('thead', null, h('tr', null, h('th', null), s.columns.map((c) => h('th', null, c.label)))),
        h('tbody', null, s.rows.map((r) => {
          const row = s.grid[r.id] || {};
          const tot = Object.values(row).reduce((a, b) => a + b, 0) || 1;
          const top = Math.max(...Object.values(row));
          return h('tr', null, h('th', { scope: 'row' }, r.label), s.columns.map((c) => {
            const v = row[c.id] || 0;
            const p = v / tot;
            return h('td', {
              style: { background: `rgba(42,120,214,${(0.06 + p * 0.85).toFixed(3)})`, color: p > 0.5 ? '#fff' : '' },
              class: v === top && v > 0 ? 'is-top' : '', title: `${r.label} · ${c.label}: ${v} (${Math.round(p * 100)}%)`,
            }, h('strong', null, Math.round(p * 100) + '%'), h('small', null, v));
          }));
        })));
      el.append(h('div', { class: 'heat-wrap' }, table));
    },
    date(s, el) {
      if (s.top) {
        el.append(bars(Object.entries(s.top).map(([d, n]) => ({
          label: new Date(d + 'T00:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          value: n, display: String(n),
        }))));
      }
    },
    text(s, el) {
      const list = h('ul', { class: 'text-list' }, s.texts.map((t) => h('li', null, h('span', null, t.text), h('small', null, fmtDate(t.date)))));
      if (s.texts.length > 6) {
        const search = h('input', { type: 'search', placeholder: _t('Filtrar respuestas…'), class: 'mini-search' });
        search.addEventListener('input', () => {
          const q = search.value.toLowerCase();
          list.querySelectorAll('li').forEach((li) => (li.hidden = q && !li.textContent.toLowerCase().includes(q)));
        });
        el.append(search);
      }
      el.append(list);
    },
  };
  renderers.short_text = renderers.text;
  renderers.long_text = renderers.text;
  renderers.email = renderers.text;
  const _date = renderers.date;
  renderers.date = (s, el) => { _date(s, el); renderers.text(s, el); };

  function choice(s, el) {
    el.append(bars(s.options.map((o) => ({ label: o.label, value: o.count, display: fmtN(o.pct) + '%', sub: String(o.count), title: `${o.count} (${o.pct}%)` })), { highlight: true }));
    if (s.multi) el.append(h('p', { class: 'muted small' }, _t('Selección múltiple: los porcentajes pueden sumar más de 100%.')));
    othersList(s, el);
  }

  function numeric(s, el) {
    el.append(statRow([
      [_t('Media'), fmtN(s.avg) + (s.unit ? ' ' + s.unit : '')],
      [_t('Mediana'), fmtN(s.median)],
      [_t('Mínimo'), fmtN(s.min)],
      [_t('Máximo'), fmtN(s.max)],
    ]));
    const keys = Object.keys(s.dist);
    if (keys.length) columnChart(el, keys, keys.map((k) => s.dist[k]));
    if (s.minLabel || s.maxLabel) el.append(h('div', { class: 'scale-ends' }, h('span', null, s.minLabel || ''), h('span', null, s.maxLabel || '')));
  }

  const split = document.getElementById('lang-split');
  if (split && R.byLang) {
    const total = Object.values(R.byLang).reduce((a, b) => a + b, 0) || 1;
    const colors = [C.series, '#eb6834', '#1baf7a'];
    const entries = Object.entries(R.byLang);
    split.append(
      h('div', { class: 'split-bar' }, entries.map(([l, n], i) => h('div', { class: 'split-seg', style: { flex: n || 0.0001, background: colors[i % colors.length] }, title: `${R.langNames[l]}: ${n}` }))),
      h('div', { class: 'split-legend lang-legend' }, entries.map(([l, n], i) => h('div', null,
        h('i', { class: 'dot', style: { background: colors[i % colors.length] } }), R.langNames[l] + ' ',
        h('strong', null, Math.round((n / total) * 100) + '%'), h('small', null, ` (${fmtN(n)})`)))));
  }

  const grid = document.getElementById('q-grid');
  if (grid) R.stats.forEach((s, i) => grid.append(questionCard(s, i + 1)));

  /* ---------- individual responses ---------- */
  const list = document.getElementById('resp-list');
  const fmtDur = (s) => (s > 0 ? (s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s') : '—');
  function renderResponses(filter) {
    list.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const rows = R.responses.filter((r) => !q || r.items.some((i) => i.a.toLowerCase().includes(q)));
    if (!rows.length) {
      list.append(h('p', { class: 'muted center small pad' }, _t(R.responses.length ? 'No hay respuestas que coincidan.' : 'Todavía no hay respuestas.')));
      return;
    }
    rows.forEach((r) => {
      const preview = r.items.slice(0, 2).map((i) => i.a).filter(Boolean).join(' · ');
      const row = h('button', { type: 'button', class: 'resp-row' + (r.lang ? ' has-lang' : '') },
        h('span', { class: 'resp-id' }, '#' + r.id),
        r.lang ? h('span', { class: 'lang-badge' }, r.lang.toUpperCase()) : null,
        h('span', { class: 'resp-preview' }, preview || '—'),
        h('span', { class: 'resp-meta' }, h('i', { class: 'ti ti-clock' }), ' ' + fmtDur(r.dur)),
        h('span', { class: 'resp-date' }, r.date),
        h('i', { class: 'ti ti-chevron-right' }));
      row.addEventListener('click', () => openResponse(r));
      list.append(row);
    });
  }
  let currentResp = null;
  function openResponse(r) {
    currentResp = r;
    document.getElementById('resp-title').textContent = _t('Respuesta #{id}', { id: r.id });
    const body = document.getElementById('resp-body');
    body.innerHTML = '';
    body.append(h('p', { class: 'muted small' }, h('i', { class: 'ti ti-calendar' }), ' ' + r.date + '  ·  ', h('i', { class: 'ti ti-clock' }), ' ' + fmtDur(r.dur)));
    body.append(h('dl', { class: 'resp-detail' }, r.items.map((i) => [h('dt', null, i.q), h('dd', null, i.a || '—')])));
    App.openModal('modal-response');
  }
  if (list) {
    renderResponses();
    document.getElementById('resp-search').addEventListener('input', (e) => renderResponses(e.target.value));
  }
  document.getElementById('resp-delete').addEventListener('click', async () => {
    if (!currentResp) return;
    const ok = await App.confirm({ title: _t('Eliminar respuesta'), text: _t('Se eliminará la respuesta #{id}. No se puede deshacer.', { id: currentResp.id }), ok: _t('Eliminar'), danger: true });
    if (!ok) return;
    try {
      await App.api('delete_response', { id: currentResp.id });
      App.toast(_t('Respuesta eliminada'));
      setTimeout(() => location.reload(), 500);
    } catch (e) { App.toast(e.message, 'error'); }
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    const ok = await App.confirm({
      title: _t('Borrar todas las respuestas'),
      text: _t('Se eliminarán todas las respuestas y estadísticas de esta encuesta. Útil tras hacer pruebas. No se puede deshacer.'),
      ok: _t('Borrar todo'), danger: true,
    });
    if (!ok) return;
    try {
      await App.api('reset', { id: R.id });
      location.reload();
    } catch (e) { App.toast(e.message, 'error'); }
  });
})();
