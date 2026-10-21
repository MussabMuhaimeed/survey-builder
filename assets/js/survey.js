/* Public survey runner (bilingual) */
(function () {
  'use strict';
  const S = window.SURVEY;
  const h = SV.h;
  const root = document.getElementById('sv');
  const card = document.getElementById('sv-card');
  const header = document.getElementById('sv-header');
  const progress = root.querySelector('.sv-progress');
  const bar = root.querySelector('.sv-progress-bar');

  const def = S.def || {};
  const st = def.settings || {};
  const steps = (def.steps || []).filter((s) => (s.blocks || []).length);
  const KEY_DRAFT = 'svy_draft_' + S.uid;
  const KEY_DONE = 'svy_done_' + S.uid;
  const KEY_LANG = 'svy_lang';

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } },
  };

  /* ---------- language ---------- */
  const L = S.langs || { primary: 'es', langs: ['es'], initial: 'es' };
  let lang = L.initial;
  if (L.langs.length > 1 && !S.forcedLang) {
    const saved = store.get(KEY_LANG);
    if (L.langs.includes(saved)) lang = saved;
  }
  const loc = (obj, kind) => SV.localize(obj, kind, lang, L.primary);
  function applyLang() {
    SV.lang = lang;
    document.documentElement.lang = lang;
    const w = loc(def.welcome || {}, 'welcome');
    document.title = w.title || S.titles[lang] || S.title;
    header.querySelectorAll('.sv-lang button').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.lang === lang);
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    });
  }

  SV.applyTheme(root, S.theme);
  if (st.logo) header.append(h('img', { class: 'sv-logo', src: SV.asset(st.logo), alt: '' }));
  if (L.langs.length > 1) {
    header.append(h('div', { class: 'sv-lang', role: 'group', 'aria-label': 'Language / Idioma' },
      L.langs.map((l) => h('button', { type: 'button', 'data-lang': l, title: SV.LANGS[l].name, onclick: () => setLang(l) }, SV.LANGS[l].short))));
    header.classList.add('has-lang');
  }
  applyLang();

  function setLang(l) {
    if (l === lang) return;
    lang = l;
    store.set(KEY_LANG, l);
    applyLang();
    render();
  }

  // Global question numbering
  const numbers = {};
  let qn = 0;
  steps.forEach((s) => s.blocks.forEach((b) => { if (SV.isQuestion(b.type)) numbers[b.id] = ++qn; }));

  let answers = {};
  let screen = 'welcome'; // 'welcome' | step index | 'thanks' | { kind, msg }
  const startedAt = Date.now();
  let started = false;

  const msgFor = (kind) => (S.messages && S.messages[kind] && (S.messages[kind][lang] || S.messages[kind][L.primary])) || '';

  if (S.state === 'open' && !S.preview) {
    if (st.onePerBrowser && store.get(KEY_DONE)) {
      screen = { kind: 'done' };
      return render();
    }
    const draft = store.get(KEY_DRAFT);
    if (draft && typeof draft === 'object') answers = draft.answers || {};
  }

  if (S.state !== 'open') screen = { kind: S.state };
  else if (!steps.length) screen = { kind: 'closed', text: 'noQuestions' };
  else screen = (def.welcome || {}).enabled !== false ? 'welcome' : 0;
  render();

  /* ---------- screens ---------- */

  function render(animate) {
    if (screen === 'welcome') return showWelcome();
    if (screen === 'thanks') return showThanks(false);
    if (typeof screen === 'number') return showStep(screen, animate);
    return showMessage(screen.kind, screen.text ? SV.t(screen.text) : msgFor(screen.kind));
  }

  function swap(nodes, cls, animate) {
    card.className = 'sv-card ' + (cls || '');
    card.replaceChildren(...[].concat(nodes).filter(Boolean));
    if (animate === false) return;
    card.classList.remove('sv-enter');
    void card.offsetWidth;
    card.classList.add('sv-enter');
  }

  function setProgress(p) {
    if (!st.showProgress) return;
    progress.hidden = false;
    bar.style.width = Math.max(0, Math.min(100, p)) + '%';
  }

  function showWelcome() {
    const w = loc(def.welcome || {}, 'welcome');
    setProgress(0);
    const mins = Math.max(1, Math.round(qn * 0.3));
    swap([
      w.image ? h('img', { class: 'sv-hero', src: SV.asset(w.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, w.title || S.titles[lang] || S.title),
      w.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(w.text) }) : null,
      h('div', { class: 'sv-meta' },
        h('span', null, h('i', { class: 'ti ti-list-check' }), ' ' + SV.t(qn === 1 ? 'question1' : 'questionN', { n: qn })),
        h('span', null, h('i', { class: 'ti ti-clock' }), ' ' + SV.t('minutes', { n: mins })),
        st.onePerBrowser ? h('span', null, h('i', { class: 'ti ti-shield-check' }), ' ' + SV.t('onePerPerson')) : null),
      h('div', { class: 'sv-actions center' },
        h('button', { class: 'sv-btn sv-btn-primary sv-btn-lg', type: 'button', onclick: () => go(0) }, w.button || SV.t('start'), h('i', { class: 'ti ti-arrow-right' }))),
    ], 'is-welcome');
  }

  function go(i) {
    if (!started) { started = true; trackStart(); }
    screen = i;
    showStep(i, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStep(i, animate) {
    const step = loc(steps[i], 'step');
    setProgress((i / steps.length) * 100 + 4);
    const nodes = [];
    if (steps.length > 1) {
      nodes.push(h('div', { class: 'sv-step-head' },
        h('span', { class: 'sv-step-count' }, SV.t('stepOf', { n: i + 1, total: steps.length })),
        step.title ? h('span', { class: 'sv-step-title' }, step.title) : null));
    }
    const list = h('div', { class: 'sv-blocks' });
    steps[i].blocks.forEach((raw) => {
      const b = loc(raw, 'block');
      if (SV.isQuestion(b.type)) {
        answers[b.id] = answers[b.id] || { value: null, other: '' };
        const el = SV.render(b, {
          mode: 'live',
          number: st.showNumbers !== false ? numbers[b.id] : null,
          state: answers[b.id],
          onChange: () => {
            el.classList.remove('has-error');
            el.querySelector('.sv-q-error').textContent = '';
            saveDraft();
          },
        });
        list.append(el);
      } else {
        list.append(SV.render(b, { mode: 'live' }));
      }
    });
    nodes.push(list);

    const last = i === steps.length - 1;
    const back = (st.allowBack !== false) && (i > 0 || (def.welcome || {}).enabled !== false)
      ? h('button', { class: 'sv-btn sv-btn-ghost', type: 'button', onclick: () => (i > 0 ? go(i - 1) : ((screen = 'welcome'), showWelcome())) }, h('i', { class: 'ti ti-arrow-left' }), SV.t('back'))
      : h('span');
    const next = h('button', { class: 'sv-btn sv-btn-primary', type: 'button' },
      SV.t(last ? 'submit' : 'next'), h('i', { class: 'ti ' + (last ? 'ti-send' : 'ti-arrow-right') }));
    next.addEventListener('click', () => {
      if (!validateStep(steps[i])) return;
      if (last) submit(next);
      else go(i + 1);
    });
    nodes.push(h('div', { class: 'sv-err-global', role: 'alert' }));
    nodes.push(h('div', { class: 'sv-actions' }, back, next));
    swap(nodes, 'is-step', animate);

    card.querySelectorAll('input:not([type=range]):not([type=date])').forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); next.click(); }
      });
    });
  }

  function validateStep(step) {
    let first = null;
    step.blocks.forEach((raw) => {
      if (!SV.isQuestion(raw.type)) return;
      const b = loc(raw, 'block');
      const el = card.querySelector(`.sv-q[data-id="${b.id}"]`);
      const msg = SV.validate(b, answers[b.id]);
      el.classList.toggle('has-error', !!msg);
      el.querySelector('.sv-q-error').textContent = msg;
      if (msg && !first) first = el;
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.classList.remove('shake');
      void first.offsetWidth;
      first.classList.add('shake');
      return false;
    }
    return true;
  }

  function saveDraft() {
    if (!S.preview) store.set(KEY_DRAFT, { answers, t: Date.now() });
  }

  function trackStart() {
    if (S.preview) return;
    try {
      if (sessionStorage.getItem('svy_started_' + S.uid)) return;
      sessionStorage.setItem('svy_started_' + S.uid, '1');
    } catch (e) { /* noop */ }
    const fd = new FormData();
    fd.append('uid', S.uid);
    if (navigator.sendBeacon) navigator.sendBeacon(S.submit + '?action=start', fd);
    else fetch(S.submit + '?action=start', { method: 'POST', body: fd, keepalive: true });
  }

  async function submit(btn) {
    const errBox = card.querySelector('.sv-err-global');
    errBox.textContent = '';
    if (S.preview) return showThanks(true);
    btn.disabled = true;
    btn.classList.add('is-loading');
    const payload = { uid: S.uid, lang, answers: {}, others: {}, duration: Math.round((Date.now() - startedAt) / 1000), website: '' };
    steps.forEach((s) => s.blocks.forEach((b) => {
      if (!SV.isQuestion(b.type)) return;
      const a = answers[b.id];
      if (!a || SV.isEmpty(b, a.value)) return;
      payload.answers[b.id] = a.value;
      const hasOther = a.value === '__other__' || (Array.isArray(a.value) && a.value.includes('__other__'));
      if (hasOther && a.other) payload.others[b.id] = a.other;
    }));
    try {
      const res = await fetch(S.submit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (st.onePerBrowser) store.set(KEY_DONE, Date.now());
        store.del(KEY_DRAFT);
        return showThanks(true);
      }
      if (res.status === 409) {
        store.set(KEY_DONE, Date.now());
        screen = { kind: 'done' };
        return render();
      }
      if (data.field) {
        const el = card.querySelector(`.sv-q[data-id="${data.field}"]`);
        if (el) {
          el.classList.add('has-error');
          el.querySelector('.sv-q-error').textContent = data.error;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      errBox.textContent = data.error || SV.t('sendError');
    } catch (e) {
      errBox.textContent = SV.t('netError');
    }
    btn.disabled = false;
    btn.classList.remove('is-loading');
  }

  function showThanks(celebrate) {
    screen = 'thanks';
    setProgress(100);
    const t = loc(def.thanks || {}, 'thanks');
    const url = /^https?:\/\//i.test(t.url || '') ? t.url : '';
    swap([
      h('div', { class: 'sv-done-anim' }, h('svg', { viewBox: '0 0 52 52', html: '<circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-15"/>' })),
      t.image ? h('img', { class: 'sv-hero', src: SV.asset(t.image), alt: '' }) : null,
      h('h1', { class: 'sv-welcome-title' }, t.title || SV.t('thanks')),
      t.text ? h('div', { class: 'sv-welcome-text', html: SV.fmt(t.text) }) : null,
      url && t.button ? h('div', { class: 'sv-actions center' }, h('a', { class: 'sv-btn sv-btn-primary', href: url }, t.button, h('i', { class: 'ti ti-external-link' }))) : null,
      S.preview ? h('div', { class: 'sv-actions center' }, h('button', { class: 'sv-btn sv-btn-ghost', type: 'button', onclick: () => location.reload() }, h('i', { class: 'ti ti-refresh' }), SV.t('restart'))) : null,
    ], 'is-thanks', celebrate);
    if (!celebrate) return;
    confetti();
    if (url && !t.button && !S.preview) setTimeout(() => (location.href = url), 3500);
  }

  function showMessage(kind, msg) {
    if (progress) progress.hidden = true;
    const icons = { done: 'ti-circle-check', closed: 'ti-lock', missing: 'ti-mood-confuzed' };
    const titles = { done: 'doneTitle', closed: 'closedTitle', missing: 'missingTitle' };
    swap([
      h('div', { class: 'sv-msg-icon is-' + kind }, h('i', { class: 'ti ' + (icons[kind] || 'ti-info-circle') })),
      h('h1', { class: 'sv-welcome-title' }, titles[kind] ? SV.t(titles[kind]) : ''),
      h('p', { class: 'sv-welcome-text' }, msg || ''),
    ], 'is-message');
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = h('div', { class: 'sv-confetti', 'aria-hidden': 'true' });
    const colors = [(S.theme && S.theme.accent) || '#6d5efc', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];
    for (let i = 0; i < 70; i++) {
      layer.append(h('i', {
        style: {
          left: Math.random() * 100 + '%',
          background: colors[i % colors.length],
          animationDelay: Math.random() * 0.6 + 's',
          animationDuration: 1.8 + Math.random() * 1.4 + 's',
          transform: `rotate(${Math.random() * 360}deg)`,
        },
      }));
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 3800);
  }
})();
