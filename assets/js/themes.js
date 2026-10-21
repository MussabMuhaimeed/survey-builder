/* Componentes de temas: miniaturas y formulario de edición (editor + página de temas) */
(function () {
  'use strict';
  const h = SV.h;

  /* ---------- utilidades de color ---------- */
  const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = toRgb(a), B = toRgb(b); return toHex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
  const contrast = (a, b) => { const la = SV.luminance(a), lb = SV.luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  SV.colorMix = mix;
  SV.contrast = contrast;

  /** Genera una paleta completa a partir del color principal */
  SV.autoPalette = function (accent, dark) {
    if (dark) {
      return { bg: mix(accent, '#0b0d12', 0.9), bg2: mix(accent, '#140d22', 0.78), card: mix(accent, '#151821', 0.92), text: '#eef0f5', muted: '#9ba1b3', border: mix(accent, '#2a2f3d', 0.85), input: mix(accent, '#1b1f2a', 0.93) };
    }
    return { bg: mix(accent, '#f7f7fa', 0.9), bg2: mix(accent, '#fff4f8', 0.82), card: '#ffffff', text: '#16171d', muted: '#6a6e7d', border: mix(accent, '#e5e5ec', 0.88), input: '#ffffff' };
  };

  /* ---------- miniatura ---------- */
  SV.themeThumb = function (t) {
    t = Object.assign({}, SV.themeDefaults, t);
    const bg = t.bgStyle === 'gradient' ? `linear-gradient(150deg, ${t.bg}, ${t.bg2})`
      : t.bgStyle === 'image' && t.bgImage ? `linear-gradient(rgba(10,12,20,${t.overlay / 100}),rgba(10,12,20,${t.overlay / 100})), url("${SV.asset(t.bgImage)}") center/cover` : t.bg;
    const r = Math.min(10, t.radius / 2.2) + 'px';
    return h('div', { class: 'theme-thumb', style: { background: bg, fontFamily: `'${t.font}', sans-serif` } },
      h('div', { class: 'theme-thumb-card', style: { background: t.card, borderRadius: r, opacity: 1, boxShadow: t.shadow ? '0 6px 16px -8px rgba(0,0,0,.35)' : `0 0 0 1px ${t.border}` } },
        h('div', { class: 'tt-title', style: { color: t.text } }, 'Aa'),
        h('div', { class: 'tt-line', style: { background: t.muted } }),
        h('div', { class: 'tt-opt', style: { borderColor: t.border, background: t.input, borderRadius: r } }, h('i', { style: { background: t.accent } })),
        h('div', { class: 'tt-opt', style: { borderColor: t.border, background: t.input, borderRadius: r } }, h('i', { style: { background: t.border } })),
        h('div', { class: 'tt-btn', style: { background: t.accent, borderRadius: r } })));
  };

  /* ---------- formulario ---------- */
  /**
   * theme: objeto de configuración (se modifica in situ)
   * onChange(): se llama tras cada cambio
   */
  SV.themeForm = function (theme, onChange) {
    const root = h('div', { class: 'theme-form' });
    const fonts = SV.fonts;
    const changed = (rerender) => { onChange && onChange(); if (rerender) paint(); else checkContrast(); };

    const field = (label, control, hint) => h('div', { class: 'field' }, label ? h('span', null, label) : null, control, hint ? h('small', { class: 'hint' }, hint) : null);

    function color(key, label) {
      const pick = h('input', { type: 'color' });
      const txt = h('input', { type: 'text', class: 'color-hex', maxlength: 7 });
      pick.value = txt.value = theme[key];
      pick.addEventListener('input', () => { theme[key] = txt.value = pick.value; changed(); });
      txt.addEventListener('change', () => {
        const v = txt.value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(v)) { theme[key] = pick.value = v; changed(); } else txt.value = theme[key];
      });
      return h('label', { class: 'color-cell' }, pick, h('span', { class: 'color-cell-text' }, h('small', null, label), txt));
    }
    function seg(key, choices) {
      const w = h('div', { class: 'seg seg-block' });
      choices.forEach(([v, l, icon]) => {
        const b = h('button', { type: 'button', class: String(theme[key]) === String(v) ? 'active' : '' }, icon ? h('i', { class: 'ti ' + icon }) : null, h('span', null, l));
        b.addEventListener('click', () => { theme[key] = v; changed(true); });
        w.append(b);
      });
      return w;
    }
    function range(key, min, max, unit) {
      const r = h('input', { type: 'range', min, max, value: theme[key], class: 'range' });
      const out = h('output', null, theme[key] + unit);
      r.addEventListener('input', () => { theme[key] = +r.value; out.textContent = r.value + unit; changed(); });
      return h('div', { class: 'range-row' }, r, out);
    }
    function toggle(key, label, hint) {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = !!theme[key];
      cb.addEventListener('change', () => { theme[key] = cb.checked; changed(); });
      return h('label', { class: 'toggle-row' }, h('span', { class: 'toggle-text' }, h('strong', null, label), hint ? h('small', null, hint) : null), h('span', { class: 'switch' }, cb, h('span', { class: 'slider' })));
    }

    const warn = h('div', { class: 'alert alert-warn hidden' });
    function checkContrast() {
      const issues = [];
      if (contrast(theme.text, theme.card) < 4.5) issues.push('el texto sobre la tarjeta');
      if (contrast(theme.muted, theme.card) < 3) issues.push('el texto secundario');
      if (contrast(theme.accent, theme.card) < 2.2) issues.push('el color principal sobre la tarjeta');
      warn.classList.toggle('hidden', !issues.length);
      warn.innerHTML = '<i class="ti ti-contrast-2"></i><span></span>';
      warn.querySelector('span').textContent = 'Contraste bajo en ' + issues.join(', ') + '. Puede costar leerlo.';
    }

    function paint() {
      root.innerHTML = '';
      const name = h('input', { type: 'text', maxlength: 120, placeholder: 'Mi tema' });
      name.value = theme.name || '';
      name.addEventListener('input', () => { theme.name = name.value; onChange && onChange(); });

      const auto = (dark) => {
        Object.assign(theme, SV.autoPalette(theme.accent, dark));
        changed(true);
      };

      const fontSel = h('select', null, fonts.map((f) => h('option', { value: f, style: { fontFamily: f } }, f)));
      fontSel.value = theme.font;
      fontSel.addEventListener('change', () => { theme.font = fontSel.value; SV.loadFont(theme.font); changed(); });

      const imgPrev = h('div', { class: 'img-field-preview' }, theme.bgImage ? h('img', { src: SV.asset(theme.bgImage), alt: '' }) : h('i', { class: 'ti ti-photo' }));
      const up = h('button', { type: 'button', class: 'btn btn-soft btn-sm' }, h('i', { class: 'ti ti-upload' }), 'Subir imagen');
      up.addEventListener('click', async () => {
        const f = await App.pickFile('image/*');
        if (!f) return;
        try { theme.bgImage = await App.upload(f); changed(true); } catch (e) { /* toast */ }
      });

      root.append(...[
        field('Nombre del tema', name),
        h('div', { class: 'panel-section-title' }, 'Colores'),
        h('div', { class: 'color-grid' },
          color('accent', 'Principal'), color('bg', theme.bgStyle === 'gradient' ? 'Fondo (inicio)' : 'Fondo'),
          theme.bgStyle === 'gradient' ? color('bg2', 'Fondo (fin)') : null,
          color('card', 'Tarjeta'), color('text', 'Texto'), color('muted', 'Texto secundario'),
          color('border', 'Bordes'), color('input', 'Campos')),
        h('div', { class: 'auto-row' },
          h('span', { class: 'muted small' }, h('i', { class: 'ti ti-wand' }), ' Generar desde el color principal:'),
          h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => auto(false) }, h('i', { class: 'ti ti-sun' }), 'Claro'),
          h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => auto(true) }, h('i', { class: 'ti ti-moon' }), 'Oscuro')),
        warn,
        h('div', { class: 'panel-section-title' }, 'Fondo'),
        field(null, seg('bgStyle', [['solid', 'Sólido', 'ti-square-filled'], ['gradient', 'Degradado', 'ti-color-swatch'], ['image', 'Imagen', 'ti-photo']])),
        theme.bgStyle === 'image' ? h('div', null,
          field('Imagen de fondo', h('div', { class: 'img-field' }, imgPrev, h('div', { class: 'img-field-side' }, h('div', { class: 'img-field-btns' }, up)))),
          field('Oscurecer imagen', range('overlay', 0, 85, '%'))) : null,
        field('Opacidad de la tarjeta', range('cardOpacity', 50, 100, '%'), 'Por debajo de 100% se aplica un efecto cristal sobre el fondo.'),
        h('div', { class: 'panel-section-title' }, 'Forma y tipografía'),
        field('Tipografía', h('div', { class: 'select-wrap' }, fontSel)),
        field('Redondeo de esquinas', range('radius', 0, 36, 'px')),
        toggle('shadow', 'Sombra en la tarjeta', 'Si la desactivas se dibuja un borde fino'),
      ].filter(Boolean));
      checkContrast();
    }
    paint();
    return root;
  };

  /* ---------- vista previa de muestra ---------- */
  SV.themeSample = function () {
    const blocks = [
      Object.assign(SV.newBlock('heading'), { text: 'Vista previa del tema' }),
      Object.assign(SV.newBlock('single_choice'), { title: '¿Cómo nos conociste?', required: true, options: [SV.opt('Redes sociales'), SV.opt('Un amigo'), SV.opt('Buscador')] }),
      Object.assign(SV.newBlock('rating'), { title: 'Valora tu experiencia' }),
      Object.assign(SV.newBlock('short_text'), { title: 'Tu nombre' }),
    ];
    const states = { [blocks[1].id]: { value: blocks[1].options[0].id, other: '' }, [blocks[2].id]: { value: 4, other: '' } };
    let n = 0;
    return h('div', { class: 'sv-shell' },
      h('section', { class: 'sv-card is-step' },
        h('div', { class: 'sv-step-head' }, h('span', { class: 'sv-step-count' }, 'Paso 1 de 2'), h('span', { class: 'sv-step-title' }, 'Sobre ti')),
        h('div', { class: 'sv-blocks' }, blocks.map((b) => SV.render(b, { mode: 'live', number: SV.isQuestion(b.type) ? ++n : null, state: states[b.id] || { value: null, other: '' } }))),
        h('div', { class: 'sv-actions' }, h('span', { class: 'sv-btn sv-btn-ghost' }, h('i', { class: 'ti ti-arrow-left' }), 'Atrás'), h('span', { class: 'sv-btn sv-btn-primary' }, 'Siguiente', h('i', { class: 'ti ti-arrow-right' })))));
  };
})();
