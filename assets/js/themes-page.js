/* Themes management page */
(function () {
  'use strict';
  const h = SV.h;
  const T = window.THEMES;
  const studio = document.getElementById('studio');
  const canvas = document.getElementById('studio-canvas');
  let draft = null; // { id, config }

  function card(t) {
    const usage = t.usage ? _t(t.usage === 1 ? 'Usado en {n} encuesta' : 'Usado en {n} encuestas', { n: t.usage }) : _t('Sin usar');
    const actions = t.custom
      ? [
        h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => open(t.id, t.config) }, h('i', { class: 'ti ti-pencil' }), _t('Editar')),
        h('button', { type: 'button', class: 'icon-btn', title: _t('Duplicar'), onclick: () => open(null, Object.assign({}, t.config, { name: t.name + ' ' + _t('(copia)') })) }, h('i', { class: 'ti ti-copy' })),
        h('button', { type: 'button', class: 'icon-btn danger', title: _t('Eliminar'), onclick: () => remove(t) }, h('i', { class: 'ti ti-trash' })),
      ]
      : [h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => open(null, Object.assign({}, t.config, { name: t.name + ' ' + _t('(personalizado)') })) }, h('i', { class: 'ti ti-adjustments-horizontal' }), _t('Personalizar'))];
    const swatches = h('div', { class: 'theme-swatches' }, ['accent', 'bg', 'card', 'text'].map((k) => h('span', { style: { background: t.config[k] }, title: k })));
    return h('article', { class: 'theme-card' },
      SV.themeThumb(t.config),
      h('div', { class: 'theme-card-body' },
        h('div', { class: 'theme-card-top' }, h('strong', null, t.name), swatches),
        h('div', { class: 'muted small' }, t.config.font + ' · ' + usage),
        h('div', { class: 'theme-card-actions' }, actions)));
  }

  function renderGrids() {
    const cg = document.getElementById('custom-grid');
    const pg = document.getElementById('preset-grid');
    cg.replaceChildren(...T.list.filter((t) => t.custom).map(card));
    pg.replaceChildren(...T.list.filter((t) => !t.custom).map(card));
  }

  function preview() {
    SV.applyTheme(canvas, draft.config);
  }

  function open(id, config) {
    draft = { id, config: Object.assign({}, T.defaults, config) };
    document.getElementById('studio-title').textContent = id ? _t('Editar tema') : _t('Nuevo tema');
    const form = document.getElementById('studio-form');
    form.replaceChildren(SV.themeForm(draft.config, preview));
    canvas.replaceChildren(SV.themeSample());
    preview();
    studio.classList.add('open');
    studio.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    studio.classList.remove('open');
    studio.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    draft = null;
  }

  async function save() {
    if (!draft) return;
    if (!String(draft.config.name || '').trim()) return App.toast(_t('Ponle un nombre al tema'), 'error');
    const t = T.list.find((x) => x.custom && x.id === draft.id);
    if (t && t.usage > 0) {
      const ok = await App.confirm({ title: _t('Actualizar tema'), text: _t('Los cambios se aplicarán a las {n} encuesta(s) que usan «{name}».', { n: t.usage, name: t.name }), ok: _t('Guardar cambios') });
      if (!ok) return;
    }
    try {
      await App.api('theme_save', { id: draft.id || 0, config: draft.config });
      App.toast(_t('Tema guardado'));
      setTimeout(() => location.reload(), 400);
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function remove(t) {
    const ok = await App.confirm({
      title: _t('Eliminar tema'),
      text: t.usage ? _t('«{name}» se usa en {n} encuesta(s); pasarán a usar el tema por defecto.', { name: t.name, n: t.usage }) : _t('Se eliminará «{name}».', { name: t.name }),
      ok: _t('Eliminar'), danger: true,
    });
    if (!ok) return;
    try {
      await App.api('theme_delete', { id: t.id });
      location.reload();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  document.querySelector('[data-theme-new]').addEventListener('click', () => {
    const accent = '#5b4cf0';
    open(null, Object.assign({}, T.defaults, SV.autoPalette(accent, false), { accent, name: _t('Mi tema') }));
  });
  studio.addEventListener('click', (e) => { if (e.target.closest('[data-studio-close]')) close(); });
  document.getElementById('studio-save').addEventListener('click', save);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && studio.classList.contains('open')) close(); });
  document.getElementById('studio-device').addEventListener('click', (e) => {
    const b = e.target.closest('[data-device]');
    if (!b) return;
    document.getElementById('studio-frame').classList.toggle('is-mobile', b.dataset.device === 'mobile');
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  renderGrids();
})();
