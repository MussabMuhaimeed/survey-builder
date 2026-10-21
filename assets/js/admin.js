/* Utilidades comunes del panel de administración */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const cfg = window.APP || {};

  App.url = (p) => cfg.base + '/' + String(p).replace(/^\//, '');

  App.api = async function (action, data, opts) {
    opts = opts || {};
    const isForm = data instanceof FormData;
    const res = await fetch(App.url('admin/api.php?action=' + encodeURIComponent(action)), {
      method: 'POST',
      credentials: 'same-origin',
      headers: Object.assign({ 'X-CSRF-Token': cfg.csrf }, isForm ? {} : { 'Content-Type': 'application/json' }),
      body: isForm ? data : JSON.stringify(data || {}),
      keepalive: !!opts.keepalive,
    });
    let json = {};
    try { json = await res.json(); } catch (e) { json = { ok: false, error: 'Respuesta inesperada del servidor (' + res.status + ')' }; }
    if (!res.ok || !json.ok) {
      const err = new Error(json.error || 'Error ' + res.status);
      err.status = res.status;
      throw err;
    }
    return json;
  };

  App.upload = async function (file) {
    const fd = new FormData();
    fd.append('file', file);
    const t = App.toast('Subiendo ' + file.name + '…', 'info', 0);
    try {
      const r = await App.api('upload', fd);
      t.remove();
      return r.url;
    } catch (e) {
      t.remove();
      App.toast(e.message, 'error');
      throw e;
    }
  };

  App.pickFile = function (accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || 'image/*';
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  };

  /* ---------- toasts ---------- */
  App.toast = function (msg, type, ms) {
    const root = document.getElementById('toast-root') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast-root', className: 'toast-root' }));
    const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'success');
    el.innerHTML = `<i class="ti ${icons[type || 'success'] || icons.info}"></i><span></span>`;
    el.querySelector('span').textContent = msg;
    root.append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    if (ms !== 0) setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms || 3200);
    return el;
  };

  /* ---------- modales ---------- */
  App.openModal = function (id) {
    const m = typeof id === 'string' ? document.getElementById(id) : id;
    if (!m) return;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    const f = m.querySelector('input:not([readonly]), textarea, select');
    if (f) setTimeout(() => f.focus(), 60);
  };
  App.closeModal = function (m) {
    m = typeof m === 'string' ? document.getElementById(m) : m;
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  };

  App.confirm = function (opts) {
    return new Promise((resolve) => {
      const m = document.createElement('div');
      m.className = 'modal open';
      m.innerHTML = `<div class="modal-backdrop"></div><div class="modal-dialog modal-sm">
        <div class="modal-body center"><div class="confirm-icon ${opts.danger ? 'danger' : ''}"><i class="ti ${opts.icon || (opts.danger ? 'ti-alert-triangle' : 'ti-help')}"></i></div>
        <h2></h2><p class="muted"></p></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-r="0">Cancelar</button><button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-r="1"></button></div></div>`;
      m.querySelector('h2').textContent = opts.title || '¿Seguro?';
      m.querySelector('p').textContent = opts.text || '';
      m.querySelector('[data-r="1"]').textContent = opts.ok || 'Aceptar';
      const done = (v) => { m.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
      m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === '1');
        else if (e.target.classList.contains('modal-backdrop')) done(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.append(m);
      m.querySelector('[data-r="1"]').focus();
    });
  };

  App.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    App.toast('Copiado al portapapeles');
  };

  /* ---------- QR ---------- */
  function qrMatrix(text) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr;
  }
  /** Canvas con el QR. opts: { size, fg, bg, margin (módulos) } */
  App.qrCanvas = function (text, opts) {
    opts = Object.assign({ size: 512, fg: '#111111', bg: '#ffffff', margin: 2 }, opts);
    const qr = qrMatrix(text);
    const n = qr.getModuleCount();
    const total = n + opts.margin * 2;
    const scale = Math.max(1, Math.floor(opts.size / total));
    const c = document.createElement('canvas');
    c.width = c.height = total * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = opts.fg;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(r, col)) ctx.fillRect((col + opts.margin) * scale, (r + opts.margin) * scale, scale, scale);
      }
    }
    return c;
  };
  /** SVG vectorial del QR (ideal para imprenta) */
  App.qrSvg = function (text, opts) {
    opts = Object.assign({ fg: '#111111', bg: '#ffffff', margin: 2 }, opts);
    const qr = qrMatrix(text);
    const n = qr.getModuleCount();
    const total = n + opts.margin * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(r, col)) d += `M${col + opts.margin} ${r + opts.margin}h1v1h-1z`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${opts.bg}"/><path fill="${opts.fg}" d="${d}"/></svg>`;
  };
  App.download = function (href, filename) {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
  };
  App.slug = (s) => String(s || 'encuesta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'encuesta';
  App.downloadQr = function (text, format, name, opts) {
    const base = 'qr-' + App.slug(name);
    if (format === 'svg') {
      const url = URL.createObjectURL(new Blob([App.qrSvg(text, opts)], { type: 'image/svg+xml' }));
      App.download(url, base + '.svg');
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
      App.download(App.qrCanvas(text, Object.assign({ size: 1200 }, opts)).toDataURL('image/png'), base + '.png');
    }
  };

  /* ---------- compartir ---------- */
  App.shareCtx = null;
  App.share = function (url, status, id, title) {
    const m = document.getElementById('modal-share');
    if (!m) return;
    App.shareCtx = { url, id, title };
    m.querySelector('#share-url').value = url;
    m.querySelector('#share-open').href = url;
    m.querySelector('#share-embed').value = `<iframe src="${url}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy" title="Encuesta"></iframe>`;
    m.querySelector('#share-draft-warn').classList.toggle('hidden', status === 'published');
    const poster = m.querySelector('#share-poster');
    poster.href = id ? App.url('admin/qr.php?id=' + id) : '#';
    poster.classList.toggle('hidden', !id);
    const box = m.querySelector('#share-qr');
    box.innerHTML = '';
    if (window.qrcode) box.append(App.qrCanvas(url, { size: 336 }));
    else box.innerHTML = '<span class="muted small">QR no disponible</span>';
    App.openModal(m);
  };

  /* ---------- delegación global ---------- */
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); App.openModal(open.dataset.open); return; }
    const close = e.target.closest('[data-close]');
    if (close) { App.closeModal(close.closest('.modal')); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) { const src = document.querySelector(copy.dataset.copy); App.copy(src.value || src.textContent); return; }
    const share = e.target.closest('[data-share]');
    if (share) { App.share(share.dataset.share, share.dataset.status, share.dataset.id, share.dataset.title); return; }
    const qrDl = e.target.closest('[data-qr-download]');
    if (qrDl && App.shareCtx) { App.downloadQr(App.shareCtx.url, qrDl.dataset.qrDownload, App.shareCtx.title); return; }

    const dd = e.target.closest('[data-dropdown]');
    document.querySelectorAll('.dropdown.open').forEach((d) => { if (!dd || d !== dd.parentElement) d.classList.remove('open'); });
    if (dd) { e.preventDefault(); dd.parentElement.classList.toggle('open'); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach((m) => App.closeModal(m));
  });

})();
