/* Renderizador compartido de bloques (editor + encuesta pública) */
(function () {
  'use strict';
  const SV = (window.SV = window.SV || {});
  SV.base = (window.APP && window.APP.base) || '';

  /* ---------- utilidades ---------- */
  SV.uid = (p = 'b') => p + '_' + Math.random().toString(36).slice(2, 10);
  SV.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  SV.asset = (u) => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return SV.base + '/' + u;
  };
  SV.fmt = (text) => {
    let s = SV.esc(text);
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s.replace(/\n/g, '<br>');
  };

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const sk in v) sk.startsWith('--') ? el.style.setProperty(sk, v[sk]) : (el.style[sk] = v[sk]);
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    children.flat(3).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  SV.h = h;

  const opt = (label, extra) => Object.assign({ id: SV.uid('o'), label }, extra || {});
  const q = (title, extra) => Object.assign({ title, description: '', required: false }, extra || {});
  SV.opt = opt;

  /* ---------- catálogo ---------- */
  SV.catalog = {
    heading:   { group: 'content', label: 'Título', icon: 'ti-heading', make: () => ({ text: 'Título de la sección', size: 'h2', align: 'left' }) },
    paragraph: { group: 'content', label: 'Texto', icon: 'ti-align-left', make: () => ({ text: 'Escribe aquí tu texto. Puedes usar **negrita**, *cursiva* y [enlaces](https://ejemplo.com).', align: 'left' }) },
    image:     { group: 'content', label: 'Imagen', icon: 'ti-photo', make: () => ({ src: '', alt: '', caption: '', width: 'full', rounded: true }) },
    video:     { group: 'content', label: 'Vídeo', icon: 'ti-brand-youtube', make: () => ({ url: '', caption: '' }) },
    logos:     { group: 'content', label: 'Logos', icon: 'ti-award', make: () => ({ title: '', items: [], size: 'md', grayscale: false }) },
    divider:   { group: 'content', label: 'Separador', icon: 'ti-separator', make: () => ({}) },
    spacer:    { group: 'content', label: 'Espacio', icon: 'ti-arrows-vertical', make: () => ({ height: 32 }) },

    single_choice:   { group: 'question', label: 'Opción única', icon: 'ti-circle-dot', make: () => q('Elige una opción', { options: [opt('Opción 1'), opt('Opción 2'), opt('Opción 3')], allowOther: false, otherLabel: 'Otro', layout: 'list' }) },
    multiple_choice: { group: 'question', label: 'Opción múltiple', icon: 'ti-checkbox', make: () => q('Selecciona una o varias opciones', { options: [opt('Opción 1'), opt('Opción 2'), opt('Opción 3')], allowOther: false, otherLabel: 'Otro', minSelect: 0, maxSelect: 0, layout: 'list' }) },
    image_choice:    { group: 'question', label: 'Imágenes / logos', icon: 'ti-layout-grid', make: () => q('¿Cuál prefieres?', { options: [opt('Opción A', { image: '' }), opt('Opción B', { image: '' }), opt('Opción C', { image: '' })], multiple: false, minSelect: 0, maxSelect: 0, columns: 3, showLabels: true, fit: 'contain' }) },
    dropdown:        { group: 'question', label: 'Desplegable', icon: 'ti-selector', make: () => q('Elige de la lista', { options: [opt('Opción 1'), opt('Opción 2'), opt('Opción 3')], placeholder: 'Selecciona…' }) },
    yes_no:          { group: 'question', label: 'Sí / No', icon: 'ti-thumb-up', make: () => q('¿Responderías que sí?', { yesLabel: 'Sí', noLabel: 'No' }) },
    rating:          { group: 'question', label: 'Valoración', icon: 'ti-star', make: () => q('Valora tu experiencia', { max: 5, icon: 'star' }) },
    scale:           { group: 'question', label: 'Escala lineal', icon: 'ti-adjustments-horizontal', make: () => q('En una escala del 1 al 5…', { min: 1, max: 5, minLabel: 'Nada', maxLabel: 'Mucho' }) },
    nps:             { group: 'question', label: 'NPS (0-10)', icon: 'ti-gauge', make: () => q('¿Qué probabilidad hay de que nos recomiendes?', { minLabel: 'Nada probable', maxLabel: 'Muy probable' }) },
    slider:          { group: 'question', label: 'Deslizador', icon: 'ti-adjustments', make: () => q('Mueve el control', { min: 0, max: 100, step: 1, unit: '' }) },
    ranking:         { group: 'question', label: 'Ranking', icon: 'ti-arrows-sort', make: () => q('Ordena por preferencia', { options: [opt('Elemento 1'), opt('Elemento 2'), opt('Elemento 3')] }) },
    matrix:          { group: 'question', label: 'Matriz', icon: 'ti-table', make: () => q('Valora cada aspecto', { rows: [opt('Aspecto 1'), opt('Aspecto 2'), opt('Aspecto 3')], columns: [opt('Malo'), opt('Regular'), opt('Bueno'), opt('Excelente')] }) },
    short_text:      { group: 'question', label: 'Texto corto', icon: 'ti-forms', make: () => q('Pregunta de respuesta corta', { placeholder: 'Escribe tu respuesta' }) },
    long_text:       { group: 'question', label: 'Texto largo', icon: 'ti-align-justified', make: () => q('Pregunta abierta', { placeholder: 'Escribe tu respuesta…', maxLength: 0 }) },
    email:           { group: 'question', label: 'Email', icon: 'ti-mail', make: () => q('¿Cuál es tu email?', { placeholder: 'nombre@ejemplo.com' }) },
    number:          { group: 'question', label: 'Número', icon: 'ti-123', make: () => q('Introduce un número', { placeholder: '0', min: '', max: '' }) },
    date:            { group: 'question', label: 'Fecha', icon: 'ti-calendar', make: () => q('Selecciona una fecha', {}) },
  };
  SV.isQuestion = (t) => !!(SV.catalog[t] && SV.catalog[t].group === 'question');
  SV.newBlock = (type) => Object.assign({ id: SV.uid(SV.isQuestion(type) ? 'q' : 'b'), type }, SV.catalog[type].make());

  /* ---------- tema ---------- */
  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0.2;
    const n = parseInt(m[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  SV.luminance = luminance;
  SV.themeDefaults = {
    name: 'Tema', accent: '#6d5efc', bgStyle: 'solid', bg: '#f1f0fb', bg2: '#fde7f3', bgImage: '', overlay: 30,
    card: '#ffffff', cardOpacity: 100, text: '#16171d', muted: '#696d7c', border: '#e3e4ea', input: '#ffffff',
    font: 'Inter', radius: 22, shadow: true,
  };
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
  /** Aplica un tema (configuración completa) a un contenedor .sv-root */
  SV.applyTheme = function (root, theme) {
    const t = Object.assign({}, SV.themeDefaults, theme || {});
    const D = SV.themeDefaults;
    const accent = hex(t.accent, D.accent);
    const card = hex(t.card, D.card);
    const set = (k, v) => root.style.setProperty(k, v);
    set('--accent', accent);
    set('--accent-ink', luminance(accent) > 0.45 ? '#111827' : '#ffffff');
    set('--sv-font', `'${t.font || 'Inter'}', system-ui, -apple-system, 'Segoe UI', sans-serif`);
    set('--sv-page', hex(t.bg, D.bg));
    set('--sv-page-2', hex(t.bg2, D.bg2));
    set('--sv-card', card);
    set('--sv-card-alpha', Math.max(50, Math.min(100, +t.cardOpacity || 100)) + '%');
    set('--sv-text', hex(t.text, D.text));
    set('--sv-muted', hex(t.muted, D.muted));
    set('--sv-border', hex(t.border, D.border));
    set('--sv-input', hex(t.input, D.input));
    set('--sv-radius', Math.max(0, Math.min(36, +t.radius)) + 'px');
    set('--sv-overlay', Math.max(0, Math.min(85, +t.overlay || 0)) / 100);
    set('--sv-bg-image', t.bgStyle === 'image' && t.bgImage ? `url("${SV.asset(t.bgImage).replace(/"/g, '%22')}")` : 'none');
    ['solid', 'gradient', 'image'].forEach((b) => root.classList.remove('sv-bg-' + b));
    root.classList.add('sv-bg-' + (['solid', 'gradient', 'image'].includes(t.bgStyle) ? t.bgStyle : 'solid'));
    root.classList.toggle('is-dark', luminance(card) < 0.18);
    root.classList.toggle('is-glass', (+t.cardOpacity || 100) < 100);
    root.classList.toggle('no-shadow', t.shadow === false);
    SV.loadFont(t.font);
  };
  SV.loadFont = function (font) {
    const map = {
      'Inter': 'Inter:wght@400;500;600;700;800', 'Poppins': 'Poppins:wght@400;500;600;700;800', 'DM Sans': 'DM+Sans:wght@400;500;600;700;800',
      'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700;800', 'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
      'Playfair Display': 'Playfair+Display:wght@400;600;700;800', 'Lora': 'Lora:wght@400;500;600;700',
    };
    const spec = map[font];
    if (!spec || document.querySelector(`link[data-font="${font}"]`)) return;
    document.head.append(h('link', { rel: 'stylesheet', 'data-font': font, href: `https://fonts.googleapis.com/css2?family=${spec}&display=swap` }));
  };
  SV.fonts = ['Inter', 'Poppins', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Playfair Display', 'Lora'];

  /* ---------- vídeo ---------- */
  SV.videoEmbed = function (url) {
    url = (url || '').trim();
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/))) {
      return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0' };
    }
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
    if (/\.(mp4|webm)(\?|$)/i.test(url) || /^uploads\//.test(url)) return { kind: 'video', src: SV.asset(url) };
    return null;
  };

  /* ---------- bloques de contenido ---------- */
  function placeholder(icon, text) {
    return h('div', { class: 'sv-placeholder' }, h('i', { class: 'ti ' + icon }), h('span', null, text));
  }

  const content = {
    heading(b) {
      const tag = ['h1', 'h2', 'h3'].includes(b.size) ? b.size : 'h2';
      return h(tag, { class: 'sv-heading sv-' + tag, style: { textAlign: b.align || 'left' } }, b.text || '');
    },
    paragraph(b) {
      return h('div', { class: 'sv-text', style: { textAlign: b.align || 'left' }, html: SV.fmt(b.text || '') });
    },
    image(b, edit) {
      if (!b.src) return edit ? placeholder('ti-photo', 'Añade una imagen desde el panel de propiedades') : null;
      return h('figure', { class: 'sv-figure w-' + (b.width || 'full') + (b.rounded !== false ? ' is-rounded' : '') },
        h('img', { src: SV.asset(b.src), alt: b.alt || '', loading: 'lazy' }),
        b.caption ? h('figcaption', null, b.caption) : null);
    },
    video(b, edit) {
      const v = SV.videoEmbed(b.url);
      if (!v) return edit ? placeholder('ti-brand-youtube', 'Pega un enlace de YouTube o Vimeo, o sube un MP4') : null;
      const media = v.kind === 'iframe'
        ? h('iframe', { src: v.src, allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true, loading: 'lazy', title: b.caption || 'Vídeo' })
        : h('video', { src: v.src, controls: true, playsinline: true, preload: 'metadata' });
      return h('figure', { class: 'sv-video' }, h('div', { class: 'sv-video-frame' }, media), b.caption ? h('figcaption', null, b.caption) : null);
    },
    logos(b, edit) {
      const items = (b.items || []).filter((i) => i.src);
      if (!items.length) return edit ? placeholder('ti-award', 'Añade logos desde el panel de propiedades') : null;
      return h('div', { class: 'sv-logos size-' + (b.size || 'md') + (b.grayscale ? ' is-gray' : '') },
        b.title ? h('div', { class: 'sv-logos-title' }, b.title) : null,
        h('div', { class: 'sv-logos-row' }, items.map((i) => {
          const img = h('img', { src: SV.asset(i.src), alt: i.alt || '', loading: 'lazy' });
          return i.link && /^https?:\/\//i.test(i.link) ? h('a', { href: i.link, target: '_blank', rel: 'noopener' }, img) : img;
        })));
    },
    divider() { return h('hr', { class: 'sv-divider' }); },
    spacer(b) { return h('div', { class: 'sv-spacer', style: { height: Math.max(4, Math.min(200, +b.height || 32)) + 'px' } }); },
  };

  /* ---------- preguntas ---------- */
  function textInput(b, st, set, type) {
    const inp = h('input', { class: 'sv-input', type, placeholder: b.placeholder || '', value: st.value == null ? '' : st.value });
    if (type === 'number') {
      inp.inputMode = 'decimal';
      if (b.min !== '' && b.min != null) inp.min = b.min;
      if (b.max !== '' && b.max != null) inp.max = b.max;
    }
    if (type === 'email') inp.autocomplete = 'email';
    inp.addEventListener('input', () => set(type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value));
    return inp;
  }

  function choices(b, st, set, multi) {
    const wrap = h('div', { class: 'sv-choices' + (b.layout === 'grid' ? ' is-grid' : ''), role: multi ? 'group' : 'radiogroup' });
    let sel = multi ? (Array.isArray(st.value) ? st.value.slice() : []) : st.value == null ? null : st.value;
    let other = st.other || '';
    const max = multi ? +b.maxSelect || 0 : 1;
    const items = (b.options || []).slice();
    if (b.allowOther) items.push({ id: '__other__', label: b.otherLabel || 'Otro' });
    const otherInput = h('input', { class: 'sv-input sv-other-input', placeholder: 'Especifica tu respuesta…', value: other });
    const isOn = (id) => (multi ? sel.includes(id) : sel === id);
    function refresh() {
      wrap.querySelectorAll('.sv-choice').forEach((el) => {
        const on = isOn(el.dataset.id);
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.classList.toggle('is-disabled', multi && max > 0 && !on && sel.length >= max);
      });
      otherInput.hidden = !isOn('__other__');
    }
    items.forEach((o, i) => {
      const el = h('button', { type: 'button', class: 'sv-choice', role: multi ? 'checkbox' : 'radio', 'data-id': o.id },
        h('span', { class: 'sv-key' }, String.fromCharCode(65 + (i % 26))),
        h('span', { class: 'sv-choice-label' }, o.label),
        h('i', { class: 'ti ti-check sv-choice-check' }));
      el.addEventListener('click', () => {
        if (multi) {
          const k = sel.indexOf(o.id);
          if (k >= 0) sel.splice(k, 1);
          else {
            if (max > 0 && sel.length >= max) return;
            sel.push(o.id);
          }
          set(sel.slice(), other);
        } else {
          sel = o.id;
          set(sel, other);
        }
        refresh();
        if (o.id === '__other__' && !otherInput.hidden) otherInput.focus();
      });
      wrap.append(el);
    });
    otherInput.addEventListener('input', () => {
      other = otherInput.value;
      set(multi ? sel.slice() : sel, other);
    });
    wrap.append(otherInput);
    if (multi && max > 0) wrap.append(h('div', { class: 'sv-hint' }, `Puedes elegir hasta ${max}`));
    refresh();
    return wrap;
  }

  const questions = {
    short_text: (b, st, set) => textInput(b, st, set, 'text'),
    email: (b, st, set) => textInput(b, st, set, 'email'),
    number: (b, st, set) => textInput(b, st, set, 'number'),
    date: (b, st, set) => {
      const inp = h('input', { class: 'sv-input sv-date', type: 'date', value: st.value || '' });
      inp.addEventListener('input', () => set(inp.value));
      return inp;
    },
    long_text(b, st, set) {
      const max = +b.maxLength || 0;
      const ta = h('textarea', { class: 'sv-input sv-textarea', rows: 4, placeholder: b.placeholder || '', maxlength: max || null });
      ta.value = st.value || '';
      const counter = max ? h('div', { class: 'sv-hint sv-counter' }, `${ta.value.length}/${max}`) : null;
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(480, ta.scrollHeight + 2) + 'px'; };
      ta.addEventListener('input', () => {
        set(ta.value);
        grow();
        if (counter) counter.textContent = `${ta.value.length}/${max}`;
      });
      requestAnimationFrame(grow);
      return h('div', null, ta, counter);
    },
    single_choice: (b, st, set) => choices(b, st, set, false),
    multiple_choice: (b, st, set) => choices(b, st, set, true),
    dropdown(b, st, set) {
      const s = h('select', { class: 'sv-input sv-select' },
        h('option', { value: '' }, b.placeholder || 'Selecciona…'),
        (b.options || []).map((o) => h('option', { value: o.id }, o.label)));
      s.value = st.value || '';
      s.addEventListener('change', () => set(s.value || null));
      return h('div', { class: 'sv-select-wrap' }, s, h('i', { class: 'ti ti-chevron-down' }));
    },
    yes_no(b, st, set) {
      const wrap = h('div', { class: 'sv-yesno', role: 'radiogroup' });
      [['yes', b.yesLabel || 'Sí', 'ti-thumb-up'], ['no', b.noLabel || 'No', 'ti-thumb-down']].forEach(([id, label, icon]) => {
        const btn = h('button', { type: 'button', class: 'sv-yn' + (st.value === id ? ' is-on' : ''), role: 'radio', 'data-id': id }, h('i', { class: 'ti ' + icon }), h('span', null, label));
        btn.addEventListener('click', () => {
          wrap.querySelectorAll('.sv-yn').forEach((x) => x.classList.toggle('is-on', x === btn));
          set(id);
        });
        wrap.append(btn);
      });
      return wrap;
    },
    image_choice(b, st, set) {
      const multi = !!b.multiple;
      const max = multi ? +b.maxSelect || 0 : 1;
      let sel = multi ? (Array.isArray(st.value) ? st.value.slice() : []) : st.value == null ? null : st.value;
      const cols = Math.min(4, Math.max(2, +b.columns || 3));
      const grid = h('div', { class: `sv-imgchoices cols-${cols}` + (b.fit === 'cover' ? ' fit-cover' : ''), role: multi ? 'group' : 'radiogroup' });
      const isOn = (id) => (multi ? sel.includes(id) : sel === id);
      function refresh() {
        grid.querySelectorAll('.sv-imgchoice').forEach((el) => {
          const on = isOn(el.dataset.id);
          el.classList.toggle('is-on', on);
          el.setAttribute('aria-checked', on ? 'true' : 'false');
          el.classList.toggle('is-disabled', multi && max > 0 && !on && sel.length >= max);
        });
      }
      (b.options || []).forEach((o) => {
        const media = o.image ? h('img', { src: SV.asset(o.image), alt: o.label || '', loading: 'lazy' }) : h('i', { class: 'ti ti-photo' });
        const card = h('button', { type: 'button', class: 'sv-imgchoice', role: multi ? 'checkbox' : 'radio', 'data-id': o.id, 'aria-label': o.label },
          h('span', { class: 'sv-imgchoice-media' }, media),
          b.showLabels !== false ? h('span', { class: 'sv-imgchoice-label' }, o.label) : null,
          h('span', { class: 'sv-imgchoice-check' }, h('i', { class: 'ti ti-check' })));
        card.addEventListener('click', () => {
          if (multi) {
            const k = sel.indexOf(o.id);
            if (k >= 0) sel.splice(k, 1);
            else {
              if (max > 0 && sel.length >= max) return;
              sel.push(o.id);
            }
            set(sel.slice());
          } else {
            sel = o.id;
            set(sel);
          }
          refresh();
        });
        grid.append(card);
      });
      refresh();
      const hint = multi ? (max > 0 ? `Puedes elegir hasta ${max}` : 'Puedes elegir varias opciones') : '';
      return h('div', null, grid, hint ? h('div', { class: 'sv-hint' }, hint) : null);
    },
    rating(b, st, set) {
      const emoji = b.icon === 'emoji';
      const max = emoji ? 5 : Math.min(10, Math.max(3, +b.max || 5));
      const faces = ['ti-mood-cry', 'ti-mood-sad', 'ti-mood-empty', 'ti-mood-smile', 'ti-mood-happy'];
      const icon = b.icon === 'heart' ? 'ti-heart-filled' : 'ti-star-filled';
      const wrap = h('div', { class: 'sv-rating' + (emoji ? ' is-emoji' : ' is-' + (b.icon || 'star')), role: 'radiogroup' });
      let val = +st.value || 0;
      const paint = (n) => wrap.querySelectorAll('.sv-rate').forEach((el, i) => {
        el.classList.toggle('is-on', emoji ? i + 1 === n : i < n);
      });
      for (let i = 1; i <= max; i++) {
        const btn = h('button', { type: 'button', class: 'sv-rate', role: 'radio', 'aria-label': `${i} de ${max}` }, h('i', { class: 'ti ' + (emoji ? faces[i - 1] : icon) }));
        btn.addEventListener('click', () => { val = i; paint(val); set(i); });
        btn.addEventListener('mouseenter', () => paint(i));
        wrap.append(btn);
      }
      wrap.addEventListener('mouseleave', () => paint(val));
      paint(val);
      return wrap;
    },
    scale(b, st, set) {
      const min = parseInt(b.min, 10) || 0;
      const max = Math.max(min + 1, Math.min(min + 10, parseInt(b.max, 10) || 5));
      return numberButtons(b, st, set, min, max, false);
    },
    nps: (b, st, set) => numberButtons(b, st, set, 0, 10, true),
    slider(b, st, set) {
      const min = +b.min || 0;
      const max = +b.max > min ? +b.max : min + 100;
      const step = +b.step > 0 ? +b.step : 1;
      const touched = st.value != null && st.value !== '';
      const r = h('input', { type: 'range', class: 'sv-range', min, max, step, value: touched ? st.value : (min + max) / 2 });
      const out = h('div', { class: 'sv-range-value' + (touched ? '' : ' is-empty') }, touched ? `${st.value}${b.unit ? ' ' + b.unit : ''}` : 'Mueve el control');
      const fill = () => r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
      r.addEventListener('input', () => {
        out.textContent = `${r.value}${b.unit ? ' ' + b.unit : ''}`;
        out.classList.remove('is-empty');
        fill();
        set(Number(r.value));
      });
      fill();
      return h('div', { class: 'sv-slider' }, out, r,
        h('div', { class: 'sv-scale-labels' }, h('span', null, `${min}${b.unit ? ' ' + b.unit : ''}`), h('span', null, `${max}${b.unit ? ' ' + b.unit : ''}`)));
    },
    ranking(b, st, set) {
      const byId = {};
      (b.options || []).forEach((o) => (byId[o.id] = o));
      let order = Array.isArray(st.value) ? st.value.filter((id) => byId[id]) : [];
      (b.options || []).forEach((o) => { if (!order.includes(o.id)) order.push(o.id); });
      const list = h('ol', { class: 'sv-ranking' + (Array.isArray(st.value) ? ' is-touched' : '') });
      function commit() {
        order = [...list.children].map((li) => li.dataset.id);
        list.classList.add('is-touched');
        renumber();
        set(order.slice());
      }
      function renumber() { [...list.children].forEach((li, i) => (li.querySelector('.sv-rank-pos').textContent = i + 1)); }
      function move(li, dir) {
        const sib = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
        if (!sib) return;
        dir < 0 ? list.insertBefore(li, sib) : list.insertBefore(sib, li);
        commit();
      }
      order.forEach((id) => {
        const li = h('li', { class: 'sv-rank', 'data-id': id },
          h('span', { class: 'sv-rank-handle' }, h('i', { class: 'ti ti-grip-vertical' })),
          h('span', { class: 'sv-rank-pos' }),
          h('span', { class: 'sv-rank-label' }, byId[id].label),
          h('span', { class: 'sv-rank-btns' },
            h('button', { type: 'button', 'aria-label': 'Subir', onclick: () => move(li, -1) }, h('i', { class: 'ti ti-chevron-up' })),
            h('button', { type: 'button', 'aria-label': 'Bajar', onclick: () => move(li, 1) }, h('i', { class: 'ti ti-chevron-down' }))));
        list.append(li);
      });
      renumber();
      if (window.Sortable) {
        window.Sortable.create(list, { handle: '.sv-rank-handle', animation: 180, ghostClass: 'is-ghost', onEnd: commit });
      }
      return h('div', null, list, h('div', { class: 'sv-hint' }, 'Arrastra o usa las flechas para ordenar'));
    },
    matrix(b, st, set) {
      const val = st.value && typeof st.value === 'object' && !Array.isArray(st.value) ? Object.assign({}, st.value) : {};
      const cols = b.columns || [];
      const table = h('table', { class: 'sv-matrix' },
        h('thead', null, h('tr', null, h('th', null), cols.map((c) => h('th', null, c.label)))),
        h('tbody', null, (b.rows || []).map((r) => h('tr', { 'data-row': r.id },
          h('th', { scope: 'row' }, r.label),
          cols.map((c) => {
            const btn = h('button', { type: 'button', class: 'sv-mx' + (val[r.id] === c.id ? ' is-on' : ''), 'aria-label': `${r.label}: ${c.label}` }, h('span', { class: 'sv-mx-dot' }), h('span', { class: 'sv-mx-label' }, c.label));
            btn.addEventListener('click', () => {
              val[r.id] = c.id;
              btn.closest('tr').querySelectorAll('.sv-mx').forEach((x) => x.classList.toggle('is-on', x === btn));
              set(Object.assign({}, val));
            });
            return h('td', { 'data-label': c.label }, btn);
          })))));
      return h('div', { class: 'sv-matrix-wrap' }, table);
    },
  };

  function numberButtons(b, st, set, min, max, nps) {
    const wrap = h('div', { class: 'sv-scale' + (nps ? ' is-nps' : ''), role: 'radiogroup' });
    for (let i = min; i <= max; i++) {
      const tone = nps ? (i <= 6 ? 'det' : i <= 8 ? 'pas' : 'pro') : '';
      const btn = h('button', { type: 'button', class: 'sv-num' + (tone ? ' tone-' + tone : '') + (+st.value === i && st.value !== null && st.value !== '' ? ' is-on' : ''), role: 'radio' }, String(i));
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.sv-num').forEach((x) => x.classList.toggle('is-on', x === btn));
        set(i);
      });
      wrap.append(btn);
    }
    return h('div', null, wrap, (b.minLabel || b.maxLabel) ? h('div', { class: 'sv-scale-labels' }, h('span', null, b.minLabel || ''), h('span', null, b.maxLabel || '')) : null);
  }

  /* ---------- render principal ---------- */
  /**
   * ctx: { mode: 'edit'|'live', number, state: {value, other}, onChange(value, other) }
   */
  SV.render = function (b, ctx) {
    ctx = ctx || {};
    const edit = ctx.mode === 'edit';
    if (!SV.isQuestion(b.type)) {
      const fn = content[b.type];
      const inner = fn ? fn(b, edit) : null;
      if (!inner) return h('div', { class: 'sv-block sv-c is-empty', 'data-id': b.id });
      return h('div', { class: `sv-block sv-c sv-c-${b.type}`, 'data-id': b.id }, inner);
    }
    const st = ctx.state || { value: null, other: '' };
    const set = (value, other) => {
      st.value = value;
      if (other !== undefined) st.other = other;
      if (ctx.onChange) ctx.onChange(st.value, st.other);
    };
    const body = (questions[b.type] || (() => h('div')))(b, st, set);
    return h('div', { class: `sv-block sv-q sv-q-${b.type}`, 'data-id': b.id },
      h('div', { class: 'sv-q-head' },
        ctx.number ? h('span', { class: 'sv-q-num' }, ctx.number) : null,
        h('div', { class: 'sv-q-titles' },
          h('h3', { class: 'sv-q-title', id: 'qt_' + b.id }, b.title || 'Pregunta sin título', b.required ? h('span', { class: 'sv-req', title: 'Obligatoria' }, ' *') : null),
          b.description ? h('p', { class: 'sv-q-desc', html: SV.fmt(b.description) }) : null)),
      h('div', { class: 'sv-q-body' }, body),
      h('div', { class: 'sv-q-error', role: 'alert' }));
  };

  /* ---------- validación ---------- */
  SV.isEmpty = (b, v) => v == null || v === '' || (Array.isArray(v) && !v.length) ||
    (b.type === 'matrix' && typeof v === 'object' && !Object.keys(v).length);

  SV.validate = function (b, st) {
    const v = st ? st.value : null;
    if (SV.isEmpty(b, v)) {
      if (!b.required) return '';
      return b.type === 'ranking' ? 'Ordena los elementos (arrastra o usa las flechas).' : 'Esta pregunta es obligatoria.';
    }
    switch (b.type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) return 'Introduce un email válido.';
        break;
      case 'number':
        if (isNaN(v)) return 'Introduce un número válido.';
        if (b.min !== '' && b.min != null && v < +b.min) return `El valor mínimo es ${b.min}.`;
        if (b.max !== '' && b.max != null && v > +b.max) return `El valor máximo es ${b.max}.`;
        break;
      case 'multiple_choice':
      case 'image_choice':
        if (Array.isArray(v) && +b.minSelect > 0 && v.length < +b.minSelect) return `Selecciona al menos ${b.minSelect} opciones.`;
        break;
      case 'matrix':
        if (b.required && (b.rows || []).some((r) => !v[r.id])) return 'Responde todas las filas.';
        break;
    }
    const hasOther = v === '__other__' || (Array.isArray(v) && v.includes('__other__'));
    if (hasOther && !String(st.other || '').trim()) return 'Especifica tu respuesta en «' + (b.otherLabel || 'Otro') + '».';
    return '';
  };
})();
