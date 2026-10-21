/* Visual survey editor (with translation mode for bilingual surveys) */
(function () {
  'use strict';
  const h = SV.h;
  const E = window.EDITOR;
  const $ = (s, r) => (r || document).querySelector(s);

  let def = E.def;
  let title = E.title;
  let status = E.status;
  let screen = 0; // índice de paso | 'welcome' | 'thanks'
  let selected = null; // id de bloque
  let tab = 'props';
  let themeDraft = null; // { id: number|null, config: {...} } while a theme is being edited
  let editLang = SV.surveyLangs(E.def).primary; // language being edited (≠ primary = translation mode)
  E.themes = E.themes || [];

  function currentTheme() {
    if (themeDraft) return themeDraft.config;
    const t = E.themes.find((x) => x.key === def.settings.theme) || E.themes[0];
    return t ? t.config : SV.themeDefaults;
  }

  def.settings = def.settings || {};
  def.welcome = def.welcome || { enabled: true };
  def.thanks = def.thanks || {};
  def.steps = def.steps && def.steps.length ? def.steps : [{ id: SV.uid('s'), title: SV.surveyLangs(def).primary === 'en' ? 'Step 1' : 'Paso 1', blocks: [] }];

  const canvas = $('#ed-canvas');
  const frame = $('#ed-frame');
  const panelBody = $('#ed-panel-body');
  const stepsNav = $('#ed-steps');
  const saveEl = $('#ed-save');

  /* =========================================================
     Guardado, historial
     ========================================================= */
  let saveTimer = null;
  let dirty = false;
  let saving = null;
  const history = [];
  let hIndex = -1;
  let snapTimer = null;

  function snapshot() {
    const s = JSON.stringify({ title, def });
    if (history[hIndex] === s) return;
    history.splice(hIndex + 1);
    history.push(s);
    if (history.length > 60) history.shift();
    hIndex = history.length - 1;
    updateUndo();
  }
  function updateUndo() {
    $('#ed-undo').disabled = hIndex <= 0;
    $('#ed-redo').disabled = hIndex >= history.length - 1;
  }
  function restore(i) {
    if (i < 0 || i >= history.length) return;
    hIndex = i;
    const s = JSON.parse(history[i]);
    title = s.title;
    def = s.def;
    $('#ed-title').value = title;
    if (typeof screen === 'number' && screen >= def.steps.length) screen = def.steps.length - 1;
    if (selected && !findBlock(selected)) selected = null;
    syncEditLang();
    renderAll();
    updateUndo();
    queueSave(false);
  }

  function setSaveState(state, msg) {
    const map = {
      saved: ['ti-cloud-check', _t('Guardado')],
      pending: ['ti-cloud', _t('Cambios sin guardar')],
      saving: ['ti-loader-2 spin', _t('Guardando…')],
      error: ['ti-cloud-x', msg || _t('Error al guardar')],
    };
    saveEl.className = 'ed-save is-' + state;
    saveEl.innerHTML = `<i class="ti ${map[state][0]}"></i><span></span>`;
    saveEl.querySelector('span').textContent = map[state][1];
  }

  function queueSave(snap = true) {
    dirty = true;
    setSaveState('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1100);
    if (snap) {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapshot, 400);
    }
  }

  async function save() {
    clearTimeout(saveTimer);
    if (saving) await saving;
    if (!dirty) return;
    dirty = false;
    setSaveState('saving');
    saving = App.api('save', { id: E.id, title, definition: def })
      .then(() => setSaveState(dirty ? 'pending' : 'saved'))
      .catch((e) => {
        dirty = true;
        setSaveState('error', e.message);
        App.toast(e.message, 'error');
        if (e.status !== 401 && e.status !== 413) saveTimer = setTimeout(save, 5000);
      })
      .finally(() => { saving = null; });
    return saving;
  }

  window.addEventListener('beforeunload', (e) => {
    if (dirty || saving) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* =========================================================
     Helpers de datos
     ========================================================= */
  function currentStep() { return typeof screen === 'number' ? def.steps[screen] : null; }
  function findBlock(id) {
    for (let si = 0; si < def.steps.length; si++) {
      const bi = def.steps[si].blocks.findIndex((b) => b.id === id);
      if (bi >= 0) return { step: def.steps[si], si, bi, block: def.steps[si].blocks[bi] };
    }
    return null;
  }
  function questionNumbers() {
    const map = {};
    let n = 0;
    def.steps.forEach((s) => s.blocks.forEach((b) => { if (SV.isQuestion(b.type)) map[b.id] = ++n; }));
    return map;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reId(b) {
    b.id = SV.uid(SV.isQuestion(b.type) ? 'q' : 'b');
    ['options', 'rows', 'columns'].forEach((k) => { if (Array.isArray(b[k])) b[k].forEach((o) => (o.id = SV.uid('o'))); });
    return b;
  }

  /* =========================================================
     Acciones
     ========================================================= */
  function addBlock(type, index) {
    if (translating()) return App.toast(_t('Estás en modo traducción. Cambia a {lang} para modificar la estructura.', { lang: SV.LANGS[langs().primary].short }), 'info');
    if (typeof screen !== 'number') screen = 0;
    const step = currentStep();
    const b = SV.newBlock(type, langs().primary);
    if (index == null) {
      const si = selected ? step.blocks.findIndex((x) => x.id === selected) : -1;
      index = si >= 0 ? si + 1 : step.blocks.length;
    }
    step.blocks.splice(index, 0, b);
    selected = b.id;
    tab = 'props';
    renderAll();
    queueSave();
    closeDrawers();
    requestAnimationFrame(() => {
      const el = canvas.querySelector(`.ed-block[data-id="${b.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = panelBody.querySelector('textarea, input[type=text]');
      if (first && window.innerWidth > 1000) first.focus();
    });
  }

  function duplicateBlock(id) {
    if (translating()) return App.toast(_t('Estás en modo traducción. Cambia a {lang} para modificar la estructura.', { lang: SV.LANGS[langs().primary].short }), 'info');
    const f = findBlock(id);
    if (!f) return;
    const copy = reId(clone(f.block));
    f.step.blocks.splice(f.bi + 1, 0, copy);
    selected = copy.id;
    renderAll();
    queueSave();
  }

  function deleteBlock(id) {
    if (translating()) return App.toast(_t('Estás en modo traducción. Cambia a {lang} para modificar la estructura.', { lang: SV.LANGS[langs().primary].short }), 'info');
    const f = findBlock(id);
    if (!f) return;
    f.step.blocks.splice(f.bi, 1);
    if (selected === id) selected = null;
    renderAll();
    queueSave();
    App.toast(_t('Elemento eliminado · Ctrl+Z para deshacer'), 'info');
  }

  function moveBlock(id, dir) {
    if (translating()) return App.toast(_t('Estás en modo traducción. Cambia a {lang} para modificar la estructura.', { lang: SV.LANGS[langs().primary].short }), 'info');
    const f = findBlock(id);
    if (!f) return;
    const to = f.bi + dir;
    if (to < 0 || to >= f.step.blocks.length) return;
    f.step.blocks.splice(to, 0, f.step.blocks.splice(f.bi, 1)[0]);
    renderAll();
    queueSave();
  }

  function addStep() {
    if (translating()) return App.toast(_t('Estás en modo traducción. Cambia a {lang} para modificar la estructura.', { lang: SV.LANGS[langs().primary].short }), 'info');
    def.steps.push({ id: SV.uid('s'), title: (langs().primary === 'en' ? 'Step ' : 'Paso ') + (def.steps.length + 1), blocks: [] });
    screen = def.steps.length - 1;
    selected = null;
    tab = 'props';
    renderAll();
    queueSave();
  }

  /* =========================================================
     Paleta
     ========================================================= */
  const pal = $('#ed-palette');
  pal.addEventListener('click', (e) => {
    const it = e.target.closest('.ed-pal-item');
    if (it) addBlock(it.dataset.type);
  });
  pal.addEventListener('keydown', (e) => {
    const it = e.target.closest('.ed-pal-item');
    if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addBlock(it.dataset.type); }
  });

  function renderPalette() {
    pal.innerHTML = '';
    const groups = [['question', _t('Preguntas')], ['content', _t('Contenido')]];
    groups.forEach(([g, label]) => {
      const list = h('div', { class: 'ed-pal-list' });
      Object.entries(SV.catalog).forEach(([type, c]) => {
        if (c.group !== g) return;
        list.append(h('div', { class: 'ed-pal-item', role: 'button', tabindex: 0, 'data-type': type, title: _t('Añadir {name}', { name: c.label }) },
          h('i', { class: 'ti ' + c.icon }), h('span', null, c.label)));
      });
      pal.append(h('div', { class: 'ed-pal-group' }, h('div', { class: 'ed-pal-title' }, label), list));
      if (window.Sortable) {
        Sortable.create(list, { group: { name: 'blocks', pull: 'clone', put: false }, sort: false, animation: 150 });
      }
    });
    pal.append(h('p', { class: 'ed-pal-tip' }, h('i', { class: 'ti ti-hand-finger' }), ' ' + _t('Haz clic o arrastra al lienzo')));
  }

  /* =========================================================
     Barra de pasos
     ========================================================= */
  function renderSteps() {
    stepsNav.innerHTML = '';
    const pend = translating() ? SV.trPending(def, editLang, langs().primary) : null;
    const pill = (key, label, icon, extra) => {
      const active = screen === key;
      return h('button', Object.assign({ type: 'button', class: 'ed-step' + (active ? ' active' : '') + (extra && extra.cls ? ' ' + extra.cls : '') }, extra && extra.attrs),
        icon ? h('i', { class: 'ti ' + icon }) : null, h('span', null, label));
    };
    const w = pill('welcome', _t('Bienvenida'), 'ti-door-enter', { cls: (def.welcome.enabled === false ? 'is-off' : '') + (pend && pend.welcome ? ' has-pending' : '') });
    w.onclick = () => go('welcome');
    stepsNav.append(w);

    const list = h('div', { class: 'ed-steps-list' });
    def.steps.forEach((s, i) => {
      const count = s.blocks.filter((b) => SV.isQuestion(b.type)).length;
      const p = pill(i, loc(s, 'step').title || _t('Paso {n}', { n: i + 1 }), null, { cls: 'is-step', attrs: { 'data-index': i } });
      p.prepend(h('span', { class: 'ed-step-num' }, i + 1));
      if (translating()) {
        const n = pend.steps[s.id] || 0;
        p.append(n ? h('span', { class: 'ed-lang-badge', title: _t('{n} textos sin traducir', { n }) }, n) : h('i', { class: 'ti ti-check tr-ok' }));
      } else {
        p.append(h('span', { class: 'ed-step-count', title: _t('{n} preguntas', { n: count }) }, count));
      }
      p.onclick = () => go(i);
      list.append(p);
    });
    stepsNav.append(list);
    if (!translating()) stepsNav.append(h('button', { type: 'button', class: 'ed-step ed-step-add', title: _t('Añadir paso'), onclick: addStep }, h('i', { class: 'ti ti-plus' }), h('span', null, _t('Paso'))));
    const t = pill('thanks', _t('Final'), 'ti-confetti', { cls: pend && pend.thanks ? 'has-pending' : '' });
    t.onclick = () => go('thanks');
    stepsNav.append(t);

    if (window.Sortable) {
      Sortable.create(list, {
        animation: 150,
        disabled: translating(),
        draggable: '.is-step',
        onEnd(evt) {
          if (evt.oldIndex === evt.newIndex) return;
          const cur = currentStep();
          def.steps.splice(evt.newIndex, 0, def.steps.splice(evt.oldIndex, 1)[0]);
          if (cur) screen = def.steps.indexOf(cur);
          renderAll();
          queueSave();
        },
      });
    }
  }

  function go(s) {
    screen = s;
    selected = null;
    tab = 'props';
    renderAll();
    $('#ed-stage').scrollTop = 0;
  }

  /* =========================================================
     Lienzo
     ========================================================= */
  function renderCanvas() {
    SV.applyTheme(canvas, currentTheme());
    canvas.innerHTML = '';
    const shell = h('div', { class: 'sv-shell' });
    if (def.settings.showProgress !== false && typeof screen === 'number') {
      const pct = ((screen + 0.5) / def.steps.length) * 100;
      canvas.append(h('div', { class: 'sv-progress' }, h('div', { class: 'sv-progress-bar', style: { width: pct + '%' } })));
    }
    const head = h('header', { class: 'sv-header' }, def.settings.logo ? h('img', { class: 'sv-logo', src: SV.asset(def.settings.logo), alt: '' }) : null);
    shell.append(head);

    if (screen === 'welcome') shell.append(renderWelcome());
    else if (screen === 'thanks') shell.append(renderThanks());
    else shell.append(renderStepCanvas());
    canvas.append(shell);
  }

  function screenCard(cls, nodes, onclick) {
    const c = h('section', { class: 'sv-card ed-screen ' + cls }, nodes);
    c.addEventListener('click', onclick);
    return c;
  }

  function renderWelcome() {
    const w = loc(def.welcome, 'welcome');
    const card = screenCard('is-welcome', [
      w.enabled === false ? h('div', { class: 'ed-off-note' }, h('i', { class: 'ti ti-eye-off' }), ' ' + _t('Pantalla de bienvenida desactivada: la encuesta empezará directamente en el paso 1.')) : null,
      w.image ? h('img', { class: 'sv-hero', src: SV.asset(w.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, w.title || title),
      w.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(w.text) }) : null,
      h('div', { class: 'sv-actions center' }, h('span', { class: 'sv-btn sv-btn-primary sv-btn-lg' }, w.button || SV.t('start'), h('i', { class: 'ti ti-arrow-right' }))),
    ], () => { tab = 'props'; renderPanel(); });
    if (w.enabled === false) card.classList.add('is-disabled');
    return card;
  }

  function renderThanks() {
    const t = loc(def.thanks, 'thanks');
    return screenCard('is-thanks', [
      h('div', { class: 'sv-done-anim' }, h('svg', { viewBox: '0 0 52 52', html: '<circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-15"/>' })),
      t.image ? h('img', { class: 'sv-hero', src: SV.asset(t.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, t.title || SV.t('thanks')),
      t.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(t.text) }) : null,
      t.button && t.url ? h('div', { class: 'sv-actions center' }, h('span', { class: 'sv-btn sv-btn-primary' }, t.button)) : null,
    ], () => { tab = 'props'; renderPanel(); });
  }

  function renderStepCanvas() {
    const step = loc(currentStep(), 'step');
    const rawStep = currentStep();
    const nums = questionNumbers();
    const card = h('section', { class: 'sv-card is-step' });
    if (def.steps.length > 1) {
      card.append(h('div', { class: 'sv-step-head' },
        h('span', { class: 'sv-step-count' }, SV.t('stepOf', { n: screen + 1, total: def.steps.length })),
        step.title ? h('span', { class: 'sv-step-title' }, step.title) : null));
    }
    const list = h('div', { class: 'sv-blocks ed-blocks', 'data-empty': _t('Arrastra aquí componentes de la izquierda o haz clic en ellos') });
    rawStep.blocks.forEach((b) => list.append(blockWrapper(b, nums)));
    card.append(list);

    const last = screen === def.steps.length - 1;
    card.append(h('div', { class: 'sv-actions ed-fake-nav' },
      (screen > 0 || def.welcome.enabled !== false) && def.settings.allowBack !== false ? h('span', { class: 'sv-btn sv-btn-ghost' }, h('i', { class: 'ti ti-arrow-left' }), SV.t('back')) : h('span'),
      h('span', { class: 'sv-btn sv-btn-primary' }, SV.t(last ? 'submit' : 'next'), h('i', { class: 'ti ' + (last ? 'ti-send' : 'ti-arrow-right') }))));

    card.addEventListener('click', (e) => {
      if (e.target.closest('.ed-block')) return;
      if (selected) { selected = null; renderCanvasSelection(); renderPanel(); }
    });

    if (window.Sortable) {
      Sortable.create(list, {
        disabled: translating(),
        group: { name: 'blocks', pull: false, put: true },
        animation: 180,
        filter: '.ed-tools',
        preventOnFilter: false,
        ghostClass: 'ed-ghost',
        onAdd(evt) {
          const type = evt.item.dataset.type;
          evt.item.remove();
          if (SV.catalog[type]) addBlock(type, evt.newIndex);
        },
        onUpdate(evt) {
          rawStep.blocks.splice(evt.newIndex, 0, rawStep.blocks.splice(evt.oldIndex, 1)[0]);
          renderAll();
          queueSave();
        },
      });
    }
    return card;
  }

  function blockWrapper(b, nums) {
    const c = SV.catalog[b.type] || { label: b.type, icon: 'ti-square' };
    const el = SV.render(loc(b, 'block'), { mode: 'edit', number: def.settings.showNumbers !== false ? nums[b.id] : null });
    const missing = translating() ? (SV.trPending({ steps: [{ blocks: [b] }], settings: {}, thanks: {} }, editLang, langs().primary).count) : 0;
    const wrap = h('div', { class: 'ed-block' + (selected === b.id ? ' is-selected' : '') + (missing ? ' needs-tr' : ''), 'data-id': b.id },
      h('div', { class: 'ed-tag' }, h('i', { class: 'ti ' + c.icon }), c.label, b.required ? h('span', { class: 'ed-tag-req' }, _t('Obligatoria')) : null),
      missing ? h('div', { class: 'ed-tr-badge', title: _t('{n} textos sin traducir', { n: missing }) }, h('i', { class: 'ti ti-language' }), missing) : null,
      h('div', { class: 'ed-tools' },
        h('button', { type: 'button', title: _t('Subir'), onclick: (e) => { e.stopPropagation(); moveBlock(b.id, -1); } }, h('i', { class: 'ti ti-arrow-up' })),
        h('button', { type: 'button', title: _t('Bajar'), onclick: (e) => { e.stopPropagation(); moveBlock(b.id, 1); } }, h('i', { class: 'ti ti-arrow-down' })),
        h('button', { type: 'button', title: _t('Duplicar'), onclick: (e) => { e.stopPropagation(); duplicateBlock(b.id); } }, h('i', { class: 'ti ti-copy' })),
        h('button', { type: 'button', title: _t('Eliminar'), class: 'danger', onclick: (e) => { e.stopPropagation(); deleteBlock(b.id); } }, h('i', { class: 'ti ti-trash' }))),
      el);
    wrap.addEventListener('click', () => {
      if (selected === b.id && tab === 'props') return;
      selected = b.id;
      tab = 'props';
      renderCanvasSelection();
      renderPanel();
    });
    return wrap;
  }

  function renderCanvasSelection() {
    canvas.querySelectorAll('.ed-block').forEach((x) => x.classList.toggle('is-selected', x.dataset.id === selected));
  }

  function refreshBlock(id) {
    const f = findBlock(id);
    const old = canvas.querySelector(`.ed-block[data-id="${id}"]`);
    if (!f || !old) return renderCanvas();
    old.replaceWith(blockWrapper(f.block, questionNumbers()));
  }

  /* =========================================================
     Panel: constructores de campos
     ========================================================= */
  // after: 'block' (refresca el bloque seleccionado) | 'canvas' | 'all' | 'panel'
  function changed(after) {
    if (after === 'none') return queueSave();
    if (after === 'stepname') { renderSteps(); renderCanvas(); return queueSave(); }
    if (after === 'block' && selected) refreshBlock(selected);
    else if (after === 'all') renderAll();
    else if (after === 'panel') { renderCanvas(); renderPanel(); }
    else renderCanvas();
    queueSave();
  }

  function field(label, control, hint) {
    return h('div', { class: 'field' }, label ? h('span', null, label) : null, control, hint ? h('small', { class: 'hint' }, hint) : null);
  }

  function fText(obj, key, label, o = {}) {
    const tag = o.multiline ? 'textarea' : 'input';
    const i = h(tag, { type: o.type || 'text', placeholder: o.placeholder || '', rows: o.multiline ? o.rows || 3 : null, min: o.min, max: o.max, step: o.step });
    i.value = obj[key] == null ? '' : obj[key];
    i.addEventListener('input', () => {
      obj[key] = o.type === 'number' ? (i.value === '' ? '' : Number(i.value)) : i.value;
      changed(o.after || 'block');
    });
    return field(label, i, o.hint);
  }

  function fSelect(obj, key, label, choices, o = {}) {
    const s = h('select', null, choices.map(([v, l]) => h('option', { value: v }, l)));
    s.value = obj[key] == null ? '' : String(obj[key]);
    s.addEventListener('change', () => {
      obj[key] = o.num ? Number(s.value) : s.value;
      changed(o.after || 'block');
    });
    return field(label, h('div', { class: 'select-wrap' }, s), o.hint);
  }

  function fSeg(obj, key, label, choices, o = {}) {
    const wrap = h('div', { class: 'seg seg-block' });
    choices.forEach(([v, l, icon]) => {
      const b = h('button', { type: 'button', class: String(obj[key]) === String(v) ? 'active' : '', title: l }, icon ? h('i', { class: 'ti ' + icon }) : null, icon && o.iconOnly ? null : h('span', null, l));
      b.addEventListener('click', () => {
        obj[key] = v;
        wrap.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        changed(o.after || 'block');
      });
      wrap.append(b);
    });
    return field(label, wrap, o.hint);
  }

  function fToggle(obj, key, label, hint, o = {}) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = o.invert ? obj[key] === false : !!obj[key];
    cb.addEventListener('change', () => {
      obj[key] = o.invert ? !cb.checked : cb.checked;
      changed(o.after || 'block');
    });
    return h('label', { class: 'toggle-row' },
      h('span', { class: 'toggle-text' }, h('strong', null, label), hint ? h('small', null, hint) : null),
      h('span', { class: 'switch' }, cb, h('span', { class: 'slider' })));
  }

  function fImage(obj, key, label, o = {}) {
    const accept = o.video ? 'video/mp4,video/webm' : 'image/*';
    const preview = h('div', { class: 'img-field-preview' });
    const urlInput = h('input', { type: 'text', placeholder: o.video ? _t('https://youtube.com/… o sube un MP4') : _t('https://… o sube un archivo') });
    urlInput.value = obj[key] || '';
    function paint() {
      preview.innerHTML = '';
      const v = obj[key];
      if (!v) preview.append(h('i', { class: 'ti ' + (o.video ? 'ti-movie' : 'ti-photo') }));
      else if (o.video) preview.append(h('i', { class: 'ti ti-movie' }));
      else preview.append(h('img', { src: SV.asset(v), alt: '' }));
      rm.hidden = !v;
    }
    const up = h('button', { type: 'button', class: 'btn btn-soft btn-sm' }, h('i', { class: 'ti ti-upload' }), _t('Subir'));
    const rm = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: _t('Quitar') }, h('i', { class: 'ti ti-trash' }));
    up.addEventListener('click', async () => {
      const file = await App.pickFile(accept);
      if (!file) return;
      try {
        obj[key] = await App.upload(file);
        urlInput.value = obj[key];
        paint();
        changed(o.after || 'block');
      } catch (e) { /* toast mostrado */ }
    });
    rm.addEventListener('click', () => { obj[key] = ''; urlInput.value = ''; paint(); changed(o.after || 'block'); });
    urlInput.addEventListener('change', () => { obj[key] = urlInput.value.trim(); paint(); changed(o.after || 'block'); });
    paint();
    return field(label, h('div', { class: 'img-field' }, preview, h('div', { class: 'img-field-side' }, h('div', { class: 'img-field-btns' }, up, rm), urlInput)), o.hint);
  }

  /** Editor de listas de opciones (opciones, filas, columnas, logos) */
  const pL = (es, en) => (langs().primary === 'en' ? en : es);
  function fList(b, key, label, o = {}) {
    b[key] = b[key] || [];
    const list = h('div', { class: 'opt-list' });
    b[key].forEach((op, i) => {
      const inp = h('input', { type: 'text', placeholder: o.placeholder || _t('Opción {n}', { n: i + 1 }) });
      inp.value = op[o.labelKey || 'label'] || '';
      inp.addEventListener('input', () => { op[o.labelKey || 'label'] = inp.value; changed('block'); });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          b[key].splice(i + 1, 0, o.make ? o.make() : SV.opt(''));
          changed('panel');
          const inputs = panelBody.querySelectorAll(`.opt-list[data-key="${key}"] .opt-row input[type=text]`);
          if (inputs[i + 1]) inputs[i + 1].focus();
        }
      });
      let thumb = null;
      if (o.images) {
        thumb = h('button', { type: 'button', class: 'opt-thumb' + (op.image || op.src ? ' has-img' : ''), title: _t('Imagen / logo') },
          op[o.imageKey || 'image'] ? h('img', { src: SV.asset(op[o.imageKey || 'image']), alt: '' }) : h('i', { class: 'ti ti-photo-plus' }));
        thumb.addEventListener('click', async () => {
          const file = await App.pickFile('image/*');
          if (!file) return;
          try {
            op[o.imageKey || 'image'] = await App.upload(file);
            changed('panel');
          } catch (e) { /* toast */ }
        });
      }
      const extra = o.extra ? o.extra(op) : null;
      const del = h('button', { type: 'button', class: 'opt-del', title: _t('Eliminar') }, h('i', { class: 'ti ti-x' }));
      del.addEventListener('click', () => {
        if (!o.allowEmpty && b[key].length <= 1) return App.toast(_t('Debe haber al menos un elemento'), 'info');
        b[key].splice(i, 1);
        changed('panel');
      });
      list.append(h('div', { class: 'opt-row', 'data-index': i },
        h('span', { class: 'opt-handle', title: _t('Arrastrar') }, h('i', { class: 'ti ti-grip-vertical' })),
        thumb, h('div', { class: 'opt-main' }, inp, extra), del));
    });
    list.dataset.key = key;
    if (window.Sortable) {
      Sortable.create(list, {
        handle: '.opt-handle', animation: 150,
        onEnd(evt) {
          if (evt.oldIndex === evt.newIndex) return;
          b[key].splice(evt.newIndex, 0, b[key].splice(evt.oldIndex, 1)[0]);
          changed('panel');
        },
      });
    }
    const add = h('button', { type: 'button', class: 'btn btn-soft btn-sm' }, h('i', { class: 'ti ti-plus' }), o.addLabel || _t('Añadir opción'));
    add.addEventListener('click', () => {
      b[key].push(o.make ? o.make() : SV.opt((o.prefix || pL('Opción', 'Option')) + ' ' + (b[key].length + 1)));
      changed('panel');
      const inputs = panelBody.querySelectorAll(`.opt-list[data-key="${key}"] .opt-row input[type=text]`);
      if (inputs.length && !o.images) inputs[inputs.length - 1].select();
    });
    const actions = h('div', { class: 'opt-actions' }, add);
    if (!o.noBulk) {
      const bulk = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, h('i', { class: 'ti ti-list' }), _t('Pegar lista'));
      bulk.addEventListener('click', () => {
        const ta = h('textarea', { rows: 6, placeholder: _t('Una opción por línea') });
        ta.value = b[key].map((x) => x.label).join('\n');
        const ok = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, _t('Aplicar'));
        const box = h('div', { class: 'bulk-box' }, ta, h('div', { class: 'opt-actions' }, ok));
        ok.addEventListener('click', () => {
          const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
          if (!lines.length) return;
          const prev = b[key];
          b[key] = lines.map((l, i) => (prev[i] ? Object.assign(prev[i], { label: l }) : SV.opt(l)));
          changed('panel');
        });
        actions.replaceWith(box);
        ta.focus();
      });
      actions.append(bulk);
    }
    return h('div', { class: 'field' }, h('span', null, label), list, actions);
  }

  function section(title, ...children) {
    return h('div', { class: 'panel-section' }, title ? h('div', { class: 'panel-section-title' }, title) : null, children);
  }

  /* =========================================================
     Panel: contenido
     ========================================================= */
  function renderPanel() {
    $('#ed-panel-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    panelBody.innerHTML = '';
    if (tab === 'design') return panelDesign();
    if (tab === 'settings') return translating() ? panelSettingsTranslating() : panelSettings();
    if (translating()) return panelTranslate();
    if (screen === 'welcome') return panelWelcome();
    if (screen === 'thanks') return panelThanks();
    const f = selected && findBlock(selected);
    if (f) return panelBlock(f);
    return panelStep();
  }

  function panelHead(icon, label, actions) {
    return h('div', { class: 'panel-head' }, h('span', { class: 'panel-head-icon' }, h('i', { class: 'ti ' + icon })), h('strong', null, label), h('div', { class: 'panel-head-actions' }, actions));
  }

  function panelWelcome() {
    const w = def.welcome;
    if (w.enabled === undefined) w.enabled = true;
    panelBody.append(
      panelHead('ti-door-enter', _t('Pantalla de bienvenida')),
      section(null,
        fToggle(w, 'enabled', _t('Mostrar bienvenida'), _t('Si la desactivas, la encuesta empieza en el paso 1'), { invert: false, after: 'all' }),
        fText(w, 'title', _t('Título'), { placeholder: title, after: 'canvas' }),
        fText(w, 'text', _t('Texto'), { multiline: true, rows: 4, after: 'canvas', hint: _t('Admite **negrita**, *cursiva* y [enlaces](https://…)') }),
        fImage(w, 'image', _t('Imagen de cabecera'), { after: 'canvas' }),
        fText(w, 'button', _t('Texto del botón'), { placeholder: SV.P[langs().primary].start, after: 'canvas' })));
  }

  function panelThanks() {
    const t = def.thanks;
    panelBody.append(
      panelHead('ti-confetti', _t('Pantalla final')),
      section(null,
        fText(t, 'title', _t('Título'), { placeholder: SV.P[langs().primary].thanks, after: 'canvas' }),
        fText(t, 'text', _t('Mensaje'), { multiline: true, rows: 4, after: 'canvas' }),
        fImage(t, 'image', _t('Imagen'), { after: 'canvas' })),
      section(_t('Redirección (opcional)'),
        fText(t, 'url', _t('URL de destino'), { placeholder: 'https://tuweb.com', after: 'canvas', hint: _t('Si no indicas texto de botón, se redirigirá automáticamente a los 3 s.') }),
        fText(t, 'button', _t('Texto del botón'), { placeholder: _t('Visitar web'), after: 'canvas' })));
  }

  function panelStep() {
    const step = currentStep();
    const i = screen;
    const actions = [
      h('button', { type: 'button', class: 'icon-btn', title: _t('Mover a la izquierda'), disabled: i === 0, onclick: () => { def.steps.splice(i - 1, 0, def.steps.splice(i, 1)[0]); screen = i - 1; changed('all'); } }, h('i', { class: 'ti ti-arrow-left' })),
      h('button', { type: 'button', class: 'icon-btn', title: _t('Mover a la derecha'), disabled: i === def.steps.length - 1, onclick: () => { def.steps.splice(i + 1, 0, def.steps.splice(i, 1)[0]); screen = i + 1; changed('all'); } }, h('i', { class: 'ti ti-arrow-right' })),
      h('button', { type: 'button', class: 'icon-btn', title: _t('Duplicar paso'), onclick: () => {
        const c = clone(step);
        c.id = SV.uid('s');
        c.title = (c.title || '') + ' ' + _t('(copia)');
        c.blocks.forEach(reId);
        def.steps.splice(i + 1, 0, c);
        screen = i + 1;
        changed('all');
      } }, h('i', { class: 'ti ti-copy' })),
      h('button', { type: 'button', class: 'icon-btn danger', title: _t('Eliminar paso'), disabled: def.steps.length <= 1, onclick: async () => {
        if (step.blocks.length && !(await App.confirm({ title: _t('Eliminar paso'), text: _t('Se eliminará «{title}» y sus {n} elementos.', { title: step.title, n: step.blocks.length }), ok: _t('Eliminar'), danger: true }))) return;
        def.steps.splice(i, 1);
        screen = Math.max(0, i - 1);
        changed('all');
      } }, h('i', { class: 'ti ti-trash' })),
    ];
    const q = step.blocks.filter((b) => SV.isQuestion(b.type)).length;
    panelBody.append(
      panelHead('ti-stack-2', _t('Paso {n}', { n: i + 1 }), actions),
      section(null,
        fText(step, 'title', _t('Nombre del paso'), { after: 'stepname' }),
        h('div', { class: 'panel-stats' },
          h('div', null, h('strong', null, step.blocks.length), h('span', null, _t('elementos'))),
          h('div', null, h('strong', null, q), h('span', null, _t('preguntas'))))),
      section(_t('Consejo'), h('p', { class: 'muted small' }, _t('Selecciona un elemento del lienzo para editarlo, o añade componentes desde la columna izquierda. Arrastra para reordenar. Divide encuestas largas en varios pasos para mejorar la tasa de respuesta.'))));
  }

  const OPTION_TYPES = ['single_choice', 'multiple_choice', 'dropdown', 'image_choice', 'ranking'];

  function panelBlock(f) {
    const b = f.block;
    const c = SV.catalog[b.type];
    const isQ = SV.isQuestion(b.type);
    const actions = [
      h('button', { type: 'button', class: 'icon-btn', title: _t('Duplicar (Ctrl+D)'), onclick: () => duplicateBlock(b.id) }, h('i', { class: 'ti ti-copy' })),
      h('button', { type: 'button', class: 'icon-btn danger', title: _t('Eliminar (Supr)'), onclick: () => deleteBlock(b.id) }, h('i', { class: 'ti ti-trash' })),
    ];
    panelBody.append(panelHead(c.icon, c.label, actions));

    if (isQ) {
      panelBody.append(section(null,
        fText(b, 'title', _t('Pregunta'), { multiline: true, rows: 2 }),
        fText(b, 'description', _t('Descripción (opcional)'), { multiline: true, rows: 2, placeholder: _t('Texto de ayuda bajo la pregunta') }),
        fToggle(b, 'required', _t('Obligatoria'), _t('El participante no podrá avanzar sin responder'))));
    }

    const s = [];
    switch (b.type) {
      case 'heading':
        s.push(fText(b, 'text', _t('Texto'), { multiline: true, rows: 2 }),
          fSeg(b, 'size', _t('Tamaño'), [['h1', _t('Grande')], ['h2', _t('Medio')], ['h3', _t('Pequeño')]]),
          fSeg(b, 'align', _t('Alineación'), [['left', _t('Izquierda'), 'ti-align-left'], ['center', _t('Centro'), 'ti-align-center'], ['right', _t('Derecha'), 'ti-align-right']], { iconOnly: true }));
        break;
      case 'paragraph':
        s.push(fText(b, 'text', _t('Texto'), { multiline: true, rows: 7, hint: _t('Formato: **negrita**, *cursiva*, [texto](https://enlace)') }),
          fSeg(b, 'align', _t('Alineación'), [['left', _t('Izquierda'), 'ti-align-left'], ['center', _t('Centro'), 'ti-align-center'], ['right', _t('Derecha'), 'ti-align-right']], { iconOnly: true }));
        break;
      case 'image':
        if (b.rounded === undefined) b.rounded = true;
        s.push(fImage(b, 'src', _t('Imagen')), fText(b, 'alt', _t('Texto alternativo'), { placeholder: _t('Describe la imagen (accesibilidad)') }),
          fText(b, 'caption', _t('Pie de foto')),
          fSeg(b, 'width', _t('Ancho'), [['small', _t('Pequeño')], ['medium', _t('Medio')], ['full', _t('Completo')]]),
          fToggle(b, 'rounded', _t('Esquinas redondeadas'), null, { invert: false }));
        break;
      case 'video':
        s.push(fImage(b, 'url', _t('Vídeo'), { video: true, hint: _t('Enlace de YouTube o Vimeo, o sube un archivo MP4/WEBM.') }), fText(b, 'caption', _t('Descripción')));
        break;
      case 'logos':
        s.push(fText(b, 'title', _t('Título (opcional)'), { placeholder: _t('Con el apoyo de…') }),
          fSeg(b, 'size', _t('Tamaño'), [['sm', 'S'], ['md', 'M'], ['lg', 'L']]),
          fToggle(b, 'grayscale', _t('Escala de grises'), _t('Se colorean al pasar el ratón')),
          fList(b, 'items', _t('Logos'), {
            images: true, imageKey: 'src', labelKey: 'alt', placeholder: _t('Nombre de la marca'), addLabel: _t('Añadir logo'), allowEmpty: true, noBulk: true,
            make: () => ({ id: SV.uid('l'), src: '', alt: '', link: '' }),
            extra: (op) => {
              const l = h('input', { type: 'text', placeholder: _t('Enlace (opcional)'), class: 'opt-sub' });
              l.value = op.link || '';
              l.addEventListener('input', () => { op.link = l.value; changed('block'); });
              return l;
            },
          }));
        break;
      case 'divider':
        s.push(h('p', { class: 'muted small' }, _t('Línea separadora entre secciones.')));
        break;
      case 'spacer':
        s.push(fText(b, 'height', _t('Altura (px)'), { type: 'number', min: 4, max: 200 }));
        break;
      case 'short_text':
      case 'email':
        s.push(fText(b, 'placeholder', _t('Texto de ejemplo')));
        break;
      case 'long_text':
        s.push(fText(b, 'placeholder', _t('Texto de ejemplo')), fText(b, 'maxLength', _t('Máximo de caracteres'), { type: 'number', min: 0, hint: _t('0 = sin límite') }));
        break;
      case 'number':
        s.push(fText(b, 'placeholder', _t('Texto de ejemplo')),
          h('div', { class: 'field-row' }, fText(b, 'min', _t('Mínimo'), { type: 'number' }), fText(b, 'max', _t('Máximo'), { type: 'number' })));
        break;
      case 'single_choice':
      case 'multiple_choice':
        s.push(fList(b, 'options', _t('Opciones')),
          fToggle(b, 'allowOther', _t('Opción «Otro»'), _t('Añade un campo de texto libre'), { after: 'panel' }));
        if (b.allowOther) s.push(fText(b, 'otherLabel', _t('Texto de «Otro»'), { placeholder: SV.P[langs().primary].other }));
        s.push(fSeg(b, 'layout', _t('Disposición'), [['list', _t('Lista'), 'ti-list'], ['grid', _t('Cuadrícula'), 'ti-layout-grid']]));
        if (b.type === 'multiple_choice') {
          s.push(h('div', { class: 'field-row' },
            fText(b, 'minSelect', _t('Mín. selecciones'), { type: 'number', min: 0 }),
            fText(b, 'maxSelect', _t('Máx. selecciones'), { type: 'number', min: 0, hint: _t('0 = sin límite') })));
        }
        break;
      case 'dropdown':
        s.push(fList(b, 'options', _t('Opciones')), fText(b, 'placeholder', _t('Texto inicial'), { placeholder: SV.P[langs().primary].select }));
        break;
      case 'yes_no':
        s.push(h('div', { class: 'field-row' }, fText(b, 'yesLabel', _t('Texto «Sí»')), fText(b, 'noLabel', _t('Texto «No»'))));
        break;
      case 'image_choice':
        if (b.showLabels === undefined) b.showLabels = true;
        s.push(fList(b, 'options', _t('Opciones con imagen / logo'), { images: true, hint: '' }),
          fToggle(b, 'multiple', _t('Selección múltiple'), _t('Permite elegir varias imágenes'), { after: 'panel' }));
        if (b.multiple) {
          s.push(h('div', { class: 'field-row' },
            fText(b, 'minSelect', _t('Mín.'), { type: 'number', min: 0 }),
            fText(b, 'maxSelect', _t('Máx.'), { type: 'number', min: 0, hint: _t('0 = sin límite') })));
        }
        s.push(fSeg(b, 'columns', _t('Columnas'), [[2, '2'], [3, '3'], [4, '4']]),
          fSeg(b, 'fit', _t('Ajuste de imagen'), [['contain', _t('Logo (completo)')], ['cover', _t('Foto (recortar)')]]),
          fToggle(b, 'showLabels', _t('Mostrar etiquetas'), null, { invert: false }));
        break;
      case 'rating':
        s.push(fSeg(b, 'icon', _t('Icono'), [['star', _t('Estrellas'), 'ti-star'], ['heart', _t('Corazones'), 'ti-heart'], ['emoji', _t('Caras'), 'ti-mood-smile']], { after: 'panel' }));
        if (b.icon !== 'emoji') s.push(fSelect(b, 'max', _t('Máximo'), [3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, _t(b.icon === 'heart' ? '{n} corazones' : '{n} estrellas', { n })]), { num: true }));
        break;
      case 'scale':
        s.push(h('div', { class: 'field-row' },
          fSelect(b, 'min', _t('Desde'), [[0, '0'], [1, '1']], { num: true }),
          fSelect(b, 'max', _t('Hasta'), [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, String(n)]), { num: true })),
          h('div', { class: 'field-row' }, fText(b, 'minLabel', _t('Etiqueta mínima')), fText(b, 'maxLabel', _t('Etiqueta máxima'))));
        break;
      case 'nps':
        s.push(h('div', { class: 'field-row' }, fText(b, 'minLabel', _t('Etiqueta 0')), fText(b, 'maxLabel', _t('Etiqueta 10'))),
          h('p', { class: 'muted small' }, _t('El Net Promoter Score se calcula automáticamente en los resultados: % promotores (9-10) − % detractores (0-6).')));
        break;
      case 'slider':
        s.push(h('div', { class: 'field-row' }, fText(b, 'min', _t('Mínimo'), { type: 'number' }), fText(b, 'max', _t('Máximo'), { type: 'number' })),
          h('div', { class: 'field-row' }, fText(b, 'step', _t('Incremento'), { type: 'number', min: 0 }), fText(b, 'unit', _t('Unidad'), { placeholder: _t('€, %, km…') })));
        break;
      case 'ranking':
        s.push(fList(b, 'options', _t('Elementos a ordenar')));
        break;
      case 'matrix':
        s.push(fList(b, 'rows', _t('Filas (aspectos)'), { prefix: pL('Aspecto', 'Aspect'), addLabel: _t('Añadir fila') }),
          fList(b, 'columns', _t('Columnas (respuestas)'), { prefix: pL('Valor', 'Value'), addLabel: _t('Añadir columna') }));
        break;
    }
    if (s.length) panelBody.append(section(isQ ? _t('Configuración') : null, s));

    // Conversión entre tipos con opciones
    if (OPTION_TYPES.includes(b.type)) {
      const conv = h('select', null, OPTION_TYPES.map((t) => h('option', { value: t }, SV.catalog[t].label)));
      conv.value = b.type;
      conv.addEventListener('change', () => {
        const base = SV.newBlock(conv.value, langs().primary);
        delete base.id;
        const keep = { id: b.id, title: b.title, description: b.description, required: b.required, options: b.options };
        Object.keys(b).forEach((k) => delete b[k]);
        Object.assign(b, base, keep, { type: conv.value });
        changed('panel');
      });
      panelBody.append(section(_t('Convertir'), field(_t('Tipo de pregunta'), h('div', { class: 'select-wrap' }, conv))));
    }

    // Mover a otro paso
    if (def.steps.length > 1) {
      const mv = h('select', null, def.steps.map((st, i) => h('option', { value: i }, `${i + 1}. ${loc(st, 'step').title || _t('Paso')}`)));
      mv.value = String(f.si);
      mv.addEventListener('change', () => {
        const to = +mv.value;
        f.step.blocks.splice(f.bi, 1);
        def.steps[to].blocks.push(b);
        screen = to;
        changed('all');
        App.toast(_t('Movido al paso {n}', { n: to + 1 }));
      });
      panelBody.append(section(_t('Ubicación'), field(_t('Mover al paso'), h('div', { class: 'select-wrap' }, mv))));
    }
  }

  function panelDesign() {
    const st = def.settings;
    if (themeDraft) return panelThemeEditor();

    const cur = E.themes.find((x) => x.key === st.theme) || E.themes[0];
    const gallery = h('div', { class: 'theme-gallery' }, E.themes.map((t) => {
      const b = h('button', { type: 'button', class: 'theme-pick' + (cur && t.key === cur.key ? ' active' : ''), title: t.name },
        SV.themeThumb(t.config),
        h('span', { class: 'theme-pick-name' }, t.custom ? h('i', { class: 'ti ti-user-edit', title: _t('Tema personalizado') }) : null, t.name));
      b.addEventListener('click', () => { st.theme = t.key; changed('panel'); });
      return b;
    }));
    const actions = h('div', { class: 'opt-actions' },
      h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => {
        themeDraft = { id: null, config: Object.assign({}, cur.config, { name: cur.name + ' (personalizado)' }) };
        renderPanel();
      } }, h('i', { class: 'ti ti-adjustments-horizontal' }), _t('Personalizar colores')),
      cur && cur.custom ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
        themeDraft = { id: cur.id, config: Object.assign({}, cur.config) };
        renderPanel();
      } }, h('i', { class: 'ti ti-pencil' }), _t('Editar «{name}»', { name: cur.name })) : null,
      h('a', { class: 'btn btn-ghost btn-sm', href: 'themes.php', target: '_blank' }, h('i', { class: 'ti ti-palette' }), _t('Gestionar temas')));

    panelBody.append(
      panelHead('ti-palette', _t('Diseño de la encuesta')),
      section(_t('Tema'), gallery, actions),
      section(_t('Marca'), fImage(st, 'logo', _t('Logo de cabecera'), { after: 'canvas', hint: _t('Se muestra arriba en todas las pantallas.') })),
      section(_t('Elementos'),
        fToggle(st, 'showProgress', _t('Barra de progreso'), null, { after: 'canvas' }),
        fToggle(st, 'showNumbers', _t('Numerar preguntas'), null, { after: 'canvas' })));
  }

  function panelThemeEditor() {
    const d = themeDraft;
    const editingExisting = !!d.id;
    const saveTheme = async (asNew) => {
      try {
        if (!asNew && editingExisting) {
          const ok = await App.confirm({ title: _t('Actualizar tema'), text: _t('Los cambios se aplicarán a todas las encuestas que usan «{name}».', { name: d.config.name }), ok: _t('Guardar cambios') });
          if (!ok) return;
        }
        const r = await App.api('theme_save', { id: asNew ? 0 : d.id, config: d.config });
        const i = E.themes.findIndex((x) => x.key === r.theme.key);
        if (i >= 0) E.themes[i] = r.theme; else E.themes.push(r.theme);
        def.settings.theme = r.theme.key;
        themeDraft = null;
        changed('panel');
        App.toast(asNew ? _t('Tema «{name}» creado y aplicado', { name: r.theme.name }) : _t('Tema actualizado'));
      } catch (e) { App.toast(e.message, 'error'); }
    };
    panelBody.append(
      panelHead('ti-brush', editingExisting ? _t('Editar tema') : _t('Nuevo tema'), [
        h('button', { type: 'button', class: 'icon-btn', title: _t('Cancelar'), onclick: () => { themeDraft = null; renderCanvas(); renderPanel(); } }, h('i', { class: 'ti ti-x' })),
      ]),
      SV.themeForm(d.config, () => renderCanvas()),
      h('div', { class: 'theme-actions' },
        editingExisting ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => saveTheme(false) }, h('i', { class: 'ti ti-device-floppy' }), _t('Guardar cambios')) : null,
        h('button', { type: 'button', class: editingExisting ? 'btn btn-soft' : 'btn btn-primary', onclick: () => saveTheme(true) }, h('i', { class: 'ti ti-plus' }), editingExisting ? _t('Guardar como copia') : _t('Guardar tema y aplicar')),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { themeDraft = null; renderCanvas(); renderPanel(); } }, _t('Cancelar'))));
  }

  function panelSettings() {
    const st = def.settings;
    // Programación: fecha y hora en campos separados (se guardan como 'AAAA-MM-DDTHH:MM', hora de Madrid)
    const fmtWhen = (v) => {
      const d = new Date(v);
      if (isNaN(d)) return '';
      return _t('{date} a las {time}', { date: d.toLocaleDateString(SV.adminLang === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), time: v.slice(11, 16) });
    };
    const summary = h('div', { class: 'schedule-summary' });
    function paintSummary() {
      const a = st.startAt, b = st.endAt;
      let icon = 'ti-calendar-time', text = _t('Sin programar: la encuesta acepta respuestas mientras esté publicada.'), cls = '';
      if (a && b && b <= a) { icon = 'ti-alert-triangle'; cls = 'is-error'; text = _t('La hora de cierre debe ser posterior a la de apertura.'); }
      else if (a && b) text = _t('Abre el {a} y cierra el {b}.', { a: fmtWhen(a), b: fmtWhen(b) });
      else if (a) text = _t('Abre el {a} y no tiene cierre.', { a: fmtWhen(a) });
      else if (b) text = _t('Acepta respuestas hasta el {b}.', { b: fmtWhen(b) });
      summary.className = 'schedule-summary ' + cls;
      summary.replaceChildren(h('i', { class: 'ti ' + icon }), h('span', null, text));
    }
    const when = (key, label, defTime) => {
      const date = h('input', { type: 'date', 'aria-label': label + ' (' + _t('fecha') + ')' });
      const time = h('input', { type: 'time', step: 60, 'aria-label': label + ' (' + _t('hora') + ')' });
      const clear = h('button', { type: 'button', class: 'icon-btn', title: _t('Quitar') }, h('i', { class: 'ti ti-x' }));
      const v = st[key] || '';
      date.value = v.slice(0, 10);
      time.value = v.slice(11, 16);
      const sync = () => {
        if (!date.value) { st[key] = ''; time.value = ''; }
        else {
          if (!time.value) time.value = defTime;
          st[key] = date.value + 'T' + time.value;
        }
        clear.hidden = !st[key];
        paintSummary();
        queueSave();
      };
      date.addEventListener('change', sync);
      time.addEventListener('change', sync);
      clear.addEventListener('click', () => { date.value = ''; sync(); });
      clear.hidden = !v;
      return h('div', { class: 'field' }, h('span', null, label), h('div', { class: 'datetime-row' }, date, time, clear));
    };
    const quick = h('div', { class: 'opt-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        st.startAt = st.startAt || today + 'T' + pad(Math.min(23, now.getHours() + 1)) + ':00';
        st.endAt = st.endAt || st.startAt.slice(0, 11) + '23:59';
        queueSave();
        renderPanel();
      } }, h('i', { class: 'ti ti-clock-plus' }), _t('Programar para hoy')));
    paintSummary();
    const link = h('input', { type: 'text', readonly: true });
    link.value = E.publicUrl;
    panelBody.append(
      panelHead('ti-settings', _t('Ajustes')),
      langSettings(),
      section(_t('Enlace público'), h('div', { class: 'input-group' }, link, h('button', { type: 'button', class: 'btn btn-soft', onclick: () => App.copy(E.publicUrl) }, h('i', { class: 'ti ti-copy' })))),
      section(_t('Control de participación'),
        fToggle(st, 'onePerBrowser', _t('Una respuesta por navegador'), _t('Usa una cookie para impedir que se responda dos veces desde el mismo navegador'), { after: 'none' }),
        fToggle(st, 'limitByIp', _t('Una respuesta por IP'), _t('Más estricto: bloquea también otras ventanas o navegadores desde la misma red. Ojo con redes compartidas (empresas, wifi pública).'), { after: 'none' }),
        fText(st, 'doneMessage', _t('Mensaje si ya ha participado'), { multiline: true, rows: 2, after: 'none', placeholder: _t('Vacío = mensaje estándar en el idioma del participante') })),
      section(_t('Navegación'),
        fToggle(st, 'allowBack', _t('Permitir volver atrás'), null, { after: 'canvas' })),
      section(_t('Disponibilidad (fecha y hora)'),
        when('startAt', _t('Apertura'), '00:00'),
        when('endAt', _t('Cierre'), '23:59'),
        summary,
        !st.startAt && !st.endAt ? quick : null,
        h('small', { class: 'hint' }, _t('Hora de Madrid. La encuesta debe estar en estado «Publicada»; fuera del horario se muestra el mensaje de abajo.'))),
      section(null,
        fText(st, 'maxResponses', _t('Límite de respuestas'), { type: 'number', min: 0, hint: _t('0 = sin límite'), after: 'none' }),
        fText(st, 'closedMessage', _t('Mensaje cuando está cerrada'), { multiline: true, rows: 2, after: 'none', placeholder: _t('Vacío = mensaje estándar en el idioma del participante') })),
      section(_t('Compartir en redes'), fText(st, 'description', _t('Descripción para buscadores y redes'), { multiline: true, rows: 2, after: 'none' })));
  }

  /* =========================================================
     Languages & translation mode
     ========================================================= */
  const langs = () => SV.surveyLangs(def);
  const translating = () => editLang !== langs().primary;
  const loc = (obj, kind) => SV.localize(obj, kind, editLang, langs().primary);
  const filledStr = (v) => typeof v === 'string' && v.trim() !== '';

  function syncEditLang() {
    const L = langs();
    if (!L.langs.includes(editLang)) editLang = L.primary;
    SV.lang = editLang;
    document.body.classList.toggle('is-translating', translating());
    const banner = $('#ed-tr-banner');
    banner.hidden = !translating();
    if (translating()) {
      banner.replaceChildren(h('i', { class: 'ti ti-language' }),
        h('span', null, _t('Modo traducción · {lang}. La estructura está bloqueada: solo se editan los textos.', { lang: SV.LANGS[editLang].name })),
        h('button', { type: 'button', class: 'btn btn-sm btn-soft', onclick: () => setEditLang(L.primary) }, _t('Volver a {lang}', { lang: SV.LANGS[L.primary].short })));
    }
    renderLangSwitch();
  }

  function renderLangSwitch() {
    const box = $('#ed-langs');
    const L = langs();
    box.hidden = !L.bilingual;
    box.innerHTML = '';
    if (!L.bilingual) return;
    const pending = L.secondary ? SV.trPending(def, L.secondary, L.primary).count : 0;
    L.langs.forEach((l) => {
      const b = h('button', { type: 'button', class: l === editLang ? 'active' : '', title: l === L.primary ? _t('Idioma principal') : _t('Traducción') },
        h('span', null, SV.LANGS[l].short),
        l !== L.primary && pending ? h('span', { class: 'ed-lang-badge', title: _t('{n} textos sin traducir', { n: pending }) }, pending) : null,
        l !== L.primary && !pending ? h('i', { class: 'ti ti-check ed-lang-ok', title: _t('Traducción completa') }) : null);
      b.addEventListener('click', () => setEditLang(l));
      box.append(b);
    });
  }

  function setEditLang(l) {
    if (l === editLang) return;
    editLang = l;
    themeDraft = null;
    tab = 'props';
    syncEditLang();
    renderAll();
    if (translating()) App.toast(_t('Modo traducción: {lang}. La estructura queda bloqueada; edita solo los textos.', { lang: SV.LANGS[l].name }), 'info', 4500);
  }

  /** Text field bound to obj.tr[editLang][key], showing the original text above it */
  function fTr(obj, key, label, o = {}) {
    const L = langs();
    const source = obj[key];
    const tag = o.multiline ? 'textarea' : 'input';
    const i = h(tag, { type: 'text', rows: o.multiline ? o.rows || 3 : null, placeholder: source || '' });
    i.value = (obj.tr && obj.tr[editLang] && obj.tr[editLang][key]) || '';
    const mark = h('span', { class: 'tr-state' });
    const paintState = () => {
      const ok = filledStr(i.value);
      mark.className = 'tr-state ' + (ok ? 'is-ok' : 'is-missing');
      mark.innerHTML = ok ? '<i class="ti ti-check"></i>' : '<i class="ti ti-point-filled"></i>';
    };
    i.addEventListener('input', () => {
      obj.tr = obj.tr || {};
      obj.tr[editLang] = obj.tr[editLang] || {};
      if (filledStr(i.value)) obj.tr[editLang][key] = i.value;
      else delete obj.tr[editLang][key];
      paintState();
      changed(o.after || 'block');
      renderLangSwitch();
    });
    paintState();
    const copy = h('button', { type: 'button', class: 'tr-copy', title: _t('Copiar el original') }, h('i', { class: 'ti ti-copy' }));
    copy.addEventListener('click', () => { i.value = source || ''; i.dispatchEvent(new Event('input')); i.focus(); });
    return h('div', { class: 'field tr-field' },
      h('span', null, mark, label),
      h('div', { class: 'tr-source', lang: L.primary }, h('small', null, SV.LANGS[L.primary].short), h('span', null, source || '—'), filledStr(source) ? copy : null),
      i);
  }

  /** Translation of a list (options, rows, columns, logos) */
  function fTrList(b, key, label) {
    const field = SV.trLists[key][0];
    const items = (Array.isArray(b[key]) ? b[key] : []).filter((it) => filledStr(it[field]));
    if (!items.length) return null;
    return h('div', { class: 'panel-section' }, h('div', { class: 'panel-section-title' }, label),
      items.map((it, n) => fTr(it, field, '#' + (n + 1))));
  }

  const LIST_LABELS = () => ({ options: _t('Opciones'), rows: _t('Filas'), columns: _t('Columnas'), items: _t('Logos') });
  const FIELD_LABELS = () => ({
    title: _t('Título'), description: _t('Descripción'), text: _t('Texto'), alt: _t('Texto alternativo'), caption: _t('Pie de foto'),
    placeholder: _t('Texto de ejemplo'), otherLabel: _t('Texto de «Otro»'), yesLabel: _t('Texto «Sí»'), noLabel: _t('Texto «No»'),
    minLabel: _t('Etiqueta mínima'), maxLabel: _t('Etiqueta máxima'), unit: _t('Unidad'), button: _t('Texto del botón'),
    closedMessage: _t('Mensaje cuando está cerrada'), doneMessage: _t('Mensaje si ya ha participado'), description_seo: _t('Descripción para buscadores y redes'),
  });

  function trFieldsOf(obj, kind) {
    const F = FIELD_LABELS();
    const primary = langs().primary;
    return SV.fieldsFor(kind, obj).filter((f) => filledStr(obj[f]) && !SV.isAutoField(kind, f, obj, primary)).map((f) => {
      const multi = ['text', 'description', 'closedMessage', 'doneMessage'].includes(f);
      const label = kind === 'settings' && f === 'description' ? F.description_seo : F[f] || f;
      const after = kind === 'step' ? 'stepname' : kind === 'settings' ? 'none' : kind === 'block' ? 'block' : 'canvas';
      return fTr(obj, f, label, { multiline: multi, rows: f === 'text' ? 4 : 2, after });
    });
  }

  /** Location of the next text that still needs a translation */
  function nextPending() {
    const L = langs();
    const P = SV.trPending(def, editLang, L.primary);
    if (!P.count) return null;
    if (P.welcome) return { screen: 'welcome' };
    for (let i = 0; i < def.steps.length; i++) {
      const s = def.steps[i];
      const own = SV.trPending({ steps: [Object.assign({}, s, { blocks: [] })], settings: {}, thanks: {} }, editLang, L.primary).count;
      if (own) return { screen: i, block: null };
      const b = s.blocks.find((x) => P.blocks[x.id]);
      if (b) return { screen: i, block: b.id };
    }
    if (P.thanks) return { screen: 'thanks' };
    if (P.settings) return { screen: 0, block: null };
    return null;
  }

  function goNextPending() {
    const n = nextPending();
    if (!n) return App.toast(_t('¡Traducción completa!'));
    screen = n.screen;
    selected = n.block || null;
    tab = 'props';
    renderAll();
    requestAnimationFrame(() => {
      const el = selected && canvas.querySelector(`.ed-block[data-id="${selected}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = [...panelBody.querySelectorAll('.tr-field')].find((f) => f.querySelector('.is-missing'));
      if (first) first.querySelector('input, textarea').focus();
    });
  }

  function trProgress() {
    const L = langs();
    const n = SV.trPending(def, editLang, L.primary).count;
    return h('div', { class: 'tr-progress' + (n ? '' : ' is-done') },
      h('i', { class: 'ti ' + (n ? 'ti-language' : 'ti-circle-check') }),
      h('span', null, n ? _t('{n} textos sin traducir al {lang}', { n, lang: SV.LANGS[editLang].name }) : _t('Traducción completa')),
      n ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: goNextPending }, _t('Siguiente pendiente'), h('i', { class: 'ti ti-arrow-right' })) : null);
  }

  function panelTranslate() {
    const L = langs();
    const head = (icon, label) => panelHead(icon, label, [h('span', { class: 'tr-chip' }, SV.LANGS[L.primary].short + ' → ' + SV.LANGS[editLang].short)]);
    panelBody.append(trProgress());
    if (screen === 'welcome') {
      panelBody.append(head('ti-door-enter', _t('Pantalla de bienvenida')), section(null, trFieldsOf(def.welcome, 'welcome')));
      return;
    }
    if (screen === 'thanks') {
      panelBody.append(head('ti-confetti', _t('Pantalla final')), section(null, trFieldsOf(def.thanks, 'thanks')));
      return;
    }
    const f = selected && findBlock(selected);
    if (f) {
      const b = f.block;
      const c = SV.catalog[b.type];
      const own = trFieldsOf(b, 'block');
      const lists = Object.keys(SV.trLists).map((k) => fTrList(b, k, LIST_LABELS()[k])).filter(Boolean);
      panelBody.append(head(c.icon, c.label));
      if (!own.length && !lists.length) panelBody.append(h('p', { class: 'muted small' }, _t('Este elemento no tiene textos que traducir.')));
      if (own.length) panelBody.append(section(null, own));
      lists.forEach((l) => panelBody.append(l));
      return;
    }
    const step = currentStep();
    const P = SV.trPending(def, editLang, L.primary);
    panelBody.append(
      head('ti-stack-2', _t('Paso {n}', { n: screen + 1 })),
      section(null, trFieldsOf(step, 'step')),
      section(_t('Elementos de este paso'),
        step.blocks.length ? h('div', { class: 'tr-list' }, step.blocks.map((b) => {
          const c = SV.catalog[b.type];
          const n = P.blocks[b.id] || 0;
          const label = (loc(b, 'block').title || loc(b, 'block').text || c.label);
          return h('button', { type: 'button', class: 'tr-item', onclick: () => { selected = b.id; renderCanvasSelection(); renderPanel(); } },
            h('i', { class: 'ti ' + c.icon }), h('span', null, String(label).slice(0, 60)),
            n ? h('span', { class: 'ed-lang-badge' }, n) : h('i', { class: 'ti ti-check tr-ok' }));
        })) : h('p', { class: 'muted small' }, _t('Este paso no tiene elementos.'))),
      section(_t('Textos generales de la encuesta'), trFieldsOf(def.settings, 'settings')));
  }

  /** Languages section of the Settings tab */
  function langSettings() {
    const L = langs();
    const st = def.settings;
    const other = L.primary === 'es' ? 'en' : 'es';
    const prim = h('select', null, Object.keys(SV.LANGS).map((l) => h('option', { value: l }, SV.LANGS[l].name)));
    prim.value = L.primary;
    prim.addEventListener('change', async () => {
      const to = prim.value;
      if (L.bilingual) {
        const ok = await App.confirm({
          title: _t('Cambiar idioma principal'),
          text: _t('Los textos en {to} pasarán a ser los principales y los de {from} quedarán como traducción. Lo que no esté traducido se quedará en {from}.', { to: SV.LANGS[to].name, from: SV.LANGS[L.primary].name }),
          ok: _t('Cambiar'),
        });
        if (!ok) { prim.value = L.primary; return; }
        SV.swapPrimary(def, L.primary, to);
      } else {
        st.lang = to;
        st.languages = [to];
      }
      editLang = to;
      syncEditLang();
      changed('all');
    });
    const bi = h('input', { type: 'checkbox' });
    bi.checked = L.bilingual;
    bi.addEventListener('change', async () => {
      if (bi.checked) {
        st.languages = [L.primary, other];
        syncEditLang();
        changed('all');
        App.toast(_t('Encuesta bilingüe activada. Pulsa {lang} arriba para traducir.', { lang: SV.LANGS[other].short }), 'success', 5000);
      } else {
        const ok = await App.confirm({ title: _t('Desactivar bilingüe'), text: _t('La encuesta se mostrará solo en {lang}. Las traducciones se conservan por si vuelves a activarlo.', { lang: SV.LANGS[L.primary].name }), ok: _t('Desactivar') });
        if (!ok) { bi.checked = true; return; }
        st.languages = [L.primary];
        editLang = L.primary;
        syncEditLang();
        changed('all');
      }
    });
    const pending = L.bilingual ? SV.trPending(def, L.secondary, L.primary).count : 0;
    return section(_t('Idiomas'),
      field(_t('Idioma principal'), h('div', { class: 'select-wrap' }, prim), _t('Idioma en el que escribes el contenido.')),
      h('label', { class: 'toggle-row' },
        h('span', { class: 'toggle-text' }, h('strong', null, _t('Encuesta bilingüe ({langs})', { langs: SV.LANGS[L.primary].short + ' + ' + SV.LANGS[other].short })),
          h('small', null, _t('Cada participante ve la encuesta en su idioma (detectado automáticamente) y puede cambiarlo. Los resultados se suman en un único informe.'))),
        h('span', { class: 'switch' }, bi, h('span', { class: 'slider' }))),
      L.bilingual ? h('div', { class: 'tr-progress' + (pending ? '' : ' is-done') },
        h('i', { class: 'ti ' + (pending ? 'ti-language' : 'ti-circle-check') }),
        h('span', null, pending ? _t('{n} textos sin traducir al {lang}', { n: pending, lang: SV.LANGS[L.secondary].name }) : _t('Traducción completa')),
        pending ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => { setEditLang(L.secondary); goNextPending(); } }, _t('Traducir')) : null) : null);
  }

  function panelSettingsTranslating() {
    const L = langs();
    panelBody.append(panelHead('ti-settings', _t('Ajustes')), langSettings(),
      h('p', { class: 'muted small pad-x' }, _t('Los ajustes son comunes a todos los idiomas. Para cambiarlos vuelve a {lang}; los textos generales se traducen en la pestaña Propiedades.', { lang: SV.LANGS[L.primary].name })));
  }

  /* =========================================================
     Render general + eventos
     ========================================================= */
  function renderAll() {
    renderSteps();
    renderCanvas();
    renderPanel();
  }

  $('#ed-panel-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    if (themeDraft && tab !== 'design') { themeDraft = null; renderCanvas(); }
    renderPanel();
  });

  $('#ed-title').addEventListener('input', (e) => {
    title = e.target.value;
    document.title = 'Editor · ' + title;
    if (screen === 'welcome' && !def.welcome.title) renderCanvas();
    queueSave();
  });

  $('#ed-device').addEventListener('click', (e) => {
    const b = e.target.closest('[data-device]');
    if (!b) return;
    frame.classList.toggle('is-mobile', b.dataset.device === 'mobile');
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  $('#ed-undo').addEventListener('click', () => restore(hIndex - 1));
  $('#ed-redo').addEventListener('click', () => restore(hIndex + 1));

  $('#ed-preview').addEventListener('click', async () => {
    const w = window.open('about:blank', '_blank');
    await save();
    const url = E.previewUrl + (translating() ? '&lang=' + editLang : '');
    if (w) w.location.href = url;
    else location.href = url;
  });

  $('#ed-share').addEventListener('click', () => App.share(E.publicUrl, status, E.id, title, langs().langs.join(',')));

  const statusSel = $('#ed-status');
  statusSel.value = status;
  statusSel.dataset.status = status;
  statusSel.addEventListener('change', async () => {
    const next = statusSel.value;
    const qCount = def.steps.reduce((n, s) => n + s.blocks.filter((b) => SV.isQuestion(b.type)).length, 0);
    if (next === 'published' && !qCount) {
      statusSel.value = status;
      return App.toast(_t('Añade al menos una pregunta antes de publicar'), 'error');
    }
    try {
      await save();
      await App.api('status', { id: E.id, status: next });
      status = next;
      statusSel.dataset.status = next;
      App.toast({ draft: _t('Encuesta en borrador'), published: _t('¡Encuesta publicada! Ya puedes compartirla'), closed: _t('Encuesta cerrada') }[next]);
      if (next === 'published') App.share(E.publicUrl, status, E.id, title, langs().langs.join(','));
    } catch (e) {
      statusSel.value = status;
      App.toast(e.message, 'error');
    }
  });

  /* móvil: cajones */
  function closeDrawers() { document.body.classList.remove('show-palette', 'show-panel'); }
  document.querySelector('.ed-mobilebar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mobile]');
    if (!b) return;
    const cls = 'show-' + b.dataset.mobile;
    const on = !document.body.classList.contains(cls);
    closeDrawers();
    if (on) document.body.classList.add(cls);
  });
  $('#ed-scrim').addEventListener('click', closeDrawers);

  /* atajos de teclado */
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (inField) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? restore(hIndex + 1) : restore(hIndex - 1); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); restore(hIndex + 1); return; }
    if (mod && e.key.toLowerCase() === 'd' && selected) { e.preventDefault(); duplicateBlock(selected); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteBlock(selected); return; }
    if (e.key === 'Escape' && selected) { selected = null; renderCanvasSelection(); renderPanel(); }
  });

  /* boot */
  syncEditLang();
  renderPalette();
  renderAll();
  snapshot();
})();
