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
        
        // Initialize Scanner Instance
        html5QrCode = new Html5Qrcode("reader");
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
        (p['รหัสสินค้า'] && p['รหัสสินค้า'].toLowerCase() === query) || 
        (p['บาร์โค้ดในหน่วยนับ 1'] && p['บาร์โค้ดในหน่วยนับ 1'] === query)
    );

    // 2. Try partial match (Name) if no exact match
    if (!product) {
        product = productsData.find(p => 
            p['ชื่อการค้า'] && p['ชื่อการค้า'].toLowerCase().includes(query)
        );
    }

    if (product) {
        renderProduct(product);
        statusMessage.textContent = '';
        // Scroll to result on mobile
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
    } else {
        statusMessage.textContent = 'ไม่พบสินค้าที่ตรงกับ "' + query + '"';
    }
}

// Helper to extract price
function getPrice(product) {
    const unit1 = product['หน่วยนับที่ 1'];
    const priceKey = 'หน่วย/' + unit1;
    let price = product[priceKey];

    if (price === undefined || price === "" || price === null || price == 0) {
        price = product['ราคา 1'] || product['ราคา 2'] || product['ระดับที่ 1'] || "0.00";
    }

    if (typeof price === 'string') {
        const match = price.match(/[0-9.]+/);
        price = match ? match[0] : "0.00";
    }

    const numericPrice = parseFloat(price);
    return isNaN(numericPrice) ? 0 : numericPrice;
}

// Render Result
function renderProduct(product) {
    const price = getPrice(product);
    const unit = product['หน่วยนับที่ 1'] || 'ชิ้น';
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

// Scanner Functions
async function openScanner() {
    scannerDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    try {
        // Preference for back camera
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                // Success
                searchInput.value = decodedText;
                closeScannerDrawer();
                performSearch();
            },
            (errorMessage) => {
                // Ignore small scanning errors
            }
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

// Auto-focus search input
window.addEventListener('load', () => {
    searchInput.focus();
    init();
});
