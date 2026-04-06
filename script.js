const API_URL = 'https://script.google.com/macros/s/AKfycbyPMzdWVeyKJZhr_rtSOfnSlbwlN1MZ9UhaQlykyCxpcpmAUM7w9-S3b-EFC_JdXkG5Yg/exec';

let productsData = [];
let html5QrCode;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const scanBtn = document.getElementById('scanBtn');
const resultsContainer = document.getElementById('resultsContainer');
const statusMessage = document.getElementById('statusMessage');
const scannerDrawer = document.getElementById('scannerDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const closeScanner = document.getElementById('closeScanner');

// Initialize: Fetch Data
async function init() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const json = await response.json();
        productsData = json.data;
        
        statusMessage.textContent = 'พร้อมตรวจสอบราคา (ค้นหาจากสินค้ากว่า ' + productsData.length + ' รายการ)';
        
        // Initialize Scanner Instance with experimental focus features
        html5QrCode = new Html5Qrcode("reader", { 
            experimentalFeatures: { useBarCodeDetectorIfSupported: true } 
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        statusMessage.innerHTML = '<span style="color: #ef4444;">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</span>';
    }
}

// Search Logic
function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) return;

    statusMessage.textContent = 'กำลังค้นหา...';
    resultsContainer.innerHTML = '';
    
    // 1. Try exact match (Barcode or ID)
    let product = productsData.find(p => 
        (p['รหัสสินค้า'] && p['รหัสสินค้า'].toString().toLowerCase() === query) || 
        (p['บาร์โค้ดในหน่วยนับ 1'] && p['บาร์โค้ดในหน่วยนับ 1'].toString() === query)
    );

    // 2. Try partial match (Name) if no exact match
    if (!product) {
        product = productsData.find(p => 
            p['ชื่อการค้า'] && p['ชื่อการค้า'].toString().toLowerCase().includes(query)
        );
    }

    if (product) {
        renderProduct(product);
        statusMessage.textContent = '';
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
    } else {
        statusMessage.textContent = 'ไม่พบสินค้าที่ตรงกับ "' + query + '"';
    }
}

// User Requested Mapping: Column O (ราคา 1) and Column P (หน่วย 1)
function getPriceAndUnit(product) {
    let priceValue = "0";
    let unitValue = product['หน่วยนับที่ 1'] || "ชิ้น";

    // 1. Check Column O (ราคา 1) directly
    if (product['ราคา 1'] && parseFloat(product['ราคา 1']) > 0) {
        priceValue = product['ราคา 1'];
        // Use Column P (หน่วย 1) if Price exists
        if (product['หน่วย 1']) unitValue = product['หน่วย 1'];
    } 
    // 2. Fallback: Parse "ระดับที่ 1" (e.g., "1/55")
    else if (product['ระดับที่ 1'] && typeof product['ระดับที่ 1'] === 'string' && product['ระดับที่ 1'].includes('/')) {
        const parts = product['ระดับที่ 1'].split('/');
        priceValue = parts[1];
    }
    // 3. Last Fallback: "หน่วย/[หน่วยนับที่ 1]"
    else {
        const fallbackKey = 'หน่วย/' + unitValue;
        if (product[fallbackKey] && parseFloat(product[fallbackKey]) > 0) {
            priceValue = product[fallbackKey];
        }
    }

    // Clean up price string
    if (typeof priceValue === 'string') {
        const match = priceValue.match(/[0-9.]+/);
        priceValue = match ? match[0] : "0.00";
    }

    return {
        price: parseFloat(priceValue) || 0,
        unit: unitValue
    };
}

// Render Result
function renderProduct(product) {
    const { price, unit } = getPriceAndUnit(product);
    const barcode = product['บาร์โค้ดในหน่วยนับ 1'] || 'ไม่มีบาร์โค้ด';
    const productId = product['รหัสสินค้า'] || 'N/A';

    const card = document.createElement('div');
    card.className = 'product-card glass';
    
    card.innerHTML = `
        <div class="product-id">ID: ${productId}</div>
        <div class="product-name">${product['ชื่อการค้า']}</div>
        <div class="barcode-badge">Barcode: ${barcode}</div>
        
        <div class="price-section">
            <div class="price-label">ราคาประมาณการ</div>
            <div class="price-value">฿${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
            <div class="unit-label">ต่อ 1 ${unit}</div>
        </div>
    `;

    resultsContainer.appendChild(card);
}

// Optimized Scanner Functions
async function openScanner() {
    scannerDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    
    const config = { 
        fps: 20, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
            return { width: size, height: size };
        },
        aspectRatio: 1.0
    };
    
    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                searchInput.value = decodedText;
                closeScannerDrawer();
                performSearch();
            },
            (errorMessage) => {}
        );
    } catch (err) {
        console.error("Scanner failed:", err);
        statusMessage.textContent = "ไม่สามารถเปิดกล้องได้: " + err;
        closeScannerDrawer();
    }
}

function closeScannerDrawer() {
    scannerDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error(err));
    }
}

// Events
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

scanBtn.addEventListener('click', openScanner);
closeScanner.addEventListener('click', closeScannerDrawer);
drawerOverlay.addEventListener('click', closeScannerDrawer);

// Listen for visibility changes to cleanup camera if user switches apps
document.addEventListener("visibilitychange", () => {
    if (document.hidden) closeScannerDrawer();
});

window.addEventListener('load', () => {
    searchInput.focus();
    init();
});
