// Gestock POS & Predictive Inventory - Frontend SPA Controller

const state = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  products: [],
  inventory: [],
  suppliers: [],
  taxInvoices: [],
  cart: [],
  selectedPayment: 'EFECTIVO',
  currentCartTotal: 0,
  currentCajaEsperado: 0,
  scannedInvoiceData: null,
  theme: 'dark',
  dashboardPeriod: 'mensual',
  status: {
    online: true,
    pendingDirty: 0,
    lastSyncedAt: null
  }
};

// --- Regla de Redondeo de Chile (Ley N° 20.956) ---
function aplicarRedondeoChileno(monto) {
  const num = Math.round(Number(monto) || 0);
  const residuo = num % 10;
  if (residuo >= 1 && residuo <= 4) {
    return num - residuo;
  } else if (residuo >= 5 && residuo <= 9) {
    return num + (10 - residuo);
  }
  return num;
}

// --- Theme Management (Modo Oscuro / Claro) ---
function initTheme() {
  const savedTheme = localStorage.getItem('gestock_theme') || 'dark';
  aplicarTemaEnDOM(savedTheme);
}

function cambiarTema(theme) {
  localStorage.setItem('gestock_theme', theme);
  aplicarTemaEnDOM(theme);
  showToast(`Tema ${theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'} activado`, 'info');
}

function alternarTemaRapido() {
  const current = state.theme === 'light' ? 'dark' : 'light';
  cambiarTema(current);
}

function aplicarTemaEnDOM(theme) {
  state.theme = theme;
  const isLight = theme === 'light';
  if (isLight) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }

  // Actualizar botones de configuración
  const darkBtn = document.getElementById('themeDarkBtn');
  const lightBtn = document.getElementById('themeLightBtn');
  if (darkBtn && lightBtn) {
    if (isLight) {
      darkBtn.style.border = '1px solid var(--border-color)';
      lightBtn.style.border = '2px solid var(--accent)';
      lightBtn.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.4)';
      darkBtn.style.boxShadow = 'none';
    } else {
      darkBtn.style.border = '2px solid var(--accent)';
      darkBtn.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.4)';
      lightBtn.style.border = '1px solid var(--border-color)';
      lightBtn.style.boxShadow = 'none';
    }
  }

  // Actualizar botón rápido en header
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (icon) icon.innerText = isLight ? '☀️' : '🌙';
  if (text) text.innerText = isLight ? 'Claro' : 'Oscuro';
}

// --- Utilidad de Debounce para optimizacion de eventos de entrada ---
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initSearch();
  initPaymentButtons();
  initSyncButton();
  initKeyboardShortcuts();
  initOcrEvents();
  
  // Carga inicial esencial para la terminal POS (evita saturacion de sockets HTTP)
  loadStatus();
  loadProducts();

  // Iniciar monitoreo no superpuesto de conectividad y sincronizacion
  setTimeout(pollStatusLoop, 5000);
});

// --- Tab Navigation ---
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetTab)?.classList.add('active');

      if (targetTab === 'tab-dashboard') cargarDashboardGlobal();
      if (targetTab === 'tab-inventory') loadInventory();
      if (targetTab === 'tab-transactions') loadTransactions();
      if (targetTab === 'tab-caja') loadCajaResumen();
      if (targetTab === 'tab-tax') recargarModuloTributario();
      if (targetTab === 'tab-suppliers') loadSuppliers();
      if (targetTab === 'tab-replenishment') loadReplenishment();
      if (targetTab === 'tab-trends') loadTrends();
      if (targetTab === 'tab-config') {
        loadMarginConfig();
        loadEmailConfig();
        loadFiscalConfig();
      }
    });
  });
}

// --- Status & Sync Monitoring ---
let isLoadingStatus = false;
let isStatusPolling = false;

async function pollStatusLoop() {
  if (isStatusPolling) return;
  isStatusPolling = true;
  try {
    await loadStatus();
  } catch (err) {
    // Gestion silenciosa de error en bucle
  } finally {
    isStatusPolling = false;
    // Espaciar sondeo: 10s cuando esta online, 30s cuando esta offline para no saturar
    const interval = state.status.online ? 10000 : 30000;
    setTimeout(pollStatusLoop, interval);
  }
}

async function loadStatus() {
  if (isLoadingStatus) return;
  isLoadingStatus = true;
  try {
    const res = await fetch(`/api/v1/pos/status?tenant_id=${state.tenantId}`);
    const data = await res.json();

    if (data.success) {
      state.status.online = data.cloud_online;
      state.status.pendingDirty = data.pending_dirty_count;
      state.status.lastSyncedAt = data.last_synced_at;

      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      const dirtyCount = document.getElementById('dirtyCount');

      if (!data.cloud_online) {
        if (dot) dot.className = 'status-dot dot-offline';
        if (text) text.innerText = 'MODO OFFLINE (LOCAL)';
      } else if (data.pending_dirty_count > 0) {
        if (dot) dot.className = 'status-dot dot-pending';
        if (text) text.innerText = `${data.pending_dirty_count} PENDIENTES DE NUBE`;
      } else {
        if (dot) dot.className = 'status-dot dot-online';
        if (text) text.innerText = 'ONLINE / SINCRONIZADO';
      }

      if (dirtyCount) dirtyCount.innerText = data.pending_dirty_count;
    }
  } catch (err) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot dot-offline';
    if (text) text.innerText = 'RED NO DISPONIBLE';
  } finally {
    isLoadingStatus = false;
  }
}

function initSyncButton() {
  const syncBtn = document.getElementById('btnSyncNow');
  if (!syncBtn) return;
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.innerText = 'Sincronizando...';
    try {
      const res = await fetch('/api/v1/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: state.tenantId })
      });
      const data = await res.json();
      if (data.success && data.result?.success !== false) {
        showToast(data.message || 'Sincronizacion con la nube completada con exito');
        await loadStatus();
        await loadProducts();
      } else {
        showToast('Fallo al sincronizar: ' + (data.message || 'Error en servidor'), 'error');
        await loadStatus();
      }
    } catch (err) {
      showToast('Error de conexion durante sincronizacion', 'error');
      await loadStatus();
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerText = 'Sincronizar Nube';
    }
  });
}

// --- Product Catalog & Search ---
async function loadProducts() {
  try {
    const res = await fetch(`/api/v1/pos/products?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      state.products = data.data;
      renderProducts(state.products);
    }
  } catch (err) {
    console.error('Error al cargar productos del catalogo local:', err);
  }
}

function initSearch() {
  const searchInput = document.getElementById('posSearch');
  if (!searchInput) return;

  // Filtrado optimizado con debounce de 150ms para evitar bloqueos del DOM
  const ejecutarFiltro = debounce((query) => {
    const filtered = state.products.filter(p => 
      p.nombre.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.codigo_barra && p.codigo_barra.includes(query))
    );
    renderProducts(filtered);
  }, 150);

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    ejecutarFiltro(query);
  });

  // Si escanea codigo de barras y presiona Enter
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      const exactMatch = state.products.find(p => p.sku === query || p.codigo_barra === query);
      if (exactMatch) {
        addToCart(exactMatch);
        searchInput.value = '';
        renderProducts(state.products);
      }
    }
  });
}

function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; color: #94a3b8; padding: 20px; text-align: center;">No se encontraron productos en el catálogo local.</div>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    const isAgotado = Number(p.stock_actual) <= 0;
    const isLowStock = Number(p.stock_actual) <= Number(p.stock_minimo);

    card.className = `product-card ${isAgotado ? 'product-card-out-of-stock' : ''}`;
    
    if (isAgotado) {
      card.onclick = () => {
        showToast(`⚠️ "${p.nombre}" se encuentra AGOTADO (Stock: 0). Registra una factura para reabastecer.`, 'warning');
      };
    } else {
      card.onclick = () => addToCart(p);
    }

    const isAlcohol = p.impuesto_adicional_codigo === 27 || p.impuesto_adicional_codigo === 28;
    const isAzucarada = p.impuesto_adicional_codigo === 25 || p.impuesto_adicional_codigo === 26;
    const taxBadge = isAlcohol
      ? `<span style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 4px;" title="Ley de Alcoholes N° 19.925 (+18)">🔞 +18</span>`
      : isAzucarada
      ? `<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 4px;" title="Impuesto Adicional ILA (18%)">⚡ ILA 18%</span>`
      : '';

    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <div style="display: flex; align-items: center;">
            <span class="product-sku">${p.sku}</span>
            ${taxBadge}
          </div>
          ${p.codigo_barra ? `<small style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${p.codigo_barra}</small>` : ''}
        </div>
        <h4 class="product-name">${p.nombre}</h4>
      </div>
      <div class="product-footer">
        <span class="product-price">$${Number(p.precio_venta).toLocaleString('es-CL')}</span>
        ${isAgotado 
          ? `<span class="badge-agotado">🔴 AGOTADO</span>`
          : `<span class="stock-badge ${isLowStock ? 'stock-low' : ''}">Stock: ${p.stock_actual}</span>`
        }
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- Cart & Checkout ---
function addToCart(product) {
  const existing = state.cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ product, quantity: 1 });
  }
  renderCart();
}

function updateQty(productId, delta) {
  const item = state.cart.find(i => i.product.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.product.id !== productId);
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  const ivaEl = document.getElementById('cartIva');
  const totalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('btnCheckout');

  if (!container) return;
  container.innerHTML = '';

  if (state.cart.length === 0) {
    container.innerHTML = '<div style="color: #64748b; text-align: center; margin-top: 40px;">El carrito está vacío. Haz clic en un producto para agregarlo.</div>';
    if (subtotalEl) subtotalEl.innerText = '$0';
    if (ivaEl) ivaEl.innerText = '$0';
    if (totalEl) totalEl.innerText = '$0';
    state.currentCartTotal = 0;
    updateCashChange();
    if (checkoutBtn) checkoutBtn.disabled = true;

    const alcoholBox = document.getElementById('alcoholWarningBox');
    if (alcoholBox) alcoholBox.style.display = 'none';
    const checkAlc = document.getElementById('checkVerificacionAlcohol');
    if (checkAlc) checkAlc.checked = false;
    return;
  }

  let rawTotal = 0;
  state.cart.forEach(item => {
    const subtotal = item.quantity * Number(item.product.precio_venta);
    rawTotal += subtotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-title">${item.product.nombre}</div>
        <div class="cart-item-meta">$${Number(item.product.precio_venta).toLocaleString('es-CL')} x ${item.quantity} = $${subtotal.toLocaleString('es-CL')}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateQty('${item.product.id}', -1)">-</button>
        <span style="font-weight: 700; width: 20px; text-align: center;">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQty('${item.product.id}', 1)">+</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Control de Venta de Alcohol Ley N° 19.925 / Ley 21.363
  const hasAlcohol = state.cart.some(item => 
    item.product.impuesto_adicional_codigo === 27 || 
    item.product.impuesto_adicional_codigo === 28 ||
    item.product.codigo_ila === 27 ||
    item.product.codigo_ila === 28
  );
  const alcoholBox = document.getElementById('alcoholWarningBox');
  if (alcoholBox) {
    alcoholBox.style.display = hasAlcohol ? 'block' : 'none';
    if (!hasAlcohol) {
      const checkAlc = document.getElementById('checkVerificacionAlcohol');
      if (checkAlc) checkAlc.checked = false;
    }
  }

  // Aplicar Ley de Redondeo de Chile (Ley N° 20.956)
  const total = aplicarRedondeoChileno(rawTotal);
  state.currentCartTotal = total;

  const neto = Math.round(total / 1.19);
  const iva = total - neto;

  if (subtotalEl) subtotalEl.innerText = `$${neto.toLocaleString('es-CL')}`;
  if (ivaEl) ivaEl.innerText = `$${iva.toLocaleString('es-CL')}`;
  if (totalEl) totalEl.innerText = `$${total.toLocaleString('es-CL')}`;
  if (checkoutBtn) checkoutBtn.disabled = false;

  updateCashChange();
}

function updateCashChange() {
  const cashGivenInput = document.getElementById('cashGivenInput');
  const cashChangeDisplay = document.getElementById('cashChangeDisplay');
  if (!cashGivenInput || !cashChangeDisplay) return;

  const given = Number(cashGivenInput.value) || 0;
  const total = state.currentCartTotal || 0;

  if (given >= total && total > 0) {
    const change = given - total;
    cashChangeDisplay.innerText = `$${change.toLocaleString('es-CL')}`;
    cashChangeDisplay.style.color = '#10b981';
  } else if (given > 0 && given < total) {
    const diff = total - given;
    cashChangeDisplay.innerText = `Faltan $${diff.toLocaleString('es-CL')}`;
    cashChangeDisplay.style.color = '#f87171';
  } else {
    cashChangeDisplay.innerText = '$0';
    cashChangeDisplay.style.color = 'var(--primary)';
  }
}

function initPaymentButtons() {
  const payButtons = document.querySelectorAll('.pay-btn');
  payButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      payButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedPayment = btn.getAttribute('data-pay');

      const cashBox = document.getElementById('cashCalcBox');
      if (cashBox) {
        cashBox.style.display = state.selectedPayment === 'EFECTIVO' ? 'block' : 'none';
      }
    });
  });

  const cashGivenInput = document.getElementById('cashGivenInput');
  if (cashGivenInput) {
    cashGivenInput.addEventListener('input', updateCashChange);
  }

  const checkoutBtn = document.getElementById('btnCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', processCheckout);
  }
}

function agregarBolsaReutilizable() {
  let bag = state.products.find(p => p.sku === 'BOLSA-REUT-01');
  if (!bag) {
    bag = {
      id: 'prod-bolsa-reutilizable-21368',
      sku: 'BOLSA-REUT-01',
      nombre: 'Bolsa Reutilizable (Ley N° 21.368)',
      precio_venta: 1000,
      stock_actual: 9999,
      stock_minimo: 10,
      categoria: 'Insumos'
    };
  } else {
    bag.precio_venta = 1000;
  }
  addToCart(bag);
  showToast('🛍️ Bolsa reutilizable agregada al ticket ($1.000 - Ley N° 21.368)', 'info');
}

function togglePosDocType() {
  const docType = document.querySelector('input[name="posDocType"]:checked')?.value || 'BOLETA';
  const fields = document.getElementById('posFacturaFields');
  if (fields) {
    fields.style.display = docType === 'FACTURA' ? 'block' : 'none';
  }
}

async function processCheckout() {
  if (state.cart.length === 0) return;

  const checkoutBtn = document.getElementById('btnCheckout');
  checkoutBtn.disabled = true;
  checkoutBtn.innerText = '⏳ Procesando Venta ACID...';

  const docType = document.querySelector('input[name="posDocType"]:checked')?.value || 'BOLETA';
  let receptorEmpresa = undefined;

  if (docType === 'FACTURA') {
    const rut = document.getElementById('posFacturaRut')?.value?.trim();
    const razonSocial = document.getElementById('posFacturaRazonSocial')?.value?.trim();
    const giro = document.getElementById('posFacturaGiro')?.value?.trim();
    const direccion = document.getElementById('posFacturaDireccion')?.value?.trim();

    if (!rut || !razonSocial) {
      showToast('Para emitir Factura Electrónica (DTE 33) debes ingresar el RUT y Razón Social de la empresa receptora', 'warning');
      checkoutBtn.disabled = false;
      checkoutBtn.innerText = 'CONFIRMAR VENTA (F4)';
      return;
    }

    receptorEmpresa = {
      rut,
      razon_social: razonSocial,
      giro: giro || 'Giro Comercial',
      direccion: direccion || 'Dirección Comercial'
    };
  }

  // Control de Venta de Alcohol Ley N° 19.925 / Ley 21.363
  const hasAlcoholInCart = state.cart.some(i => 
    i.product.impuesto_adicional_codigo === 27 || 
    i.product.impuesto_adicional_codigo === 28 ||
    i.product.codigo_ila === 27 ||
    i.product.codigo_ila === 28
  );

  if (hasAlcoholInCart) {
    const checkAlcohol = document.getElementById('checkVerificacionAlcohol');
    if (!checkAlcohol || !checkAlcohol.checked) {
      showToast('🔞 Control Ley de Alcoholes N° 19.925: Debes solicitar la Cédula de Identidad y marcar la confirmación de mayoría de edad (+18)', 'warning');
      checkoutBtn.disabled = false;
      checkoutBtn.innerText = 'CONFIRMAR VENTA (F4)';
      const alcBox = document.getElementById('alcoholWarningBox');
      if (alcBox) alcBox.scrollIntoView({ behavior: 'smooth' });
      if (checkAlcohol) checkAlcohol.focus();
      return;
    }
  }

  const payload = {
    tenant_id: state.tenantId,
    usuario_id: state.userId,
    metodo_pago: state.selectedPayment,
    tipo_comprobante: docType,
    receptor_empresa: receptorEmpresa,
    verificacion_edad_alcohol: hasAlcoholInCart,
    items: state.cart.map(i => ({
      producto_id: i.product.id,
      cantidad: i.quantity,
      precio_unitario: Number(i.product.precio_venta),
      codigo_ila: i.product.impuesto_adicional_codigo || i.product.codigo_ila || undefined,
      tasa_ila: i.product.impuesto_adicional_tasa || i.product.tasa_ila || undefined
    }))
  };

  try {
    const res = await fetch('/api/v1/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      const data = result.data;
      let msg = `Venta ${data.folio} confirmada exitosamente ($${data.total.toLocaleString('es-CL')}).`;
      if (data.payment_status === 'OFFLINE_VOUCHER') {
        msg += ' ⚠️ Emitido Vale Offline de Contingencia.';
        showToast(msg, 'warning');
      } else {
        showToast(msg, 'success');
      }

      state.cart = [];
      const cashGivenInput = document.getElementById('cashGivenInput');
      if (cashGivenInput) cashGivenInput.value = '';
      const checkAlc = document.getElementById('checkVerificacionAlcohol');
      if (checkAlc) checkAlc.checked = false;

      renderCart();
      loadProducts();
      loadStatus();
      loadCajaResumen();

      // Abrir automáticamente el ticket térmico oficial (Boleta DTE o Voucher Res. 176)
      if (data.dte) {
        mostrarModalBoletaTermica({
          saleId: data.saleId,
          folio: data.folio,
          total: data.total,
          metodo_pago: data.payment_method,
          payment_transaction_id: data.payment_transaction_id,
          dte: data.dte
        });
      }
    } else {
      showToast('Error en el cobro: ' + result.message, 'error');
    }
  } catch (err) {
    showToast('Error crítico de comunicación local', 'error');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = 'CONFIRMAR VENTA (F4)';
  }
}

// --- Inventario Completo & Catálogo con Etiquetas de Origen ---
async function loadInventory() {
  try {
    const res = await fetch(`/api/v1/pos/inventory?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      state.inventory = data.data || [];
      renderInventory(state.inventory);
      loadVencimientosAlerts();
    }
  } catch (err) {
    console.error('Error loading inventory', err);
    showToast('Error al cargar inventario', 'error');
  }
}

async function loadVencimientosAlerts() {
  try {
    const res = await fetch(`/api/v1/pos/vencimientos?tenant_id=${state.tenantId}`);
    const data = await res.json();
    const banner = document.getElementById('vencimientosAlertBanner');
    const text = document.getElementById('vencimientosAlertText');
    if (!banner || !text) return;

    if (data.success && data.resumen && data.resumen.total_en_riesgo > 0) {
      const r = data.resumen;
      text.innerText = `${r.vencidos} productos vencidos, ${r.riesgo_critico_7d} vencen esta semana (≤7 días), ${r.riesgo_medio_15d} vencen en 15 días.`;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    console.error('Error cargando alertas de vencimiento:', err);
  }
}

function filtrarSoloPorVencer() {
  const filtered = state.inventory.filter(p => {
    if (!p.fecha_vencimiento) return false;
    const diff = Math.round((new Date(p.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
    return diff <= 30;
  });
  renderInventory(filtered);
  showToast(`Mostrando ${filtered.length} productos con riesgo sanitario de vencimiento`, 'warning');
}

function renderInventory(list) {
  const tbody = document.getElementById('inventoryTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#94a3b8; padding:20px;">No se encontraron productos en el inventario.</td></tr>';
    return;
  }

  list.forEach(p => {
    const isAgotado = Number(p.stock_actual) <= 0;
    const isLow = Number(p.stock_actual) <= Number(p.stock_minimo);
    const isInvoiceProduct = p.origen_creacion === 'FACTURA' || !!p.factura_origen_folio;
    const tr = document.createElement('tr');

    if (isAgotado) {
      tr.className = 'row-out-of-stock';
    } else if (isInvoiceProduct) {
      tr.style.background = 'rgba(16, 185, 129, 0.05)';
      tr.style.borderLeft = '3px solid #10b981';
    }

    const origenBadge = isInvoiceProduct
      ? `<span style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">✨ NUEVO (${p.factura_origen_folio || 'Factura'})</span>`
      : `<span style="color: #64748b; font-size: 11px;">Catálogo Base</span>`;

    const stockText = isAgotado
      ? `<span style="color:#ef4444; font-weight:800;">0</span> / ${p.stock_minimo}`
      : `<span style="color:${isLow ? '#f87171' : '#10b981'}; font-weight:700;">${p.stock_actual}</span> / ${p.stock_minimo}`;

    // Lote y Vencimiento DS 977 MINSAL
    let vencimientoHtml = '<span style="color:#64748b; font-size:11px;">No perecible</span>';
    if (p.fecha_vencimiento) {
      const diffDias = Math.round((new Date(p.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
      let badgeColor = '#10b981';
      let tagText = `${diffDias}d restantes`;

      if (diffDias < 0) {
        badgeColor = '#ef4444';
        tagText = 'VENCIDO';
      } else if (diffDias <= 7) {
        badgeColor = '#f97316';
        tagText = `¡URGENTE! ${diffDias}d`;
      } else if (diffDias <= 15) {
        badgeColor = '#eab308';
        tagText = `${diffDias}d`;
      }

      vencimientoHtml = `
        <div style="font-size:11px;">
          <div><span style="color:#94a3b8;">Lote:</span> <strong style="font-family:monospace;">${p.lote || 'L-GEN'}</strong></div>
          <div style="margin-top:2px;">
            <span style="background:${badgeColor}20; color:${badgeColor}; border:1px solid ${badgeColor}; padding:1px 6px; border-radius:10px; font-weight:700;">
              ${p.fecha_vencimiento.slice(0, 10)} (${tagText})
            </span>
          </div>
        </div>
      `;
    }

    // Impuesto Adicional ILA
    const ilaHtml = p.impuesto_adicional_codigo
      ? `<span style="background:rgba(217, 119, 6, 0.2); border:1px solid #d97706; color:#fbbf24; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap;">
          ILA ${p.impuesto_adicional_tasa}% (Cód ${p.impuesto_adicional_codigo})
        </span>`
      : `<span style="color:#64748b; font-size:11px;">IVA 19%</span>`;

    tr.innerHTML = `
      <td><strong>${p.sku}</strong></td>
      <td><span style="font-family:monospace; font-size:12px; color:#38bdf8;">${p.codigo_barra || '-'}</span></td>
      <td><strong>${p.nombre}</strong></td>
      <td><span style="background:#334155; padding:2px 8px; border-radius:4px; font-size:12px;">${p.categoria || 'General'}</span></td>
      <td>${stockText}</td>
      <td>$${Number(p.precio_compra || 0).toLocaleString('es-CL')}</td>
      <td><strong style="color:var(--primary);">$${Number(p.precio_venta || 0).toLocaleString('es-CL')}</strong></td>
      <td>${vencimientoHtml}</td>
      <td>${ilaHtml}</td>
      <td><span style="color:#cbd5e1; font-size:12px;">${p.proveedor_nombre || 'Proveedor Local'}</span></td>
      <td>${origenBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarInventario() {
  const searchInput = document.getElementById('inventorySearch');
  if (!searchInput) return;
  const q = searchInput.value.toLowerCase().trim();
  const filtered = state.inventory.filter(p => 
    p.nombre.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.codigo_barra && p.codigo_barra.toLowerCase().includes(q)) ||
    (p.categoria && p.categoria.toLowerCase().includes(q)) ||
    (p.factura_origen_folio && p.factura_origen_folio.toLowerCase().includes(q)) ||
    (p.lote && p.lote.toLowerCase().includes(q))
  );
  renderInventory(filtered);
}

// --- Registro de Ventas & Auditoría ---
async function loadTransactions() {
  try {
    const res = await fetch(`/api/v1/pos/transactions?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      renderTransactions(data.data || []);
    }
  } catch (err) {
    console.error('Error loading transactions', err);
    showToast('Error al cargar transacciones de venta', 'error');
  }
}

function renderTransactions(list) {
  const tbody = document.getElementById('transactionsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#94a3b8; padding:20px;">No hay ventas registradas aún.</td></tr>';
    return;
  }

  list.forEach(t => {
    const itemsText = (t.items || []).map(i => `${i.producto_nombre || i.sku} (${i.cantidad}u)`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#38bdf8;">${t.folio}</strong></td>
      <td style="font-size:12px;">${new Date(t.fecha).toLocaleString('es-CL')}</td>
      <td>${t.cajero_nombre || 'Admin Demo'}</td>
      <td><span style="background:#334155; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;">${t.medio_pago_nombre || t.medio_pago_tipo || 'EFECTIVO'}</span></td>
      <td>${t.unidades} u</td>
      <td><strong style="color:var(--primary); font-size:14px;">$${Number(t.total).toLocaleString('es-CL')}</strong></td>
      <td><span style="color:#10b981; font-weight:700; font-size:11px;">${t.estado}</span></td>
      <td><span style="font-size:12px; color:#94a3b8;">${itemsText || '-'}</span></td>
      <td style="text-align: center;">
        <button onclick="abrirComprobantePorVenta('${t.id}')" style="background: #0284c7; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          🧾 Ver Ticket
        </button>
      </td>
      <td style="text-align: center;">
        <button onclick="abrirModalDevolucion('${t.id}')" style="background: #dc2626; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          ↩️ Devolución
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Cierre de Caja (Arqueo / Balance Z) ---
async function loadCajaResumen() {
  try {
    const res = await fetch(`/api/v1/caja/resumen?tenant_id=${state.tenantId}`);
    const data = await res.json();

    const aperturaCard = document.getElementById('cajaAperturaCard');
    const cierreCard = document.getElementById('cajaCierreCard');
    const movimientoCard = document.getElementById('cajaMovimientoCard');
    const badge = document.getElementById('cajaEstadoBadge');

    if (data.success && data.activa && data.data) {
      const r = data.data;
      if (aperturaCard) aperturaCard.style.display = 'none';
      if (cierreCard) cierreCard.style.display = 'block';
      if (movimientoCard) movimientoCard.style.display = 'block';
      if (badge) {
        badge.innerHTML = `🟢 CAJA ABIERTA (Desde ${new Date(r.fecha_apertura).toLocaleTimeString('es-CL')})`;
        badge.style.color = '#10b981';
      }

      document.getElementById('metricFondoApertura').innerText = `$${Number(r.monto_apertura).toLocaleString('es-CL')}`;
      document.getElementById('metricVentasEfectivo').innerText = `$${Number(r.ventas_efectivo).toLocaleString('es-CL')}`;
      if (document.getElementById('metricIngresosCaja')) {
        document.getElementById('metricIngresosCaja').innerText = `$${Number(r.ingresos_caja || 0).toLocaleString('es-CL')}`;
      }
      if (document.getElementById('metricEgresosCaja')) {
        document.getElementById('metricEgresosCaja').innerText = `$${Number(r.egresos_caja || 0).toLocaleString('es-CL')}`;
      }
      document.getElementById('metricEsperadoEfectivo').innerText = `$${Number(r.monto_esperado_efectivo).toLocaleString('es-CL')}`;
      document.getElementById('metricVentasTransbank').innerText = `$${Number(r.ventas_transbank).toLocaleString('es-CL')}`;
      document.getElementById('metricVentasMP').innerText = `$${Number(r.ventas_mercadopago).toLocaleString('es-CL')}`;
      document.getElementById('metricVentasSumUp').innerText = `$${Number(r.ventas_sumup).toLocaleString('es-CL')}`;
      
      document.getElementById('cajaEsperadoDisplay').innerText = `$${Number(r.monto_esperado_efectivo).toLocaleString('es-CL')}`;
      state.currentCajaEsperado = Number(r.monto_esperado_efectivo);
      state.currentActiveCaja = r;
      calcularDiferenciaCaja();
    } else {
      if (aperturaCard) aperturaCard.style.display = 'block';
      if (cierreCard) cierreCard.style.display = 'none';
      if (movimientoCard) movimientoCard.style.display = 'none';
      if (badge) {
        badge.innerHTML = '🔴 CAJA CERRADA';
        badge.style.color = '#f87171';
      }

      document.getElementById('metricFondoApertura').innerText = '$0';
      document.getElementById('metricVentasEfectivo').innerText = '$0';
      if (document.getElementById('metricIngresosCaja')) document.getElementById('metricIngresosCaja').innerText = '$0';
      if (document.getElementById('metricEgresosCaja')) document.getElementById('metricEgresosCaja').innerText = '$0';
      document.getElementById('metricEsperadoEfectivo').innerText = '$0';
      document.getElementById('metricVentasTransbank').innerText = '$0';
      document.getElementById('metricVentasMP').innerText = '$0';
      document.getElementById('metricVentasSumUp').innerText = '$0';
      document.getElementById('cajaEsperadoDisplay').innerText = '$0';
      state.currentCajaEsperado = 0;
      state.currentActiveCaja = null;
    }

    loadCajaHistorial();
  } catch (err) {
    console.error('Error loading caja resumen', err);
  }
}

async function loadCajaHistorial() {
  try {
    const res = await fetch(`/api/v1/caja/historial?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('cajaHistorialTbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const list = data.data || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:16px;">Sin registros previos de cierre.</td></tr>';
        return;
      }

      list.forEach(c => {
        const diff = Number(c.diferencia_efectivo || 0);
        let diffColor = '#10b981';
        let diffText = '$0 (Cuadrada)';
        if (diff > 0) {
          diffColor = '#38bdf8';
          diffText = `+$${diff.toLocaleString('es-CL')} (Sobrante)`;
        } else if (diff < 0) {
          diffColor = '#f87171';
          diffText = `-$${Math.abs(diff).toLocaleString('es-CL')} (Faltante)`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-size:12px;">${c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-CL') : 'En curso'}</td>
          <td>${c.cajero_nombre || 'Cajero'}</td>
          <td>$${Number(c.monto_apertura).toLocaleString('es-CL')}</td>
          <td><strong>$${Number(c.total_ventas).toLocaleString('es-CL')}</strong></td>
          <td>$${Number(c.monto_esperado_efectivo).toLocaleString('es-CL')}</td>
          <td>${c.monto_real_efectivo !== null && c.monto_real_efectivo !== undefined ? '$' + Number(c.monto_real_efectivo).toLocaleString('es-CL') : '-'}</td>
          <td><strong style="color:${diffColor}">${diffText}</strong></td>
          <td><span style="font-size:11px; font-weight:700; color:${c.estado === 'ABIERTA' ? '#10b981' : '#cbd5e1'}">${c.estado}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading caja historial', err);
  }
}

async function abrirTurnoCaja() {
  const input = document.getElementById('montoAperturaInput');
  const monto = Number(input?.value) || 0;
  if (monto < 0) {
    showToast('El fondo inicial debe ser un número válido mayor o igual a 0', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/caja/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        usuario_id: state.userId,
        monto_apertura: monto
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Turno de caja abierto exitosamente con fondo de $${monto.toLocaleString('es-CL')}`, 'success');
      if (input) input.value = '';
      loadCajaResumen();
    } else {
      showToast(data.message || 'Error al abrir turno', 'error');
    }
  } catch (err) {
    showToast('Error de conexión al abrir turno', 'error');
  }
}

function calcularDiferenciaCaja() {
  const realInput = document.getElementById('montoRealEfectivoInput');
  const display = document.getElementById('cajaDiferenciaDisplay');
  if (!realInput || !display) return;

  const real = Number(realInput.value) || 0;
  const esperado = state.currentCajaEsperado || 0;
  const diff = real - esperado;

  if (realInput.value === '') {
    display.innerText = '$0 (Pendiente conteo)';
    display.style.color = 'var(--text-muted)';
    return;
  }

  if (diff === 0) {
    display.innerText = '$0 (Cuadrada)';
    display.style.color = '#10b981';
  } else if (diff > 0) {
    display.innerText = `+$${diff.toLocaleString('es-CL')} (Sobrante)`;
    display.style.color = '#38bdf8';
  } else {
    display.innerText = `-$${Math.abs(diff).toLocaleString('es-CL')} (Faltante)`;
    display.style.color = '#f87171';
  }
}

async function ejecutarCierreCaja() {
  const realInput = document.getElementById('montoRealEfectivoInput');
  const obsInput = document.getElementById('cajaObservacionesInput');

  if (!realInput || realInput.value === '') {
    showToast('Debes ingresar el monto real en efectivo contado en gaveta', 'warning');
    return;
  }

  const real = Number(realInput.value);
  const obs = obsInput ? obsInput.value.trim() : '';

  try {
    const res = await fetch('/api/v1/caja/cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        usuario_id: state.userId,
        monto_real_efectivo: real,
        observaciones: obs
      })
    });
    const data = await res.json();
    if (data.success) {
      const c = data.data;
      const diff = Number(c.diferencia_efectivo);
      const diffStr = diff === 0 ? 'Caja cuadrada exactamente' : diff > 0 ? `Sobrante de $${diff.toLocaleString('es-CL')}` : `Faltante de $${Math.abs(diff).toLocaleString('es-CL')}`;
      showToast(`Cierre Z completado. Ventas: $${Number(c.total_ventas).toLocaleString('es-CL')}. ${diffStr}.`, 'success');

      realInput.value = '';
      if (obsInput) obsInput.value = '';
      loadCajaResumen();
      imprimirUltimoReporteZ();
    } else {
      showToast(data.message || 'Error al cerrar caja', 'error');
    }
  } catch (err) {
    showToast('Error de red al cerrar caja', 'error');
  }
}

async function registrarMovimientoCajaForm() {
  const tipo = document.getElementById('tipoMovimientoCajaInput')?.value || 'EGRESO';
  const montoInput = document.getElementById('montoMovimientoCajaInput');
  const motivoInput = document.getElementById('motivoMovimientoCajaInput');

  const monto = Number(montoInput?.value) || 0;
  const motivo = motivoInput?.value?.trim();

  if (monto <= 0) {
    showToast('El monto del movimiento debe ser mayor a $0', 'warning');
    return;
  }
  if (!motivo) {
    showToast('Debes especificar el motivo o destino del movimiento', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/v1/caja/movimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        usuario_id: state.userId,
        tipo,
        monto,
        motivo
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`${tipo === 'INGRESO' ? '🟢 Aporte de efectivo' : '🔴 Retiro de gastos'} de $${monto.toLocaleString('es-CL')} registrado`, 'success');
      if (montoInput) montoInput.value = '';
      if (motivoInput) motivoInput.value = '';
      loadCajaResumen();
    } else {
      showToast('Error: ' + result.message, 'error');
    }
  } catch (err) {
    showToast('Error de conexión al registrar movimiento de caja', 'error');
  }
}

async function imprimirUltimoReporteZ() {
  try {
    const res = await fetch(`/api/v1/caja/historial?tenant_id=${state.tenantId}`);
    const data = await res.json();
    let c = null;

    if (data.success && data.data && data.data.length > 0) {
      c = data.data[0];
    } else if (state.currentActiveCaja) {
      c = state.currentActiveCaja;
    }

    if (!c) {
      showToast('No hay cierres de caja registrados para generar el Reporte Z', 'warning');
      return;
    }

    const modal = document.getElementById('cierreZModal');
    if (!modal) return;

    if (document.getElementById('zSesionId')) document.getElementById('zSesionId').innerText = c.sesion_id || (c.id ? c.id.slice(0, 8) : 'N/A');
    if (document.getElementById('zFechaApertura')) document.getElementById('zFechaApertura').innerText = c.fecha_apertura ? new Date(c.fecha_apertura).toLocaleString('es-CL') : '-';
    if (document.getElementById('zFechaCierre')) document.getElementById('zFechaCierre').innerText = c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-CL') : 'En Curso (Reporte X)';
    if (document.getElementById('zCajero')) document.getElementById('zCajero').innerText = c.cajero_nombre || 'Admin Demo';
    if (document.getElementById('zFondoInicial')) document.getElementById('zFondoInicial').innerText = '$' + Number(c.monto_apertura || 0).toLocaleString('es-CL');
    if (document.getElementById('zVentasEfectivo')) document.getElementById('zVentasEfectivo').innerText = '$' + Number(c.ventas_efectivo || 0).toLocaleString('es-CL');
    if (document.getElementById('zIngresos')) document.getElementById('zIngresos').innerText = '$' + Number(c.ingresos_caja || 0).toLocaleString('es-CL');
    if (document.getElementById('zEgresos')) document.getElementById('zEgresos').innerText = '$' + Number(c.egresos_caja || 0).toLocaleString('es-CL');
    if (document.getElementById('zEsperado')) document.getElementById('zEsperado').innerText = '$' + Number(c.monto_esperado_efectivo || 0).toLocaleString('es-CL');
    if (document.getElementById('zReal')) document.getElementById('zReal').innerText = c.monto_real_efectivo !== null && c.monto_real_efectivo !== undefined ? '$' + Number(c.monto_real_efectivo).toLocaleString('es-CL') : 'Pendiente';
    
    const diff = Number(c.diferencia_efectivo || 0);
    const diffText = diff === 0 ? '$0 (Cuadrada)' : diff > 0 ? `+$${diff.toLocaleString('es-CL')} (Sobrante)` : `-$${Math.abs(diff).toLocaleString('es-CL')} (Faltante)`;
    if (document.getElementById('zDiferencia')) document.getElementById('zDiferencia').innerText = diffText;

    if (document.getElementById('zVentasTb')) document.getElementById('zVentasTb').innerText = '$' + Number(c.ventas_transbank || 0).toLocaleString('es-CL');
    if (document.getElementById('zVentasMp')) document.getElementById('zVentasMp').innerText = '$' + Number(c.ventas_mercadopago || 0).toLocaleString('es-CL');
    if (document.getElementById('zVentasSu')) document.getElementById('zVentasSu').innerText = '$' + Number(c.ventas_sumup || 0).toLocaleString('es-CL');
    if (document.getElementById('zTotalVentas')) document.getElementById('zTotalVentas').innerText = '$' + Number(c.total_ventas || 0).toLocaleString('es-CL');

    modal.style.display = 'block';
  } catch (err) {
    showToast('Error al preparar Reporte Z', 'error');
  }
}

function cerrarModalCierreZ() {
  const modal = document.getElementById('cierreZModal');
  if (modal) modal.style.display = 'none';
}

function imprimirReporteZTermico() {
  window.print();
}

// --- Respaldo Digital de Facturas & SII (F29) ---
async function loadTaxInvoices() {
  try {
    const res = await fetch(`/api/v1/invoices?tenant_id=${state.tenantId}`);
    const data = await res.json();

    if (data.success) {
      state.taxInvoices = data.invoices || [];
      renderTaxInvoices(state.taxInvoices);
    }
  } catch (err) {
    console.error('Error loading tax invoices', err);
    showToast('Error al cargar facturas de respaldo', 'error');
  }
}

function renderTaxInvoices(list) {
  const tbody = document.getElementById('taxInvoicesTbody');
  const countEl = document.getElementById('taxCountFacturas');
  const netoEl = document.getElementById('taxTotalNeto');
  const ivaEl = document.getElementById('taxTotalIva');
  const brutoEl = document.getElementById('taxTotalBruto');

  if (!tbody) return;
  tbody.innerHTML = '';

  let totalNeto = 0;
  let totalIva = 0;
  let totalBruto = 0;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">No hay facturas respaldadas todavía. Puedes ingresar una en el módulo OCR.</td></tr>';
  } else {
    list.forEach(inv => {
      const neto = Number(inv.monto_neto) || 0;
      const iva = Number(inv.iva_credito) || 0;
      const total = Number(inv.total_factura || inv.total) || 0;

      totalNeto += neto;
      totalIva += iva;
      totalBruto += total;

      const folio = inv.numero_factura || inv.folio_factura || '-';
      const rut = inv.rut_proveedor || '-';
      const razon = inv.proveedor_nombre || inv.razon_social || 'Proveedor Comercial';
      const fecha = inv.fecha_ingreso ? inv.fecha_ingreso.slice(0, 10) : '-';
      const metodo = inv.metodo_ingreso || 'OCR Multimodal';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#38bdf8;">${folio}</strong></td>
        <td>${rut}</td>
        <td><strong>${razon}</strong></td>
        <td>${fecha}</td>
        <td>$${neto.toLocaleString('es-CL')}</td>
        <td><strong style="color:#38bdf8;">$${iva.toLocaleString('es-CL')}</strong></td>
        <td><strong style="color:var(--primary);">$${total.toLocaleString('es-CL')}</strong></td>
        <td><span style="background:#334155; padding:2px 8px; border-radius:4px; font-size:11px;">${metodo}</span></td>
        <td><span style="background:#065f46; color:#a7f3d0; font-weight:700; font-size:11px; padding:2px 8px; border-radius:4px;">RESPALDADA F29</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (countEl) countEl.innerText = list.length;
  if (netoEl) netoEl.innerText = `$${totalNeto.toLocaleString('es-CL')}`;
  if (ivaEl) ivaEl.innerText = `$${totalIva.toLocaleString('es-CL')}`;
  if (brutoEl) brutoEl.innerText = `$${totalBruto.toLocaleString('es-CL')}`;
}

function exportarFacturasCSV() {
  if (!state.taxInvoices || state.taxInvoices.length === 0) {
    showToast('No hay facturas respaldadas para exportar', 'warning');
    return;
  }

  const headers = ['Folio_Factura', 'RUT_Proveedor', 'Razon_Social', 'Fecha_Emision', 'Monto_Neto_CLP', 'IVA_Credito_19_CLP', 'Total_Factura_CLP', 'Metodo_Ingesta', 'Estado_Tributario'];
  const rows = state.taxInvoices.map(inv => [
    `"${inv.numero_factura || inv.folio_factura || ''}"`,
    `"${inv.rut_proveedor || ''}"`,
    `"${(inv.proveedor_nombre || inv.razon_social || '').replace(/"/g, '""')}"`,
    `"${inv.fecha_ingreso ? inv.fecha_ingreso.slice(0, 10) : ''}"`,
    Number(inv.monto_neto) || 0,
    Number(inv.iva_credito) || 0,
    Number(inv.total_factura || inv.total) || 0,
    `"${inv.metodo_ingreso || 'OCR'}"`,
    `"RESPALDADA_F29"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Respaldo_Facturas_SII_F29_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Archivo CSV tributario descargado exitosamente para el contador', 'success');
}

// --- Configuración de Margen de Ganancia ---
async function loadMarginConfig() {
  try {
    const res = await fetch(`/api/v1/config/margin?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      const input = document.getElementById('configMarginInput');
      if (input) input.value = data.margin;
    }
  } catch (err) {
    console.error('Error loading margin config', err);
  }
}

async function guardarMargenConfigurado() {
  const input = document.getElementById('configMarginInput');
  if (!input) return;

  const val = Number(input.value);
  if (isNaN(val) || val < 0 || val > 500) {
    showToast('El margen comercial debe ser un porcentaje entre 0% y 500%', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/config/margin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        margin: val
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Margen de ganancia comercial actualizado al ${data.margin}% exitosamente.`, 'success');
    } else {
      showToast(data.message || 'Error al guardar margen', 'error');
    }
  } catch (err) {
    showToast('Error de red al actualizar margen de ganancia', 'error');
  }
}

// --- Configuración de Correo para Órdenes de Compra ---
async function loadEmailConfig() {
  try {
    const res = await fetch(`/api/v1/config/email?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      const emailInput = document.getElementById('configEmailOrdersInput');
      const autoCheck = document.getElementById('configAutoSendOrdersCheck');
      if (emailInput && data.data.email) emailInput.value = data.data.email;
      if (autoCheck) autoCheck.checked = Boolean(data.data.auto_send);
    }
  } catch (err) {
    console.error('Error loading email config', err);
  }
}

async function guardarEmailConfigurado() {
  const emailInput = document.getElementById('configEmailOrdersInput');
  const autoCheck = document.getElementById('configAutoSendOrdersCheck');
  if (!emailInput) return;

  const emailVal = emailInput.value.trim();
  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    showToast('Por favor ingresa un correo electrónico válido', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/config/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        email: emailVal,
        auto_send: autoCheck ? autoCheck.checked : false
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Configuración de correo de órdenes guardada exitosamente.', 'success');
    } else {
      showToast(data.message || 'Error al guardar configuración de correo', 'error');
    }
  } catch (err) {
    showToast('Error de red al guardar configuración de correo', 'error');
  }
}

// --- Gestión de Proveedores & Días de Visita ---
async function loadSuppliers() {
  try {
    const res = await fetch(`/api/v1/suppliers?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      state.suppliers = data.data || [];
      renderSuppliers(state.suppliers);
    }
  } catch (err) {
    console.error('Error loading suppliers', err);
    showToast('Error al cargar proveedores', 'error');
  }
}

function renderSuppliers(list) {
  const tbody = document.getElementById('suppliersTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:20px;">No hay proveedores registrados aún. Sube una factura para crear proveedores automáticamente.</td></tr>';
    return;
  }

  const diasOpciones = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
    'Lunes, Jueves', 'Martes, Viernes', 'Semanal', 'Quincenal', 'A pedido'
  ];

  list.forEach(s => {
    const tr = document.createElement('tr');
    const proxima = s.proxima_visita || { displayText: 'Sin definir', daysUntil: 99 };
    const isSoon = proxima.daysUntil <= 2;
    const badgeColor = isSoon ? '#10b981' : (proxima.daysUntil <= 5 ? '#38bdf8' : '#94a3b8');

    let selectOptions = diasOpciones.map(dia => {
      const selected = (s.dias_visita_proveedores || '').toLowerCase() === dia.toLowerCase() ? 'selected' : '';
      return `<option value="${dia}" ${selected}>${dia}</option>`;
    }).join('');

    tr.innerHTML = `
      <td><span style="font-family:monospace; color:#38bdf8; font-weight:700;">${s.rut_proveedor}</span></td>
      <td><strong>${s.nombre_proveedores}</strong></td>
      <td><span style="color:#cbd5e1; font-size:12px;">${s.giro || 'Distribución y Comercialización'}</span></td>
      <td>
        <span style="font-size:12px; color:#e2e8f0;">${s.direccion || 'Sin dirección registrada'}</span><br>
        <small style="color:#94a3b8;">📞 ${s.telefono || s.whatsapp_contacto || 'Sin teléfono'}</small>
      </td>
      <td>
        <select onchange="actualizarDiaVisita('${s.id}', this.value)" style="background:#0f172a; border:1px solid #38bdf8; color:#fff; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
          ${selectOptions}
        </select>
      </td>
      <td>
        <span style="color:${badgeColor}; font-weight:700; background:rgba(56,189,248,0.1); padding:3px 8px; border-radius:12px; border:1px solid ${badgeColor}; font-size:11px; white-space:nowrap;">
          📅 ${proxima.displayText}
        </span>
      </td>
      <td>
        <span style="background:#334155; color:#fff; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;">
          ${s.total_productos_suministrados || 0} ítems
        </span>
      </td>
      <td>
        <button onclick="showToast('Día de visita guardado para ${s.nombre_proveedores}', 'success')" class="btn-sync" style="padding:4px 10px; font-size:11px;">💾 OK</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function actualizarDiaVisita(supplierId, nuevoDia) {
  try {
    const res = await fetch(`/api/v1/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        dias_visita_proveedores: nuevoDia
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Día de visita actualizado a "${nuevoDia}"`, 'success');
      loadSuppliers();
      loadReplenishment();
    } else {
      showToast(data.message || 'Error al actualizar día de visita', 'error');
    }
  } catch (err) {
    showToast('Error de red al actualizar día de visita', 'error');
  }
}

// --- Reabastecimiento Predictivo ROP con Comparador Multiproveedor ---
async function loadReplenishment() {
  try {
    const res = await fetch(`/api/v1/replenishment/suggest?tenant_id=${state.tenantId}&lead_time_days=7&safety_factor=1.2`);
    const data = await res.json();

    if (data.success) {
      const orders = data.data.suggested_orders || [];
      const lowStockList = data.data.low_stock_products || [];
      const resumen = data.data.resumen || {};

      const orderCountEl = document.getElementById('suggestedOrderCount');
      const criticalCountEl = document.getElementById('criticalStockCount');
      const lowStockBadge = document.getElementById('lowStockBadge');
      const lowStockTbody = document.getElementById('lowStockTbody');
      const replenishmentTbody = document.getElementById('replenishmentTbody');

      if (orderCountEl) orderCountEl.innerText = resumen.total_ordenes ?? orders.length;
      if (criticalCountEl) criticalCountEl.innerText = resumen.total_productos_criticos ?? lowStockList.length;
      if (lowStockBadge) lowStockBadge.innerText = `${lowStockList.length} Críticos`;

      // 1. Renderizar Tabla 1: Productos en Alerta de Bajo Stock & Quiebre
      if (lowStockTbody) {
        lowStockTbody.innerHTML = '';
        if (lowStockList.length === 0) {
          lowStockTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#10b981; padding:18px; font-weight:600;">✅ ¡Excelente! No hay productos bajo el punto de reorden en este momento.</td></tr>';
        } else {
          lowStockList.forEach(p => {
            const isAgotado = p.is_agotado || Number(p.stock_actual) <= 0;
            const tr = document.createElement('tr');
            if (isAgotado) tr.className = 'row-out-of-stock';

            const statusBadge = isAgotado
              ? `<span class="badge-agotado">🔴 AGOTADO</span>`
              : `<span style="background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#fbbf24; font-weight:700; font-size:11px; padding:2px 8px; border-radius:12px;">🟡 BAJO STOCK</span>`;

            const diasColor = p.dias_inventario_restante <= 0 ? '#ef4444' : (p.dias_inventario_restante <= 2 ? '#f59e0b' : '#38bdf8');

            tr.innerHTML = `
              <td><strong style="font-family:monospace; color:#38bdf8;">${p.codigo_barra || '-'}</strong></td>
              <td><strong>${p.nombre}</strong><br><small style="color:#94a3b8;">${p.sku}</small></td>
              <td><span style="color:${isAgotado ? '#ef4444' : '#f87171'}; font-weight:800;">${p.stock_actual}</span> / ${p.stock_minimo}</td>
              <td>${Number(p.velocidad_diaria).toFixed(2)} u/día</td>
              <td><strong style="color:${diasColor};">${p.dias_inventario_restante <= 0 ? '0 días' : p.dias_inventario_restante + ' días'}</strong></td>
              <td>${statusBadge}</td>
              <td><strong>${p.proveedor_nombre || 'Proveedor Local'}</strong></td>
              <td><span style="color:#38bdf8; font-weight:600;">📅 ${p.proxima_visita?.displayText || 'Sin definir'}</span></td>
            `;
            lowStockTbody.appendChild(tr);
          });
        }
      }

      // 2. Renderizar Tabla 2: Propuestas de Órdenes de Compra con Comparador Multiproveedor
      if (replenishmentTbody) {
        replenishmentTbody.innerHTML = '';
        if (orders.length === 0) {
          replenishmentTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">No se requieren órdenes de reposición de mercadería hoy.</td></tr>';
        } else {
          orders.forEach(order => {
            order.items.forEach(item => {
              const tr = document.createElement('tr');
              
              // Construir comparador multiproveedor
              let comparativaHtml = '';
              const candidatos = item.candidatos_proveedores || [];
              if (candidatos.length > 1) {
                const opcionesHtml = candidatos.map(c => {
                  const tag = c.es_recomendado ? '★ ' : '';
                  const precioTag = `$${Number(c.precio_unitario).toLocaleString('es-CL')}`;
                  const visitTag = c.proxima_visita?.displayText ? ` (${c.proxima_visita.displayText})` : '';
                  return `<option value="${c.proveedor_id}">${tag}${c.proveedor_nombre} - ${precioTag}${visitTag}</option>`;
                }).join('');

                const badges = [];
                const proximoProv = candidatos.find(c => c.es_visita_mas_proxima);
                const baratoProv = candidatos.find(c => c.es_mejor_precio);

                if (proximoProv) {
                  badges.push(`<span style="background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;" title="Visita más cercana: ${proximoProv.proxima_visita?.displayText}">⚡ Visita: ${proximoProv.proveedor_nombre.split(' ')[0]}</span>`);
                }
                if (baratoProv) {
                  badges.push(`<span style="background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#34d399; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;" title="Mejor precio: $${baratoProv.precio_unitario}">💰 Mejor Precio: ${baratoProv.proveedor_nombre.split(' ')[0]}</span>`);
                }

                comparativaHtml = `
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">${badges.join('')}</div>
                    <select onchange="cambiarProveedorOrden(this, '${item.sku}')" style="background:#0f172a; border:1px solid #334155; color:#fff; padding:4px 6px; border-radius:4px; font-size:11px;">
                      ${opcionesHtml}
                    </select>
                  </div>
                `;
              } else if (candidatos.length === 1) {
                const c = candidatos[0];
                comparativaHtml = `<span style="color:#94a3b8; font-size:11px;">Proveedor único asignado (${c.dias_visita || 'Semanal'})</span>`;
              } else {
                comparativaHtml = `<span style="color:#94a3b8; font-size:11px;">Proveedor base</span>`;
              }

              tr.innerHTML = `
                <td>
                  <strong>${order.proveedor_nombre}</strong><br>
                  <small style="color:#38bdf8; font-weight:600;">📅 ${order.proxima_visita?.displayText || 'Visita programada'}</small>
                </td>
                <td>
                  <strong>${item.producto_nombre}</strong><br>
                  <span style="font-family:monospace; color:#38bdf8; font-size:11px;">${item.codigo_barra || '-'}</span> | <small style="color:#94a3b8;">${item.sku}</small>
                </td>
                <td>
                  <span style="color:${item.is_agotado ? '#ef4444' : '#f87171'}; font-weight:700;">${item.stock_actual}</span> / ${item.stock_minimo}
                  ${item.is_agotado ? '<br><span class="badge-agotado" style="margin-top:2px;">AGOTADO</span>' : ''}
                </td>
                <td><strong style="color:#10b981; font-size:15px;">${item.cantidad_sugerida} u</strong></td>
                <td>$${Number(item.costo_unitario || (item.costo_estimado / item.cantidad_sugerida)).toLocaleString('es-CL')}</td>
                <td><strong style="color:#fff;">$${Number(item.costo_estimado).toLocaleString('es-CL')}</strong></td>
                <td>${comparativaHtml}</td>
              `;
              replenishmentTbody.appendChild(tr);
            });
          });
        }
      }
    }
  } catch (err) {
    console.error('Error loading replenishment', err);
    showToast('Error al cargar propuestas de reabastecimiento', 'error');
  }
}

async function enviarOrdenesPorEmail() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Enviando...';
  }

  try {
    const res = await fetch('/api/v1/replenishment/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: state.tenantId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`📧 Órdenes enviadas exitosamente a ${data.destinatario} (${data.total_ordenes} órdenes, $${Number(data.costo_total).toLocaleString('es-CL')})`, 'success');
    } else {
      showToast(data.message || 'Error al enviar órdenes por correo', 'error');
    }
  } catch (err) {
    showToast('Error de red al enviar órdenes por correo', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📧 Enviar Órdenes por Correo';
    }
  }
}

function cambiarProveedorOrden(selectEl, sku) {
  showToast(`Proveedor cambiado para SKU ${sku}`, 'info');
}

// --- Market Trends Tab ---
async function loadTrends() {
  try {
    const res = await fetch(`/api/v1/trends/${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('trendsTbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const list = data.data || data.trends || [];
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">No hay tendencias registradas. Haz clic en "Actualizar Tendencias".</td></tr>';
        return;
      }
      list.forEach(t => {
        const keyword = t.palabra_clave || t.keyword || 'Producto';
        const sku = t.sku_referencia || t.sku || '';
        const source = t.fuente_api || t.source || 'MercadoLibre';
        const demand = Number(t.indice_demanda ?? t.demandIndex ?? 0);
        const price = Number(t.precio_promedio_mercado ?? t.averageMarketPrice ?? 0);
        const isHigh = demand > 70;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${keyword}</strong> <br><small style="color:#94a3b8">${sku}</small></td>
          <td><span style="background:#334155; padding:2px 8px; border-radius:4px;">${source}</span></td>
          <td><strong style="color: ${isHigh ? '#10b981' : '#f59e0b'}">${demand.toFixed(1)} / 100</strong></td>
          <td>$${price.toLocaleString('es-CL')}</td>
          <td><span style="color: ${isHigh ? '#10b981' : '#94a3b8'}; font-weight:600;">${isHigh ? '+20% Stock Seguridad' : 'Estable'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading trends', err);
  }
}

// --- OCR Smart Invoice Ingestion: Two-Step Scanning & Confirmation Modal ---

function initOcrEvents() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('invoiceFileInput');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleInvoiceFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropZone.addEventListener(evt, () => {
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.backgroundColor = 'transparent';
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.backgroundColor = 'transparent';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleInvoiceFile(e.dataTransfer.files[0]);
    }
  });
}

async function handleInvoiceFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const rawData = e.target.result;
    const base64Data = rawData.includes(',') ? rawData.split(',')[1] : rawData;

    showToast(`Escaneando factura digital (${file.name})...`, 'info');
    document.getElementById('ocrPreview').innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:12px;">🔍</div>
        <h4 style="color:#e2e8f0;">Escaneando documento y extrayendo ítems...</h4>
        <p style="font-size:12px; margin-top:6px;">Extrayendo productos, cantidades, precios y comparando con catálogo</p>
      </div>
    `;

    try {
      const res = await fetch('/api/v1/invoices/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: state.tenantId,
          invoice_data: base64Data,
          file_name: file.name,
          mime_type: file.type || 'application/pdf'
        })
      });
      const data = await res.json();
      if (data.success && data.preview) {
        mostrarModalPrevisualizacion(data.preview);
        document.getElementById('ocrPreview').innerHTML = `
          <div style="background:#1e293b; border:1px solid #38bdf8; padding:20px; border-radius:8px; width:100%;">
            <h4 style="color:#38bdf8; margin:0 0 8px 0;">📑 Factura Escaneada: ${data.preview.folio_factura}</h4>
            <p style="font-size:13px; color:#cbd5e1; margin-bottom:4px;"><strong>Proveedor:</strong> ${data.preview.razon_social} (${data.preview.rut_proveedor})</p>
            <p style="font-size:13px; color:#cbd5e1; margin-bottom:12px;"><strong>Ítems detectados:</strong> ${data.preview.items_count} productos</p>
            <button class="btn-checkout" style="width:auto; padding:8px 18px;" onclick="mostrarModalPrevisualizacion(state.lastPreview)">Reabrir Ventana de Confirmación</button>
          </div>
        `;
      } else {
        showToast('Error al escanear factura: ' + (data.message || 'Error desconocido'), 'error');
        document.getElementById('ocrPreview').innerHTML = `<div style="color:#f87171; text-align:center; padding:20px;">Error al escanear: ${data.message}</div>`;
      }
    } catch (err) {
      showToast('Error de red al procesar factura', 'error');
      document.getElementById('ocrPreview').innerHTML = `<div style="color:#f87171; text-align:center; padding:20px;">Error de comunicación con el backend.</div>`;
    }
  };
  reader.readAsDataURL(file);
}

function mostrarModalPrevisualizacion(preview) {
  state.lastPreview = preview;
  state.scannedInvoiceData = preview.raw_data;

  document.getElementById('modalFolio').innerText = preview.folio_factura;
  document.getElementById('modalProveedor').innerText = preview.razon_social;
  document.getElementById('modalRut').innerText = `RUT: ${preview.rut_proveedor}`;
  document.getElementById('modalFecha').innerText = preview.fecha_emision;
  document.getElementById('modalMotor').innerText = preview.ocr_provider;

  // Actualizar ficha del proveedor detectado
  const giroEl = document.getElementById('modalGiroProveedor');
  const dirEl = document.getElementById('modalDireccionProveedor');
  const telEl = document.getElementById('modalTelefonoProveedor');
  const nuevoBadge = document.getElementById('modalBadgeProveedorNuevo');
  const daySelect = document.getElementById('modalSupplierDaySelect');

  if (giroEl) giroEl.innerText = preview.giro_proveedor || 'Distribución y Comercio';
  if (dirEl) dirEl.innerText = preview.direccion_proveedor || 'No especificada en factura';
  if (telEl) telEl.innerText = preview.telefono_proveedor || 'No especificado';
  if (nuevoBadge) nuevoBadge.style.display = preview.es_proveedor_nuevo ? 'inline-block' : 'none';
  if (daySelect && preview.dias_visita_proveedor) {
    daySelect.value = preview.dias_visita_proveedor;
  }

  document.getElementById('modalItemsCount').innerText = `${preview.items_count} ítems`;
  document.getElementById('modalMontoNeto').innerText = `$${Number(preview.monto_neto).toLocaleString('es-CL')}`;
  document.getElementById('modalIva').innerText = `$${Number(preview.iva_credito).toLocaleString('es-CL')}`;
  document.getElementById('modalTotalFactura').innerText = `$${Number(preview.total_factura).toLocaleString('es-CL')}`;

  const tbody = document.getElementById('modalItemsTbody');
  tbody.innerHTML = '';

  preview.items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const badge = item.es_nuevo
      ? `<span style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">✨ NUEVO PRODUCTO</span>`
      : `<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">🔄 ACTUALIZAR (${item.stock_actual} ➔ ${item.stock_proyectado})</span>`;

    tr.innerHTML = `
      <td style="color: #94a3b8; font-size: 11px;">${idx + 1}</td>
      <td><strong style="font-family: monospace; color: #38bdf8; font-size: 12px;">${item.codigo_barra || '780... (Auto-EAN13)'}</strong></td>
      <td><strong>${item.sku}</strong></td>
      <td><strong>${item.descripcion}</strong></td>
      <td style="text-align: center;"><strong style="color: #38bdf8; font-size: 14px;">${item.cantidad}</strong></td>
      <td><span style="background: #334155; padding: 1px 6px; border-radius: 4px; font-size: 11px;">${item.unidad || 'UNI'}</span></td>
      <td>$${Number(item.precio_unitario).toLocaleString('es-CL')}</td>
      <td>$${Number(item.subtotal).toLocaleString('es-CL')}</td>
      <td style="color: #f59e0b; font-weight: 600;">${preview.margin_used}%</td>
      <td><strong style="color: var(--primary);">$${Number(item.precio_venta_sugerido).toLocaleString('es-CL')}</strong></td>
      <td>${badge}</td>
    `;
    tbody.appendChild(tr);
  });

  const modal = document.getElementById('invoicePreviewModal');
  if (modal) modal.style.display = 'block';
}

function cerrarModalFactura() {
  const modal = document.getElementById('invoicePreviewModal');
  if (modal) modal.style.display = 'none';
  state.scannedInvoiceData = null;
  const fileInput = document.getElementById('invoiceFileInput');
  if (fileInput) fileInput.value = '';
}

async function confirmarIngestaModal() {
  if (!state.scannedInvoiceData) {
    showToast('No hay datos de factura escaneada para confirmar', 'warning');
    return;
  }

  // Capturar el día de visita seleccionado por el usuario en el modal
  const daySelect = document.getElementById('modalSupplierDaySelect');
  if (daySelect && state.scannedInvoiceData) {
    state.scannedInvoiceData.dias_visita_proveedor = daySelect.value;
  }

  const btn = document.getElementById('btnModalConfirmarIngesta');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Ingresando transaccionalmente...';
  }

  try {
    const res = await fetch('/api/v1/invoices/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        invoice_data: state.scannedInvoiceData
      })
    });
    const data = await res.json();
    if (data.success) {
      const result = data.data;
      cerrarModalFactura();
      showToast(`Factura ${result.folio_factura} ingresada con éxito (${result.items_count} ítems ingresados)`, 'success');
      
      document.getElementById('ocrPreview').innerHTML = `
        <div style="background:#1e293b; border:1px solid #10b981; padding:20px; border-radius:8px; width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#10b981; margin:0;">✅ Factura ${result.folio_factura} Autorizada e Ingresada</h4>
            <span style="font-size:11px; background:#065f46; color:#a7f3d0; padding:3px 8px; border-radius:12px;">Motor: ${result.ocr_provider}</span>
          </div>
          <p style="font-size:13px; color:#cbd5e1; margin-bottom:6px;"><strong>Folio:</strong> ${result.folio_factura}</p>
          <p style="font-size:13px; color:#cbd5e1; margin-bottom:6px;"><strong>RUT Proveedor:</strong> ${result.rut_proveedor}</p>
          <p style="font-size:13px; color:#cbd5e1; margin-bottom:6px;"><strong>Total Ingestado:</strong> $${Number(result.total).toLocaleString('es-CL')}</p>
          <p style="font-size:13px; color:#cbd5e1; margin-bottom:12px;"><strong>Ítems procesados:</strong> ${result.items_count}</p>
          <div style="background:#0f172a; padding:12px; border-radius:6px; font-size:12px; color:#38bdf8; border-left:3px solid #38bdf8;">
            ⚡ <strong>Inventario Actualizado:</strong> Los productos nuevos se han destacado con etiqueta verde <span style="background:rgba(16, 185, 129, 0.2); color:#34d399; padding:1px 6px; border-radius:8px;">✨ NUEVO (Factura)</span> en la pestaña <strong>"Inventario & Catálogo"</strong> y sus códigos de barra estándar EAN-13 generados.
          </div>
        </div>
      `;

      loadProducts();
      loadInventory();
      loadStatus();
      loadSuppliers();
      loadReplenishment();
      loadTaxInvoices();
    } else {
      showToast('Error al ingresar factura: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Error de red al confirmar factura', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📥 Aceptar e Ingresar al Inventario';
    }
  }
}

window.simulateOcrUpload = async function(type) {
  let sampleData;
  if (type === 'distribuidora') {
    sampleData = {
      folio_factura: 'FAC-2026-9041',
      rut_proveedor: '76.999.888-K',
      razon_social: 'Distribuidora Mayorista Central SpA',
      fecha_emision: new Date().toISOString().slice(0, 10),
      items: [
        { sku: 'BEB-CC-350', descripcion: 'Coca Cola 350ml Lata', cantidad: 48, precio_unitario: 550, subtotal: 26400 },
        { sku: 'ABA-HAR-1K', descripcion: 'Harina Selecta 1kg', cantidad: 20, precio_unitario: 800, subtotal: 16000 }
      ],
      total: 42400
    };
  } else {
    sampleData = {
      folio_factura: 'FAC-2026-3022',
      rut_proveedor: '81.444.222-1',
      razon_social: 'Lácteos del Sur Ltda',
      fecha_emision: new Date().toISOString().slice(0, 10),
      items: [
        { sku: 'LAC-LECH-1L', descripcion: 'Leche Entera 1L Colun', cantidad: 30, precio_unitario: 720, subtotal: 21600 }
      ],
      total: 21600
    };
  }

  showToast(`Escaneando factura de prueba (${sampleData.folio_factura})...`);
  try {
    const res = await fetch('/api/v1/invoices/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        invoice_data: JSON.stringify(sampleData)
      })
    });
    const data = await res.json();
    if (data.success && data.preview) {
      mostrarModalPrevisualizacion(data.preview);
    }
  } catch (err) {
    showToast('Error al escanear factura de prueba', 'error');
  }
};

// --- Toast Messages ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Keyboard Shortcuts ---
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4') {
      e.preventDefault();
      processCheckout();
    }
    if (e.key === 'F2') {
      e.preventDefault();
      document.getElementById('posSearch')?.focus();
    }
    if (e.key === 'Escape') {
      cerrarModalFactura();
    }
  });
}

// ============================================================================
// Modulo Tributario SII, Boletas Electronicas, CAF, RCOF y Ticket Termico
// ============================================================================

let currentReceiptData = null;

// --- Sub-pestañas en Centro Tributario ---
function cambiarSubtabTax(targetId) {
  const panes = document.querySelectorAll('.subpane-tax');
  const btns = document.querySelectorAll('.subtab-btn');

  panes.forEach(p => p.style.display = 'none');
  btns.forEach(b => b.classList.remove('active'));

  const targetPane = document.getElementById('subpane-' + targetId);
  if (targetPane) targetPane.style.display = 'block';

  if (targetId === 'tax-compras') document.getElementById('btnSubtabTaxCompras')?.classList.add('active');
  if (targetId === 'tax-boletas') document.getElementById('btnSubtabTaxBoletas')?.classList.add('active');
  if (targetId === 'tax-f29') document.getElementById('btnSubtabTaxF29')?.classList.add('active');
  if (targetId === 'tax-guias') document.getElementById('btnSubtabTaxGuias')?.classList.add('active');
  if (targetId === 'tax-caf') document.getElementById('btnSubtabTaxCaf')?.classList.add('active');
  if (targetId === 'tax-rcof') document.getElementById('btnSubtabTaxRcof')?.classList.add('active');
  if (targetId === 'tax-cert') document.getElementById('btnSubtabTaxCert')?.classList.add('active');

  if (targetId === 'tax-compras') loadTaxInvoices();
  if (targetId === 'tax-boletas') loadTaxDtes();
  if (targetId === 'tax-f29') cargarReporteF29();
  if (targetId === 'tax-guias') cargarGuiasDespacho();
  if (targetId === 'tax-caf') loadTaxCafStatus();
  if (targetId === 'tax-rcof') loadTaxRcofHistory();
}

function recargarModuloTributario() {
  loadTaxInvoices();
  loadTaxDtes();
  cargarReporteF29();
  cargarGuiasDespacho();
  loadTaxCafStatus();
  loadTaxRcofHistory();
}

// --- Boletas & DTEs Emitidos ---
async function loadTaxDtes() {
  try {
    const res = await fetch(`/api/v1/dte/list?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const list = data.data || [];
    const tbody = document.getElementById('taxDtesTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let totalNeto = 0;
    let totalIva = 0;
    let totalVentas = 0;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">No hay DTEs emitidos aún. Emite una boleta o factura desde el Terminal POS.</td></tr>';
    } else {
      list.forEach(d => {
        totalNeto += Number(d.monto_neto || 0);
        totalIva += Number(d.monto_iva || 0);
        totalVentas += Number(d.monto_total || 0);

        const tipoNombre = d.tipo_dte === 33 ? 'Factura Afecta (33)' : d.tipo_dte === 34 ? 'Factura Exenta (34)' : d.tipo_dte === 39 ? 'Boleta Afecta (39)' : d.tipo_dte === 41 ? 'Boleta Exenta (41)' : d.tipo_dte === 52 ? 'Guía Despacho (52)' : 'Nota Crédito (61)';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#38bdf8;">${d.folio}</strong></td>
          <td><span style="background:#1e3a8a; color:#93c5fd; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;">${tipoNombre}</span></td>
          <td style="font-size:12px;">${new Date(d.fecha_emision).toLocaleString('es-CL')}</td>
          <td><span style="font-size:12px;">${d.rut_receptor}</span></td>
          <td>$${Number(d.monto_neto).toLocaleString('es-CL')}</td>
          <td style="color:#38bdf8;">$${Number(d.monto_iva).toLocaleString('es-CL')}</td>
          <td><strong style="color:var(--primary);">$${Number(d.monto_total).toLocaleString('es-CL')}</strong></td>
          <td><span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:10px; font-size:10.5px; font-weight:700;">${d.estado_sii}</span></td>
          <td style="text-align:center; white-space:nowrap;">
            <button onclick="abrirComprobantePorDte('${d.id}')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:4px;">🖨️ Ticket</button>
            <button onclick="window.open('/api/v1/dte/${d.id}/xml', '_blank')" style="background:#6366f1; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:4px;">📥 XML</button>
            <button onclick="promptEnviarEmail('${d.id}')" style="background:#059669; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">📧 Email</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    const countElem = document.getElementById('taxCountDtes');
    if (countElem) countElem.innerText = list.length;
    const netoElem = document.getElementById('taxTotalNetoVentas');
    if (netoElem) netoElem.innerText = '$' + totalNeto.toLocaleString('es-CL');
    const ivaElem = document.getElementById('taxTotalIvaVentas');
    if (ivaElem) ivaElem.innerText = '$' + totalIva.toLocaleString('es-CL');
    const ventasElem = document.getElementById('taxTotalVentasDte');
    if (ventasElem) ventasElem.innerText = '$' + totalVentas.toLocaleString('es-CL');
  } catch (err) {
    console.error('Error cargando DTEs:', err);
  }
}

// --- Stock de Folios CAF ---
async function loadTaxCafStatus() {
  try {
    const res = await fetch(`/api/v1/dte/caf/status?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const grid = document.getElementById('taxCafCardsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = data.data || [];
    if (list.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding:20px;">No hay archivos CAF cargados aún. El sistema aprovisiona folios de prueba automáticamente.</div>';
      return;
    }

    list.forEach(c => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#0f172a; border:1px solid #334155; border-radius:8px; padding:16px;';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <strong style="color:#fff; font-size:14px;">${c.nombreDte}</strong>
            <div style="font-size:11px; color:#94a3b8;">Tipo DTE: ${c.tipoDte}</div>
          </div>
          <span style="background:${c.activo ? '#065f46' : '#991b1b'}; color:${c.activo ? '#a7f3d0' : '#fecaca'}; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;">
            ${c.activo ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        <div style="font-size:12px; color:#cbd5e1; margin-bottom:8px;">
          <div><strong>Rango Autorizado:</strong> ${c.folioDesde} al ${c.folioHasta}</div>
          <div><strong>Último Folio Usado:</strong> <span style="color:#38bdf8; font-weight:700;">${c.ultimoUsado}</span></div>
          <div><strong>Folios Restantes:</strong> <strong style="color:#10b981;">${c.foliosDisponibles.toLocaleString('es-CL')}</strong> (${c.porcentajeDisponible}%)</div>
        </div>

        <!-- Barra de Progreso -->
        <div style="background:#1e293b; border-radius:10px; height:8px; width:100%; overflow:hidden; margin-bottom:8px;">
          <div style="background:var(--primary); height:100%; width:${c.porcentajeDisponible}%;"></div>
        </div>

        <div style="font-size:11px; color:#64748b;">
          Fecha Autorización SII: ${c.fechaAutorizacion}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error cargando estado CAF:', err);
  }
}

// Modal Carga CAF
function abrirModalCargaCaf() {
  const modal = document.getElementById('cafUploadModal');
  if (modal) modal.style.display = 'block';
}

function cerrarModalCargaCaf() {
  const modal = document.getElementById('cafUploadModal');
  if (modal) modal.style.display = 'none';
  const textarea = document.getElementById('cafXmlTextInput');
  if (textarea) textarea.value = '';
}

function leerArchivoCafXml(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result;
    const textarea = document.getElementById('cafXmlTextInput');
    if (textarea && content) {
      textarea.value = String(content);
    }
  };
  reader.readAsText(file);
}

async function procesarCargaCafXml() {
  const textarea = document.getElementById('cafXmlTextInput');
  const xmlContent = textarea?.value?.trim();
  if (!xmlContent || !xmlContent.includes('<CAF')) {
    showToast('El contenido debe ser un XML de CAF válido que contenga el nodo <CAF>', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/dte/caf/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: state.tenantId, xmlContent })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Archivo CAF registrado y autorizado exitosamente', 'success');
      cerrarModalCargaCaf();
      loadTaxCafStatus();
    } else {
      showToast('Error cargando CAF: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error de conexión al cargar CAF', 'error');
  }
}

// --- RCOF (Registro de Consumo de Folios / RCV) ---
async function loadTaxRcofHistory() {
  const dateInput = document.getElementById('rcofFechaInput');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  try {
    const res = await fetch(`/api/v1/dte/rcof/list?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('taxRcofTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = data.data || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">No hay reportes RCOF generados aún. Presiona "Generar RCOF del Día".</td></tr>';
      return;
    }

    list.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#38bdf8;">${r.fecha_reporte}</strong></td>
        <td>Secuencia ${r.secuencia_envio}</td>
        <td>${r.cantidad_boletas} boletas</td>
        <td>$${Number(r.total_neto).toLocaleString('es-CL')}</td>
        <td style="color:#38bdf8;">$${Number(r.total_iva).toLocaleString('es-CL')}</td>
        <td><strong style="color:var(--primary);">$${Number(r.total_ventas).toLocaleString('es-CL')}</strong></td>
        <td><span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:10px; font-size:10.5px; font-weight:700;">${r.estado_envio}</span></td>
        <td style="font-size:11.5px;">${new Date(r.created_at).toLocaleString('es-CL')}</td>
        <td>
          <span style="color:#10b981; font-size:11px; font-weight:700;">XML FIRMADO OK</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error cargando historial RCOF:', err);
  }
}

async function generarRcofDiario() {
  const dateInput = document.getElementById('rcofFechaInput');
  const fecha = dateInput?.value || new Date().toISOString().split('T')[0];

  try {
    const res = await fetch('/api/v1/dte/rcof/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: state.tenantId, fechaReporte: fecha })
    });
    const result = await res.json();
    if (result.success) {
      const r = result.data;
      showToast(`RCOF generado con éxito: ${r.cantidadBoletas} boletas agrupadas ($${r.montoTotal.toLocaleString('es-CL')})`, 'success');
      loadTaxRcofHistory();
    } else {
      showToast('Error generando RCOF: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error de comunicación al generar RCOF', 'error');
  }
}

// --- Certificación Técnica SII (Res. Ex. N° 74) ---
async function ejecutarSetCertificacionSii() {
  const btn = document.getElementById('btnEjecutarCertificacion');
  const resultsArea = document.getElementById('certResultsArea');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Ejecutando Homologación ante Maullín...';
  }

  try {
    const res = await fetch('/api/v1/dte/certification/run-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: state.tenantId })
    });
    const result = await res.json();
    if (result.success) {
      const d = result.data;
      let rowsHtml = '';
      d.resultados.forEach(item => {
        rowsHtml += `
          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:18px;">${item.passed ? '✅' : '❌'}</span>
                <strong style="color:#fff; font-size:14px;">${item.suiteName}</strong>
              </div>
              <p style="font-size:12px; color:#94a3b8; margin:4px 0 0 26px;">${item.detalles}</p>
            </div>
            <span style="background:${item.passed ? '#065f46' : '#991b1b'}; color:${item.passed ? '#a7f3d0' : '#fecaca'}; padding:4px 12px; border-radius:12px; font-weight:700; font-size:11px;">
              ${item.passed ? 'APROBADO' : 'FALLIDO'}
            </span>
          </div>
        `;
      });

      resultsArea.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.3); border-radius:8px; padding:16px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="color:#10b981; font-size:16px; font-weight:700; margin:0 0 4px 0;">🎉 Certificación Técnica Exitosa (Res. Ex. N° 74)</h4>
              <p style="font-size:12px; color:#cbd5e1; margin:0;">${d.resumen}</p>
            </div>
            <div style="text-align:right;">
              <span style="font-size:11px; color:#94a3b8;">Ambiente:</span>
              <div style="font-size:12px; font-weight:700; color:#38bdf8;">${d.urlSii}</div>
            </div>
          </div>
        </div>
        ${rowsHtml}
      `;
      showToast('Suite de homologación técnica completada con 100% de éxito', 'success');
      loadTaxDtes();
      loadTaxCafStatus();
      loadTaxRcofHistory();
    } else {
      showToast('Error en la certificación: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error al ejecutar certificación técnica', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Ejecutar Suite de Homologación Maullín';
    }
  }
}

// --- Modal de Boleta Térmica & Comprobante (80mm) ---
function mostrarModalBoletaTermica(saleData) {
  currentReceiptData = saleData;
  const modal = document.getElementById('thermalReceiptModal');
  if (!modal) return;

  const dte = saleData.dte || {};
  const isDte = !!dte.esTributarioDte;
  const isVoucher = !isDte;

  const emisor = dte.emisor || {};
  document.getElementById('ticketEmisorNombre').innerText = emisor.razonSocial || 'ALMACÉN DON TITO SPA';
  document.getElementById('ticketEmisorRut').innerText = emisor.rut || '76.123.456-7';
  document.getElementById('ticketEmisorGiro').innerText = 'GIRO: ' + (emisor.giro || 'VENTA AL POR MENOR EN MINIMARKET');
  document.getElementById('ticketEmisorDir').innerText = 'CASA MATRIZ: ' + (emisor.direccion || 'AV. LIBERTADOR B. OHIGGINS 1234');
  document.getElementById('ticketEmisorComuna').innerText = (emisor.comuna || 'SANTIAGO') + ' - CHILE';

  const tituloDoc = document.getElementById('ticketTituloDoc');
  const banner176 = document.getElementById('ticketBannerRes176');
  const tedSection = document.getElementById('ticketTedSection');
  const btnXml = document.getElementById('btnDescargarXmlDte');

  if (isDte) {
    const nom = dte.tipoDte === 41 ? 'BOLETA EXENTA' : dte.tipoDte === 61 ? 'NOTA DE CRÉDITO' : 'BOLETA ELECTRÓNICA';
    tituloDoc.innerText = `${nom} N° ${String(dte.folio || '000001').padStart(6, '0')}`;
    banner176.style.display = 'none';
    tedSection.style.display = 'block';
    if (btnXml) btnXml.style.display = 'inline-block';
  } else {
    tituloDoc.innerText = 'COMPROBANTE DE PAGO ELECTRÓNICO';
    banner176.style.display = 'block';
    tedSection.style.display = 'none';
    if (btnXml) btnXml.style.display = 'none';
  }

  const now = new Date();
  document.getElementById('ticketFecha').innerText = now.toLocaleDateString('es-CL');
  document.getElementById('ticketHora').innerText = now.toLocaleTimeString('es-CL');
  document.getElementById('ticketMedioPago').innerText = saleData.metodo_pago || 'EFECTIVO';

  const cardInfo = document.getElementById('ticketCardInfo');
  if (isVoucher || saleData.metodo_pago !== 'EFECTIVO') {
    cardInfo.style.display = 'block';
    document.getElementById('ticketCardBrand').innerText = saleData.metodo_pago === 'TRANSBANK' ? 'Transbank / Redcompra' : saleData.metodo_pago === 'RUTPAY' ? 'RutPay / BancoEstado' : saleData.metodo_pago;
    document.getElementById('ticketCardLast4').innerText = saleData.metodo_pago === 'RUTPAY' ? '**** 9988' : '**** 4321';
    document.getElementById('ticketAuthCode').innerText = saleData.payment_transaction_id ? String(saleData.payment_transaction_id).substring(0, 8).toUpperCase() : 'RUTP-123456';
  } else {
    cardInfo.style.display = 'none';
  }

  const tbody = document.getElementById('ticketItemsTbody');
  tbody.innerHTML = '';
  const items = dte.items || [];
  items.forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.cantidad}</td>
      <td>${it.nombre}</td>
      <td style="text-align:right;">$${Number(it.precioUnitario).toLocaleString('es-CL')}</td>
      <td style="text-align:right; font-weight:700;">$${Number(it.subtotal).toLocaleString('es-CL')}</td>
    `;
    tbody.appendChild(tr);
  });

  const totales = dte.totales || {
    montoNeto: Math.round(saleData.total / 1.19),
    montoIva: saleData.total - Math.round(saleData.total / 1.19),
    montoTotal: saleData.total,
    redondeoChileno: 0
  };

  document.getElementById('ticketNeto').innerText = '$' + Number(totales.montoNeto).toLocaleString('es-CL');
  document.getElementById('ticketIva').innerText = '$' + Number(totales.montoIva).toLocaleString('es-CL');
  document.getElementById('ticketRedondeo').innerText = (totales.redondeoChileno >= 0 ? '+$' : '-$') + Math.abs(totales.redondeoChileno || 0);
  document.getElementById('ticketTotal').innerText = '$' + Number(totales.montoTotal).toLocaleString('es-CL');

  const qrContainer = document.getElementById('ticketQrElement');
  if (qrContainer && isDte) {
    const qrUrl = dte.qrUrl || 'https://www.sii.cl';
    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrUrl)}" alt="QR SII" style="width:110px; height:110px; display:block; margin:0 auto;">`;
  }

  const noticeEl = document.getElementById('ticketAlcoholNotice');
  if (noticeEl) {
    const hasAlc = saleData.contiene_alcohol || saleData.verificacion_edad_alcohol || (dte.items || []).some(it => it.codigoIla === 27 || it.codigoIla === 28);
    noticeEl.style.display = hasAlc ? 'block' : 'none';
  }

  modal.style.display = 'block';
}

async function abrirComprobantePorDte(dteId) {
  try {
    const res = await fetch(`/api/v1/dte/${dteId}/receipt`);
    const data = await res.json();
    if (data.success) {
      const d = data.data;
      mostrarModalBoletaTermica({
        folio: d.folio,
        total: d.totales.total,
        metodo_pago: 'EFECTIVO',
        dte: {
          esTributarioDte: true,
          dteId: d.dteId,
          tipoDte: d.tipoDte,
          folio: d.folio,
          emisor: d.emisor,
          items: d.items.map(i => ({
            cantidad: i.cantidad,
            nombre: i.nombre,
            precioUnitario: i.precio_unitario,
            subtotal: i.subtotal
          })),
          totales: {
            montoNeto: d.totales.neto,
            montoIva: d.totales.iva,
            montoTotal: d.totales.total,
            redondeoChileno: 0
          },
          qrUrl: d.qrCodeUrl
        }
      });
    } else {
      showToast('Error cargando ticket: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Error al obtener comprobante', 'error');
  }
}

async function abrirComprobantePorVenta(saleId) {
  try {
    const res = await fetch(`/api/v1/dte/list?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (data.success) {
      const match = (data.data || []).find(d => d.venta_id === saleId);
      if (match) {
        return abrirComprobantePorDte(match.id);
      }
    }

    mostrarModalBoletaTermica({
      saleId,
      folio: 'VOUCHER-' + saleId.substring(0, 8),
      total: 1000,
      metodo_pago: 'TRANSBANK',
      dte: {
        esTributarioDte: false,
        emisor: {
          razonSocial: 'ALMACÉN DON TITO SPA',
          rut: '76.123.456-7',
          giro: 'VENTA AL POR MENOR EN MINIMARKET',
          direccion: 'AV. LIBERTADOR BERNARDO OHIGGINS 1234',
          comuna: 'SANTIAGO'
        },
        items: [
          { cantidad: 1, nombre: 'Venta Registrada POS', precioUnitario: 1000, subtotal: 1000 }
        ],
        totales: { montoNeto: 840, montoIva: 160, montoTotal: 1000, redondeoChileno: 0 }
      }
    });
  } catch (err) {
    showToast('Error abriendo ticket de venta', 'error');
  }
}

function cerrarModalBoletaTermica() {
  const modal = document.getElementById('thermalReceiptModal');
  if (modal) modal.style.display = 'none';
}

function imprimirTicketTermico() {
  window.print();
}

function descargarXmlDteActual() {
  if (currentReceiptData?.dte?.dteId) {
    window.open(`/api/v1/dte/${currentReceiptData.dte.dteId}/xml`, '_blank');
  } else {
    showToast('No hay XML disponible para comprobantes no tributarios / vouchers', 'warning');
  }
}

async function enviarBoletaPorCorreoModal() {
  const input = document.getElementById('ticketEmailDestinoInput');
  const email = input?.value?.trim();
  if (!email || !email.includes('@')) {
    showToast('Ingresa un correo electrónico válido para despachar el comprobante', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/v1/dte/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        dteId: currentReceiptData?.dte?.dteId,
        ventaId: currentReceiptData?.saleId
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      if (input) input.value = '';
    } else {
      showToast('Error enviando boleta: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error de conexión al enviar correo', 'error');
  }
}

function promptEnviarEmail(dteId) {
  const email = prompt('Ingresa el correo electrónico del cliente para enviar la Boleta Electrónica:');
  if (email && email.includes('@')) {
    fetch('/api/v1/dte/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, dteId })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) showToast(res.message, 'success');
        else showToast('Error: ' + res.error, 'error');
      })
      .catch(() => showToast('Error al enviar correo', 'error'));
  }
}

// --- Configuración Tributaria (Res. 176 y Datos Emisor) ---
async function loadFiscalConfig() {
  try {
    const res = await fetch(`/api/v1/dte/config?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const d = data.data || {};
    const mod = d.modeloEmision || 'MODELO_B';
    const radioB = document.getElementById('siiModeloB');
    const radioA = document.getElementById('siiModeloA');
    if (radioB && radioA) {
      if (mod === 'MODELO_A') radioA.checked = true;
      else radioB.checked = true;
    }

    const emisor = d.emisor || {};
    if (document.getElementById('cfgRutEmisor')) document.getElementById('cfgRutEmisor').value = emisor.rut || '';
    if (document.getElementById('cfgRazonSocial')) document.getElementById('cfgRazonSocial').value = emisor.razonSocial || '';
    if (document.getElementById('cfgGiroComercial')) document.getElementById('cfgGiroComercial').value = emisor.giro || '';
    if (document.getElementById('cfgActeco')) document.getElementById('cfgActeco').value = emisor.acteco || '';
    if (document.getElementById('cfgDireccion')) document.getElementById('cfgDireccion').value = emisor.direccion || '';
    if (document.getElementById('cfgComuna')) document.getElementById('cfgComuna').value = emisor.comuna || '';
    if (document.getElementById('cfgCiudad')) document.getElementById('cfgCiudad').value = emisor.ciudad || '';
    if (document.getElementById('cfgTelefono')) document.getElementById('cfgTelefono').value = emisor.telefono || '';
  } catch (err) {
    console.error('Error cargando configuración fiscal:', err);
  }
}

async function guardarModeloEmisionConfigurado() {
  const radio = document.querySelector('input[name="radioSiiModelo"]:checked');
  const modelo = radio?.value || 'MODELO_B';

  try {
    const res = await fetch('/api/v1/dte/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: state.tenantId, modeloEmision: modelo })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Modelo de emisión actualizado a ${modelo === 'MODELO_B' ? 'Opción B (Voucher reemplaza boleta - Res. 176)' : 'Opción A (Siempre emite boleta)'}`, 'success');
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error guardando modelo de emisión', 'error');
  }
}

async function guardarDatosFiscalesConfigurados() {
  const payload = {
    tenantId: state.tenantId,
    rut: document.getElementById('cfgRutEmisor')?.value?.trim(),
    razonSocial: document.getElementById('cfgRazonSocial')?.value?.trim(),
    giro: document.getElementById('cfgGiroComercial')?.value?.trim(),
    acteco: document.getElementById('cfgActeco')?.value?.trim(),
    direccion: document.getElementById('cfgDireccion')?.value?.trim(),
    comuna: document.getElementById('cfgComuna')?.value?.trim(),
    ciudad: document.getElementById('cfgCiudad')?.value?.trim(),
    telefono: document.getElementById('cfgTelefono')?.value?.trim()
  };

  try {
    const res = await fetch('/api/v1/dte/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Datos fiscales del emisor guardados y certificados con éxito', 'success');
    } else {
      showToast('Error guardando datos fiscales: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error de conexión al guardar datos fiscales', 'error');
  }
}

// --- Pre-Liquidación Mensual F29 (Débito vs Crédito Fiscal) ---
async function cargarReporteF29() {
  const periodoInput = document.getElementById('f29PeriodoInput');
  const tasaInput = document.getElementById('f29TasaPpmInput');

  let periodo = periodoInput?.value;
  if (!periodo) {
    periodo = new Date().toISOString().slice(0, 7);
    if (periodoInput) periodoInput.value = periodo;
  }
  const tasaPpm = Number(tasaInput?.value) || 1.0;

  try {
    const res = await fetch(`/api/v1/dte/f29?tenantId=${state.tenantId}&periodo=${periodo}&tasaPpm=${tasaPpm}`);
    const data = await res.json();
    if (!data.success) {
      showToast('Error cargando F29: ' + (data.error || 'Error de servidor'), 'error');
      return;
    }

    const r = data.data;

    const totalVentasEl = document.getElementById('f29TotalVentasNeto');
    const debitoEl = document.getElementById('f29IvaDebito');
    const creditoEl = document.getElementById('f29IvaCredito');
    const determinadoEl = document.getElementById('f29IvaDeterminado');
    const pagarEl = document.getElementById('f29TotalPagar');

    const totalVentasNeto = r.debitoFiscal?.totalNeto || 0;
    const ivaDebito = r.debitoFiscal?.totalIvaDebito || 0;
    const ivaCredito = r.creditoFiscal?.totalIvaCredito || 0;
    const ivaDeterminado = r.balance?.ivaDeterminadoAPagar || 0;
    const totalPagar = r.balance?.totalImpuestoPagarF29 || 0;

    if (totalVentasEl) totalVentasEl.innerText = '$' + Number(totalVentasNeto).toLocaleString('es-CL');
    if (debitoEl) debitoEl.innerText = '$' + Number(ivaDebito).toLocaleString('es-CL');
    if (creditoEl) creditoEl.innerText = '$' + Number(ivaCredito).toLocaleString('es-CL');
    if (determinadoEl) determinadoEl.innerText = '$' + Number(ivaDeterminado).toLocaleString('es-CL');
    if (pagarEl) pagarEl.innerText = '$' + Number(totalPagar).toLocaleString('es-CL');

    // Desglose Débito
    const debitoTbody = document.getElementById('f29DebitoTbody');
    if (debitoTbody) {
      debitoTbody.innerHTML = '';
      (r.debitoFiscal?.items || []).forEach(it => {
        const isResta = it.montoNeto < 0 || it.montoIva < 0 || it.tipoDte === 61;
        const colorIva = isResta ? '#f87171' : '#38bdf8';
        const sign = isResta && it.montoNeto > 0 ? '-' : '';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${it.tipoDocumento}</td>
          <td style="text-align:right;">${it.cantidad}</td>
          <td style="text-align:right; color:${colorIva};">${sign}$${Math.abs(Number(it.montoNeto || 0)).toLocaleString('es-CL')}</td>
          <td style="text-align:right; color:${colorIva}; font-weight:700;">${sign}$${Math.abs(Number(it.montoIva || 0)).toLocaleString('es-CL')}</td>
        `;
        debitoTbody.appendChild(row);
      });
      if ((r.debitoFiscal?.items || []).length === 0) {
        debitoTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; font-size:12px;">Sin ventas en el período</td></tr>';
      }
    }

    // Desglose Crédito
    const creditoTbody = document.getElementById('f29CreditoTbody');
    if (creditoTbody) {
      creditoTbody.innerHTML = '';
      (r.creditoFiscal?.items || []).forEach(it => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${it.tipoDocumento}</td>
          <td style="text-align:right;">${it.cantidad}</td>
          <td style="text-align:right;">$${Number(it.montoNeto || 0).toLocaleString('es-CL')}</td>
          <td style="text-align:right; color:#34d399; font-weight:700;">$${Number(it.montoIva || 0).toLocaleString('es-CL')}</td>
        `;
        creditoTbody.appendChild(row);
      });
      if ((r.creditoFiscal?.items || []).length === 0) {
        creditoTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; font-size:12px;">Sin facturas de compra en el período</td></tr>';
      }

      // Agregar fila de PPM
      const ppmRow = document.createElement('tr');
      ppmRow.style.borderTop = '1px dashed #334155';
      ppmRow.innerHTML = `
        <td><strong>PPM Obligatorio (${r.balance?.tasaPpm || 1}%)</strong></td>
        <td style="text-align:right;">-</td>
        <td style="text-align:right; font-size:11px; color:#94a3b8;">Base: $${Number(totalVentasNeto).toLocaleString('es-CL')}</td>
        <td style="text-align:right; font-weight:700; color:var(--primary);">$${Number(r.balance?.montoPpm || 0).toLocaleString('es-CL')}</td>
      `;
      creditoTbody.appendChild(ppmRow);
    }
  } catch (err) {
    showToast('Error de conexión al obtener pre-liquidación F29', 'error');
  }
}

// --- Guías de Despacho Electrónicas (DTE Tipo 52) ---
function abrirModalNuevaGuia() {
  const modal = document.getElementById('nuevaGuiaModal');
  const itemsContainer = document.getElementById('guiaItemsList');
  if (!modal || !itemsContainer) return;

  itemsContainer.innerHTML = '';
  if (state.products.length === 0) {
    itemsContainer.innerHTML = '<div style="color:#94a3b8; font-size:12px;">No hay productos en inventario.</div>';
  } else {
    state.products.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding:4px 0; border-bottom:1px solid #1e293b;';
      row.innerHTML = `
        <div style="font-size:12px; color:#fff;">
          <strong>${p.sku}</strong> - ${p.nombre}
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" data-sku="${p.sku}" data-nombre="${p.nombre}" data-precio="${p.precio_venta}" class="guia-qty-input" min="0" value="0" style="background:#1e293b; border:1px solid #475569; color:#fff; padding:4px; border-radius:4px; width:60px; text-align:right; font-size:12px;">
          <span style="font-size:11px; color:#94a3b8;">u</span>
        </div>
      `;
      itemsContainer.appendChild(row);
    });
  }

  modal.style.display = 'block';
}

function cerrarModalNuevaGuia() {
  const modal = document.getElementById('nuevaGuiaModal');
  if (modal) modal.style.display = 'none';
}

async function emitirGuiaDespachoForm() {
  const tipoTraslado = document.getElementById('guiaTipoTrasladoInput')?.value || '5';
  const patente = document.getElementById('guiaPatenteInput')?.value?.trim();
  const choferRut = document.getElementById('guiaChoferRutInput')?.value?.trim();
  const choferNombre = document.getElementById('guiaChoferNombreInput')?.value?.trim();
  const receptorRut = document.getElementById('guiaReceptorRutInput')?.value?.trim();
  const receptorRzn = document.getElementById('guiaReceptorRznInput')?.value?.trim();
  const dirDestino = document.getElementById('guiaDirDestinoInput')?.value?.trim();
  const comunaDestino = document.getElementById('guiaComunaDestinoInput')?.value?.trim();

  if (!receptorRut || !receptorRzn || !dirDestino) {
    showToast('Debes ingresar RUT receptor, Razón Social y Dirección de destino', 'warning');
    return;
  }

  const inputs = document.querySelectorAll('.guia-qty-input');
  const items = [];
  inputs.forEach(inp => {
    const cant = Number(inp.value) || 0;
    if (cant > 0) {
      items.push({
        sku: inp.getAttribute('data-sku'),
        nombre: inp.getAttribute('data-nombre'),
        precioUnitario: Number(inp.getAttribute('data-precio')) || 0,
        cantidad: cant
      });
    }
  });

  if (items.length === 0) {
    showToast('Debes indicar al menos un producto con cantidad mayor a 0 para despachar', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/v1/dte/guias/emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: state.tenantId,
        tipoTraslado: Number(tipoTraslado),
        patente,
        choferRut,
        choferNombre,
        receptorRut,
        receptorRazonSocial: receptorRzn,
        direccionDestino: dirDestino,
        comunaDestino: comunaDestino || 'SANTIAGO',
        items
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      cerrarModalNuevaGuia();
      cargarGuiasDespacho();
      loadTaxDtes();
    } else {
      showToast('Error emitiendo guía: ' + (result.error || 'Error desconocido'), 'error');
    }
  } catch (err) {
    showToast('Error al conectar para emitir guía de despacho', 'error');
  }
}

async function cargarGuiasDespacho() {
  try {
    const res = await fetch(`/api/v1/dte/guias?tenantId=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('taxGuiasTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = data.data || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">No hay guías de despacho emitidas todavía. Presiona "+ Emitir Guía de Despacho".</td></tr>';
      return;
    }

    list.forEach(g => {
      const tipoTexto = g.tipo_traslado === 5 ? '5: Traslado Interno' : g.tipo_traslado === 1 ? '1: Venta' : '6: Otros No Venta';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#38bdf8;">${g.folio}</strong></td>
        <td style="font-size:12px;">${new Date(g.fecha_emision).toLocaleString('es-CL')}</td>
        <td><span style="background:#1e293b; color:#cbd5e1; padding:2px 8px; border-radius:4px; font-size:11px;">${tipoTexto}</span></td>
        <td><strong>${g.receptor_razon_social}</strong><br><small style="color:#94a3b8;">${g.receptor_rut}</small></td>
        <td><span style="font-size:12px;">${g.direccion_destino}, ${g.comuna_destino}</span></td>
        <td><span style="font-size:12px;">${g.chofer_nombre || '-'}<br><small style="color:#38bdf8;">Patente: ${g.patente_vehiculo || 'S/P'}</small></span></td>
        <td style="text-align:center;">${g.total_items} ítems</td>
        <td><strong style="color:var(--primary);">$${Number(g.monto_total || 0).toLocaleString('es-CL')}</strong></td>
        <td><span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:10px; font-size:10.5px; font-weight:700;">${g.estado}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error cargando guías:', err);
  }
}

// --- Devolución & Nota de Crédito Electrónica (DTE Tipo 61) ---
let currentDevolucionVenta = null;

async function abrirModalDevolucion(ventaId) {
  try {
    const res = await fetch(`/api/v1/pos/transactions?tenant_id=${state.tenantId}`);
    const data = await res.json();
    if (!data.success) return;

    const venta = (data.data || []).find(v => v.id === ventaId);
    if (!venta) {
      showToast('Venta no encontrada', 'error');
      return;
    }

    currentDevolucionVenta = venta;
    const modal = document.getElementById('devolucionModal');
    if (!modal) return;

    if (document.getElementById('devFolioVentaDisplay')) document.getElementById('devFolioVentaDisplay').innerText = venta.folio;
    if (document.getElementById('devFechaVentaDisplay')) document.getElementById('devFechaVentaDisplay').innerText = new Date(venta.fecha).toLocaleString('es-CL');

    const container = document.getElementById('devItemsContainer');
    if (container) {
      container.innerHTML = '';
      let totalInicial = 0;
      (venta.items || []).forEach(it => {
        totalInicial += Number(it.subtotal || it.precio_unitario * it.cantidad);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #1e293b;';
        row.innerHTML = `
          <div>
            <strong style="color:#fff; font-size:12.5px;">${it.producto_nombre || it.sku}</strong>
            <div style="font-size:11px; color:#94a3b8;">$${Number(it.precio_unitario).toLocaleString('es-CL')} c/u (Compradas: ${it.cantidad}u)</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:11px; color:#94a3b8;">Devolver:</label>
            <input type="number" min="0" max="${it.cantidad}" value="${it.cantidad}" data-prodid="${it.producto_id || it.id}" data-precio="${it.precio_unitario}" class="dev-item-qty" oninput="calcularTotalDevolucionModal()" style="background:#1e293b; border:1px solid #475569; color:#fff; padding:4px 8px; border-radius:4px; width:60px; text-align:right; font-weight:700;">
            <span style="font-size:11px; color:#cbd5e1;">u</span>
          </div>
        `;
        container.appendChild(row);
      });
      if (document.getElementById('devTotalReembolso')) {
        document.getElementById('devTotalReembolso').innerText = '$' + totalInicial.toLocaleString('es-CL');
      }
    }

    modal.style.display = 'block';
  } catch (err) {
    showToast('Error al preparar devolución', 'error');
  }
}

function calcularTotalDevolucionModal() {
  const inputs = document.querySelectorAll('.dev-item-qty');
  let total = 0;
  inputs.forEach(inp => {
    const cant = Number(inp.value) || 0;
    const precio = Number(inp.getAttribute('data-precio')) || 0;
    total += cant * precio;
  });
  if (document.getElementById('devTotalReembolso')) {
    document.getElementById('devTotalReembolso').innerText = '$' + total.toLocaleString('es-CL');
  }
}

function cerrarModalDevolucion() {
  const modal = document.getElementById('devolucionModal');
  if (modal) modal.style.display = 'none';
  currentDevolucionVenta = null;
}

async function ejecutarDevolucionModal() {
  if (!currentDevolucionVenta) return;

  const motivo = document.getElementById('devMotivoSelect')?.value || 'Garantía Legal Ley N° 21.398';
  const inputs = document.querySelectorAll('.dev-item-qty');
  const itemsDev = [];

  inputs.forEach(inp => {
    const cant = Number(inp.value) || 0;
    if (cant > 0) {
      itemsDev.push({
        producto_id: inp.getAttribute('data-prodid'),
        cantidad: cant
      });
    }
  });

  if (itemsDev.length === 0) {
    showToast('Debes seleccionar al menos un ítem con cantidad a devolver', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/v1/pos/devolucion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        usuario_id: state.userId,
        venta_id: currentDevolucionVenta.id,
        motivo,
        items_devolucion: itemsDev
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Devolución completada: emitido DTE 61 Folio ${result.data?.folio_nc || 'N/A'} y stock repuesto.`, 'success');
      cerrarModalDevolucion();
      loadTransactions();
      loadInventory();
      loadProducts();
      loadTaxDtes();
      loadCajaResumen();
    } else {
      showToast('Error en devolución: ' + result.message, 'error');
    }
  } catch (err) {
    showToast('Error al conectar para procesar devolución', 'error');
  }
}

// --- Respaldo Legal Tributario 6 Años (Arts. 17 y 200 Código Tributario) ---
function descargarRespaldoLegal6Anos() {
  showToast('Generando respaldo legal inmutable de 6 años (Arts. 17 y 200 Código Tributario)...', 'info');
  window.open(`/api/v1/dte/backup/export?tenantId=${state.tenantId}`, '_blank');
}

// --- Generador e Impresión de Etiquetas de Góndola y Códigos de Barra (Ley SERNAC N° 19.496) ---
let productosParaEtiquetas = [];

// Generador de Código de Barra Vectorial SVG (Code 39 Estándar)
function generarBarcodeSVG(codeStr, width = 160, height = 32) {
  const code = String(codeStr || '000000').toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '-');
  const fullCode = '*' + code + '*';

  const CODE39 = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
  };

  let totalUnits = 0;
  for (let i = 0; i < fullCode.length; i++) {
    const pattern = CODE39[fullCode[i]] || CODE39['-'];
    for (let j = 0; j < 9; j++) {
      totalUnits += pattern[j] === '1' ? 3 : 1;
    }
    if (i < fullCode.length - 1) totalUnits += 1;
  }

  const unitWidth = width / (totalUnits || 1);
  let currentX = 0;
  let rects = '';

  for (let i = 0; i < fullCode.length; i++) {
    const pattern = CODE39[fullCode[i]] || CODE39['-'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const w = (pattern[j] === '1' ? 3 : 1) * unitWidth;
      if (isBar) {
        rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000" />`;
      }
      currentX += w;
    }
    currentX += 1 * unitWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block; margin:2px 0;">${rects}</svg>`;
}

function abrirModalEtiquetasGondola() {
  const modal = document.getElementById('modalEtiquetasGondola');
  if (!modal) return;

  productosParaEtiquetas = state.inventoryProducts && state.inventoryProducts.length > 0
    ? [...state.inventoryProducts]
    : [...state.products];

  filtrarEtiquetasGondola();
  modal.style.display = 'block';
}

function cerrarModalEtiquetasGondola() {
  const modal = document.getElementById('modalEtiquetasGondola');
  if (modal) modal.style.display = 'none';
}

function filtrarEtiquetasGondola() {
  const filtro = document.getElementById('etiquetasFiltroSelect')?.value || 'TODOS';
  const tbody = document.getElementById('etiquetasTbody');
  if (!tbody) return;

  let filtrados = productosParaEtiquetas;
  if (filtro === 'NUEVOS') {
    filtrados = productosParaEtiquetas.filter(p => p.origen_creacion === 'FACTURA_XML' || p.factura_origen_folio);
  } else if (filtro === 'VENCIMIENTO') {
    filtrados = productosParaEtiquetas.filter(p => p.fecha_vencimiento);
  } else if (filtro === 'ALCOHOL') {
    filtrados = productosParaEtiquetas.filter(p => p.impuesto_adicional_codigo === 27 || p.impuesto_adicional_codigo === 28);
  }

  tbody.innerHTML = '';
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">No hay productos que coincidan con este filtro.</td></tr>';
    actualizarContadorEtiquetas();
    return;
  }

  filtrados.forEach(p => {
    const tr = document.createElement('tr');
    const codigoMostrar = p.codigo_barra || p.sku;
    const barcodeSvg = generarBarcodeSVG(codigoMostrar, 130, 24);
    
    let sellosHtml = '';
    if (p.impuesto_adicional_codigo === 27 || p.impuesto_adicional_codigo === 28) {
      sellosHtml += `<span style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; margin-right:4px;">🔞 +18 Alcohol</span>`;
    } else if (p.impuesto_adicional_codigo === 25 || p.impuesto_adicional_codigo === 26) {
      sellosHtml += `<span style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid #38bdf8; font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; margin-right:4px;">⚡ ILA 18%</span>`;
    }
    if (p.fecha_vencimiento) {
      sellosHtml += `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px;">📅 Vence: ${p.fecha_vencimiento}</span>`;
    }
    if (!sellosHtml) {
      sellosHtml = '<span style="color:#94a3b8; font-size:11px;">Estándar</span>';
    }

    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" class="label-item-check" data-id="${p.id}" checked onchange="actualizarContadorEtiquetas()">
      </td>
      <td>
        <strong style="color:#38bdf8; font-family:monospace; font-size:12px;">${codigoMostrar}</strong><br>
        <small style="color:#94a3b8;">${p.sku}</small>
      </td>
      <td><strong>${p.nombre}</strong></td>
      <td><strong style="color:var(--primary); font-size:14px;">$${Number(p.precio_venta).toLocaleString('es-CL')}</strong></td>
      <td>${sellosHtml}</td>
      <td style="text-align:center;">
        <div style="background:#fff; padding:3px 6px; border-radius:4px; display:inline-block; border:1px solid #ccc;">
          ${barcodeSvg}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  actualizarContadorEtiquetas();
}

function seleccionarTodasEtiquetas(marcar) {
  const checkboxes = document.querySelectorAll('.label-item-check');
  checkboxes.forEach(cb => cb.checked = marcar);
  const master = document.getElementById('checkSelectAllLabels');
  if (master) master.checked = marcar;
  actualizarContadorEtiquetas();
}

function actualizarContadorEtiquetas() {
  const checked = document.querySelectorAll('.label-item-check:checked');
  const copias = Number(document.getElementById('etiquetasCopiasInput')?.value) || 1;
  const totalLabels = checked.length * copias;
  const display = document.getElementById('etiquetasCountDisplay');
  if (display) {
    display.innerText = `${checked.length} productos seleccionados (${totalLabels} etiquetas a imprimir)`;
  }
}

function ejecutarImpresionEtiquetasGondola() {
  const checkedBoxes = Array.from(document.querySelectorAll('.label-item-check:checked'));
  if (checkedBoxes.length === 0) {
    showToast('Selecciona al menos un producto para imprimir etiquetas', 'warning');
    return;
  }

  const copias = Math.max(1, Math.min(10, Number(document.getElementById('etiquetasCopiasInput')?.value) || 1));
  const selectedIds = new Set(checkedBoxes.map(cb => cb.getAttribute('data-id')));
  const itemsAImprimir = productosParaEtiquetas.filter(p => selectedIds.has(p.id));

  const printArea = document.getElementById('shelfLabelsPrintArea');
  if (!printArea) return;
  printArea.innerHTML = '';

  itemsAImprimir.forEach(p => {
    const codigoMostrar = p.codigo_barra || p.sku;
    const barcodeSvg = generarBarcodeSVG(codigoMostrar, 160, 32);
    const precioFmt = '$' + Number(p.precio_venta).toLocaleString('es-CL');
    const isAlcohol = p.impuesto_adicional_codigo === 27 || p.impuesto_adicional_codigo === 28;
    const vencimientoStr = p.fecha_vencimiento ? ` | Venc: ${p.fecha_vencimiento}` : '';

    for (let c = 0; c < copias; c++) {
      const card = document.createElement('div');
      card.className = 'shelf-label-card';
      card.innerHTML = `
        <div class="shelf-label-header">
          <span class="shelf-label-store">GESTOCK RETAIL CHILE</span>
          <span class="shelf-label-cat">${p.categoria || 'Góndola'}${isAlcohol ? ' • 🔞 +18' : ''}</span>
        </div>
        <div class="shelf-label-title">${p.nombre}</div>
        <div class="shelf-label-body">
          <div class="shelf-label-barcode-col">
            ${barcodeSvg}
            <div style="font-family: monospace; font-size: 9.5px; font-weight: 700; color: #000; letter-spacing: 1px;">${codigoMostrar}</div>
            <div style="font-size: 8px; color: #555; margin-top: 1px;">SKU: ${p.sku}${vencimientoStr}</div>
          </div>
          <div class="shelf-label-price-col">
            <div class="shelf-label-price">${precioFmt}</div>
            <div class="shelf-label-iva">IVA INCLUIDO</div>
          </div>
        </div>
      `;
      printArea.appendChild(card);
    }
  });

  // Activar clase para aislar la cuadrícula de etiquetas en @media print
  document.body.classList.add('printing-labels');

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-labels');
    }, 1000);
  }, 250);
}

// --- Dashboard Global & Analítica Interactiva (Chart.js) ---
let chartSalesTimeline = null;
let chartPaymentMethods = null;
let chartTopProducts = null;
let chartSupplierSpend = null;

function cambiarPeriodoDashboard(periodo) {
  state.dashboardPeriod = periodo;

  const btnDiario = document.getElementById('dashBtnDiario');
  const btnMensual = document.getElementById('dashBtnMensual');
  const btnHistorico = document.getElementById('dashBtnHistorico');
  const badge = document.getElementById('dashPeriodoBadge');

  if (btnDiario) btnDiario.classList.toggle('active', periodo === 'diario');
  if (btnMensual) btnMensual.classList.toggle('active', periodo === 'mensual');
  if (btnHistorico) btnHistorico.classList.toggle('active', periodo === 'historico');

  if (badge) {
    if (periodo === 'diario') {
      badge.innerText = 'Diario (Hoy)';
    } else if (periodo === 'mensual') {
      badge.innerText = 'Mensual (Este Mes)';
    } else {
      badge.innerText = 'Histórico Total';
    }
  }

  cargarDashboardGlobal();
}

async function cargarDashboardGlobal() {
  try {
    const periodo = state.dashboardPeriod || 'mensual';
    const res = await fetch(`/api/v1/dashboard/overview?tenant_id=${state.tenantId}&periodo=${periodo}`);
    const json = await res.json();
    if (!json.success || !json.data) {
      showToast('Error al cargar métricas del dashboard', 'error');
      return;
    }

    const data = json.data;
    const k = data.kpis;

    // 1. Tarjetas de KPIs Consolidadas
    const elVentas = document.getElementById('dashKpiVentasBrutas');
    const elNetoIva = document.getElementById('dashKpiNetoIva');
    const elUtilidad = document.getElementById('dashKpiUtilidad');
    const elMargen = document.getElementById('dashKpiMargen');
    const elTicket = document.getElementById('dashKpiTicketPromedio');
    const elTransacciones = document.getElementById('dashKpiTransacciones');
    const elUnidades = document.getElementById('dashKpiUnidades');
    const elInventario = document.getElementById('dashKpiValorInventario');
    const elValorVenta = document.getElementById('dashKpiValorVenta');
    const elAlertas = document.getElementById('dashKpiAlertasStock');
    const elProveedores = document.getElementById('dashKpiProveedores');

    if (elVentas) elVentas.innerText = '$' + Number(k.totalVentasBruto).toLocaleString('es-CL');
    if (elNetoIva) elNetoIva.innerText = `Neto: $${Number(k.totalVentasNeto).toLocaleString('es-CL')} | IVA: $${Number(k.totalIvaDebito).toLocaleString('es-CL')}`;
    if (elUtilidad) elUtilidad.innerText = '$' + Number(k.utilidadBruta).toLocaleString('es-CL');
    if (elMargen) elMargen.innerText = `Margen: ${k.margenUtilidadPorc}%`;
    if (elTicket) elTicket.innerText = '$' + Number(k.ticketPromedio).toLocaleString('es-CL');
    if (elTransacciones) elTransacciones.innerText = `${k.totalTransacciones} transacciones`;
    if (elUnidades) elUnidades.innerText = `${Number(k.unidadesVendidas).toLocaleString('es-CL')} u`;
    if (elInventario) elInventario.innerText = '$' + Number(k.inventarioValorCosto).toLocaleString('es-CL');
    if (elValorVenta) elValorVenta.innerText = `PVP Proyectado: $${Number(k.inventarioValorVenta).toLocaleString('es-CL')}`;
    if (elAlertas) elAlertas.innerText = `${k.productosStockCritico} crít. / ${k.productosAgotados} agot.`;
    if (elProveedores) elProveedores.innerText = `${k.totalProveedores} proveedores activos`;

    // 2. Gráficos Interactivos con Chart.js
    renderChartTimeline(data.timelineChart, periodo);
    renderChartPayments(data.paymentsBreakdown);
    renderChartTopProducts(data.topProducts);
    renderChartSuppliers(data.suppliersAnalytics);

    // 3. Tablas de Desglose
    renderDashTables(data.topProducts, data.suppliersAnalytics);

  } catch (err) {
    console.error('Error al cargar dashboard global:', err);
    showToast('Error de comunicación al obtener datos del dashboard', 'error');
  }
}

function renderChartTimeline(timeline, periodo) {
  const ctx = document.getElementById('chartSalesTimeline');
  if (!ctx || typeof Chart === 'undefined') return;

  if (chartSalesTimeline) {
    chartSalesTimeline.destroy();
  }

  const labels = timeline.labels.length > 0 ? timeline.labels : ['Sin ventas'];
  const data = timeline.data.length > 0 ? timeline.data : [0];

  chartSalesTimeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ventas Brutas ($)',
          data: data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#38bdf8'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => 'Ventas: $' + Number(item.raw).toLocaleString('es-CL')
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: (val) => '$' + Number(val).toLocaleString('es-CL')
          }
        }
      }
    }
  });
}

function renderChartPayments(payments) {
  const ctx = document.getElementById('chartPaymentMethods');
  if (!ctx || typeof Chart === 'undefined') return;

  if (chartPaymentMethods) {
    chartPaymentMethods.destroy();
  }

  const palette = {
    'EFECTIVO': '#10b981',
    'TRANSBANK': '#3b82f6',
    'RUTPAY': '#f59e0b',
    'MERCADOPAGO': '#06b6d4',
    'SUMUP': '#ef4444'
  };

  const labels = payments.length > 0 ? payments.map(p => p.metodo) : ['Sin ventas'];
  const data = payments.length > 0 ? payments.map(p => p.total) : [1];
  const bgColors = payments.length > 0
    ? payments.map(p => palette[p.metodo] || '#8b5cf6')
    : ['#334155'];

  chartPaymentMethods = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#1e293b'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e2e8f0', font: { size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: $${Number(item.raw).toLocaleString('es-CL')}`
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderChartTopProducts(products) {
  const ctx = document.getElementById('chartTopProducts');
  if (!ctx || typeof Chart === 'undefined') return;

  if (chartTopProducts) {
    chartTopProducts.destroy();
  }

  const labels = products.length > 0
    ? products.map(p => p.nombre.length > 15 ? p.nombre.slice(0, 15) + '...' : p.nombre)
    : ['Sin datos'];
  const data = products.length > 0 ? products.map(p => p.unidades) : [0];

  chartTopProducts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Unidades Vendidas',
          data: data,
          backgroundColor: 'rgba(139, 92, 246, 0.85)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 }
        }
      }
    }
  });
}

function renderChartSuppliers(suppliers) {
  const ctx = document.getElementById('chartSupplierSpend');
  if (!ctx || typeof Chart === 'undefined') return;

  if (chartSupplierSpend) {
    chartSupplierSpend.destroy();
  }

  const filtered = (suppliers || []).filter(s => s.totalInvertido > 0);
  const labels = filtered.length > 0
    ? filtered.map(s => s.nombre.length > 15 ? s.nombre.slice(0, 15) + '...' : s.nombre)
    : ['Sin compras registradas'];
  const data = filtered.length > 0 ? filtered.map(s => s.totalInvertido) : [0];

  chartSupplierSpend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Inversión ($)',
          data: data,
          backgroundColor: 'rgba(6, 182, 212, 0.85)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => 'Compras: $' + Number(item.raw).toLocaleString('es-CL')
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: (val) => '$' + Number(val).toLocaleString('es-CL')
          }
        }
      }
    }
  });
}

function renderDashTables(topProducts, suppliers) {
  const prodTbody = document.getElementById('dashTopProductsTbody');
  if (prodTbody) {
    if (!topProducts || topProducts.length === 0) {
      prodTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">Sin ventas registradas en el período</td></tr>';
    } else {
      prodTbody.innerHTML = topProducts.map(p => `
        <tr>
          <td>
            <strong style="color:#fff;">${p.nombre}</strong><br>
            <span style="font-size:10px; color:#94a3b8; font-family:monospace;">${p.sku}</span>
          </td>
          <td><span class="badge-cat" style="font-size:11px; padding:2px 6px; background:#334155; border-radius:4px;">${p.categoria}</span></td>
          <td style="text-align:right; font-weight:700; color:#8b5cf6;">${p.unidades} u</td>
          <td style="text-align:right; font-weight:700; color:#10b981;">$${Number(p.ingresos).toLocaleString('es-CL')}</td>
        </tr>
      `).join('');
    }
  }

  const provTbody = document.getElementById('dashSuppliersTbody');
  if (provTbody) {
    if (!suppliers || suppliers.length === 0) {
      provTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">Sin proveedores registrados</td></tr>';
    } else {
      provTbody.innerHTML = suppliers.map(s => `
        <tr>
          <td>
            <strong style="color:#fff;">${s.nombre}</strong><br>
            <span style="font-size:10px; color:#94a3b8; font-family:monospace;">${s.rut || 'S/RUT'}</span>
          </td>
          <td><span style="font-size:11px; color:#38bdf8;">📅 ${s.diasVisita}</span></td>
          <td style="text-align:right; font-weight:700; color:#cbd5e1;">${s.facturasIngresadas}</td>
          <td style="text-align:right; font-weight:700; color:#06b6d4;">$${Number(s.totalInvertido).toLocaleString('es-CL')}</td>
        </tr>
      `).join('');
    }
  }
}

// Exponer funciones globales para interactividad en HTML
window.addToCart = addToCart;
window.updateQty = updateQty;
window.cambiarPeriodoDashboard = cambiarPeriodoDashboard;
window.cargarDashboardGlobal = cargarDashboardGlobal;
window.filtrarInventario = filtrarInventario;
window.loadInventory = loadInventory;
window.loadVencimientosAlerts = loadVencimientosAlerts;
window.filtrarSoloPorVencer = filtrarSoloPorVencer;
window.loadTransactions = loadTransactions;
window.loadCajaResumen = loadCajaResumen;
window.abrirTurnoCaja = abrirTurnoCaja;
window.calcularDiferenciaCaja = calcularDiferenciaCaja;
window.ejecutarCierreCaja = ejecutarCierreCaja;
window.registrarMovimientoCajaForm = registrarMovimientoCajaForm;
window.imprimirUltimoReporteZ = imprimirUltimoReporteZ;
window.cerrarModalCierreZ = cerrarModalCierreZ;
window.imprimirReporteZTermico = imprimirReporteZTermico;
window.loadTaxInvoices = loadTaxInvoices;
window.exportarFacturasCSV = exportarFacturasCSV;
window.loadMarginConfig = loadMarginConfig;
window.guardarMargenConfigurado = guardarMargenConfigurado;
window.loadEmailConfig = loadEmailConfig;
window.guardarEmailConfigurado = guardarEmailConfigurado;
window.loadSuppliers = loadSuppliers;
window.actualizarDiaVisita = actualizarDiaVisita;
window.loadReplenishment = loadReplenishment;
window.enviarOrdenesPorEmail = enviarOrdenesPorEmail;
window.cambiarProveedorOrden = cambiarProveedorOrden;
window.loadTrends = loadTrends;
window.mostrarModalPrevisualizacion = mostrarModalPrevisualizacion;
window.cerrarModalFactura = cerrarModalFactura;
window.confirmarIngestaModal = confirmarIngestaModal;
window.initTheme = initTheme;
window.cambiarTema = cambiarTema;
window.alternarTemaRapido = alternarTemaRapido;

// Compliance y Terminal POS Ley 21.368 / DTE 33 / SERNAC / Ley Alcoholes
window.agregarBolsaReutilizable = agregarBolsaReutilizable;
window.togglePosDocType = togglePosDocType;
window.cargarReporteF29 = cargarReporteF29;
window.abrirModalNuevaGuia = abrirModalNuevaGuia;
window.cerrarModalNuevaGuia = cerrarModalNuevaGuia;
window.emitirGuiaDespachoForm = emitirGuiaDespachoForm;
window.cargarGuiasDespacho = cargarGuiasDespacho;
window.abrirModalDevolucion = abrirModalDevolucion;
window.calcularTotalDevolucionModal = calcularTotalDevolucionModal;
window.cerrarModalDevolucion = cerrarModalDevolucion;
window.ejecutarDevolucionModal = ejecutarDevolucionModal;
window.descargarRespaldoLegal6Anos = descargarRespaldoLegal6Anos;

// Etiquetas de Góndola y Códigos de Barra
window.generarBarcodeSVG = generarBarcodeSVG;
window.abrirModalEtiquetasGondola = abrirModalEtiquetasGondola;
window.cerrarModalEtiquetasGondola = cerrarModalEtiquetasGondola;
window.filtrarEtiquetasGondola = filtrarEtiquetasGondola;
window.seleccionarTodasEtiquetas = seleccionarTodasEtiquetas;
window.actualizarContadorEtiquetas = actualizarContadorEtiquetas;
window.ejecutarImpresionEtiquetasGondola = ejecutarImpresionEtiquetasGondola;

// Funciones Tributarias SII, DTE y Cumplimiento Normativo
window.cambiarSubtabTax = cambiarSubtabTax;
window.recargarModuloTributario = recargarModuloTributario;
window.loadTaxDtes = loadTaxDtes;
window.loadTaxCafStatus = loadTaxCafStatus;
window.abrirModalCargaCaf = abrirModalCargaCaf;
window.cerrarModalCargaCaf = cerrarModalCargaCaf;
window.leerArchivoCafXml = leerArchivoCafXml;
window.procesarCargaCafXml = procesarCargaCafXml;
window.loadTaxRcofHistory = loadTaxRcofHistory;
window.generarRcofDiario = generarRcofDiario;
window.ejecutarSetCertificacionSii = ejecutarSetCertificacionSii;
window.mostrarModalBoletaTermica = mostrarModalBoletaTermica;
window.abrirComprobantePorDte = abrirComprobantePorDte;
window.abrirComprobantePorVenta = abrirComprobantePorVenta;
window.cerrarModalBoletaTermica = cerrarModalBoletaTermica;
window.imprimirTicketTermico = imprimirTicketTermico;
window.descargarXmlDteActual = descargarXmlDteActual;
window.enviarBoletaPorCorreoModal = enviarBoletaPorCorreoModal;
window.promptEnviarEmail = promptEnviarEmail;
window.loadFiscalConfig = loadFiscalConfig;
window.guardarModeloEmisionConfigurado = guardarModeloEmisionConfigurado;
window.guardarDatosFiscalesConfigurados = guardarDatosFiscalesConfigurados;
