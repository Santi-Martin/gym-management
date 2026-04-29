/* ==========================================
   VIEW: SCAN ENTRY — QR scan to register visit
   ========================================== */

function renderScanEntry() {
  const vc = document.getElementById('view-container');

  vc.innerHTML = `
    <div class="view-header">
      <div class="view-title">Escanear ingreso</div>
      <div class="view-subtitle">Escanear QR o ingresar código manualmente</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;" id="scan-grid">
      <!-- Scanner panel -->
      <div class="card">
        <div class="card__title">📷 Escanear código</div>
        
        <div id="qr-reader-container" style="background:var(--dark-3);border-radius:var(--radius);overflow:hidden;min-height:250px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">
           <div id="qr-reader" style="width:100%;"></div>
        </div>
        <div id="scan-result-area"></div>
      </div>

      <!-- Today's visits panel -->
      <div class="card">
        <div class="card__title" id="today-count-title">Ingresos de hoy <span>...</span></div>
        <div id="today-visits-list"></div>
      </div>
    </div>
  `;

  // Responsive: stack on mobile
  const grid = document.getElementById('scan-grid');
  if (window.innerWidth < 768) {
    grid.style.gridTemplateColumns = '1fr';
  }

  loadTodayVisits();

  let debounceTimer;

  // Camera initialization delay to let DOM settle
          setTimeout(() => {
            if (typeof Html5Qrcode !== 'undefined') {
              const html5QrCode = new Html5Qrcode("qr-reader");
              window.currentQRScanner = html5QrCode;
              
              let isScanning = false;

              html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                  if (isScanning) return;
                  isScanning = true;
                  submitScan(decodedText).finally(() => {
                    setTimeout(() => { isScanning = false; }, 2500); 
                  });
                },
                (error) => { /* ignore normal errors */ }
              ).catch((err) => {
                document.getElementById('qr-reader-container').innerHTML = 
                  `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem;">
                    La cámara no se puede iniciar automáticamente. Requiere permisos o HTTPS.
                  </div>`;
              });
            } else {
              document.getElementById('qr-reader-container').style.display = 'none';
            }
          }, 100);
}

async function submitScan(qrCode) {
  const resultArea = document.getElementById('scan-result-area');
  
  // Loading state placeholder if we want to show anything
  resultArea.innerHTML = '<div style="padding:20px;text-align:center;"><div class="spinner" style="margin:0 auto"></div></div>';

  try {
    const res = await API.post('/visits/scan', { qr_code: qrCode });
    const data = await API.json(res);

    if (res.ok && data.allowed) {
      const m = data.membership;
      resultArea.innerHTML = `
        <div class="scan-result" style="border: 3px solid var(--green); background: rgba(34,197,94,0.08); border-radius: 12px; margin-top:20px;">
          <div class="scan-result__icon">✅</div>
          <div class="scan-result__name" style="font-size: 1.5rem;">${data.user.first_name} ${data.user.last_name}</div>
          <div class="scan-result__detail">${m.name}</div>
          <div class="scan-result__grid">
            <div class="scan-result__item">
              <div class="scan-result__item-label">Vence</div>
              <div class="scan-result__item-value">${new Date(m.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</div>
            </div>
            ${m.visits_per_week ? `
            <div class="scan-result__item">
              <div class="scan-result__item-label">Visitas semana</div>
              <div class="scan-result__item-value">${m.weekly_visits_used}/${m.visits_per_week}</div>
            </div>
            ` : `
            <div class="scan-result__item">
              <div class="scan-result__item-label">Acceso</div>
              <div class="scan-result__item-value">∞</div>
            </div>
            `}
          </div>
        </div>
      `;
      Toast.success(`✓ Ingreso de ${data.user.first_name} registrado`);
      loadTodayVisits();
    } else {
      resultArea.innerHTML = `
        <div class="scan-result" style="border: 3px solid var(--red); background: rgba(239,68,68,0.08); border-radius: 12px; margin-top:20px;">
          <div class="scan-result__icon">❌</div>
          ${data.user ? `<div class="scan-result__name" style="font-size: 1.5rem;">${data.user.first_name} ${data.user.last_name}</div>` : ''}
          <div class="scan-result__detail" style="font-weight: bold; color: var(--red); margin-top: 5px;">Membresía vencida o inválida</div>
          <div class="scan-result__detail" style="font-size: 0.8rem; margin-top: 2px;">${data.error || 'Ingreso denegado'}</div>
        </div>
      `;
      Toast.error(data.error || 'Ingreso denegado');
    }
  } catch (err) {
    resultArea.innerHTML = `<div class="alert alert--error" style="margin-top:16px;">${err.message}</div>`;
  }
}

async function loadTodayVisits() {
  const res = await API.get('/visits/today');
  if (!res.ok) return;
  const visits = await API.json(res);

  const title = document.getElementById('today-count-title');
  const list = document.getElementById('today-visits-list');
  if (!title || !list) return;

  title.innerHTML = `Ingresos de hoy <span>(${visits.length})</span>`;

  if (visits.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📭</div><div class="empty-state__title">Sin ingresos aún</div></div>`;
    return;
  }

  list.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${visits.slice(0, 15).map(v => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--dark-3);border-radius:var(--radius);">
          <div>
            <div style="font-weight:600;color:var(--text);font-size:0.875rem;">${v.first_name} ${v.last_name}</div>
            <div style="font-size:0.75rem;color:var(--text-dim);">${v.membership_name || 'Sin plan'}</div>
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);">
            ${new Date(v.visited_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
