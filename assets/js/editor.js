/* Editor visual de encuestas */
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
  let themeDraft = null; // { id: number|null, config: {...} } mientras se edita un tema
  E.themes = E.themes || [];

  function currentTheme() {
    if (themeDraft) return themeDraft.config;
    const t = E.themes.find((x) => x.key === def.settings.theme) || E.themes[0];
    return t ? t.config : SV.themeDefaults;
  }

  def.settings = def.settings || {};
  def.welcome = def.welcome || { enabled: true };
  def.thanks = def.thanks || {};
  def.steps = def.steps && def.steps.length ? def.steps : [{ id: SV.uid('s'), title: 'Paso 1', blocks: [] }];

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
    renderAll();
    updateUndo();
    queueSave(false);
  }

  function setSaveState(state, msg) {
    const map = {
      saved: ['ti-cloud-check', 'Guardado'],
      pending: ['ti-cloud', 'Cambios sin guardar'],
      saving: ['ti-loader-2 spin', 'Guardando…'],
      error: ['ti-cloud-x', msg || 'Error al guardar'],
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
    if (typeof screen !== 'number') screen = 0;
    const step = currentStep();
    const b = SV.newBlock(type);
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
    const f = findBlock(id);
    if (!f) return;
    const copy = reId(clone(f.block));
    f.step.blocks.splice(f.bi + 1, 0, copy);
    selected = copy.id;
    renderAll();
    queueSave();
  }

  function deleteBlock(id) {
    const f = findBlock(id);
    if (!f) return;
    f.step.blocks.splice(f.bi, 1);
    if (selected === id) selected = null;
    renderAll();
    queueSave();
    App.toast('Elemento eliminado · Ctrl+Z para deshacer', 'info');
  }

  function moveBlock(id, dir) {
    const f = findBlock(id);
    if (!f) return;
    const to = f.bi + dir;
    if (to < 0 || to >= f.step.blocks.length) return;
    f.step.blocks.splice(to, 0, f.step.blocks.splice(f.bi, 1)[0]);
    renderAll();
    queueSave();
  }

  function addStep() {
    def.steps.push({ id: SV.uid('s'), title: 'Paso ' + (def.steps.length + 1), blocks: [] });
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
    const groups = [['question', 'Preguntas'], ['content', 'Contenido']];
    groups.forEach(([g, label]) => {
      const list = h('div', { class: 'ed-pal-list' });
      Object.entries(SV.catalog).forEach(([type, c]) => {
        if (c.group !== g) return;
        list.append(h('div', { class: 'ed-pal-item', role: 'button', tabindex: 0, 'data-type': type, title: 'Añadir ' + c.label },
          h('i', { class: 'ti ' + c.icon }), h('span', null, c.label)));
      });
      pal.append(h('div', { class: 'ed-pal-group' }, h('div', { class: 'ed-pal-title' }, label), list));
      if (window.Sortable) {
        Sortable.create(list, { group: { name: 'blocks', pull: 'clone', put: false }, sort: false, animation: 150 });
      }
    });
    pal.append(h('p', { class: 'ed-pal-tip' }, h('i', { class: 'ti ti-hand-finger' }), ' Haz clic o arrastra al lienzo'));
  }

  /* =========================================================
     Barra de pasos
     ========================================================= */
  function renderSteps() {
    stepsNav.innerHTML = '';
    const pill = (key, label, icon, extra) => {
      const active = screen === key;
      return h('button', Object.assign({ type: 'button', class: 'ed-step' + (active ? ' active' : '') + (extra && extra.cls ? ' ' + extra.cls : '') }, extra && extra.attrs),
        icon ? h('i', { class: 'ti ' + icon }) : null, h('span', null, label));
    };
    const w = pill('welcome', 'Bienvenida', 'ti-door-enter', { cls: def.welcome.enabled === false ? 'is-off' : '' });
    w.onclick = () => go('welcome');
    stepsNav.append(w);

    const list = h('div', { class: 'ed-steps-list' });
    def.steps.forEach((s, i) => {
      const count = s.blocks.filter((b) => SV.isQuestion(b.type)).length;
      const p = pill(i, s.title || 'Paso ' + (i + 1), null, { cls: 'is-step', attrs: { 'data-index': i } });
      p.prepend(h('span', { class: 'ed-step-num' }, i + 1));
      p.append(h('span', { class: 'ed-step-count', title: count + ' preguntas' }, count));
      p.onclick = () => go(i);
      list.append(p);
    });
    stepsNav.append(list);
    stepsNav.append(h('button', { type: 'button', class: 'ed-step ed-step-add', title: 'Añadir paso', onclick: addStep }, h('i', { class: 'ti ti-plus' }), h('span', null, 'Paso')));
    const t = pill('thanks', 'Final', 'ti-confetti');
    t.onclick = () => go('thanks');
    stepsNav.append(t);

    if (window.Sortable) {
      Sortable.create(list, {
        animation: 150,
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
    const w = def.welcome;
    const card = screenCard('is-welcome', [
      w.enabled === false ? h('div', { class: 'ed-off-note' }, h('i', { class: 'ti ti-eye-off' }), ' Pantalla de bienvenida desactivada: la encuesta empezará directamente en el paso 1.') : null,
      w.image ? h('img', { class: 'sv-hero', src: SV.asset(w.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, w.title || title),
      w.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(w.text) }) : null,
      h('div', { class: 'sv-actions center' }, h('span', { class: 'sv-btn sv-btn-primary sv-btn-lg' }, w.button || 'Comenzar', h('i', { class: 'ti ti-arrow-right' }))),
    ], () => { tab = 'props'; renderPanel(); });
    if (w.enabled === false) card.classList.add('is-disabled');
    return card;
  }

  function renderThanks() {
    const t = def.thanks;
    return screenCard('is-thanks', [
      h('div', { class: 'sv-done-anim' }, h('svg', { viewBox: '0 0 52 52', html: '<circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-15"/>' })),
      t.image ? h('img', { class: 'sv-hero', src: SV.asset(t.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, t.title || '¡Gracias!'),
      t.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(t.text) }) : null,
      t.button && t.url ? h('div', { class: 'sv-actions center' }, h('span', { class: 'sv-btn sv-btn-primary' }, t.button)) : null,
    ], () => { tab = 'props'; renderPanel(); });
  }

  function renderStepCanvas() {
    const step = currentStep();
    const nums = questionNumbers();
    const card = h('section', { class: 'sv-card is-step' });
    if (def.steps.length > 1) {
      card.append(h('div', { class: 'sv-step-head' },
        h('span', { class: 'sv-step-count' }, `Paso ${screen + 1} de ${def.steps.length}`),
        step.title ? h('span', { class: 'sv-step-title' }, step.title) : null));
    }
    const list = h('div', { class: 'sv-blocks ed-blocks', 'data-empty': 'Arrastra aquí componentes de la izquierda o haz clic en ellos' });
    step.blocks.forEach((b) => list.append(blockWrapper(b, nums)));
    card.append(list);

    const last = screen === def.steps.length - 1;
    card.append(h('div', { class: 'sv-actions ed-fake-nav' },
      (screen > 0 || def.welcome.enabled !== false) && def.settings.allowBack !== false ? h('span', { class: 'sv-btn sv-btn-ghost' }, h('i', { class: 'ti ti-arrow-left' }), 'Atrás') : h('span'),
      h('span', { class: 'sv-btn sv-btn-primary' }, last ? 'Enviar' : 'Siguiente', h('i', { class: 'ti ' + (last ? 'ti-send' : 'ti-arrow-right') }))));

    card.addEventListener('click', (e) => {
      if (e.target.closest('.ed-block')) return;
      if (selected) { selected = null; renderCanvasSelection(); renderPanel(); }
    });

    if (window.Sortable) {
      Sortable.create(list, {
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
          step.blocks.splice(evt.newIndex, 0, step.blocks.splice(evt.oldIndex, 1)[0]);
          renderAll();
          queueSave();
        },
      });
    }
    return card;
  }

  function blockWrapper(b, nums) {
    const c = SV.catalog[b.type] || { label: b.type, icon: 'ti-square' };
    const el = SV.render(b, { mode: 'edit', number: def.settings.showNumbers !== false ? nums[b.id] : null });
    const wrap = h('div', { class: 'ed-block' + (selected === b.id ? ' is-selected' : ''), 'data-id': b.id },
      h('div', { class: 'ed-tag' }, h('i', { class: 'ti ' + c.icon }), c.label, b.required ? h('span', { class: 'ed-tag-req' }, 'Obligatoria') : null),
      h('div', { class: 'ed-tools' },
        h('button', { type: 'button', title: 'Subir', onclick: (e) => { e.stopPropagation(); moveBlock(b.id, -1); } }, h('i', { class: 'ti ti-arrow-up' })),
        h('button', { type: 'button', title: 'Bajar', onclick: (e) => { e.stopPropagation(); moveBlock(b.id, 1); } }, h('i', { class: 'ti ti-arrow-down' })),
        h('button', { type: 'button', title: 'Duplicar', onclick: (e) => { e.stopPropagation(); duplicateBlock(b.id); } }, h('i', { class: 'ti ti-copy' })),
        h('button', { type: 'button', title: 'Eliminar', class: 'danger', onclick: (e) => { e.stopPropagation(); deleteBlock(b.id); } }, h('i', { class: 'ti ti-trash' }))),
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
    const urlInput = h('input', { type: 'text', placeholder: o.video ? 'https://youtube.com/… o sube un MP4' : 'https://… o sube un archivo' });
    urlInput.value = obj[key] || '';
    function paint() {
      preview.innerHTML = '';
      const v = obj[key];
      if (!v) preview.append(h('i', { class: 'ti ' + (o.video ? 'ti-movie' : 'ti-photo') }));
      else if (o.video) preview.append(h('i', { class: 'ti ti-movie' }));
      else preview.append(h('img', { src: SV.asset(v), alt: '' }));
      rm.hidden = !v;
    }
    const up = h('button', { type: 'button', class: 'btn btn-soft btn-sm' }, h('i', { class: 'ti ti-upload' }), 'Subir');
    const rm = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: 'Quitar' }, h('i', { class: 'ti ti-trash' }));
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
  function fList(b, key, label, o = {}) {
    b[key] = b[key] || [];
    const list = h('div', { class: 'opt-list' });
    b[key].forEach((op, i) => {
      const inp = h('input', { type: 'text', placeholder: o.placeholder || 'Opción ' + (i + 1) });
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
        thumb = h('button', { type: 'button', class: 'opt-thumb' + (op.image || op.src ? ' has-img' : ''), title: 'Imagen / logo' },
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
      const del = h('button', { type: 'button', class: 'opt-del', title: 'Eliminar' }, h('i', { class: 'ti ti-x' }));
      del.addEventListener('click', () => {
        if (!o.allowEmpty && b[key].length <= 1) return App.toast('Debe haber al menos un elemento', 'info');
        b[key].splice(i, 1);
        changed('panel');
      });
      list.append(h('div', { class: 'opt-row', 'data-index': i },
        h('span', { class: 'opt-handle', title: 'Arrastrar' }, h('i', { class: 'ti ti-grip-vertical' })),
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
    const add = h('button', { type: 'button', class: 'btn btn-soft btn-sm' }, h('i', { class: 'ti ti-plus' }), o.addLabel || 'Añadir opción');
    add.addEventListener('click', () => {
      b[key].push(o.make ? o.make() : SV.opt((o.prefix || 'Opción') + ' ' + (b[key].length + 1)));
      changed('panel');
      const inputs = panelBody.querySelectorAll(`.opt-list[data-key="${key}"] .opt-row input[type=text]`);
      if (inputs.length && !o.images) inputs[inputs.length - 1].select();
    });
    const actions = h('div', { class: 'opt-actions' }, add);
    if (!o.noBulk) {
      const bulk = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, h('i', { class: 'ti ti-list' }), 'Pegar lista');
      bulk.addEventListener('click', () => {
        const ta = h('textarea', { rows: 6, placeholder: 'Una opción por línea' });
        ta.value = b[key].map((x) => x.label).join('\n');
        const ok = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Aplicar');
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
    if (tab === 'settings') return panelSettings();
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
      panelHead('ti-door-enter', 'Pantalla de bienvenida'),
      section(null,
        fToggle(w, 'enabled', 'Mostrar bienvenida', 'Si la desactivas, la encuesta empieza en el paso 1', { invert: false, after: 'all' }),
        fText(w, 'title', 'Título', { placeholder: title, after: 'canvas' }),
        fText(w, 'text', 'Texto', { multiline: true, rows: 4, after: 'canvas', hint: 'Admite **negrita**, *cursiva* y [enlaces](https://…)' }),
        fImage(w, 'image', 'Imagen de cabecera', { after: 'canvas' }),
        fText(w, 'button', 'Texto del botón', { placeholder: 'Comenzar', after: 'canvas' })));
  }

  function panelThanks() {
    const t = def.thanks;
    panelBody.append(
      panelHead('ti-confetti', 'Pantalla final'),
      section(null,
        fText(t, 'title', 'Título', { placeholder: '¡Gracias!', after: 'canvas' }),
        fText(t, 'text', 'Mensaje', { multiline: true, rows: 4, after: 'canvas' }),
        fImage(t, 'image', 'Imagen', { after: 'canvas' })),
      section('Redirección (opcional)',
        fText(t, 'url', 'URL de destino', { placeholder: 'https://tuweb.com', after: 'canvas', hint: 'Si no indicas texto de botón, se redirigirá automáticamente a los 3 s.' }),
        fText(t, 'button', 'Texto del botón', { placeholder: 'Visitar web', after: 'canvas' })));
  }

  function panelStep() {
    const step = currentStep();
    const i = screen;
    const actions = [
      h('button', { type: 'button', class: 'icon-btn', title: 'Mover a la izquierda', disabled: i === 0, onclick: () => { def.steps.splice(i - 1, 0, def.steps.splice(i, 1)[0]); screen = i - 1; changed('all'); } }, h('i', { class: 'ti ti-arrow-left' })),
      h('button', { type: 'button', class: 'icon-btn', title: 'Mover a la derecha', disabled: i === def.steps.length - 1, onclick: () => { def.steps.splice(i + 1, 0, def.steps.splice(i, 1)[0]); screen = i + 1; changed('all'); } }, h('i', { class: 'ti ti-arrow-right' })),
      h('button', { type: 'button', class: 'icon-btn', title: 'Duplicar paso', onclick: () => {
        const c = clone(step);
        c.id = SV.uid('s');
        c.title = (c.title || 'Paso') + ' (copia)';
        c.blocks.forEach(reId);
        def.steps.splice(i + 1, 0, c);
        screen = i + 1;
        changed('all');
      } }, h('i', { class: 'ti ti-copy' })),
      h('button', { type: 'button', class: 'icon-btn danger', title: 'Eliminar paso', disabled: def.steps.length <= 1, onclick: async () => {
        if (step.blocks.length && !(await App.confirm({ title: 'Eliminar paso', text: `Se eliminará «${step.title}» y sus ${step.blocks.length} elementos.`, ok: 'Eliminar', danger: true }))) return;
        def.steps.splice(i, 1);
        screen = Math.max(0, i - 1);
        changed('all');
      } }, h('i', { class: 'ti ti-trash' })),
    ];
    const q = step.blocks.filter((b) => SV.isQuestion(b.type)).length;
    panelBody.append(
      panelHead('ti-stack-2', 'Paso ' + (i + 1), actions),
      section(null,
        fText(step, 'title', 'Nombre del paso', { after: 'stepname' }),
        h('div', { class: 'panel-stats' },
          h('div', null, h('strong', null, step.blocks.length), h('span', null, 'elementos')),
          h('div', null, h('strong', null, q), h('span', null, 'preguntas')))),
      section('Consejo', h('p', { class: 'muted small' }, 'Selecciona un elemento del lienzo para editarlo, o añade componentes desde la columna izquierda. Arrastra para reordenar. Divide encuestas largas en varios pasos para mejorar la tasa de respuesta.')));
  }

  const OPTION_TYPES = ['single_choice', 'multiple_choice', 'dropdown', 'image_choice', 'ranking'];

  function panelBlock(f) {
    const b = f.block;
    const c = SV.catalog[b.type];
    const isQ = SV.isQuestion(b.type);
    const actions = [
      h('button', { type: 'button', class: 'icon-btn', title: 'Duplicar (Ctrl+D)', onclick: () => duplicateBlock(b.id) }, h('i', { class: 'ti ti-copy' })),
      h('button', { type: 'button', class: 'icon-btn danger', title: 'Eliminar (Supr)', onclick: () => deleteBlock(b.id) }, h('i', { class: 'ti ti-trash' })),
    ];
    panelBody.append(panelHead(c.icon, c.label, actions));

    if (isQ) {
      panelBody.append(section(null,
        fText(b, 'title', 'Pregunta', { multiline: true, rows: 2 }),
        fText(b, 'description', 'Descripción (opcional)', { multiline: true, rows: 2, placeholder: 'Texto de ayuda bajo la pregunta' }),
        fToggle(b, 'required', 'Obligatoria', 'El participante no podrá avanzar sin responder')));
    }

    const s = [];
    switch (b.type) {
      case 'heading':
        s.push(fText(b, 'text', 'Texto', { multiline: true, rows: 2 }),
          fSeg(b, 'size', 'Tamaño', [['h1', 'Grande'], ['h2', 'Medio'], ['h3', 'Pequeño']]),
          fSeg(b, 'align', 'Alineación', [['left', 'Izquierda', 'ti-align-left'], ['center', 'Centro', 'ti-align-center'], ['right', 'Derecha', 'ti-align-right']], { iconOnly: true }));
        break;
      case 'paragraph':
        s.push(fText(b, 'text', 'Texto', { multiline: true, rows: 7, hint: 'Formato: **negrita**, *cursiva*, [texto](https://enlace)' }),
          fSeg(b, 'align', 'Alineación', [['left', 'Izquierda', 'ti-align-left'], ['center', 'Centro', 'ti-align-center'], ['right', 'Derecha', 'ti-align-right']], { iconOnly: true }));
        break;
      case 'image':
        if (b.rounded === undefined) b.rounded = true;
        s.push(fImage(b, 'src', 'Imagen'), fText(b, 'alt', 'Texto alternativo', { placeholder: 'Describe la imagen (accesibilidad)' }),
          fText(b, 'caption', 'Pie de foto'),
          fSeg(b, 'width', 'Ancho', [['small', 'Pequeño'], ['medium', 'Medio'], ['full', 'Completo']]),
          fToggle(b, 'rounded', 'Esquinas redondeadas', null, { invert: false }));
        break;
      case 'video':
        s.push(fImage(b, 'url', 'Vídeo', { video: true, hint: 'Enlace de YouTube o Vimeo, o sube un archivo MP4/WEBM.' }), fText(b, 'caption', 'Descripción'));
        break;
      case 'logos':
        s.push(fText(b, 'title', 'Título (opcional)', { placeholder: 'Con el apoyo de…' }),
          fSeg(b, 'size', 'Tamaño', [['sm', 'S'], ['md', 'M'], ['lg', 'L']]),
          fToggle(b, 'grayscale', 'Escala de grises', 'Se colorean al pasar el ratón'),
          fList(b, 'items', 'Logos', {
            images: true, imageKey: 'src', labelKey: 'alt', placeholder: 'Nombre de la marca', addLabel: 'Añadir logo', allowEmpty: true, noBulk: true,
            make: () => ({ id: SV.uid('l'), src: '', alt: '', link: '' }),
            extra: (op) => {
              const l = h('input', { type: 'text', placeholder: 'Enlace (opcional)', class: 'opt-sub' });
              l.value = op.link || '';
              l.addEventListener('input', () => { op.link = l.value; changed('block'); });
              return l;
            },
          }));
        break;
      case 'divider':
        s.push(h('p', { class: 'muted small' }, 'Línea separadora entre secciones.'));
        break;
      case 'spacer':
        s.push(fText(b, 'height', 'Altura (px)', { type: 'number', min: 4, max: 200 }));
        break;
      case 'short_text':
      case 'email':
        s.push(fText(b, 'placeholder', 'Texto de ejemplo'));
        break;
      case 'long_text':
        s.push(fText(b, 'placeholder', 'Texto de ejemplo'), fText(b, 'maxLength', 'Máximo de caracteres', { type: 'number', min: 0, hint: '0 = sin límite' }));
        break;
      case 'number':
        s.push(fText(b, 'placeholder', 'Texto de ejemplo'),
          h('div', { class: 'field-row' }, fText(b, 'min', 'Mínimo', { type: 'number' }), fText(b, 'max', 'Máximo', { type: 'number' })));
        break;
      case 'single_choice':
      case 'multiple_choice':
        s.push(fList(b, 'options', 'Opciones'),
          fToggle(b, 'allowOther', 'Opción «Otro»', 'Añade un campo de texto libre', { after: 'panel' }));
        if (b.allowOther) s.push(fText(b, 'otherLabel', 'Texto de «Otro»', { placeholder: 'Otro' }));
        s.push(fSeg(b, 'layout', 'Disposición', [['list', 'Lista', 'ti-list'], ['grid', 'Cuadrícula', 'ti-layout-grid']]));
        if (b.type === 'multiple_choice') {
          s.push(h('div', { class: 'field-row' },
            fText(b, 'minSelect', 'Mín. selecciones', { type: 'number', min: 0 }),
            fText(b, 'maxSelect', 'Máx. selecciones', { type: 'number', min: 0, hint: '0 = sin límite' })));
        }
        break;
      case 'dropdown':
        s.push(fList(b, 'options', 'Opciones'), fText(b, 'placeholder', 'Texto inicial', { placeholder: 'Selecciona…' }));
        break;
      case 'yes_no':
        s.push(h('div', { class: 'field-row' }, fText(b, 'yesLabel', 'Texto «Sí»'), fText(b, 'noLabel', 'Texto «No»')));
        break;
      case 'image_choice':
        if (b.showLabels === undefined) b.showLabels = true;
        s.push(fList(b, 'options', 'Opciones con imagen / logo', { images: true, hint: '' }),
          fToggle(b, 'multiple', 'Selección múltiple', 'Permite elegir varias imágenes', { after: 'panel' }));
        if (b.multiple) {
          s.push(h('div', { class: 'field-row' },
            fText(b, 'minSelect', 'Mín.', { type: 'number', min: 0 }),
            fText(b, 'maxSelect', 'Máx.', { type: 'number', min: 0, hint: '0 = sin límite' })));
        }
        s.push(fSeg(b, 'columns', 'Columnas', [[2, '2'], [3, '3'], [4, '4']]),
          fSeg(b, 'fit', 'Ajuste de imagen', [['contain', 'Logo (completo)'], ['cover', 'Foto (recortar)']]),
          fToggle(b, 'showLabels', 'Mostrar etiquetas', null, { invert: false }));
        break;
      case 'rating':
        s.push(fSeg(b, 'icon', 'Icono', [['star', 'Estrellas', 'ti-star'], ['heart', 'Corazones', 'ti-heart'], ['emoji', 'Caras', 'ti-mood-smile']], { after: 'panel' }));
        if (b.icon !== 'emoji') s.push(fSelect(b, 'max', 'Máximo', [3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, n + ' ' + (b.icon === 'heart' ? 'corazones' : 'estrellas')]), { num: true }));
        break;
      case 'scale':
        s.push(h('div', { class: 'field-row' },
          fSelect(b, 'min', 'Desde', [[0, '0'], [1, '1']], { num: true }),
          fSelect(b, 'max', 'Hasta', [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, String(n)]), { num: true })),
          h('div', { class: 'field-row' }, fText(b, 'minLabel', 'Etiqueta mínima'), fText(b, 'maxLabel', 'Etiqueta máxima')));
        break;
      case 'nps':
        s.push(h('div', { class: 'field-row' }, fText(b, 'minLabel', 'Etiqueta 0'), fText(b, 'maxLabel', 'Etiqueta 10')),
          h('p', { class: 'muted small' }, 'El Net Promoter Score se calcula automáticamente en los resultados: % promotores (9-10) − % detractores (0-6).'));
        break;
      case 'slider':
        s.push(h('div', { class: 'field-row' }, fText(b, 'min', 'Mínimo', { type: 'number' }), fText(b, 'max', 'Máximo', { type: 'number' })),
          h('div', { class: 'field-row' }, fText(b, 'step', 'Incremento', { type: 'number', min: 0 }), fText(b, 'unit', 'Unidad', { placeholder: '€, %, km…' })));
        break;
      case 'ranking':
        s.push(fList(b, 'options', 'Elementos a ordenar'));
        break;
      case 'matrix':
        s.push(fList(b, 'rows', 'Filas (aspectos)', { prefix: 'Aspecto', addLabel: 'Añadir fila' }),
          fList(b, 'columns', 'Columnas (respuestas)', { prefix: 'Valor', addLabel: 'Añadir columna' }));
        break;
    }
    if (s.length) panelBody.append(section(isQ ? 'Configuración' : null, s));

    // Conversión entre tipos con opciones
    if (OPTION_TYPES.includes(b.type)) {
      const conv = h('select', null, OPTION_TYPES.map((t) => h('option', { value: t }, SV.catalog[t].label)));
      conv.value = b.type;
      conv.addEventListener('change', () => {
        const base = SV.catalog[conv.value].make();
        const keep = { id: b.id, title: b.title, description: b.description, required: b.required, options: b.options };
        Object.keys(b).forEach((k) => delete b[k]);
        Object.assign(b, base, keep, { type: conv.value });
        changed('panel');
      });
      panelBody.append(section('Convertir', field('Tipo de pregunta', h('div', { class: 'select-wrap' }, conv))));
    }

    // Mover a otro paso
    if (def.steps.length > 1) {
      const mv = h('select', null, def.steps.map((st, i) => h('option', { value: i }, `${i + 1}. ${st.title || 'Paso'}`)));
      mv.value = String(f.si);
      mv.addEventListener('change', () => {
        const to = +mv.value;
        f.step.blocks.splice(f.bi, 1);
        def.steps[to].blocks.push(b);
        screen = to;
        changed('all');
        App.toast('Movido al paso ' + (to + 1));
      });
      panelBody.append(section('Ubicación', field('Mover al paso', h('div', { class: 'select-wrap' }, mv))));
    }
  }

  function panelDesign() {
    const st = def.settings;
    if (themeDraft) return panelThemeEditor();

    const cur = E.themes.find((x) => x.key === st.theme) || E.themes[0];
    const gallery = h('div', { class: 'theme-gallery' }, E.themes.map((t) => {
      const b = h('button', { type: 'button', class: 'theme-pick' + (cur && t.key === cur.key ? ' active' : ''), title: t.name },
        SV.themeThumb(t.config),
        h('span', { class: 'theme-pick-name' }, t.custom ? h('i', { class: 'ti ti-user-edit', title: 'Tema personalizado' }) : null, t.name));
      b.addEventListener('click', () => { st.theme = t.key; changed('panel'); });
      return b;
    }));
    const actions = h('div', { class: 'opt-actions' },
      h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => {
        themeDraft = { id: null, config: Object.assign({}, cur.config, { name: cur.name + ' (personalizado)' }) };
        renderPanel();
      } }, h('i', { class: 'ti ti-adjustments-horizontal' }), 'Personalizar colores'),
      cur && cur.custom ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
        themeDraft = { id: cur.id, config: Object.assign({}, cur.config) };
        renderPanel();
      } }, h('i', { class: 'ti ti-pencil' }), 'Editar «' + cur.name + '»') : null,
      h('a', { class: 'btn btn-ghost btn-sm', href: 'themes.php', target: '_blank' }, h('i', { class: 'ti ti-palette' }), 'Gestionar temas'));

    panelBody.append(
      panelHead('ti-palette', 'Diseño de la encuesta'),
      section('Tema', gallery, actions),
      section('Marca', fImage(st, 'logo', 'Logo de cabecera', { after: 'canvas', hint: 'Se muestra arriba en todas las pantallas.' })),
      section('Elementos',
        fToggle(st, 'showProgress', 'Barra de progreso', null, { after: 'canvas' }),
        fToggle(st, 'showNumbers', 'Numerar preguntas', null, { after: 'canvas' })));
  }

  function panelThemeEditor() {
    const d = themeDraft;
    const editingExisting = !!d.id;
    const saveTheme = async (asNew) => {
      try {
        if (!asNew && editingExisting) {
          const ok = await App.confirm({ title: 'Actualizar tema', text: 'Los cambios se aplicarán a todas las encuestas que usan «' + d.config.name + '».', ok: 'Guardar cambios' });
          if (!ok) return;
        }
        const r = await App.api('theme_save', { id: asNew ? 0 : d.id, config: d.config });
        const i = E.themes.findIndex((x) => x.key === r.theme.key);
        if (i >= 0) E.themes[i] = r.theme; else E.themes.push(r.theme);
        def.settings.theme = r.theme.key;
        themeDraft = null;
        changed('panel');
        App.toast(asNew ? 'Tema «' + r.theme.name + '» creado y aplicado' : 'Tema actualizado');
      } catch (e) { App.toast(e.message, 'error'); }
    };
    panelBody.append(
      panelHead('ti-brush', editingExisting ? 'Editar tema' : 'Nuevo tema', [
        h('button', { type: 'button', class: 'icon-btn', title: 'Cancelar', onclick: () => { themeDraft = null; renderCanvas(); renderPanel(); } }, h('i', { class: 'ti ti-x' })),
      ]),
      SV.themeForm(d.config, () => renderCanvas()),
      h('div', { class: 'theme-actions' },
        editingExisting ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => saveTheme(false) }, h('i', { class: 'ti ti-device-floppy' }), 'Guardar cambios') : null,
        h('button', { type: 'button', class: editingExisting ? 'btn btn-soft' : 'btn btn-primary', onclick: () => saveTheme(true) }, h('i', { class: 'ti ti-plus' }), editingExisting ? 'Guardar como copia' : 'Guardar tema y aplicar'),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { themeDraft = null; renderCanvas(); renderPanel(); } }, 'Cancelar')));
  }

  function panelSettings() {
    const st = def.settings;
    // Programación: fecha y hora en campos separados (se guardan como 'AAAA-MM-DDTHH:MM', hora de Madrid)
    const fmtWhen = (v) => {
      const d = new Date(v);
      if (isNaN(d)) return '';
      return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + ' a las ' + v.slice(11, 16);
    };
    const summary = h('div', { class: 'schedule-summary' });
    function paintSummary() {
      const a = st.startAt, b = st.endAt;
      let icon = 'ti-calendar-time', text = 'Sin programar: la encuesta acepta respuestas mientras esté publicada.', cls = '';
      if (a && b && b <= a) { icon = 'ti-alert-triangle'; cls = 'is-error'; text = 'La hora de cierre debe ser posterior a la de apertura.'; }
      else if (a && b) text = 'Abre el ' + fmtWhen(a) + ' y cierra el ' + fmtWhen(b) + '.';
      else if (a) text = 'Abre el ' + fmtWhen(a) + ' y no tiene cierre.';
      else if (b) text = 'Acepta respuestas hasta el ' + fmtWhen(b) + '.';
      summary.className = 'schedule-summary ' + cls;
      summary.replaceChildren(h('i', { class: 'ti ' + icon }), h('span', null, text));
    }
    const when = (key, label, defTime) => {
      const date = h('input', { type: 'date', 'aria-label': label + ' (fecha)' });
      const time = h('input', { type: 'time', step: 60, 'aria-label': label + ' (hora)' });
      const clear = h('button', { type: 'button', class: 'icon-btn', title: 'Quitar' }, h('i', { class: 'ti ti-x' }));
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
      } }, h('i', { class: 'ti ti-clock-plus' }), 'Programar para hoy'));
    paintSummary();
    const link = h('input', { type: 'text', readonly: true });
    link.value = E.publicUrl;
    panelBody.append(
      panelHead('ti-settings', 'Ajustes'),
      section('Enlace público', h('div', { class: 'input-group' }, link, h('button', { type: 'button', class: 'btn btn-soft', onclick: () => App.copy(E.publicUrl) }, h('i', { class: 'ti ti-copy' })))),
      section('Control de participación',
        fToggle(st, 'onePerBrowser', 'Una respuesta por navegador', 'Usa una cookie para impedir que se responda dos veces desde el mismo navegador', { after: 'none' }),
        fToggle(st, 'limitByIp', 'Una respuesta por IP', 'Más estricto: bloquea también otras ventanas o navegadores desde la misma red. Ojo con redes compartidas (empresas, wifi pública).', { after: 'none' }),
        fText(st, 'doneMessage', 'Mensaje si ya ha participado', { multiline: true, rows: 2, after: 'none' })),
      section('Navegación',
        fToggle(st, 'allowBack', 'Permitir volver atrás', null, { after: 'canvas' })),
      section('Disponibilidad (fecha y hora)',
        when('startAt', 'Apertura', '00:00'),
        when('endAt', 'Cierre', '23:59'),
        summary,
        !st.startAt && !st.endAt ? quick : null,
        h('small', { class: 'hint' }, 'Hora de Madrid. La encuesta debe estar en estado «Publicada»; fuera del horario se muestra el mensaje de abajo.')),
      section(null,
        fText(st, 'maxResponses', 'Límite de respuestas', { type: 'number', min: 0, hint: '0 = sin límite', after: 'none' }),
        fText(st, 'closedMessage', 'Mensaje cuando está cerrada', { multiline: true, rows: 2, after: 'none' })),
      section('Compartir en redes', fText(st, 'description', 'Descripción para buscadores y redes', { multiline: true, rows: 2, after: 'none' })));
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
    const url = E.previewUrl;
    if (w) w.location.href = url;
    else location.href = url;
  });

  $('#ed-share').addEventListener('click', () => App.share(E.publicUrl, status, E.id, title));

  const statusSel = $('#ed-status');
  statusSel.value = status;
  statusSel.dataset.status = status;
  statusSel.addEventListener('change', async () => {
    const next = statusSel.value;
    const qCount = def.steps.reduce((n, s) => n + s.blocks.filter((b) => SV.isQuestion(b.type)).length, 0);
    if (next === 'published' && !qCount) {
      statusSel.value = status;
      return App.toast('Añade al menos una pregunta antes de publicar', 'error');
    }
    try {
      await save();
      await App.api('status', { id: E.id, status: next });
      status = next;
      statusSel.dataset.status = next;
      App.toast({ draft: 'Encuesta en borrador', published: '¡Encuesta publicada! Ya puedes compartirla', closed: 'Encuesta cerrada' }[next]);
      if (next === 'published') App.share(E.publicUrl, status, E.id, title);
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

  /* arranque */
  renderPalette();
  renderAll();
  snapshot();
})();
