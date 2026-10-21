/* Dashboard: survey list */
(function () {
  'use strict';

  const form = document.getElementById('form-new');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const fd = new FormData(form);
      const r = await App.api('create', { title: fd.get('title'), template: fd.get('template'), lang: fd.get('lang') });
      location.href = 'editor.php?id=' + r.id;
    } catch (err) {
      App.toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const id = +b.dataset.id;
    if (b.dataset.action === 'duplicate') {
      try {
        const r = await App.api('duplicate', { id });
        location.href = 'editor.php?id=' + r.id;
      } catch (err) { App.toast(err.message, 'error'); }
    }
    if (b.dataset.action === 'delete') {
      const ok = await App.confirm({
        title: _t('Eliminar encuesta'),
        text: _t('Se eliminará «{title}» junto con todas sus respuestas. Esta acción no se puede deshacer.', { title: b.dataset.title }),
        ok: _t('Eliminar'), danger: true,
      });
      if (!ok) return;
      try {
        await App.api('delete', { id });
        const cardEl = b.closest('.survey-card');
        cardEl.classList.add('removing');
        setTimeout(() => location.reload(), 250);
      } catch (err) { App.toast(err.message, 'error'); }
    }
  });

  /* filter and search */
  const grid = document.getElementById('survey-grid');
  if (!grid) return;
  let status = '';
  const search = document.getElementById('search');
  const noRes = document.getElementById('no-results');
  function apply() {
    const term = search.value.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.survey-card').forEach((c) => {
      const show = (!status || c.dataset.status === status) && (!term || c.dataset.title.includes(term));
      c.hidden = !show;
      if (show) visible++;
    });
    noRes.classList.toggle('hidden', visible > 0);
  }
  search.addEventListener('input', apply);
  document.getElementById('status-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    status = btn.dataset.status;
    btn.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === btn));
    apply();
  });
})();
