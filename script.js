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
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
    } else {
        statusMessage.textContent = 'ไม่พบสินค้าที่ตรงกับ "' + query + '"';
    }
}

// Advanced Price Parsing Logic
function getPrice(product) {
    let price = "0";

    // 1. Priority: "ระดับที่ 1" Column (Format might be "1/55")
    const level1 = product['ระดับที่ 1'];
    if (level1 && typeof level1 === 'string' && level1.includes('/')) {
        const parts = level1.split('/');
        price = parts[1]; // Get the price part
    } 
    // 2. Sub-Priority: "ราคา 1" Column
    else if (product['ราคา 1'] && parseFloat(product['ราคา 1']) > 0) {
        price = product['ราคา 1'];
    }
    // 3. Last Fallback: "หน่วย/X" Column
    else {
        const unit1 = product['หน่วยนับที่ 1'];
        const priceKey = 'หน่วย/' + unit1;
        const fallbackPrice = product[priceKey];

        if (fallbackPrice !== undefined && fallbackPrice !== "" && fallbackPrice !== null && fallbackPrice != 0) {
            price = fallbackPrice;
        } else {
            // Check any other Price Level if available
            price = product['ระดับที่ 2'] || product['ระดับที่ 3'] || "0.00";
        }
    }

    // Clean up price (parse as number to remove extra zeros or text)
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

// Optimized Scanner Functions
async function openScanner() {
    scannerDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    
    // Improved Configuration for Focus & Performance
    const config = { 
        fps: 15, // Higher frame rate for smoother detection
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Dynamic square scanning area for better focus on various devices
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.7;
            return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false // Usually false is better for front-facing, irrelevant for back
    };
    
    try {
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
                // Background scan errors are fine
            }
        ).catch(err => {
            // Handle specific camera start errors (e.g., focus constraint failure)
            console.error("Camera fail:", err);
        });
    } catch (err) {
        console.error("Scanner startup failed:", err);
        statusMessage.textContent = "ไม่สามารถเปิดกล้องได้: " + err;
        closeScannerDrawer();
    }
}

function closeScannerDrawer() {
    scannerDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Stop failed:", err));
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
