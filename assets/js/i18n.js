/* i18n: admin panel translation (_t), participant strings (SV.t) and bilingual content helpers */
(function () {
  'use strict';
  const SV = (window.SV = window.SV || {});
  const APP = window.APP || {};

  /* ---------- Admin panel: Spanish source strings are the keys ---------- */
  SV.adminLang = APP.lang === 'en' ? 'en' : 'es';
  const DICT = window.I18N_EN || {};
  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);
  window._t = function (s, vars) {
    const r = SV.adminLang === 'en' && DICT[s] ? DICT[s] : s;
    return fill(r, vars);
  };

  /* ---------- Survey languages ---------- */
  SV.LANGS = {
    es: { name: 'Español', short: 'ES', locale: 'es-ES' },
    en: { name: 'English', short: 'EN', locale: 'en-GB' },
  };
  SV.lang = 'es'; // language the participant-facing UI is rendered in

  /* ---------- Participant-facing strings ---------- */
  SV.P = {
    es: {
      start: 'Comenzar', next: 'Siguiente', back: 'Atrás', submit: 'Enviar',
      stepOf: 'Paso {n} de {total}', question1: '{n} pregunta', questionN: '{n} preguntas', minutes: '~{n} min',
      onePerPerson: 'Una respuesta por persona', required: 'Esta pregunta es obligatoria.',
      rankingRequired: 'Ordena los elementos (arrastra o usa las flechas).', email: 'Introduce un email válido.',
      number: 'Introduce un número válido.', min: 'El valor mínimo es {n}.', max: 'El valor máximo es {n}.',
      minSelect: 'Selecciona al menos {n} opciones.', matrixAll: 'Responde todas las filas.',
      otherSpecify: 'Especifica tu respuesta en «{label}».', otherPh: 'Especifica tu respuesta…', other: 'Otro',
      upTo: 'Puedes elegir hasta {n}', multi: 'Puedes elegir varias opciones', select: 'Selecciona…',
      yes: 'Sí', no: 'No', slider: 'Mueve el control', rankHint: 'Arrastra o usa las flechas para ordenar',
      up: 'Subir', down: 'Bajar', ofMax: '{i} de {max}', untitled: 'Pregunta sin título', requiredMark: 'Obligatoria',
      thanks: '¡Gracias!', restart: 'Reiniciar vista previa', sendError: 'No se pudo enviar. Inténtalo de nuevo.',
      netError: 'Error de conexión. Comprueba tu red e inténtalo de nuevo.', doneTitle: '¡Ya participaste!',
      closedTitle: 'Encuesta no disponible', missingTitle: 'Encuesta no encontrada',
      noQuestions: 'Esta encuesta todavía no tiene preguntas.', language: 'Idioma', video: 'Vídeo',
    },
    en: {
      start: 'Start', next: 'Next', back: 'Back', submit: 'Submit',
      stepOf: 'Step {n} of {total}', question1: '{n} question', questionN: '{n} questions', minutes: '~{n} min',
      onePerPerson: 'One response per person', required: 'This question is required.',
      rankingRequired: 'Please sort the items (drag or use the arrows).', email: 'Please enter a valid email address.',
      number: 'Please enter a valid number.', min: 'The minimum value is {n}.', max: 'The maximum value is {n}.',
      minSelect: 'Please select at least {n} options.', matrixAll: 'Please answer every row.',
      otherSpecify: 'Please specify your answer in “{label}”.', otherPh: 'Please specify…', other: 'Other',
      upTo: 'You can choose up to {n}', multi: 'You can choose several options', select: 'Select…',
      yes: 'Yes', no: 'No', slider: 'Move the slider', rankHint: 'Drag or use the arrows to sort',
      up: 'Move up', down: 'Move down', ofMax: '{i} of {max}', untitled: 'Untitled question', requiredMark: 'Required',
      thanks: 'Thank you!', restart: 'Restart preview', sendError: 'Your answers could not be sent. Please try again.',
      netError: 'Connection error. Check your network and try again.', doneTitle: 'You have already taken part!',
      closedTitle: 'Survey not available', missingTitle: 'Survey not found',
      noQuestions: 'This survey has no questions yet.', language: 'Language', video: 'Video',
    },
  };
  SV.t = function (key, vars) {
    const d = SV.P[SV.lang] || SV.P.es;
    return fill(d[key] != null ? d[key] : SV.P.es[key] != null ? SV.P.es[key] : key, vars);
  };

  /* ---------- Translatable content ---------- */
  const Q = ['title', 'description'];
  SV.trFields = {
    heading: ['text'], paragraph: ['text'], image: ['alt', 'caption'], video: ['caption'], logos: ['title'],
    short_text: ['placeholder'], long_text: ['placeholder'], email: ['placeholder'], number: ['placeholder'],
    single_choice: ['otherLabel'], multiple_choice: ['otherLabel'], dropdown: ['placeholder'],
    yes_no: ['yesLabel', 'noLabel'], scale: ['minLabel', 'maxLabel'], nps: ['minLabel', 'maxLabel'], slider: ['unit'],
    _step: ['title'], _welcome: ['title', 'text', 'button'], _thanks: ['title', 'text', 'button'],
    _settings: ['closedMessage', 'doneMessage', 'description'],
  };
  SV.trLists = { options: ['label'], rows: ['label'], columns: ['label'], items: ['alt'] };
  // Fields whose untouched default value is a UI word: they translate automatically
  const AUTO = { block: { otherLabel: 'other', yesLabel: 'yes', noLabel: 'no', placeholder: 'select' }, welcome: { button: 'start' } };

  SV.fieldsFor = function (kind, obj) {
    if (kind === 'block') {
      const isQ = window.SV.isQuestion ? SV.isQuestion(obj.type) : false;
      return (isQ ? Q : []).concat(SV.trFields[obj.type] || []).filter((f) => f !== 'otherLabel' || obj.allowOther);
    }
    return SV.trFields['_' + kind] || [];
  };

  const filled = (v) => typeof v === 'string' && v.trim() !== '';
  const isAuto = (kind, f, obj, primary) => {
    const k = AUTO[kind] && AUTO[kind][f];
    return !!k && (obj[f] === SV.P[primary][k] || !filled(obj[f]));
  };

  /** True when a field still holds an untouched UI default ("Other", "Yes"…) that translates itself */
  SV.isAutoField = (kind, f, obj, primary) => isAuto(kind, f, obj, primary);

  /** Returns a copy of obj with its texts in `lang` (falls back to the primary language) */
  SV.localize = function (obj, kind, lang, primary) {
    if (!obj || !lang || lang === primary) return obj;
    const out = Object.assign({}, obj);
    const tr = (obj.tr && obj.tr[lang]) || {};
    SV.fieldsFor(kind, obj).forEach((f) => {
      if (filled(tr[f])) out[f] = tr[f];
      else if (isAuto(kind, f, obj, primary)) out[f] = SV.P[lang][AUTO[kind][f]];
    });
    if (kind === 'block') {
      Object.keys(SV.trLists).forEach((k) => {
        if (!Array.isArray(obj[k])) return;
        out[k] = obj[k].map((it) => {
          const o = Object.assign({}, it);
          const t = (it.tr && it.tr[lang]) || {};
          SV.trLists[k].forEach((f) => { if (filled(t[f])) o[f] = t[f]; });
          return o;
        });
      });
    }
    return out;
  };

  /** Lists every text that still needs a translation into `lang` */
  SV.trPending = function (def, lang, primary) {
    const out = { count: 0, blocks: {}, steps: {}, welcome: 0, thanks: 0, settings: 0 };
    if (!lang || lang === primary) return out;
    const check = (obj, kind) => {
      let n = 0;
      const tr = (obj.tr && obj.tr[lang]) || {};
      SV.fieldsFor(kind, obj).forEach((f) => {
        if (filled(obj[f]) && !filled(tr[f]) && !isAuto(kind, f, obj, primary)) n++;
      });
      if (kind === 'block') {
        Object.keys(SV.trLists).forEach((k) => (Array.isArray(obj[k]) ? obj[k] : []).forEach((it) => {
          const t = (it.tr && it.tr[lang]) || {};
          SV.trLists[k].forEach((f) => { if (filled(it[f]) && !filled(t[f])) n++; });
        }));
      }
      return n;
    };
    if (def.welcome && def.welcome.enabled !== false) out.welcome = check(def.welcome, 'welcome');
    out.thanks = check(def.thanks || {}, 'thanks');
    out.settings = check(def.settings || {}, 'settings');
    out.count = out.welcome + out.thanks + out.settings;
    (def.steps || []).forEach((s) => {
      let n = check(s, 'step');
      (s.blocks || []).forEach((b) => {
        const m = check(b, 'block');
        if (m) out.blocks[b.id] = m;
        n += m;
      });
      out.steps[s.id] = n;
      out.count += n;
    });
    return out;
  };

  /** Calls cb(obj, kind, stepIndex) for every object that holds translatable texts */
  SV.eachTranslatable = function (def, cb) {
    if (def.welcome) cb(def.welcome, 'welcome', null);
    (def.steps || []).forEach((s, i) => {
      cb(s, 'step', i);
      (s.blocks || []).forEach((b) => cb(b, 'block', i));
    });
    if (def.thanks) cb(def.thanks, 'thanks', null);
    if (def.settings) cb(def.settings, 'settings', null);
  };

  /** Makes `to` the primary language: translated texts move to the base and the old base becomes the translation */
  SV.swapPrimary = function (def, from, to) {
    const swapObj = (obj, fields) => {
      obj.tr = obj.tr || {};
      const tTo = obj.tr[to] || {};
      const tFrom = (obj.tr[from] = obj.tr[from] || {});
      fields.forEach((f) => {
        const base = obj[f];
        if (filled(tTo[f])) obj[f] = tTo[f];
        if (filled(base)) tFrom[f] = base;
      });
      delete obj.tr[to];
      if (!Object.keys(tFrom).length) delete obj.tr[from];
      if (!Object.keys(obj.tr).length) delete obj.tr;
    };
    SV.eachTranslatable(def, (obj, kind) => {
      const fields = SV.fieldsFor(kind, obj);
      // Untouched UI defaults ("Other", "Yes"…) simply switch language
      const autos = AUTO[kind] || {};
      fields.forEach((f) => {
        if (autos[f] && obj[f] === SV.P[from][autos[f]] && !(obj.tr && obj.tr[to] && filled(obj.tr[to][f]))) {
          obj.tr = obj.tr || {};
          obj.tr[to] = obj.tr[to] || {};
          obj.tr[to][f] = SV.P[to][autos[f]];
        }
      });
      swapObj(obj, fields);
      if (kind === 'block') Object.keys(SV.trLists).forEach((k) => (Array.isArray(obj[k]) ? obj[k] : []).forEach((it) => swapObj(it, SV.trLists[k])));
    });
    def.settings.lang = to;
    const langs = (def.settings.languages || []).filter((l) => l !== to);
    def.settings.languages = [to].concat(langs.length ? langs : [from]);
  };

  /** Survey language configuration */
  SV.surveyLangs = function (def) {
    const st = (def && def.settings) || {};
    const primary = st.lang === 'en' ? 'en' : 'es';
    const langs = Array.isArray(st.languages) && st.languages.length ? st.languages.filter((l) => SV.LANGS[l]) : [primary];
    if (!langs.includes(primary)) langs.unshift(primary);
    return { primary, langs, bilingual: langs.length > 1, secondary: langs.find((l) => l !== primary) || null };
  };
})();
