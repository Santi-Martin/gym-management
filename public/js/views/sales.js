/* ==========================================
   VIEW: SALES — Employee registers sales
   ========================================== */

let saleProducts = [];
let saleCart = {};

async function renderSales() {
  const vc = document.getElementById('view-container');
  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  const [prodRes, salesRes] = await Promise.all([
    API.get('/products'),
    API.get('/sales?limit=20')
  ]);

  saleProducts = prodRes.ok ? await API.json(prodRes) : [];
  const recentSales = salesRes.ok ? await API.json(salesRes) : [];
  saleCart = {};

  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  vc.innerHTML = `
    <div class="view-header">
      <div class="view-title">Registrar venta</div>
      <div class="view-subtitle">Seleccioná productos y registrá la venta</div>
    </div>

    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px;align-items:start;" id="sales-grid">
      <!-- Products -->
      <div>
        <div class="card">
          <div class="card__title">Productos disponibles</div>
          <div id="products-list" style="display:flex;flex-direction:column;gap:8px;">
            ${saleProducts.map(p => `
              <div class="sale-item" id="product-row-${p.id}">
                <div>
                  <div class="sale-item__name">${p.name}</div>
                  <div class="sale-item__price">${fmtPeso(p.price)}</div>
                </div>
                <div style="color:var(--text-muted);font-size:0.85rem;font-weight:500;">${fmtPeso(p.price)}</div>
                <div class="qty-control">
                  <button class="qty-btn" onclick="saleQty(${p.id}, -1)">−</button>
                  <div class="qty-num" id="qty-${p.id}">0</div>
                  <button class="qty-btn" onclick="saleQty(${p.id}, +1)">+</button>
                </div>
                <div class="sale-total" id="total-${p.id}">—</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Cart summary -->
      <div class="card" style="position:sticky;top:80px;">
        <div class="card__title">Resumen de venta</div>
        <div id="sale-cart-items" style="min-height:60px;color:var(--text-dim);font-size:0.85rem;">
          Seleccioná productos para agregar al carrito...
        </div>
        <hr style="border-color:var(--border);margin:16px 0;" />
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <span style="font-family:var(--font-head);font-weight:700;color:var(--text);">Total</span>
          <span class="sale-total" id="grand-total" style="font-size:1.4rem;">$0</span>
        </div>
        <div id="sale-alert" style="display:none;"></div>
        <button class="btn btn--primary btn--full" id="submit-sale-btn" disabled>
          <span id="sale-btn-text">Registrar venta</span>
          <div class="btn-spinner" id="sale-spinner" style="display:none;"></div>
        </button>
        <button class="btn btn--ghost btn--full" style="margin-top:8px;" onclick="saleReset()">Limpiar</button>
      </div>
    </div>

    <!-- Recent sales -->
    <div class="card" style="margin-top:24px;">
      <div class="card__title">Ventas recientes</div>
      ${recentSales.length === 0 ?
        '<div class="empty-state"><div class="empty-state__icon">🛒</div><div class="empty-state__title">Sin ventas registradas</div></div>'
        : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Artículo</th><th>Precio</th><th>Cant.</th><th>Total</th><th>Vendedor</th><th>Fecha</th></tr></thead>
            <tbody>
              ${recentSales.map(s => `
                <tr>
                  <td class="td-strong">${s.item_name}</td>
                  <td>${fmtPeso(s.item_price)}</td>
                  <td>${s.quantity}</td>
                  <td>${fmtPeso(s.total)}</td>
                  <td>${s.seller_first} ${s.seller_last}</td>
                  <td>${fmtDate(s.sold_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  if (window.innerWidth < 768) {
    document.getElementById('sales-grid').style.gridTemplateColumns = '1fr';
  }

  document.getElementById('submit-sale-btn').addEventListener('click', submitSale);
}

window.saleQty = function (productId, delta) {
  if (!saleCart[productId]) saleCart[productId] = 0;
  saleCart[productId] = Math.max(0, saleCart[productId] + delta);

  const qty = saleCart[productId];
  const product = saleProducts.find(p => p.id === productId);
  if (!product) return;

  document.getElementById(`qty-${productId}`).textContent = qty;
  const totalEl = document.getElementById(`total-${productId}`);
  if (qty > 0) {
    totalEl.textContent = `$${(product.price * qty).toLocaleString('es-AR')}`;
  } else {
    totalEl.textContent = '—';
    delete saleCart[productId];
  }

  updateCartSummary();
};

window.saleReset = function () {
  saleCart = {};
  saleProducts.forEach(p => {
    const qtyEl = document.getElementById(`qty-${p.id}`);
    const totEl = document.getElementById(`total-${p.id}`);
    if (qtyEl) qtyEl.textContent = '0';
    if (totEl) totEl.textContent = '—';
  });
  updateCartSummary();
};

function updateCartSummary() {
  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;
  const cartEl = document.getElementById('sale-cart-items');
  const grandTotalEl = document.getElementById('grand-total');
  const submitBtn = document.getElementById('submit-sale-btn');

  const items = Object.entries(saleCart).filter(([, qty]) => qty > 0);

  if (items.length === 0) {
    cartEl.innerHTML = `<span style="color:var(--text-dim);font-size:0.85rem;">Seleccioná productos para agregar al carrito...</span>`;
    grandTotalEl.textContent = '$0';
    submitBtn.disabled = true;
    return;
  }

  let grand = 0;
  cartEl.innerHTML = items.map(([id, qty]) => {
    const p = saleProducts.find(pr => pr.id === parseInt(id));
    if (!p) return '';
    const subtotal = p.price * qty;
    grand += subtotal;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text);font-size:0.875rem;">${p.name} × ${qty}</span>
        <span style="color:var(--red);font-weight:600;">${fmtPeso(subtotal)}</span>
      </div>
    `;
  }).join('');

  grandTotalEl.textContent = fmtPeso(grand);
  submitBtn.disabled = false;
}

async function submitSale() {
  const alertEl = document.getElementById('sale-alert');
  alertEl.style.display = 'none';

  const items = Object.entries(saleCart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = saleProducts.find(pr => pr.id === parseInt(id));
      return { item_name: p.name, item_price: p.price, quantity: qty, item_type: 'product' };
    });

  if (items.length === 0) return;

  const btn = document.getElementById('submit-sale-btn');
  btn.disabled = true;
  document.getElementById('sale-spinner').style.display = 'block';
  document.getElementById('sale-btn-text').style.display = 'none';

  try {
    const res = await API.post('/sales', { items });
    const data = await API.json(res);
    if (!res.ok) throw new Error(data.error || 'Error');

    Toast.success('Venta registrada exitosamente');
    renderSales();
  } catch (err) {
    alertEl.className = 'alert alert--error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    btn.disabled = false;
    document.getElementById('sale-spinner').style.display = 'none';
    document.getElementById('sale-btn-text').style.display = 'inline';
  }
}
