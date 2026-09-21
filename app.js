// === تحميل البيانات عند فتح التطبيق ===
function loadFromStorage() {
    const saved = localStorage.getItem('honeyData');
    return saved ? JSON.parse(saved) : { products: [], purchases: [], sales: [] };
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
    document.querySelector(`nav button[onclick="showSection('${id}')"]`).classList.add('active');
    
    if (id === 'home') {
        renderHome();
    } else if (id === 'add-purchase' || id === 'add-sale') {
        updateProductSelects();
    }
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
        option1.textContent = `${product.name} - ${product.price} ر.س`;
        purchaseSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = index;
        option2.textContent = `${product.name} - ${product.price} ر.س`;
        saleSelect.appendChild(option2);
    });
}

// === الصفحة الرئيسية ===
function renderHome() {
    const totalPurchases = appData.purchases.reduce((sum, p) => sum + p.total, 0);
    const totalSales = appData.sales.reduce((sum, s) => sum + s.total, 0);
    const profit = totalSales - totalPurchases;
    const productsCount = appData.products.length;
    
    document.getElementById('total-purchases').textContent = totalPurchases.toLocaleString() + ' ر.س';
    document.getElementById('total-sales').textContent = totalSales.toLocaleString() + ' ر.س';
    document.getElementById('profit').textContent = profit.toLocaleString() + ' ر.س';
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
            <td>${product.price}</td>
            <td>
                <button onclick="editProduct(${index})" class="edit">تعديل</button>
                <button onclick="deleteProduct(${index})" class="delete">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// === إضافة منتج ===
function addProduct() {
    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    
    if (!name || isNaN(price) || price <= 0) {
        alert('أدخل اسم وسعر صحيحين');
        return;
    }
    
    appData.products.push({ name, price });
    saveToStorage();
    
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    
    alert('✅ تم إضافة المنتج!');
    showSection('home');
}

// === تعديل منتج ===
function editProduct(index) {
    const product = appData.products[index];
    const newName = prompt('اسم المنتج:', product.name);
    const newPrice = prompt('السعر:', product.price);
    
    if (newName && newPrice) {
        appData.products[index] = {
            name: newName.trim(),
            price: parseFloat(newPrice)
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
    
    if (isNaN(quantity) || quantity <= 0) {
        alert('أدخل كمية صحيحة');
        return;
    }
    
    const product = appData.products[productIndex];
    const total = product.price * quantity;
    
    appData.purchases.push({
        productName: product.name,
        quantity,
        total
    });
    
    saveToStorage();
    document.getElementById('purchase-quantity').value = '';
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
    
    if (isNaN(quantity) || quantity <= 0) {
        alert('أدخل كمية صحيحة');
        return;
    }
    
    const product = appData.products[productIndex];
    const total = product.price * quantity;
    
    appData.sales.push({
        productName: product.name,
        quantity,
        total
    });
    
    saveToStorage();
    document.getElementById('sale-quantity').value = '';
    alert('✅ تم تسجيل البيع!');
    showSection('home');
}

// === بدء التطبيق ===
renderHome();
