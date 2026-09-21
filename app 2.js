// === تحميل البيانات ===
function loadFromStorage() {
    const saved = localStorage.getItem('honeyData');
    return saved ? JSON.parse(saved) : { 
        products: [], 
        purchases: [], 
        sales: [] 
    };
}

let appData = loadFromStorage();

// === حفظ البيانات ===
function saveToStorage() {
    localStorage.setItem('honeyData', JSON.stringify(appData));
}

// === التنقل ===
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick="showSection('${id}')"]`);
    if (btn) btn.classList.add('active');
    
    if (id === 'home') renderHome();
    else if (id === 'purchases') renderPurchasesTable();
    else if (id === 'sales') renderSalesTable();
    else if (id === 'add-purchase' || id === 'add-sale') updateProductSelects();
}

// === تحديث قوائم المنتجات ===
function updateProductSelects() {
    const purchaseSelect = document.getElementById('purchase-product');
    const saleSelect = document.getElementById('sale-product');
    
    purchaseSelect.innerHTML = '';
    saleSelect.innerHTML = '';
    
    appData.products.forEach((product, index) => {
        const option1 = document.createElement('option');
        option1.value = index;
        option1.textContent = `${product.name} - شراء: ${product.cost} € | بيع: ${product.price} € | المخزون: ${product.quantity}`;
        purchaseSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = index;
        option2.textContent = `${product.name} - شراء: ${product.cost} € | بيع: ${product.price} € | المخزون: ${product.quantity}`;
        saleSelect.appendChild(option2);
    });
}

// === الصفحة الرئيسية ===
function renderHome() {
    const totalPurchases = appData.purchases.reduce((sum, p) => sum + p.total, 0);
    const totalSales = appData.sales.reduce((sum, s) => sum + s.total, 0);
    const profit = totalSales - totalPurchases;
    const productsCount = appData.products.length;
    
    document.getElementById('total-purchases').textContent = totalPurchases.toLocaleString() + ' €';
    document.getElementById('total-sales').textContent = totalSales.toLocaleString() + ' €';
    document.getElementById('profit').textContent = profit.toLocaleString() + ' €';
    document.getElementById('products-count').textContent = productsCount;
    
    renderProductsTable();
}

// === عرض المنتجات ===
function renderProductsTable() {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';
    
    appData.products.forEach((product, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${product.name}</td>
            <td>${product.cost} €</td>
            <td>${product.price} €</td>
            <td>${product.quantity}</td>
            <td>
                <button onclick="editProduct(${index})" class="edit">تعديل</button>
                <button onclick="deleteProduct(${index})" class="delete">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// === عرض المشتريات ===
function renderPurchasesTable() {
    const tbody = document.querySelector('#purchases-table tbody');
    tbody.innerHTML = '';
    
    appData.purchases.forEach((purchase, index) => {
        const paymentText = {
            'cash': 'كاش 💵',
            'bank': 'بنك 🏦',
            'later': 'آجل ⏳'
        }[purchase.payment];
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${purchase.productName}</td>
            <td>${purchase.quantity}</td>
            <td>${purchase.total} €</td>
            <td>${purchase.customer || '-'}</td>
            <td class="payment-${purchase.payment}">${paymentText}</td>
            <td>
                <button onclick="deletePurchase(${index})" class="delete">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// === عرض المبيعات ===
function renderSalesTable() {
    const tbody = document.querySelector('#sales-table tbody');
    tbody.innerHTML = '';
    
    appData.sales.forEach((sale, index) => {
        const paymentText = {
            'cash': 'كاش 💵',
            'bank': 'بنك 🏦',
            'later': 'آجل ⏳'
        }[sale.payment];
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${sale.productName}</td>
            <td>${sale.quantity}</td>
            <td>${sale.total} €</td>
            <td>${sale.customer || '-'}</td>
            <td class="payment-${sale.payment}">${paymentText}</td>
            <td>
                <button onclick="deleteSale(${index})" class="delete">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// === إضافة منتج ===
function addProduct() {
    const name = document.getElementById('product-name').value.trim();
    const cost = parseFloat(document.getElementById('product-cost').value);
    const price = parseFloat(document.getElementById('product-price').value);
    const quantity = parseInt(document.getElementById('product-quantity').value);
    
    if (!name || isNaN(cost) || isNaN(price) || isNaN(quantity)) {
        alert('أدخل جميع البيانات بشكل صحيح');
        return;
    }
    
    appData.products.push({ name, cost, price, quantity });
    saveToStorage();
    
    document.getElementById('product-name').value = '';
    document.getElementById('product-cost').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-quantity').value = '';
    
    alert('✅ تم إضافة المنتج!');
    showSection('home');
}

// === تعديل منتج ===
function editProduct(index) {
    const product = appData.products[index];
    const newName = prompt('اسم المنتج:', product.name);
    const newCost = prompt('سعر الشراء:', product.cost);
    const newPrice = prompt('سعر البيع:', product.price);
    const newQuantity = prompt('المخزون:', product.quantity);
    
    if (newName && newCost && newPrice && newQuantity) {
        appData.products[index] = {
            name: newName.trim(),
            cost: parseFloat(newCost),
            price: parseFloat(newPrice),
            quantity: parseInt(newQuantity)
        };
        saveToStorage();
        renderHome();
    }
}

// === حذف منتج ===
function deleteProduct(index) {
    if (confirm('حذف هذا المنتج؟')) {
        appData.products.splice(index, 1);
        saveToStorage();
        renderHome();
    }
}

// === إضافة شراء ===
function addPurchase() {
    if (appData.products.length === 0) {
        alert('أضف منتجات أولاً!');
        return;
    }
    
    const select = document.getElementById('purchase-product');
    const productIndex = parseInt(select.value);
    const quantity = parseInt(document.getElementById('purchase-quantity').value);
    const customer = document.getElementById('purchase-customer').value.trim();
    const payment = document.getElementById('purchase-payment').value;
    
    if (isNaN(quantity) || quantity <= 0) {
        alert('أدخل كمية صحيحة');
        return;
    }
    
    const product = appData.products[productIndex];
    const total = product.cost * quantity;
    
    appData.products[productIndex].quantity += quantity;
    
    appData.purchases.push({
        productName: product.name,
        quantity,
        total,
        customer,
        payment
    });
    
    saveToStorage();
    document.getElementById('purchase-quantity').value = '';
    document.getElementById('purchase-customer').value = '';
    
    alert('✅ تم تسجيل الشراء!');
    showSection('home');
}

// === إضافة بيع ===
function addSale() {
    if (appData.products.length === 0) {
        alert('أضف منتجات أولاً!');
        return;
    }
    
    const select = document.getElementById('sale-product');
    const productIndex = parseInt(select.value);
    const quantity = parseInt(document.getElementById('sale-quantity').value);
    const customer = document.getElementById('sale-customer').value.trim();
    const payment = document.getElementById('sale-payment').value;
    
    if (isNaN(quantity) || quantity <= 0) {
        alert('أدخل كمية صحيحة');
        return;
    }
    
    const product = appData.products[productIndex];
    
    if (product.quantity < quantity) {
        alert(`المخزون غير كافي! المتوفر: ${product.quantity}`);
        return;
    }
    
    const total = product.price * quantity;
    
    appData.products[productIndex].quantity -= quantity;
    
    appData.sales.push({
        productName: product.name,
        quantity,
        total,
        customer,
        payment
    });
    
    saveToStorage();
    document.getElementById('sale-quantity').value = '';
    document.getElementById('sale-customer').value = '';
    
    alert('✅ تم تسجيل البيع!');
    showSection('home');
}

// === حذف شراء ===
function deletePurchase(index) {
    if (confirm('حذف هذه الشراء؟')) {
        const purchase = appData.purchases[index];
        const product = appData.products.find(p => p.name === purchase.productName);
        if (product) {
            product.quantity -= purchase.quantity;
        }
        appData.purchases.splice(index, 1);
        saveToStorage();
        renderPurchasesTable();
    }
}

// === حذف بيع ===
function deleteSale(index) {
    if (confirm('حذف هذه البيع؟')) {
        const sale = appData.sales[index];
        const product = appData.products.find(p => p.name === sale.productName);
        if (product) {
            product.quantity += sale.quantity;
        }
        appData.sales.splice(index, 1);
        saveToStorage();
        renderSalesTable();
    }
}

// === بدء التطبيق ===
renderHome();
