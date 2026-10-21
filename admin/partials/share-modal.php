<div class="modal" id="modal-share" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-dialog">
    <div class="modal-head">
      <h2>Compartir encuesta</h2>
      <button type="button" class="icon-btn" data-close><i class="ti ti-x"></i></button>
    </div>
    <div class="modal-body">
      <div class="alert alert-warn hidden" id="share-draft-warn"><i class="ti ti-alert-triangle"></i> La encuesta no está publicada: los participantes no podrán responderla hasta que la publiques.</div>
      <label class="field"><span>Enlace público</span>
        <div class="input-group">
          <input id="share-url" readonly>
          <button type="button" class="btn btn-primary" data-copy="#share-url"><i class="ti ti-copy"></i> Copiar</button>
        </div>
      </label>
      <div class="share-row">
        <div class="qr-box" id="share-qr"></div>
        <div class="share-side">
          <p class="muted small">Escanea el código QR o descárgalo para imprimirlo en carteles, mesas, flyers o presentaciones.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-soft btn-sm" data-qr-download="png"><i class="ti ti-photo"></i> PNG</button>
            <button type="button" class="btn btn-soft btn-sm" data-qr-download="svg" title="Vectorial, ideal para imprenta"><i class="ti ti-vector"></i> SVG</button>
          </div>
          <a class="btn btn-primary btn-sm" id="share-poster" target="_blank"><i class="ti ti-printer"></i> Cartel imprimible</a>
          <a class="btn btn-ghost btn-sm" id="share-open" target="_blank"><i class="ti ti-external-link"></i> Abrir encuesta</a>
        </div>
      </div>
      <label class="field"><span>Insertar en una web (iframe)</span>
        <div class="input-group">
          <input id="share-embed" readonly>
          <button type="button" class="btn btn-soft" data-copy="#share-embed"><i class="ti ti-code"></i> Copiar</button>
        </div>
      </label>
    </div>
  </div>
</div>
