/* Página de gestión de temas */
(function () {
  'use strict';
  const h = SV.h;
  const T = window.THEMES;
  const studio = document.getElementById('studio');
  const canvas = document.getElementById('studio-canvas');
  let draft = null; // { id, config }

  function card(t) {
    const usage = t.usage ? `Usado en ${t.usage} encuesta${t.usage === 1 ? '' : 's'}` : 'Sin usar';
    const actions = t.custom
      ? [
        h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => open(t.id, t.config) }, h('i', { class: 'ti ti-pencil' }), 'Editar'),
        h('button', { type: 'button', class: 'icon-btn', title: 'Duplicar', onclick: () => open(null, Object.assign({}, t.config, { name: t.name + ' (copia)' })) }, h('i', { class: 'ti ti-copy' })),
        h('button', { type: 'button', class: 'icon-btn danger', title: 'Eliminar', onclick: () => remove(t) }, h('i', { class: 'ti ti-trash' })),
      ]
      : [h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => open(null, Object.assign({}, t.config, { name: t.name + ' (personalizado)' })) }, h('i', { class: 'ti ti-adjustments-horizontal' }), 'Personalizar')];
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
    document.getElementById('studio-title').textContent = id ? 'Editar tema' : 'Nuevo tema';
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
    if (!String(draft.config.name || '').trim()) return App.toast('Ponle un nombre al tema', 'error');
    const t = T.list.find((x) => x.custom && x.id === draft.id);
    if (t && t.usage > 0) {
      const ok = await App.confirm({ title: 'Actualizar tema', text: `Los cambios se aplicarán a las ${t.usage} encuesta(s) que usan «${t.name}».`, ok: 'Guardar cambios' });
      if (!ok) return;
    }
    try {
      await App.api('theme_save', { id: draft.id || 0, config: draft.config });
      App.toast('Tema guardado');
      setTimeout(() => location.reload(), 400);
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function remove(t) {
    const ok = await App.confirm({
      title: 'Eliminar tema',
      text: t.usage ? `«${t.name}» se usa en ${t.usage} encuesta(s); pasarán a usar el tema por defecto.` : `Se eliminará «${t.name}».`,
      ok: 'Eliminar', danger: true,
    });
    if (!ok) return;
    try {
      await App.api('theme_delete', { id: t.id });
      location.reload();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  document.querySelector('[data-theme-new]').addEventListener('click', () => {
    const accent = '#5b4cf0';
    open(null, Object.assign({}, T.defaults, SV.autoPalette(accent, false), { accent, name: 'Mi tema' }));
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
