/**
 * S-GYVER MOBILE SCANNER & THERMAL LABEL PRINTER
 * Mobile Web App for iPhone, iPad, Android & Thermal Printing (PeriPage 57mm)
 */

const DEFAULT_SB_URL = 'https://igiihteeeprpcxxlldkd.supabase.co';
const DEFAULT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaWlodGVlZXBycGN4eGxsZGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODkwNzksImV4cCI6MjEwMDU2NTA3OX0.fr8_ZAYKQ3D-JgEtAWGJnNvKjoUmYxs1T7tjzzsEltw';

const AppState = {
    supabaseClient: null,
    supabaseUrl: DEFAULT_SB_URL,
    supabaseKey: DEFAULT_SB_KEY,
    products: [],
    currentProduct: null,
    html5QrCode: null,
    isCameraRunning: false,
    cameraFacingMode: 'environment', // 'environment' = back camera, 'user' = front
    isTorchOn: false,
    lastScannedCode: null,
    lastScannedTime: 0,
    scanCooldownMs: 1800,
    soundEnabled: true,
    vibrateEnabled: true,
    activeTab: 'tabScanner'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initSupabase();
    initSoundSynthesizer();
    renderBarcode('WFC-SKT-MNS-001-01');
    fetchProducts();
});

// ==============================================================================
// 1. SUPABASE CLIENT & DATA LAYER
// ==============================================================================
function initSupabase() {
    try {
        if (window.supabase) {
            AppState.supabaseClient = window.supabase.createClient(AppState.supabaseUrl, AppState.supabaseKey);
            updateDbStatus(true, 'เชื่อมต่อแล้ว');
        } else {
            updateDbStatus(false, 'ไม่พบ Supabase Library');
        }
    } catch (e) {
        console.error('Supabase init error:', e);
        updateDbStatus(false, 'เชื่อมต่อล้มเหลว');
    }
}

function updateDbStatus(isOnline, text) {
    const dot = document.getElementById('dbStatusDot');
    const label = document.getElementById('dbStatusText');
    if (!dot || !label) return;

    if (isOnline) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        label.innerText = text || 'เชื่อมต่อสำเร็จ';
        label.className = 'text-emerald-600 font-semibold';
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        label.innerText = text || 'ออฟไลน์';
        label.className = 'text-rose-500 font-semibold';
    }
}

async function fetchProducts() {
    const icon = document.getElementById('btnRefreshIcon');
    if (icon) icon.classList.add('animate-spin');

    if (!AppState.supabaseClient) {
        if (icon) icon.classList.remove('animate-spin');
        return;
    }

    try {
        const { data, error } = await AppState.supabaseClient
            .from('product_labels')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        AppState.products = data || [];
        updateDbStatus(true, `ออนไลน์ (${AppState.products.length} รายการ)`);
        renderProductsList(AppState.products);

        // Update count badge
        const countBadge = document.getElementById('productTotalCount');
        if (countBadge) countBadge.innerText = AppState.products.length;

        // If there's an initial product, set it
        if (AppState.products.length > 0 && !AppState.currentProduct) {
            setScannedProduct(AppState.products[0], false);
        }
    } catch (err) {
        console.warn('Could not fetch products from Supabase, loading fallback:', err);
        updateDbStatus(false, 'ใช้ข้อมูลในเครื่อง');
        loadFallbackProducts();
    } finally {
        if (icon) {
            setTimeout(() => icon.classList.remove('animate-spin'), 500);
        }
    }
}

function refreshProductData() {
    fetchProducts();
}

function loadFallbackProducts() {
    AppState.products = [
        {
            sku: 'WFC-SKT-MNS-001-01',
            brand: 'Whatever_Glitters',
            product_type: 'เสื้อผ้าแฟชั่นผู้หญิง',
            name: 'เสื้อผ้าแฟชั่นผู้หญิง',
            variant: 'S',
            color: 'ทอง',
            size: 'S',
            usage_info: 'สำหรับสวมใส่',
            care_instructions: 'ซักมือเบาๆ ห้ามขยี้แรง ห้ามแช่น้ำนาน ห้ามรีดทับลายเลื่อม และงดปั่นแห้ง',
            manufacturer: 'ประเทศจีน',
            distributor: 'Whatever_Glitters',
            distributor_address: '222/56',
            price: 449,
            stock_quantity: 12,
            warehouse_location: 'A-01'
        }
    ];
    renderProductsList(AppState.products);
    if (!AppState.currentProduct) {
        setScannedProduct(AppState.products[0], false);
    }
}

// ==============================================================================
// 2. CAMERA BARCODE / QR SCANNER ENGINE (HTML5-QRCODE)
// ==============================================================================
async function toggleCameraScanner() {
    if (AppState.isCameraRunning) {
        await stopCameraScanner();
    } else {
        await startCameraScanner();
    }
}

async function startCameraScanner() {
    const readerEl = document.getElementById('reader');
    if (!readerEl) return;

    if (!AppState.html5QrCode) {
        AppState.html5QrCode = new Html5Qrcode("reader");
    }

    const config = {
        fps: 15,
        qrbox: { width: 250, height: 160 },
        aspectRatio: 1.0,
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        }
    };

    try {
        const btnText = document.getElementById('cameraStatusText');
        const btnIcon = document.getElementById('cameraStatusIcon');
        const btnTorch = document.getElementById('btnTorch');
        const btnSwitch = document.getElementById('btnSwitchCamera');
        const overlay = document.getElementById('scannerOverlay');

        await AppState.html5QrCode.start(
            { facingMode: AppState.cameraFacingMode },
            config,
            onScanSuccess,
            onScanFailure
        );

        AppState.isCameraRunning = true;
        if (btnText) btnText.innerText = 'ปิดกล้อง';
        if (btnIcon) btnIcon.className = 'bi bi-camera-video-off-fill';
        if (btnTorch) btnTorch.disabled = false;
        if (btnSwitch) btnSwitch.disabled = false;
        if (overlay) overlay.classList.remove('hidden');
    } catch (err) {
        console.error('Camera start error:', err);
        alert('ไม่สามารถเปิดกล้องได้: โปรดตรวจสอบการอนุญาตใช้งานกล้อง (Camera Permission) ในเบราว์เซอร์');
    }
}

async function stopCameraScanner() {
    if (AppState.html5QrCode && AppState.isCameraRunning) {
        try {
            await AppState.html5QrCode.stop();
        } catch (e) {
            console.warn('Camera stop warning:', e);
        }
    }

    AppState.isCameraRunning = false;
    AppState.isTorchOn = false;

    const btnText = document.getElementById('cameraStatusText');
    const btnIcon = document.getElementById('cameraStatusIcon');
    const btnTorch = document.getElementById('btnTorch');
    const btnSwitch = document.getElementById('btnSwitchCamera');
    const overlay = document.getElementById('scannerOverlay');

    if (btnText) btnText.innerText = 'เปิดกล้อง';
    if (btnIcon) btnIcon.className = 'bi bi-camera-video-fill';
    if (btnTorch) {
        btnTorch.disabled = true;
        btnTorch.classList.remove('bg-amber-100', 'text-amber-600');
    }
    if (btnSwitch) btnSwitch.disabled = true;
    if (overlay) overlay.classList.add('hidden');
}

async function switchCameraFacing() {
    AppState.cameraFacingMode = AppState.cameraFacingMode === 'environment' ? 'user' : 'environment';
    if (AppState.isCameraRunning) {
        await stopCameraScanner();
        await startCameraScanner();
    }
}

async function toggleTorch() {
    if (!AppState.isCameraRunning || !AppState.html5QrCode) return;
    try {
        AppState.isTorchOn = !AppState.isTorchOn;
        await AppState.html5QrCode.applyVideoConstraints({
            advanced: [{ torch: AppState.isTorchOn }]
        });
        const btnTorch = document.getElementById('btnTorch');
        if (btnTorch) {
            if (AppState.isTorchOn) {
                btnTorch.classList.add('bg-amber-100', 'text-amber-600');
            } else {
                btnTorch.classList.remove('bg-amber-100', 'text-amber-600');
            }
        }
    } catch (e) {
        console.warn('Torch not supported on this device:', e);
        alert('อุปกรณ์นี้ไม่รองรับการเปิดไฟฉายจากเบราว์เซอร์');
    }
}

function onScanSuccess(decodedText) {
    const cleanText = (decodedText || '').trim();
    if (!cleanText) return;

    const now = Date.now();
    if (cleanText === AppState.lastScannedCode && (now - AppState.lastScannedTime) < AppState.scanCooldownMs) {
        return; // Ignore duplicate scans in cooldown
    }

    AppState.lastScannedCode = cleanText;
    AppState.lastScannedTime = now;

    // Trigger feedback
    playScanChime();
    triggerVibration();

    // Look up product
    lookupAndShowProduct(cleanText);
}

function onScanFailure(error) {
    // Silent on normal frame miss
}

function handleManualSearch() {
    const input = document.getElementById('manualSkuInput');
    const val = (input?.value || '').trim();
    if (!val) {
        alert('กรุณากรอกรหัส SKU หรือคำค้นหา');
        return;
    }
    lookupAndShowProduct(val);
}

function lookupAndShowProduct(query) {
    const cleanQ = query.toUpperCase();

    // 1. Check local loaded products
    const match = AppState.products.find(p =>
        (p.sku && p.sku.toUpperCase() === cleanQ) ||
        (p.sku && p.sku.toUpperCase().includes(cleanQ)) ||
        (p.name && p.name.toUpperCase().includes(cleanQ))
    );

    if (match) {
        setScannedProduct(match, true);
    } else {
        // Query directly from Supabase if not found locally
        if (AppState.supabaseClient) {
            AppState.supabaseClient
                .from('product_labels')
                .select('*')
                .ilike('sku', `%${cleanQ}%`)
                .limit(1)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        setScannedProduct(data[0], true);
                    } else {
                        showProductNotFoundCard(query);
                    }
                });
        } else {
            showProductNotFoundCard(query);
        }
    }
}

function setScannedProduct(product, shouldScroll = true) {
    AppState.currentProduct = product;

    const card = document.getElementById('scannedProductCard');
    if (!card) return;

    card.classList.remove('hidden');

    const brandEl = document.getElementById('scanCardBrand');
    const titleEl = document.getElementById('scanCardTitle');
    const variantEl = document.getElementById('scanCardVariant');
    const skuEl = document.getElementById('scanCardSku');
    const stockEl = document.getElementById('scanCardStock');
    const locEl = document.getElementById('scanCardLocation');

    if (brandEl) brandEl.innerText = product.brand || 'Whatever_Glitters';
    if (titleEl) titleEl.innerText = product.product_type || product.name || 'เสื้อผ้าแฟชั่น';
    if (skuEl) skuEl.innerText = product.sku || '-';
    if (stockEl) stockEl.innerText = product.stock_quantity ?? 0;
    if (locEl) locEl.innerHTML = `<i class="bi bi-geo-alt-fill text-rose-500 text-xs"></i> <span>${product.warehouse_location || '-'}</span>`;

    // Parse color and size
    const color = product.color || extractColor(product.variant);
    const size = product.size || extractSize(product.variant);
    if (variantEl) {
        variantEl.innerText = `สี: ${color || '-'} | ขนาด / ไซต์: ${size || product.variant || '-'}`;
    }

    // Also update sticker preview in print tab
    updateStickerPreview(product);

    if (shouldScroll) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function showProductNotFoundCard(query) {
    const card = document.getElementById('scannedProductCard');
    if (!card) return;

    card.classList.remove('hidden');
    const brandEl = document.getElementById('scanCardBrand');
    const titleEl = document.getElementById('scanCardTitle');
    const variantEl = document.getElementById('scanCardVariant');
    const skuEl = document.getElementById('scanCardSku');
    const stockEl = document.getElementById('scanCardStock');
    const locEl = document.getElementById('scanCardLocation');

    if (brandEl) brandEl.innerText = 'ไม่พบข้อมูล';
    if (titleEl) titleEl.innerText = `ไม่พบรหัส "${query}" ในระบบ`;
    if (variantEl) variantEl.innerText = 'สามารถค้นหาด้วยรหัสอื่น หรือตรวจสอบการพิมพ์';
    if (skuEl) skuEl.innerText = query;
    if (stockEl) stockEl.innerText = '0';
    if (locEl) locEl.innerText = '-';
}

// ==============================================================================
// 3. QUICK STOCK ADJUSTMENT (+1 / -1)
// ==============================================================================
async function adjustCurrentStock(delta) {
    if (!AppState.currentProduct) {
        alert('กรุณาสแกนหรือเลือกสินค้าก่อน');
        return;
    }

    const currentQty = AppState.currentProduct.stock_quantity || 0;
    const newQty = Math.max(0, currentQty + delta);

    // Optimistic UI update
    AppState.currentProduct.stock_quantity = newQty;
    const stockEl = document.getElementById('scanCardStock');
    if (stockEl) stockEl.innerText = newQty;

    triggerVibration();

    // Sync to Supabase
    if (AppState.supabaseClient && AppState.currentProduct.id) {
        try {
            const { error } = await AppState.supabaseClient
                .from('product_labels')
                .update({ stock_quantity: newQty })
                .eq('id', AppState.currentProduct.id);

            if (error) throw error;
        } catch (err) {
            console.error('Failed to sync stock to Supabase:', err);
        }
    }

    // Refresh products list
    renderProductsList(AppState.products);
}

// ==============================================================================
// 4. THERMAL LABEL STICKER & PRINT ENGINE
// ==============================================================================
function updateStickerPreview(product) {
    if (!product) return;

    const lblBrand = document.getElementById('lblBrand');
    const lblProductType = document.getElementById('lblProductType');
    const lblColor = document.getElementById('lblColor');
    const lblVariant = document.getElementById('lblVariant');
    const lblBigSize = document.getElementById('stickerBigSize');
    const lblUsage = document.getElementById('lblUsage');
    const lblCare = document.getElementById('lblCare');
    const lblManufacturer = document.getElementById('lblManufacturer');
    const lblDistributor = document.getElementById('lblDistributor');
    const lblDistributorAddress = document.getElementById('lblDistributorAddress');
    const lblPriceText = document.getElementById('lblPriceText');
    const lblSkuText = document.getElementById('lblSkuText');

    if (lblBrand) lblBrand.innerText = product.brand || 'Whatever_Glitters';
    if (lblProductType) lblProductType.innerText = product.product_type || product.name || 'เสื้อผ้าแฟชั่นผู้หญิง';

    const color = product.color || extractColor(product.variant) || '-';
    const size = product.size || extractSize(product.variant) || product.variant || 'S';

    if (lblColor) lblColor.innerText = color;
    if (lblVariant) lblVariant.innerText = size;

    // Big Size Callout on right side
    const chkShowBig = document.getElementById('chkShowBigSize');
    const isShowBig = chkShowBig ? chkShowBig.checked : true;
    if (lblBigSize) {
        if (isShowBig && size) {
            lblBigSize.classList.remove('hidden');
            lblBigSize.innerText = size.trim();

            const cleanUpper = size.trim().toUpperCase();
            if (cleanUpper.length <= 1) { // S, M, L
                lblBigSize.style.fontSize = '38pt';
                lblBigSize.style.lineHeight = '0.85';
            } else if (cleanUpper.length <= 2) { // XL, 2X
                lblBigSize.style.fontSize = '30pt';
                lblBigSize.style.lineHeight = '0.88';
            } else if (cleanUpper.length <= 3) { // XXL, 3XL
                lblBigSize.style.fontSize = '24pt';
                lblBigSize.style.lineHeight = '0.90';
            } else {
                lblBigSize.style.fontSize = '18pt';
                lblBigSize.style.lineHeight = '0.95';
            }
        } else {
            lblBigSize.classList.add('hidden');
        }
    }

    if (lblUsage) lblUsage.innerText = product.usage_info || 'สำหรับสวมใส่';
    if (lblCare) lblCare.innerText = product.care_instructions || 'ซักมือเบาๆ ห้ามขยี้แรง ห้ามแช่น้ำนาน ห้ามรีดทับลายเลื่อม และงดปั่นแห้ง';
    if (lblManufacturer) lblManufacturer.innerText = product.manufacturer || 'ประเทศจีน';
    if (lblDistributor) lblDistributor.innerText = product.distributor || 'Whatever_Glitters';
    if (lblDistributorAddress) lblDistributorAddress.innerText = product.distributor_address || '222/56';

    if (lblPriceText) {
        if (product.price) {
            lblPriceText.innerText = '฿' + Number(product.price).toLocaleString('th-TH') + ' บาท';
        } else {
            lblPriceText.innerText = 'ระบุ ณ จุดขาย';
        }
    }

    const sku = product.sku || 'WFC-SKT-MNS-001-01';
    if (lblSkuText) lblSkuText.innerText = sku;

    renderBarcode(sku);
}

function updateStickerPreviewFromInputs() {
    if (AppState.currentProduct) {
        updateStickerPreview(AppState.currentProduct);
    }
}

function renderBarcode(skuCode) {
    const svg = document.getElementById('barcodeSvg');
    const qrcodeDiv = document.getElementById('qrcodeDiv');

    if (svg && window.JsBarcode) {
        try {
            JsBarcode(svg, skuCode, {
                format: "CODE128",
                width: 1.55,
                height: 65,
                displayValue: false,
                margin: 3,
                background: "#ffffff",
                lineColor: "#000000"
            });
        } catch (e) {
            console.warn('JsBarcode render error:', e);
        }
    }

    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '';
        if (window.QRCode) {
            try {
                new QRCode(qrcodeDiv, {
                    text: skuCode,
                    width: 58,
                    height: 58,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                console.warn('QRCode render error:', e);
            }
        }
    }
}

function adjustPrintCount(delta) {
    const input = document.getElementById('printCountInput');
    if (!input) return;
    let val = parseInt(input.value || '1', 10) + delta;
    if (val < 1) val = 1;
    if (val > 100) val = 100;
    input.value = val;
}

function openPrintWithCurrentProduct() {
    switchTab('tabPrint', document.querySelectorAll('.nav-item')[2]);
    if (AppState.currentProduct) {
        updateStickerPreview(AppState.currentProduct);
    }
}

function triggerMobileThermalPrint() {
    const sticker = document.getElementById('mobilePrintableLabel');
    if (!sticker) return;

    const countInput = document.getElementById('printCountInput');
    const count = parseInt(countInput?.value || '1', 10);

    playScanChime();

    // Isolated Iframe Print Engine for thermal mobile printing
    let iframe = document.getElementById('mobilePrintIframe');
    if (iframe) iframe.remove();

    iframe = document.createElement('iframe');
    iframe.id = 'mobilePrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>พิมพ์ฉลากสินค้า PeriPage 57mm</title>
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@600;700;800&family=Prompt:wght@600;700;800&display=swap" rel="stylesheet">
            <style>
                @page { margin: 0mm !important; size: auto; }
                * { box-sizing: border-box; }
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    font-family: 'Kanit', 'Prompt', -apple-system, sans-serif !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print-page-sticker {
                    width: 57mm !important;
                    max-width: 57mm !important;
                    padding: 2.5mm 5mm 0mm 5mm !important;
                    font-size: 7.2pt !important;
                    line-height: 1.3 !important;
                    font-weight: 700 !important;
                    page-break-inside: avoid !important;
                    margin: 0 auto !important;
                }
                .print-page-sticker:not(:last-child) {
                    page-break-after: always !important;
                    break-after: page !important;
                }
                .sticker-line-brand { font-size: 8.8pt !important; line-height: 1.25 !important; margin-bottom: 2.5px !important; font-weight: 800 !important; }
                .sticker-line-brand .sticker-tag-lbl, .sticker-val-brand { font-size: 9.2pt !important; font-weight: 800 !important; }
                .sticker-tag-lbl { font-weight: 800 !important; color: #000000 !important; margin-right: 3px !important; display: inline !important; font-size: 7.2pt !important; }
                .sticker-val { color: #000000 !important; font-weight: 700 !important; display: inline !important; font-size: 7.2pt !important; }
                .sticker-line { margin-bottom: 2px !important; line-height: 1.28 !important; font-weight: 700 !important; }

                /* Middle Row Flexbox (Ensures Big Size stays on right) */
                .sticker-middle-row {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: nowrap !important;
                    margin: 1px 0 !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }
                .sticker-middle-left {
                    flex: 1 1 auto !important;
                    min-width: 0 !important;
                    padding-right: 2px !important;
                }
                .sticker-big-size {
                    flex: 0 0 auto !important;
                    font-weight: 900 !important;
                    font-family: 'Arial Black', Impact, sans-serif !important;
                    color: #000000 !important;
                    line-height: 0.88 !important;
                    text-align: right !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    font-size: 38pt !important;
                    letter-spacing: -1px !important;
                }
                .sticker-line-care { margin-bottom: 2.5px !important; line-height: 1.25 !important; font-size: 6.5pt !important; font-weight: 700 !important; text-align: left !important; }
                .sticker-line-care .sticker-tag-lbl { font-size: 6.8pt !important; font-weight: 800 !important; }
                .sticker-line-care .sticker-val { font-size: 6.5pt !important; }
                .sticker-line-distributor { margin-bottom: 2px !important; line-height: 1.25 !important; font-size: 6.8pt !important; font-weight: 700 !important; }
                .sticker-line-distributor .sticker-tag-lbl { font-size: 7.2pt !important; font-weight: 800 !important; }
                .sticker-line-distributor .sticker-val { font-size: 7.0pt !important; }
                .sticker-val-address { font-size: 6.5pt !important; font-weight: 700 !important; line-height: 1.24 !important; padding-left: 2px !important; margin-top: 1.5px !important; }
                .sticker-line-price { margin-top: 2.5px !important; margin-bottom: 2.5px !important; font-size: 8.2pt !important; font-weight: 800 !important; }
                .sticker-line-price .sticker-tag-lbl { font-size: 8.5pt !important; font-weight: 800 !important; }
                .sticker-line-price .sticker-val { font-size: 8.8pt !important; }
                .sticker-barcode-section { border-top: 1px dashed #000000 !important; padding-top: 2px !important; margin-top: 2.5px !important; }
                .sticker-sku-line {
                    text-align: center !important;
                    font-family: 'Kanit', 'Prompt', sans-serif !important;
                    font-weight: 800 !important;
                    font-size: 7.2pt !important;
                    color: #000000 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    letter-spacing: 0px !important;
                    line-height: 1.3 !important;
                }
                .sticker-sku-line strong, .sticker-sku-line span { font-weight: 850 !important; font-size: 7.2pt !important; color: #000000 !important; }
                .sticker-barcode-wrapper svg { max-width: 100% !important; height: 10mm !important; display: block !important; margin: 0 auto !important; }
                .tear-feed-spacer { height: 8mm !important; display: block !important; }
            </style>
        </head>
        <body>
            ${Array.from({ length: count }).map(() => `
                <div class="print-page-sticker">
                    ${sticker.innerHTML}
                    <div class="tear-feed-spacer">&nbsp;</div>
                </div>
            `).join('')}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error('Iframe print error, falling back to window.print():', e);
            window.print();
        }
    }, 250);
}

// ==============================================================================
// 5. PRODUCTS LIST RENDERING & SEARCH
// ==============================================================================
function renderProductsList(products) {
    const container = document.getElementById('productCardsContainer');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-slate-400 text-xs">
                <i class="bi bi-inbox text-3xl mb-1 block"></i>
                <div>ไม่พบสินค้าในระบบ</div>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(p => {
        const color = p.color || extractColor(p.variant);
        const size = p.size || extractSize(p.variant) || p.variant || '-';
        const isLow = (p.stock_quantity ?? 0) <= (p.min_stock_alert || 5);

        return `
            <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-2.5 active:bg-slate-50 transition-all cursor-pointer"
                onclick="selectProductFromList('${p.sku}')">
                <div class="flex-1 min-width-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            ${p.sku || '-'}
                        </span>
                        ${isLow ? '<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">ใกล้หมด</span>' : ''}
                    </div>
                    <div class="font-bold text-xs text-slate-900 mt-1 truncate">
                        ${p.product_type || p.name || 'เสื้อผ้าแฟชั่น'}
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">
                        สี: ${color || '-'} | ขนาด / ไซต์: <strong class="text-slate-800">${size}</strong>
                        ${p.warehouse_location ? ` | ชั้น: <strong class="text-slate-700">${p.warehouse_location}</strong>` : ''}
                    </div>
                </div>

                <div class="text-right flex flex-col items-end gap-1">
                    <div class="text-xs font-bold ${isLow ? 'text-rose-600' : 'text-blue-700'}">
                        ${p.stock_quantity ?? 0} ชิ้น
                    </div>
                    <button type="button" onclick="event.stopPropagation(); printSingleProduct('${p.sku}')"
                        class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-xs"
                        title="พิมพ์ฉลากสินค้านี้">
                        <i class="bi bi-printer"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function selectProductFromList(sku) {
    const product = AppState.products.find(p => p.sku === sku);
    if (!product) return;
    setScannedProduct(product, true);
    switchTab('tabScanner', document.querySelectorAll('.nav-item')[0]);
}

function printSingleProduct(sku) {
    const product = AppState.products.find(p => p.sku === sku);
    if (!product) return;
    setScannedProduct(product, false);
    switchTab('tabPrint', document.querySelectorAll('.nav-item')[2]);
}

function handleProductListFilter(query) {
    const q = (query || '').trim().toUpperCase();
    if (!q) {
        renderProductsList(AppState.products);
        return;
    }

    const filtered = AppState.products.filter(p =>
        (p.sku && p.sku.toUpperCase().includes(q)) ||
        (p.name && p.name.toUpperCase().includes(q)) ||
        (p.product_type && p.product_type.toUpperCase().includes(q)) ||
        (p.variant && p.variant.toUpperCase().includes(q))
    );
    renderProductsList(filtered);
}

function filterProducts(type) {
    const btnAll = document.getElementById('btnFilterAll');
    const btnLow = document.getElementById('btnFilterLow');

    if (type === 'low') {
        if (btnAll) btnAll.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700';
        if (btnLow) btnLow.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 text-white';
        const lowStock = AppState.products.filter(p => (p.stock_quantity ?? 0) <= (p.min_stock_alert || 5));
        renderProductsList(lowStock);
    } else {
        if (btnAll) btnAll.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white';
        if (btnLow) btnLow.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700';
        renderProductsList(AppState.products);
    }
}

// ==============================================================================
// 6. UI NAVIGATION TABS
// ==============================================================================
function switchTab(tabId, buttonEl) {
    AppState.activeTab = tabId;

    // Hide all tabs
    ['tabScanner', 'tabProducts', 'tabPrint', 'tabSettings'].forEach(id => {
        const tab = document.getElementById(id);
        if (tab) tab.classList.add('hidden');
    });

    // Show target tab
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');

    // Update bottom nav highlights
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (buttonEl) {
        buttonEl.classList.add('active');
    }

    // Auto handle camera based on tab
    if (tabId === 'tabScanner') {
        // Can optionally auto start or let user tap
    } else {
        // Stop camera when leaving scanner tab to save battery & release hardware
        if (AppState.isCameraRunning) {
            stopCameraScanner();
        }
    }
}

// ==============================================================================
// 7. SOUND CHIME & HAPTIC VIBRATION
// ==============================================================================
let audioCtx = null;

function initSoundSynthesizer() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    } catch (e) {
        console.warn('AudioContext not available:', e);
    }
}

function playScanChime() {
    if (!AppState.soundEnabled) return;

    // Web Audio Synthesizer (Works reliably on iOS Safari without CORS or external asset load)
    try {
        if (!audioCtx) initSoundSynthesizer();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (audioCtx) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6 Note
            osc.frequency.exponentialRampToValueAtTime(1567.98, audioCtx.currentTime + 0.12); // G6 Note

            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
            return;
        }
    } catch (e) {
        // Fallback to audio element
    }

    const audio = document.getElementById('audioBeep');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function triggerVibration() {
    if (!AppState.vibrateEnabled || !navigator.vibrate) return;
    try {
        navigator.vibrate([60, 40, 60]);
    } catch (e) {}
}

// ==============================================================================
// 8. SETTINGS & LOCAL STORAGE
// ==============================================================================
function loadSettings() {
    const savedUrl = localStorage.getItem('sgyver_mobile_sb_url');
    const savedKey = localStorage.getItem('sgyver_mobile_sb_key');
    const savedSound = localStorage.getItem('sgyver_mobile_sound');
    const savedVibrate = localStorage.getItem('sgyver_mobile_vibrate');

    if (savedUrl) AppState.supabaseUrl = savedUrl;
    if (savedKey) AppState.supabaseKey = savedKey;
    if (savedSound !== null) AppState.soundEnabled = savedSound === 'true';
    if (savedVibrate !== null) AppState.vibrateEnabled = savedVibrate === 'true';

    const urlInput = document.getElementById('settingSbUrl');
    const keyInput = document.getElementById('settingSbKey');
    const soundChk = document.getElementById('settingSoundChime');
    const vibrateChk = document.getElementById('settingVibrate');

    if (urlInput) urlInput.value = AppState.supabaseUrl;
    if (keyInput) keyInput.value = AppState.supabaseKey;
    if (soundChk) soundChk.checked = AppState.soundEnabled;
    if (vibrateChk) vibrateChk.checked = AppState.vibrateEnabled;
}

function saveSettings() {
    const urlInput = document.getElementById('settingSbUrl');
    const keyInput = document.getElementById('settingSbKey');

    const newUrl = (urlInput?.value || '').trim();
    const newKey = (keyInput?.value || '').trim();

    if (!newUrl || !newKey) {
        alert('กรุณากรอกทั้ง Supabase URL และ Key');
        return;
    }

    AppState.supabaseUrl = newUrl;
    AppState.supabaseKey = newKey;

    localStorage.setItem('sgyver_mobile_sb_url', newUrl);
    localStorage.setItem('sgyver_mobile_sb_key', newKey);

    initSupabase();
    fetchProducts();
    alert('✅ บันทึกการตั้งค่าและเชื่อมต่อฐานข้อมูลเรียบร้อยแล้ว');
}

function resetDefaultSettings() {
    AppState.supabaseUrl = DEFAULT_SB_URL;
    AppState.supabaseKey = DEFAULT_SB_KEY;

    localStorage.removeItem('sgyver_mobile_sb_url');
    localStorage.removeItem('sgyver_mobile_sb_key');

    loadSettings();
    initSupabase();
    fetchProducts();
    alert('คืนค่าเริ่มต้น Supabase เรียบร้อยแล้ว');
}

function saveAppPreferences() {
    const soundChk = document.getElementById('settingSoundChime');
    const vibrateChk = document.getElementById('settingVibrate');

    AppState.soundEnabled = soundChk ? soundChk.checked : true;
    AppState.vibrateEnabled = vibrateChk ? vibrateChk.checked : true;

    localStorage.setItem('sgyver_mobile_sound', AppState.soundEnabled);
    localStorage.setItem('sgyver_mobile_vibrate', AppState.vibrateEnabled);
}

// Helpers
function extractColor(variantStr) {
    if (!variantStr) return '';
    const parts = variantStr.split(/[\/\-,|]/);
    return parts[0]?.replace(/(สี|Color)/gi, '').trim() || '';
}

function extractSize(variantStr) {
    if (!variantStr) return '';
    const parts = variantStr.split(/[\/\-,|]/);
    if (parts.length > 1) {
        return parts[1]?.replace(/(ไซส์|ขนาด|Size)/gi, '').trim() || '';
    }
    return '';
}
