// Honey Manager - app.js
// Full rebuild with: products, sales, purchases, expenses, receipts, transfers, opening balances, movements

(function () {
  "use strict";

  // ---------- State ----------
  const STORAGE_KEY = "honeyManagerStateV2";

  const defaultState = {
    products: [],
    customers: [],
    sales: [],
    purchases: [],
    expenses: [],
    receipts: [],
    transfers: [],
    opening: {
      cash: 0,
      bank: 0,
      customerDebts: [] // [{ customerId, amount }]
    }
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetDemo() {
    if (!confirm("هل تريد تصفير كل البيانات التجريبية؟")) return;
    state = structuredClone(defaultState);
    saveState();
    renderAll();
  }

  // ---------- Utilities ----------
  function uid(prefix = "id") {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function fmtMoney(n) {
    return `${(Number(n) || 0).toFixed(2)} €`;
  }

  function fmtQty(n) {
    return `${(Number(n) || 0).toFixed(2)} كيلو`;
  }

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getProductById(id) {
    return state.products.find(p => p.id === id);
  }

  function getCustomerById(id) {
    return state.customers.find(c => c.id === id);
  }

  // ---------- Calculations ----------
  function calcTotals() {
    // Opening
    const openingCash = Number(state.opening.cash) || 0;
    const openingBank = Number(state.opening.bank) || 0;
    const openingDebt = (state.opening.customerDebts || [])
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);

    // Sales
    let salesCash = 0, salesBank = 0, salesCredit = 0;
    state.sales.forEach(s => {
      const total = Number(s.total) || 0;
      if (s.paymentMethod === "cash") salesCash += total;
      else if (s.paymentMethod === "bank") salesBank += total;
      else if (s.paymentMethod === "credit") salesCredit += total;
    });

    // Purchases
    let purchCash = 0, purchBank = 0, purchCredit = 0;
    state.purchases.forEach(p => {
      const total = Number(p.total) || 0;
      if (p.paymentMethod === "cash") purchCash += total;
      else if (p.paymentMethod === "bank") purchBank += total;
      else if (p.paymentMethod === "credit") purchCredit += total;
    });

    // Expenses
    let expCash = 0, expBank = 0;
    state.expenses.forEach(e => {
      const amount = Number(e.amount) || 0;
      if (e.paymentMethod === "cash") expCash += amount;
      else if (e.paymentMethod === "bank") expBank += amount;
    });

    // Receipts
    let recCash = 0, recBank = 0;
    state.receipts.forEach(r => {
      const amount = Number(r.amount) || 0;
      if (r.paymentMethod === "cash") recCash += amount;
      else if (r.paymentMethod === "bank") recBank += amount;
    });

    // Transfers
    let tfCashToBank = 0, tfBankToCash = 0;
    state.transfers.forEach(t => {
      const amount = Number(t.amount) || 0;
      if (t.from === "cash" && t.to === "bank") tfCashToBank += amount;
      if (t.from === "bank" && t.to === "cash") tfBankToCash += amount;
    });

    const cash =
      openingCash + salesCash - purchCash - expCash + recCash - tfCashToBank + tfBankToCash;

    const bank =
      openingBank + salesBank - purchBank - expBank + recBank + tfCashToBank - tfBankToCash;

    // Customer debt: opening + credit sales - receipts
    const customerDebt = openingDebt + salesCredit - (recCash + recBank);

    // Stock
    let stock = 0;
    state.products.forEach(prod => {
      const bought = state.purchases
        .filter(p => p.productId === prod.id)
        .reduce((s, p) => s + (Number(p.quantity) || 0), 0);
      const sold = state.sales
        .filter(s => s.productId === prod.id)
        .reduce((s, s2) => s + (Number(s2.quantity) || 0), 0);
      prod.currentQty = Math.max(0, bought - sold);
      stock += prod.currentQty;
    });

    return { cash, bank, customerDebt, stock };
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderDashboard();
    renderProducts();
    renderSales();
    renderPurchases();
    renderExpenses();
    renderReceipts();
    renderTransfers();
    renderOpening();
    renderMovements();
  }

  function renderDashboard() {
    const totals = calcTotals();
    document.getElementById("dashCash").textContent = fmtMoney(totals.cash);
    document.getElementById("dashBank").textContent = fmtMoney(totals.bank);
    document.getElementById("dashCredit").textContent = fmtMoney(totals.customerDebt);
    document.getElementById("dashStock").textContent = fmtQty(totals.stock);

    const grid = document.getElementById("dashboardProducts");
    grid.innerHTML = "";
    state.products.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="qty">${fmtQty(p.currentQty || 0)}</div>
        <button class="btn secondary btnSellQuick" data-id="${p.id}">بيع سريع</button>
      `;
      grid.appendChild(card);
    });

    const tbody = document.querySelector("#lastSalesTable tbody");
    tbody.innerHTML = "";
    const lastSales = [...state.sales].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    lastSales.forEach(s => {
      const prod = getProductById(s.productId);
      const cust = getCustomerById(s.customerId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.date}</td>
        <td>${prod ? escapeHtml(prod.name) : "—"}</td>
        <td>${fmtQty(s.quantity)}</td>
        <td>${fmtMoney(s.total)}</td>
        <td>${translatePayment(s.paymentMethod)}</td>
        <td>${s.paymentMethod === "credit" && cust ? escapeHtml(cust.name) : "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderProducts() {
    const grid = document.getElementById("productsGrid");
    grid.innerHTML = "";
    if (state.products.length === 0) {
      grid.innerHTML = `<div class="card">لا توجد منتجات، أضف منتجًا أولًا.</div>`;
      return;
    }
    state.products.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="qty">المتبقي: ${fmtQty(p.currentQty || 0)}</div>
        <div class="row">
          <button class="btn btnEditProduct" data-id="${p.id}">تعديل</button>
          <button class="btn danger btnDeleteProduct" data-id="${p.id}">حذف</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderSales() {
    const tbody = document.querySelector("#salesTable tbody");
    tbody.innerHTML = "";
    [...state.sales]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(s => {
        const prod = getProductById(s.productId);
        const cust = getCustomerById(s.customerId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${s.date}</td>
          <td>${prod ? escapeHtml(prod.name) : "—"}</td>
          <td>${fmtQty(s.quantity)}</td>
          <td>${fmtMoney(s.total)}</td>
          <td>${translatePayment(s.paymentMethod)}</td>
          <td>${s.paymentMethod === "credit" && cust ? escapeHtml(cust.name) : "—"}</td>
          <td>
            <button class="btn secondary btnEditSale" data-id="${s.id}">تعديل</button>
            <button class="btn danger btnDeleteSale" data-id="${s.id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderPurchases() {
    const tbody = document.querySelector("#purchasesTable tbody");
    tbody.innerHTML = "";
    [...state.purchases]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(p => {
        const prod = getProductById(p.productId);
        const supplierName = p.supplierName || "—";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.date}</td>
          <td>${prod ? escapeHtml(prod.name) : "—"}</td>
          <td>${fmtQty(p.quantity)}</td>
          <td>${fmtMoney(p.total)}</td>
          <td>${translatePayment(p.paymentMethod)}</td>
          <td>${escapeHtml(supplierName)}</td>
          <td>
            <button class="btn secondary btnEditPurchase" data-id="${p.id}">تعديل</button>
            <button class="btn danger btnDeletePurchase" data-id="${p.id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderExpenses() {
    const tbody = document.querySelector("#expensesTable tbody");
    tbody.innerHTML = "";
    [...state.expenses]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(e => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.date}</td>
          <td>${escapeHtml(e.type || "—")}</td>
          <td>${fmtMoney(e.amount)}</td>
          <td>${translatePayment(e.paymentMethod)}</td>
          <td>${escapeHtml(e.note || "")}</td>
          <td>
            <button class="btn secondary btnEditExpense" data-id="${e.id}">تعديل</button>
            <button class="btn danger btnDeleteExpense" data-id="${e.id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderReceipts() {
    const tbody = document.querySelector("#receiptsTable tbody");
    tbody.innerHTML = "";
    [...state.receipts]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(r => {
        const cust = getCustomerById(r.customerId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.date}</td>
          <td>${cust ? escapeHtml(cust.name) : "—"}</td>
          <td>${fmtMoney(r.amount)}</td>
          <td>${translatePayment(r.paymentMethod)}</td>
          <td>
            <button class="btn secondary btnEditReceipt" data-id="${r.id}">تعديل</button>
            <button class="btn danger btnDeleteReceipt" data-id="${r.id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderTransfers() {
    const tbody = document.querySelector("#transfersTable tbody");
    tbody.innerHTML = "";
    [...state.transfers]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.date}</td>
          <td>${t.from === "cash" ? "كاش" : "بنك"}</td>
          <td>${t.to === "cash" ? "كاش" : "بنك"}</td>
          <td>${fmtMoney(t.amount)}</td>
          <td>${escapeHtml(t.note || "")}</td>
          <td>
            <button class="btn secondary btnEditTransfer" data-id="${t.id}">تعديل</button>
            <button class="btn danger btnDeleteTransfer" data-id="${t.id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderOpening() {
    document.getElementById("openingCash").value = state.opening.cash || 0;
    document.getElementById("openingBank").value = state.opening.bank || 0;

    const list = document.getElementById("openingCustomersList");
    list.innerHTML = "";
    (state.opening.customerDebts || []).forEach((d, idx) => {
      const cust = getCustomerById(d.customerId);
      const row = document.createElement("div");
      row.className = "row";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <input type="text" class="openingCustomerName" data-idx="${idx}" value="${cust ? escapeHtml(cust.name) : ""}" placeholder="اسم العميل" />
        <input type="number" class="openingCustomerAmount" data-idx="${idx}" step="0.01" value="${d.amount || 0}" placeholder="المبلغ" />
        <button class="btn danger btnRemoveOpeningCustomer" data-idx="${idx}">حذف</button>
      `;
      list.appendChild(row);
    });
  }

  function renderMovements() {
    const tbody = document.querySelector("#movementsTable tbody");
    tbody.innerHTML = "";
    const movements = [];

    state.sales.forEach(s => {
      const prod = getProductById(s.productId);
      const cust = getCustomerById(s.customerId);
      movements.push({
        date: s.date,
        type: "بيع",
        details: `${prod ? prod.name : "—"} ${cust && s.paymentMethod === "credit" ? "(" + cust.name + ")" : ""}`,
        amount: `${fmtQty(s.quantity)} / ${fmtMoney(s.total)}`,
        method: translatePayment(s.paymentMethod)
      });
    });

    state.purchases.forEach(p => {
      const prod = getProductById(p.productId);
      movements.push({
        date: p.date,
        type: "شراء",
        details: `${prod ? prod.name : "—"} ${p.supplierName ? "(" + p.supplierName + ")" : ""}`,
        amount: `${fmtQty(p.quantity)} / ${fmtMoney(p.total)}`,
        method: translatePayment(p.paymentMethod)
      });
    });

    state.expenses.forEach(e => {
      movements.push({
        date: e.date,
        type: "مصروف",
        details: e.type || "—",
        amount: fmtMoney(e.amount),
        method: translatePayment(e.paymentMethod)
      });
    });

    state.receipts.forEach(r => {
      const cust = getCustomerById(r.customerId);
      movements.push({
        date: r.date,
        type: "تحصيل",
        details: cust ? cust.name : "—",
        amount: fmtMoney(r.amount),
        method: translatePayment(r.paymentMethod)
      });
    });

    state.transfers.forEach(t => {
      movements.push({
        date: t.date,
        type: "تحويل",
        details: `${t.from === "cash" ? "كاش" : "بنك"} → ${t.to === "cash" ? "كاش" : "بنك"}`,
        amount: fmtMoney(t.amount),
        method: t.note || "—"
      });
    });

    movements.sort((a, b) => (a.date < b.date ? 1 : -1));

    movements.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.date}</td>
        <td>${m.type}</td>
        <td>${escapeHtml(m.details)}</td>
        <td>${m.amount}</td>
        <td>${m.method}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---------- Helpers ----------
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function translatePayment(method) {
    if (method === "cash") return "كاش";
    if (method === "bank") return "بنك";
    if (method === "credit") return "آجل";
    return method || "—";
  }

  // ---------- Modals ----------
  function openModal(html) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        ${html}
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
    };

    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });

    return { overlay, close };
  }

  // ---------- Add/Edit Forms ----------
  function openAddProduct() {
    const html = `
      <div class="modal-header">
        <strong>إضافة منتج</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>اسم العسل</label>
        <input type="text" id="prodName" placeholder="مثال: عسل سدر درجة أولى" />

        <label>سعر الشراء المتوقع للكيلو (€)</label>
        <input type="number" id="prodCost" step="0.01" min="0" placeholder="0.00" />

        <label>حد التنبيه للكمية (كيلو)</label>
        <input type="number" id="prodAlert" step="0.01" min="0" placeholder="1.00" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveProd">حفظ</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);
    overlay.querySelector("[data-close]").closest(".modal-footer").querySelector("[data-close]").addEventListener("click", close);

    overlay.querySelector("#btnSaveProd").addEventListener("click", () => {
      const name = (document.getElementById("prodName").value || "").trim();
      const cost = parseFloat(document.getElementById("prodCost").value) || 0;
      const alertQty = parseFloat(document.getElementById("prodAlert").value) || 0;
      if (!name) {
        alert("أدخل اسم المنتج");
        return;
      }
      state.products.push({
        id: uid("prod"),
        name,
        costPerKg: cost,
        alertQty,
        currentQty: 0
      });
      saveState();
      close();
      renderAll();
    });
  }

  function openEditProduct(id) {
    const prod = getProductById(id);
    if (!prod) return;
    const html = `
      <div class="modal-header">
        <strong>تعديل منتج</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>اسم العسل</label>
        <input type="text" id="prodName" value="${escapeHtml(prod.name)}" />

        <label>سعر الشراء المتوقع للكيلو (€)</label>
        <input type="number" id="prodCost" step="0.01" min="0" value="${prod.costPerKg || 0}" />

        <label>حد التنبيه للكمية (كيلو)</label>
        <input type="number" id="prodAlert" step="0.01" min="0" value="${prod.alertQty || 0}" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveProd">حفظ التعديل</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    overlay.querySelector("#btnSaveProd").addEventListener("click", () => {
      const name = (document.getElementById("prodName").value || "").trim();
      const cost = parseFloat(document.getElementById("prodCost").value) || 0;
      const alertQty = parseFloat(document.getElementById("prodAlert").value) || 0;
      if (!name) {
        alert("أدخل اسم المنتج");
        return;
      }
      prod.name = name;
      prod.costPerKg = cost;
      prod.alertQty = alertQty;
      saveState();
      close();
      renderAll();
    });
  }

  function openAddSale(editId = null) {
    const isEdit = !!editId;
    const sale = isEdit ? state.sales.find(s => s.id === editId) : null;
    if (isEdit && !sale) return;

    const productOptions = state.products
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");

    const customerOptions = state.customers
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");

    const html = `
      <div class="modal-header">
        <strong>${isEdit ? "تعديل بيع" : "تسجيل بيع جديد"}</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>المنتج</label>
        <select id="saleProduct">${productOptions}</select>

        <label>الكمية (كيلو)</label>
        <input type="number" id="saleQty" step="0.01" min="0.01" value="${sale ? sale.quantity : ""}" />

        <label>السعر الإجمالي (€)</label>
        <input type="number" id="saleTotal" step="0.01" min="0" value="${sale ? sale.total : ""}" />

        <label>طريقة الدفع</label>
        <select id="saleMethod">
          <option value="cash" ${sale && sale.paymentMethod === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${sale && sale.paymentMethod === "bank" ? "selected" : ""}>بنك</option>
          <option value="credit" ${sale && sale.paymentMethod === "credit" ? "selected" : ""}>آجل</option>
        </select>

        <label>العميل (للدفع الآجل)</label>
        <select id="saleCustomer">
          <option value="">— اختر عميل —</option>
          ${customerOptions}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveSale">${isEdit ? "حفظ التعديل" : "حفظ"}</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    if (sale && sale.customerId) {
      overlay.querySelector("#saleCustomer").value = sale.customerId;
    }
    if (sale && sale.productId) {
      overlay.querySelector("#saleProduct").value = sale.productId;
    }

    overlay.querySelector("#btnSaveSale").addEventListener("click", () => {
      const productId = overlay.querySelector("#saleProduct").value;
      const qty = parseFloat(overlay.querySelector("#saleQty").value);
      const total = parseFloat(overlay.querySelector("#saleTotal").value);
      const method = overlay.querySelector("#saleMethod").value;
      const customerId = overlay.querySelector("#saleCustomer").value || null;

      if (!productId || !qty || qty <= 0 || !total || total < 0) {
        alert("أدخل بيانات بيع صحيحة");
        return;
      }
      if (method === "credit" && !customerId) {
        alert("اختر عميلًا للدفع الآجل");
        return;
      }

      if (isEdit) {
        // Reverse old
        const old = sale;
        const oldProd = getProductById(old.productId);
        if (oldProd) {
          oldProd.currentQty = (oldProd.currentQty || 0) + (old.quantity || 0);
        }
        // Apply new
        const prod = getProductById(productId);
        if (prod) {
          prod.currentQty = Math.max(0, (prod.currentQty || 0) - qty);
        }
        sale.productId = productId;
        sale.quantity = qty;
        sale.total = total;
        sale.paymentMethod = method;
        sale.customerId = customerId;
      } else {
        const prod = getProductById(productId);
        if (prod) {
          prod.currentQty = Math.max(0, (prod.currentQty || 0) - qty);
        }
        state.sales.push({
          id: uid("sale"),
          date: todayStr(),
          productId,
          quantity: qty,
          total,
          paymentMethod: method,
          customerId
        });
      }

      saveState();
      close();
      renderAll();
    });
  }

  function openAddPurchase(editId = null) {
    const isEdit = !!editId;
    const purch = isEdit ? state.purchases.find(p => p.id === editId) : null;
    if (isEdit && !purch) return;

    const productOptions = state.products
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");

    const html = `
      <div class="modal-header">
        <strong>${isEdit ? "تعديل شراء" : "تسجيل شراء جديد"}</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>المنتج</label>
        <select id="purchProduct">${productOptions}</select>

        <label>الكمية (كيلو)</label>
        <input type="number" id="purchQty" step="0.01" min="0.01" value="${purch ? purch.quantity : ""}" />

        <label>السعر الإجمالي (€)</label>
        <input type="number" id="purchTotal" step="0.01" min="0" value="${purch ? purch.total : ""}" />

        <label>طريقة الدفع</label>
        <select id="purchMethod">
          <option value="cash" ${purch && purch.paymentMethod === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${purch && purch.paymentMethod === "bank" ? "selected" : ""}>بنك</option>
          <option value="credit" ${purch && purch.paymentMethod === "credit" ? "selected" : ""}>آجل للمورد</option>
        </select>

        <label>اسم المورد (اختياري)</label>
        <input type="text" id="purchSupplier" value="${purch ? purch.supplierName || "" : ""}" placeholder="اختياري" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSavePurch">${isEdit ? "حفظ التعديل" : "حفظ"}</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    if (purch && purch.productId) {
      overlay.querySelector("#purchProduct").value = purch.productId;
    }

    overlay.querySelector("#btnSavePurch").addEventListener("click", () => {
      const productId = overlay.querySelector("#purchProduct").value;
      const qty = parseFloat(overlay.querySelector("#purchQty").value);
      const total = parseFloat(overlay.querySelector("#purchTotal").value);
      const method = overlay.querySelector("#purchMethod").value;
      const supplierName = (overlay.querySelector("#purchSupplier").value || "").trim();

      if (!productId || !qty || qty <= 0 || !total || total < 0) {
        alert("أدخل بيانات شراء صحيحة");
        return;
      }

      if (isEdit) {
        const old = purch;
        const oldProd = getProductById(old.productId);
        if (oldProd) {
          oldProd.currentQty = Math.max(0, (oldProd.currentQty || 0) - (old.quantity || 0));
        }
        const prod = getProductById(productId);
        if (prod) {
          prod.currentQty = (prod.currentQty || 0) + qty;
        }
        purch.productId = productId;
        purch.quantity = qty;
        purch.total = total;
        purch.paymentMethod = method;
        purch.supplierName = supplierName;
      } else {
        const prod = getProductById(productId);
        if (prod) {
          prod.currentQty = (prod.currentQty || 0) + qty;
        }
        state.purchases.push({
          id: uid("purch"),
          date: todayStr(),
          productId,
          quantity: qty,
          total,
          paymentMethod: method,
          supplierName
        });
      }

      saveState();
      close();
      renderAll();
    });
  }

  function openAddExpense(editId = null) {
    const isEdit = !!editId;
    const exp = isEdit ? state.expenses.find(e => e.id === editId) : null;
    if (isEdit && !exp) return;

    const html = `
      <div class="modal-header">
        <strong>${isEdit ? "تعديل مصروف" : "تسجيل مصروف جديد"}</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>نوع المصروف</label>
        <input type="text" id="expType" value="${exp ? exp.type || "" : ""}" placeholder="مثال: نقل، تعبئة" />

        <label>المبلغ (€)</label>
        <input type="number" id="expAmount" step="0.01" min="0" value="${exp ? exp.amount : ""}" />

        <label>طريقة الدفع</label>
        <select id="expMethod">
          <option value="cash" ${exp && exp.paymentMethod === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${exp && exp.paymentMethod === "bank" ? "selected" : ""}>بنك</option>
        </select>

        <label>ملاحظة</label>
        <input type="text" id="expNote" value="${exp ? exp.note || "" : ""}" placeholder="اختياري" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveExp">${isEdit ? "حفظ التعديل" : "حفظ"}</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    overlay.querySelector("#btnSaveExp").addEventListener("click", () => {
      const type = (overlay.querySelector("#expType").value || "").trim();
      const amount = parseFloat(overlay.querySelector("#expAmount").value);
      const method = overlay.querySelector("#expMethod").value;
      const note = (overlay.querySelector("#expNote").value || "").trim();

      if (!amount || amount <= 0) {
        alert("أدخل مبلغ صحيح");
        return;
      }

      if (isEdit) {
        exp.type = type;
        exp.amount = amount;
        exp.paymentMethod = method;
        exp.note = note;
      } else {
        state.expenses.push({
          id: uid("exp"),
          date: todayStr(),
          type,
          amount,
          paymentMethod: method,
          note
        });
      }

      saveState();
      close();
      renderAll();
    });
  }

  function openAddReceipt(editId = null) {
    const isEdit = !!editId;
    const rec = isEdit ? state.receipts.find(r => r.id === editId) : null;
    if (isEdit && !rec) return;

    const customerOptions = state.customers
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");

    const html = `
      <div class="modal-header">
        <strong>${isEdit ? "تعديل تحصيل" : "تسجيل تحصيل جديد"}</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>العميل</label>
        <select id="recCustomer">
          <option value="">— اختر عميل —</option>
          ${customerOptions}
        </select>

        <label>المبلغ (€)</label>
        <input type="number" id="recAmount" step="0.01" min="0" value="${rec ? rec.amount : ""}" />

        <label>طريقة التحصيل</label>
        <select id="recMethod">
          <option value="cash" ${rec && rec.paymentMethod === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${rec && rec.paymentMethod === "bank" ? "selected" : ""}>بنك</option>
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveRec">${isEdit ? "حفظ التعديل" : "حفظ"}</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    if (rec && rec.customerId) {
      overlay.querySelector("#recCustomer").value = rec.customerId;
    }

    overlay.querySelector("#btnSaveRec").addEventListener("click", () => {
      const customerId = overlay.querySelector("#recCustomer").value;
      const amount = parseFloat(overlay.querySelector("#recAmount").value);
      const method = overlay.querySelector("#recMethod").value;

      if (!customerId || !amount || amount <= 0) {
        alert("أدخل عميل ومبلغ صحيح");
        return;
      }

      if (isEdit) {
        rec.customerId = customerId;
        rec.amount = amount;
        rec.paymentMethod = method;
      } else {
        state.receipts.push({
          id: uid("rec"),
          date: todayStr(),
          customerId,
          amount,
          paymentMethod: method
        });
      }

      saveState();
      close();
      renderAll();
    });
  }

  function openAddTransfer(editId = null) {
    const isEdit = !!editId;
    const tr = isEdit ? state.transfers.find(t => t.id === editId) : null;
    if (isEdit && !tr) return;

    const html = `
      <div class="modal-header">
        <strong>${isEdit ? "تعديل تحويل" : "تسجيل تحويل جديد"}</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>من</label>
        <select id="trFrom">
          <option value="cash" ${tr && tr.from === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${tr && tr.from === "bank" ? "selected" : ""}>بنك</option>
        </select>

        <label>إلى</label>
        <select id="trTo">
          <option value="cash" ${tr && tr.to === "cash" ? "selected" : ""}>كاش</option>
          <option value="bank" ${tr && tr.to === "bank" ? "selected" : ""}>بنك</option>
        </select>

        <label>المبلغ (€)</label>
        <input type="number" id="trAmount" step="0.01" min="0" value="${tr ? tr.amount : ""}" />

        <label>ملاحظة</label>
        <input type="text" id="trNote" value="${tr ? tr.note || "" : ""}" placeholder="اختياري" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveTr">${isEdit ? "حفظ التعديل" : "حفظ"}</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    overlay.querySelector("#btnSaveTr").addEventListener("click", () => {
      const from = overlay.querySelector("#trFrom").value;
      const to = overlay.querySelector("#trTo").value;
      const amount = parseFloat(overlay.querySelector("#trAmount").value);
      const note = (overlay.querySelector("#trNote").value || "").trim();

      if (!amount || amount <= 0 || from === to) {
        alert("أدخل مبلغ صحيح واختر من/إلى مختلفين");
        return;
      }

      if (isEdit) {
        tr.from = from;
        tr.to = to;
        tr.amount = amount;
        tr.note = note;
      } else {
        state.transfers.push({
          id: uid("tr"),
          date: todayStr(),
          from,
          to,
          amount,
          note
        });
      }

      saveState();
      close();
      renderAll();
    });
  }

  // ---------- Opening Balances ----------
  function ensureCustomerByName(name) {
    if (!name) return null;
    let c = state.customers.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (c) return c.id;
    c = { id: uid("cust"), name };
    state.customers.push(c);
    return c.id;
  }

  function openAddCustomerModal() {
    const html = `
      <div class="modal-header">
        <strong>إضافة عميل جديد</strong>
        <button class="btn secondary" data-close>×</button>
      </div>
      <div class="modal-body">
        <label>اسم العميل</label>
        <input type="text" id="newCustName" placeholder="اسم العميل" />
      </div>
      <div class="modal-footer">
        <button class="btn secondary" data-close>إلغاء</button>
        <button class="btn success" id="btnSaveCust">حفظ</button>
      </div>
    `;
    const { overlay, close } = openModal(html);
    overlay.querySelector("[data-close]").addEventListener("click", close);

    overlay.querySelector("#btnSaveCust").addEventListener("click", () => {
      const name = (document.getElementById("newCustName").value || "").trim();
      if (!name) {
        alert("أدخل اسم العميل");
        return;
      }
      state.customers.push({ id: uid("cust"), name });
      saveState();
      close();
      renderOpening();
    });
  }

  function saveOpeningBalances() {
    const cash = parseFloat(document.getElementById("openingCash").value) || 0;
    const bank = parseFloat(document.getElementById("openingBank").value) || 0;

    const nameInputs = document.querySelectorAll(".openingCustomerName");
    const amountInputs = document.querySelectorAll(".openingCustomerAmount");

    const newDebts = [];
    nameInputs.forEach((inp, idx) => {
      const name = (inp.value || "").trim();
      const amount = parseFloat(amountInputs[idx].value) || 0;
      if (name && amount > 0) {
        const customerId = ensureCustomerByName(name);
        newDebts.push({ customerId, amount });
      }
    });

    state.opening.cash = cash;
    state.opening.bank = bank;
    state.opening.customerDebts = newDebts;

    saveState();
    renderAll();
    alert("تم حفظ الأرصدة الافتتاحية");
  }

  // ---------- Event Listeners ----------
  function initNav() {
    const nav = document.getElementById("mainNav");
    const sections = {
      dashboard: document.getElementById("view-dashboard"),
      products: document.getElementById("view-products"),
      sales: document.getElementById("view-sales"),
      purchases: document.getElementById("view-purchases"),
      expenses: document.getElementById("view-expenses"),
      receipts: document.getElementById("view-receipts"),
      transfers: document.getElementById("view-transfers"),
      opening: document.getElementById("view-opening"),
      movements: document.getElementById("view-movements")
    };

    nav.addEventListener("click", e => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      const view = btn.getAttribute("data-view");
      nav.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      Object.keys(sections).forEach(k => {
        sections[k].classList.toggle("hidden", k !== view);
      });

      if (view === "opening") renderOpening();
      if (view === "movements") renderMovements();
    });
  }

  function initButtons() {
    document.getElementById("btnResetDemo").addEventListener("click", resetDemo);

    document.getElementById("btnAddProduct").addEventListener("click", openAddProduct);
    document.getElementById("btnAddSale").addEventListener("click", () => openAddSale());
    document.getElementById("btnAddPurchase").addEventListener("click", () => openAddPurchase());
    document.getElementById("btnAddExpense").addEventListener("click", () => openAddExpense());
    document.getElementById("btnAddReceipt").addEventListener("click", () => openAddReceipt());
    document.getElementById("btnAddTransfer").addEventListener("click", () => openAddTransfer());

    document.getElementById("btnAddOpeningCustomer").addEventListener("click", openAddCustomerModal);
    document.getElementById("btnSaveOpening").addEventListener("click", saveOpeningBalances);

    // Delegated events
    document.addEventListener("click", e => {
      const t = e.target;

      if (t.classList.contains("btnEditProduct")) {
        openEditProduct(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeleteProduct")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذا المنتج؟")) return;
        state.products = state.products.filter(p => p.id !== id);
        saveState();
        renderAll();
      }

      if (t.classList.contains("btnSellQuick")) {
        openAddSale();
      }

      if (t.classList.contains("btnEditSale")) {
        openAddSale(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeleteSale")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذه العملية؟")) return;
        const sale = state.sales.find(s => s.id === id);
        if (sale) {
          const prod = getProductById(sale.productId);
          if (prod) {
            prod.currentQty = (prod.currentQty || 0) + (sale.quantity || 0);
          }
          state.sales = state.sales.filter(s => s.id !== id);
          saveState();
          renderAll();
        }
      }

      if (t.classList.contains("btnEditPurchase")) {
        openAddPurchase(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeletePurchase")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذه العملية؟")) return;
        const p = state.purchases.find(x => x.id === id);
        if (p) {
          const prod = getProductById(p.productId);
          if (prod) {
            prod.currentQty = Math.max(0, (prod.currentQty || 0) - (p.quantity || 0));
          }
          state.purchases = state.purchases.filter(x => x.id !== id);
          saveState();
          renderAll();
        }
      }

      if (t.classList.contains("btnEditExpense")) {
        openAddExpense(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeleteExpense")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذه العملية؟")) return;
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveState();
        renderAll();
      }

      if (t.classList.contains("btnEditReceipt")) {
        openAddReceipt(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeleteReceipt")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذه العملية؟")) return;
        state.receipts = state.receipts.filter(r => r.id !== id);
        saveState();
        renderAll();
      }

      if (t.classList.contains("btnEditTransfer")) {
        openAddTransfer(t.getAttribute("data-id"));
      }
      if (t.classList.contains("btnDeleteTransfer")) {
        const id = t.getAttribute("data-id");
        if (!confirm("حذف هذه العملية؟")) return;
        state.transfers = state.transfers.filter(tr => tr.id !== id);
        saveState();
        renderAll();
      }

      if (t.classList.contains("btnRemoveOpeningCustomer")) {
        const idx = parseInt(t.getAttribute("data-idx"), 10);
        state.opening.customerDebts.splice(idx, 1);
        saveState();
        renderOpening();
      }
    });

    // Opening customer inline name/amount change
    document.getElementById("openingCustomersList").addEventListener("input", e => {
      if (e.target.classList.contains("openingCustomerName")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        const newName = (e.target.value || "").trim();
        const debt = state.opening.customerDebts[idx];
        if (!debt) return;
        const cust = getCustomerById(debt.customerId);
        if (cust) cust.name = newName || "عميل";
        saveState();
      }
      if (e.target.classList.contains("openingCustomerAmount")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        const newAmount = parseFloat(e.target.value) || 0;
        if (state.opening.customerDebts[idx]) {
          state.opening.customerDebts[idx].amount = newAmount;
          saveState();
        }
      }
    });
  }

  // ---------- Init ----------
  function init() {
    initNav();
    initButtons();
    renderAll();
  }

  init();
})();
