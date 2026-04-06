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
        
        statusMessage.textContent = 'พร้อมตรวจสอบราคา (สินค้า ' + productsData.length + ' รายการ)';
        html5QrCode = new Html5Qrcode("reader", { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
    } catch (error) {
        console.error('Error:', error);
        statusMessage.innerHTML = '<span style="color: #ef4444;">เกิดข้อผิดพลาดในการโหลดข้อมูล</span>';
    }
}

// Search Logic
function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    statusMessage.textContent = 'กำลังค้นหา...';
    resultsContainer.innerHTML = '';
    
    let matchedProduct = null;
    let matchedUnitIndex = -1; // -1: ID/Name, 0: Unit 1, 1: Unit 2, 2: Unit 3

    for (const p of productsData) {
        // 1. Check Product ID
        if (p['รหัสสินค้า'] && p['รหัสสินค้า'].toString().toLowerCase() === query) {
            matchedProduct = p;
            break;
        }
        // 2. Check Barcode 1 (Column D)
        if (p['บาร์โค้ดในหน่วยนับ 1'] && p['บาร์โค้ดในหน่วยนับ 1'].toString() === query) {
            matchedProduct = p;
            matchedUnitIndex = 0;
            break;
        }
        // 3. Check Barcode 2 (Column G)
        if (p['บาร์โค้ดในหน่วยนับ 2'] && p['บาร์โค้ดในหน่วยนับ 2'].toString() === query) {
            matchedProduct = p;
            matchedUnitIndex = 1;
            break;
        }
        // 4. Check Barcode 3 (Column J)
        if (p['บาร์โค้ดในหน่วยนับ 3'] && p['บาร์โค้ดในหน่วยนับ 3'].toString() === query) {
            matchedProduct = p;
            matchedUnitIndex = 2;
            break;
        }
    }

    // 5. Partial Name Match if no exact match
    if (!matchedProduct) {
        matchedProduct = productsData.find(p => 
            p['ชื่อการค้า'] && p['ชื่อการค้า'].toString().toLowerCase().includes(query)
        );
    }

    if (matchedProduct) {
        renderProduct(matchedProduct, matchedUnitIndex);
        statusMessage.textContent = '';
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
    } else {
        statusMessage.textContent = 'ไม่พบสินค้าที่ตรงกับ "' + query + '"';
    }
}

// Pricing Logic
function getPricingTiers(product) {
    const tiers = [];
    const parsePrice = (val) => {
        if (!val) return 0;
        const match = val.toString().match(/[0-9.]+/);
        return match ? parseFloat(match[0]) : 0;
    };

    // Level 1: O/P
    if (parsePrice(product['ราคา 1']) > 0) {
        tiers.push({ price: parsePrice(product['ราคา 1']), unit: product['หน่วย 1'] || product['หน่วยนับที่ 1'] || 'ชิ้น' });
    }
    // Level 2: Q/R
    if (parsePrice(product['ราคา 2']) > 0) {
        tiers.push({ price: parsePrice(product['ราคา 2']), unit: product['หน่วย 2'] || 'หน่วยที่ 2' });
    }
    // Level 3: S/T
    if (parsePrice(product['ราคา 3']) > 0) {
        tiers.push({ price: parsePrice(product['ราคา 3']), unit: product['หน่วย 3'] || 'หน่วยที่ 3' });
    }

    if (tiers.length === 0) {
        let fallbackPrice = 0;
        let fallbackUnit = product['หน่วยนับที่ 1'] || 'ชิ้น';
        if (product['ระดับที่ 1'] && product['ระดับที่ 1'].toString().includes('/')) {
            fallbackPrice = parsePrice(product['ระดับที่ 1'].split('/')[1]);
        } else {
            fallbackPrice = parsePrice(product['หน่วย/' + fallbackUnit]);
        }
        tiers.push({ price: fallbackPrice, unit: fallbackUnit });
    }
    return tiers;
}

// Render Result
function renderProduct(product, matchedUnitIndex) {
    const tiers = getPricingTiers(product);
    const productId = product['รหัสสินค้า'] || 'N/A';
    
    // Display primary barcode found or default to Barcode 1
    const displayBarcode = matchedUnitIndex >= 0 
        ? product[`บาร์โค้ดในหน่วยนับ ${matchedUnitIndex + 1}`] 
        : (product['บาร์โค้ดในหน่วยนับ 1'] || 'N/A');

    const card = document.createElement('div');
    card.className = 'product-card glass';
    
    const pricesHtml = tiers.map((tier, index) => {
        // Highlight the specific unit if it matched the barcode
        const isMatched = (index === matchedUnitIndex);
        return `
            <div class="price-tier ${index === 0 ? 'primary-tier' : 'secondary-tier'} ${isMatched ? 'highlight-tier' : ''}">
                <div class="price-label">
                    ${index === 0 ? 'ราคามาตรฐาน' : 'ระดับราคา ' + (index + 1)}
                    ${isMatched ? '<span class="match-badge">✓ ตรงกับบาร์โค้ด</span>' : ''}
                </div>
                <div class="price-value">฿${tier.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                <div class="unit-label">ต่อ 1 ${tier.unit}</div>
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="product-id">ID: ${productId}</div>
        <div class="product-name">${product['ชื่อการค้า']}</div>
        <div class="barcode-badge">Barcode: ${displayBarcode}</div>
        <div class="price-section multi-price">${pricesHtml}</div>
    `;

    resultsContainer.appendChild(card);
}

// Scanner Functions
async function openScanner() {
    scannerDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    const config = { fps: 20, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }), aspectRatio: 1.0 };
    try {
        await html5QrCode.start({ facingMode: "environment" }, config, (text) => {
                searchInput.value = text;
                closeScannerDrawer();
                performSearch();
            }, (err) => {});
    } catch (err) {
        statusMessage.textContent = "ไม่สามารถเปิดกล้องได้";
        closeScannerDrawer();
    }
}

function closeScannerDrawer() {
    scannerDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(e => {});
}

// Events
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
scanBtn.addEventListener('click', openScanner);
closeScanner.addEventListener('click', closeScannerDrawer);
drawerOverlay.addEventListener('click', closeScannerDrawer);
document.addEventListener("visibilitychange", () => { if (document.hidden) closeScannerDrawer(); });

window.addEventListener('load', () => {
    searchInput.focus();
    init();
});
