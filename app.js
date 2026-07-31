/**
 * Application Logic for Energy, Electricity, Chemicals & Steam Plant Tracker
 * Factory Repair & Support Division
 */

const STORAGE_KEY = 'factory_energy_chem_logs_v1';
const SETTINGS_KEY = 'factory_energy_settings_v1';
const INVENTORY_BASE_KEY = 'factory_inventory_base_v1';

// Global State
let logs = [];
let settings = { googleScriptUrl: '' };
let inventoryBase = {
  stockAlum: 2000,
  stockCaOH: 1500,
  stockSugar: 500,
  stockFuelOil: 20000,
  stockFuelLPG: 5000,
  lastUpdated: '',
  recorder: '',
  notes: ''
};
let charts = {};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initDateTime();
  loadSettings();
  loadInventoryBase();
  loadData();
  bindEvents();
  renderAllViews();
});

// Set Default DateTime to current local time
function initDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
  
  const recordDateInput = document.getElementById('recordDate');
  if (recordDateInput && !recordDateInput.value) recordDateInput.value = localISOTime;

  const inventoryDateInput = document.getElementById('inventoryDate');
  if (inventoryDateInput && !inventoryDateInput.value) inventoryDateInput.value = localISOTime;

  const todayStr = now.toISOString().slice(0, 10);
  const dailyPicker = document.getElementById('dailyDatePicker');
  if (dailyPicker && !dailyPicker.value) dailyPicker.value = todayStr;

  const monthStr = now.toISOString().slice(0, 7);
  const monthlyPicker = document.getElementById('monthlyPicker');
  if (monthlyPicker && !monthlyPicker.value) monthlyPicker.value = monthStr;
}

// Load persisted settings
function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      settings = JSON.parse(saved);
      const urlInput = document.getElementById('googleScriptUrl');
      if (urlInput) urlInput.value = settings.googleScriptUrl || '';
    } catch (e) { console.error('Error loading settings', e); }
  }
}

// Load Inventory Base Stock
function loadInventoryBase() {
  const saved = localStorage.getItem(INVENTORY_BASE_KEY);
  if (saved) {
    try {
      inventoryBase = JSON.parse(saved);
    } catch (e) { console.error('Error loading inventory base', e); }
  }
  populateInventoryFormValues();
}

function populateInventoryFormValues() {
  const elAlum = document.getElementById('baseStockAlum');
  const elCaOH = document.getElementById('baseStockCaOH');
  const elSugar = document.getElementById('baseStockSugar');
  const elOil = document.getElementById('baseStockFuelOil');
  const elLPG = document.getElementById('baseStockFuelLPG');
  const elRec = document.getElementById('inventoryRecorder');
  const elNotes = document.getElementById('inventoryNotes');

  if (elAlum) elAlum.value = inventoryBase.stockAlum;
  if (elCaOH) elCaOH.value = inventoryBase.stockCaOH;
  if (elSugar) elSugar.value = inventoryBase.stockSugar;
  if (elOil) elOil.value = inventoryBase.stockFuelOil;
  if (elLPG) elLPG.value = inventoryBase.stockFuelLPG;
  if (elRec && inventoryBase.recorder) elRec.value = inventoryBase.recorder;
  if (elNotes && inventoryBase.notes) elNotes.value = inventoryBase.notes;
}

// Load persisted records
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      logs = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored data', e);
      logs = [];
    }
  }
}

// Save records to LocalStorage
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  renderAllViews();
}

// Bind Event Listeners
function bindEvents() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
      
      const targetTab = btn.getAttribute('data-tab');
      btn.classList.add('active');
      const targetView = document.getElementById(targetTab);
      if (targetView) targetView.classList.add('active');

      // Refresh charts when switching tabs
      setTimeout(() => renderCharts(), 50);
    });
  });

  // Time Inputs Live Calculation for 6 Plants
  ['nc', 'ng', 'p', 'imi', 'b', 'acid'].forEach(plant => {
    const startEl = document.getElementById(`${plant}Start`);
    const endEl = document.getElementById(`${plant}End`);
    const calcEl = document.getElementById(`calc${plant.charAt(0).toUpperCase() + plant.slice(1)}Hours`);

    const updateCalc = () => {
      if (startEl && endEl && calcEl) {
        const hours = calculateHours(startEl.value, endEl.value);
        calcEl.textContent = `${hours.toFixed(1)} ชม.`;
      }
    };

    if (startEl) startEl.addEventListener('change', updateCalc);
    if (endEl) endEl.addEventListener('change', updateCalc);
  });

  // Live Inventory Stock Deduction Feedback on Form Inputs
  ['chemAlum', 'chemCaOH', 'chemSugar', 'fuelOil', 'fuelLPG'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateLiveStockFeedback);
  });

  // Global Form Submit (Save All Sections Together)
  const form = document.getElementById('trackingForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit();
    });
  }

  // Header Actions
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('sampleDataBtn')?.addEventListener('click', generateSampleData);
  document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPdf);

  // Search Box
  document.getElementById('logSearchInput')?.addEventListener('input', (e) => {
    renderLogsTable(e.target.value);
  });

  // Daily Date Picker & Monthly Picker
  document.getElementById('dailyDatePicker')?.addEventListener('change', () => renderDailyCharts());
  document.getElementById('monthlyPicker')?.addEventListener('change', () => renderMonthlyCharts());

  // Settings Actions
  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const urlInput = document.getElementById('googleScriptUrl');
    settings.googleScriptUrl = urlInput ? urlInput.value.trim() : '';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
  });

  document.getElementById('testSyncBtn')?.addEventListener('click', testGoogleSync);
  document.getElementById('backupJsonBtn')?.addEventListener('click', backupJson);
  document.getElementById('clearDataBtn')?.addEventListener('click', clearAllData);
}

// Calculate hours between 2 HH:MM time strings
function calculateHours(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  let startMins = sH * 60 + sM;
  let endMins = eH * 60 + eM;
  
  if (endMins < startMins) endMins += 24 * 60; // handle overnight shift
  return Math.max(0, (endMins - startMins) / 60);
}

// Calculate Current Net Inventory Balances (Base Stock - Total Usage)
function getCalculatedStockBalances() {
  const totalAlumUsed = logs.reduce((sum, r) => sum + (r.chemAlum || 0), 0);
  const totalCaOHUsed = logs.reduce((sum, r) => sum + (r.chemCaOH || 0), 0);
  const totalSugarUsed = logs.reduce((sum, r) => sum + (r.chemSugar || 0), 0);
  const totalFuelOilUsed = logs.reduce((sum, r) => sum + (r.fuelOil || 0), 0);
  const totalFuelLPGUsed = logs.reduce((sum, r) => sum + (r.fuelLPG || 0), 0);

  return {
    netAlum: Math.max(0, inventoryBase.stockAlum - totalAlumUsed),
    netCaOH: Math.max(0, inventoryBase.stockCaOH - totalCaOHUsed),
    netSugar: Math.max(0, inventoryBase.stockSugar - totalSugarUsed),
    netFuelOil: Math.max(0, inventoryBase.stockFuelOil - totalFuelOilUsed),
    netFuelLPG: Math.max(0, inventoryBase.stockFuelLPG - totalFuelLPGUsed)
  };
}

// Update Live Feedback under input fields
function updateLiveStockFeedback() {
  const currentStocks = getCalculatedStockBalances();
  
  const inputAlum = parseFloat(document.getElementById('chemAlum')?.value) || 0;
  const inputCaOH = parseFloat(document.getElementById('chemCaOH')?.value) || 0;
  const inputSugar = parseFloat(document.getElementById('chemSugar')?.value) || 0;
  const inputOil = parseFloat(document.getElementById('fuelOil')?.value) || 0;
  const inputLPG = parseFloat(document.getElementById('fuelLPG')?.value) || 0;

  const elAlum = document.getElementById('liveStockAlum');
  const elCaOH = document.getElementById('liveStockCaOH');
  const elSugar = document.getElementById('liveStockSugar');
  const elOil = document.getElementById('liveStockFuelOil');
  const elLPG = document.getElementById('liveStockFuelLPG');

  if (elAlum) elAlum.textContent = `คงคลังหลังหักลบ: ${(currentStocks.netAlum - inputAlum).toLocaleString()} kg`;
  if (elCaOH) elCaOH.textContent = `คงคลังหลังหักลบ: ${(currentStocks.netCaOH - inputCaOH).toLocaleString()} kg`;
  if (elSugar) elSugar.textContent = `คงคลังหลังหักลบ: ${(currentStocks.netSugar - inputSugar).toLocaleString()} kg`;
  if (elOil) elOil.textContent = `คงคลังหลังหักลบ: ${(currentStocks.netFuelOil - inputOil).toLocaleString()} ลิตร`;
  if (elLPG) elLPG.textContent = `คงคลังหลังหักลบ: ${(currentStocks.netFuelLPG - inputLPG).toLocaleString()} kg`;
}

// Get or Create Daily Record object
function getOrCreateDailyRecord(recordDate) {
  const dateOnly = recordDate.slice(0, 10);
  let record = logs.find(r => r.dateOnly === dateOnly);

  if (!record) {
    record = {
      id: Date.now().toString(),
      date: recordDate,
      dateOnly: dateOnly,
      solarRooftop: 0,
      solarFarm: 0,
      useKrong: 0,
      useWaterPump: 0,
      electricRecorder: '',
      electricNotes: '',
      chemAlum: 0,
      chemCaOH: 0,
      chemSugar: 0,
      chemRecorder: '',
      chemNotes: '',
      fuelOil: 0,
      fuelLPG: 0,
      plants: {
        nc: { start: '', end: '', hours: 0 },
        ng: { start: '', end: '', hours: 0 },
        p: { start: '', end: '', hours: 0 },
        imi: { start: '', end: '', hours: 0 },
        b: { start: '', end: '', hours: 0 },
        acid: { start: '', end: '', hours: 0 }
      },
      totalPlantHours: 0,
      steamRecorder: '',
      steamNotes: ''
    };
    logs.unshift(record);
  }
  return record;
}

// Independent Section Save Function
window.saveSection = function(sectionType) {

  if (sectionType === 'electricity') {
    const recordDate = document.getElementById('recordDate').value;
    if (!recordDate) return showToast('กรุณากรอกวันที่บันทึกข้อมูลก่อน', 'error');

    const recorder = document.getElementById('electricRecorder').value.trim();
    if (!recorder) return showToast('กรุณากรอกชื่อผู้บันทึกส่วนไฟฟ้า', 'error');

    const record = getOrCreateDailyRecord(recordDate);
    record.solarRooftop = parseFloat(document.getElementById('solarRooftop').value) || 0;
    record.solarFarm = parseFloat(document.getElementById('solarFarm').value) || 0;
    record.useKrong = parseFloat(document.getElementById('useKrong').value) || 0;
    record.useWaterPump = parseFloat(document.getElementById('useWaterPump').value) || 0;
    record.electricRecorder = recorder;
    record.electricNotes = document.getElementById('electricNotes').value.trim();

    saveData();
    if (settings.googleScriptUrl) syncSingleRecordToGoogle(record);
    showToast('⚡ บันทึกข้อมูลเฉพาะส่วนไฟฟ้า เรียบร้อยแล้ว!', 'success');

  } else if (sectionType === 'chemical') {
    const recordDate = document.getElementById('recordDate').value;
    if (!recordDate) return showToast('กรุณากรอกวันที่บันทึกข้อมูลก่อน', 'error');

    const recorder = document.getElementById('chemRecorder').value.trim();
    if (!recorder) return showToast('กรุณากรอกชื่อผู้บันทึกส่วนผลิตน้ำประปา', 'error');

    const record = getOrCreateDailyRecord(recordDate);
    record.chemAlum = parseFloat(document.getElementById('chemAlum').value) || 0;
    record.chemCaOH = parseFloat(document.getElementById('chemCaOH').value) || 0;
    record.chemSugar = parseFloat(document.getElementById('chemSugar').value) || 0;
    record.chemRecorder = recorder;
    record.chemNotes = document.getElementById('chemNotes').value.trim();

    saveData();
    if (settings.googleScriptUrl) syncSingleRecordToGoogle(record);
    showToast('🧪 บันทึกการใช้ส่วนผลิตน้ำประปา & คำนวณหักลบคลังอัตโนมัติ เรียบร้อยแล้ว!', 'success');

  } else if (sectionType === 'steam') {
    const recordDate = document.getElementById('recordDate').value;
    if (!recordDate) return showToast('กรุณากรอกวันที่บันทึกข้อมูลก่อน', 'error');

    const recorder = document.getElementById('steamRecorder').value.trim();
    if (!recorder) return showToast('กรุณากรอกชื่อผู้บันทึกส่วนผลิตไอน้ำและเชื้อเพลิง', 'error');

    const record = getOrCreateDailyRecord(recordDate);
    const ncH = calculateHours(document.getElementById('ncStart').value, document.getElementById('ncEnd').value);
    const ngH = calculateHours(document.getElementById('ngStart').value, document.getElementById('ngEnd').value);
    const pH = calculateHours(document.getElementById('pStart').value, document.getElementById('pEnd').value);
    const imiH = calculateHours(document.getElementById('imiStart').value, document.getElementById('imiEnd').value);
    const bH = calculateHours(document.getElementById('bStart').value, document.getElementById('bEnd').value);
    const acidH = calculateHours(document.getElementById('acidStart').value, document.getElementById('acidEnd').value);
    
    record.fuelOil = parseFloat(document.getElementById('fuelOil').value) || 0;
    record.fuelLPG = parseFloat(document.getElementById('fuelLPG').value) || 0;
    record.plants = {
      nc: { start: document.getElementById('ncStart').value, end: document.getElementById('ncEnd').value, hours: ncH },
      ng: { start: document.getElementById('ngStart').value, end: document.getElementById('ngEnd').value, hours: ngH },
      p: { start: document.getElementById('pStart').value, end: document.getElementById('pEnd').value, hours: pH },
      imi: { start: document.getElementById('imiStart').value, end: document.getElementById('imiEnd').value, hours: imiH },
      b: { start: document.getElementById('bStart').value, end: document.getElementById('bEnd').value, hours: bH },
      acid: { start: document.getElementById('acidStart').value, end: document.getElementById('acidEnd').value, hours: acidH }
    };
    record.totalPlantHours = ncH + ngH + pH + imiH + bH + acidH;
    record.steamRecorder = recorder;
    record.steamNotes = document.getElementById('steamNotes').value.trim();

    saveData();
    if (settings.googleScriptUrl) syncSingleRecordToGoogle(record);
    showToast('💨 บันทึกเฉพาะส่วนผลิตไอน้ำ & คำนวณหักลบเชื้อเพลิงคลังอัตโนมัติ เรียบร้อยแล้ว!', 'success');

  } else if (sectionType === 'inventory') {
    const recorder = document.getElementById('inventoryRecorder').value.trim();
    if (!recorder) return showToast('กรุณากรอกชื่อผู้รับเข้า/ปรับปรุงยอดคลัง', 'error');

    inventoryBase.stockAlum = parseFloat(document.getElementById('baseStockAlum').value) || 0;
    inventoryBase.stockCaOH = parseFloat(document.getElementById('baseStockCaOH').value) || 0;
    inventoryBase.stockSugar = parseFloat(document.getElementById('baseStockSugar').value) || 0;
    inventoryBase.stockFuelOil = parseFloat(document.getElementById('baseStockFuelOil').value) || 0;
    inventoryBase.stockFuelLPG = parseFloat(document.getElementById('baseStockFuelLPG').value) || 0;
    inventoryBase.recorder = recorder;
    inventoryBase.notes = document.getElementById('inventoryNotes').value.trim();
    inventoryBase.lastUpdated = document.getElementById('inventoryDate').value;

    localStorage.setItem(INVENTORY_BASE_KEY, JSON.stringify(inventoryBase));
    renderAllViews();
    showToast('📦 บันทึกตั้งค่ายอดยกมา/รับเข้าคลังเรียบร้อยแล้ว! (ระบบคำนวณหักลบให้อัตโนมัติ)', 'success');
  }
};

// Global Form Submit (All Sections Combined)
function handleFormSubmit() {
  const recordDate = document.getElementById('recordDate').value;
  if (!recordDate) {
    showToast('กรุณากรอกวันที่บันทึกข้อมูล', 'error');
    return;
  }

  saveSection('electricity');
  saveSection('chemical');
  saveSection('steam');

  showToast('🌟 บันทึกรวมทุกส่วนงานประจำวันเรียบร้อยแล้ว!', 'success');
}

// Render All Dashboard Components
function renderAllViews() {
  renderKpiCards();
  renderLogsTable();
  renderCharts();
  renderInventoryView();
  updateLiveStockFeedback();
}

// Render KPI Cards
function renderKpiCards() {
  const solarTotal = logs.reduce((sum, r) => sum + r.solarRooftop + r.solarFarm, 0);
  const electricTotal = logs.reduce((sum, r) => sum + r.useKrong + r.useWaterPump, 0);
  const chemTotal = logs.reduce((sum, r) => sum + r.chemAlum + r.chemCaOH + r.chemSugar, 0);
  const steamHoursTotal = logs.reduce((sum, r) => sum + r.totalPlantHours, 0);

  // Auto-calculated Net Stocks
  const stocks = getCalculatedStockBalances();

  document.getElementById('kpiSolarTotal').innerHTML = `${solarTotal.toLocaleString(undefined, {maximumFractionDigits: 1})} <span style="font-size: 0.9rem;">kWh</span>`;
  document.getElementById('kpiElectricTotal').innerHTML = `${electricTotal.toLocaleString(undefined, {maximumFractionDigits: 1})} <span style="font-size: 0.9rem;">kWh</span>`;
  document.getElementById('kpiChemTotal').innerHTML = `${chemTotal.toLocaleString(undefined, {maximumFractionDigits: 1})} <span style="font-size: 0.9rem;">kg</span>`;
  document.getElementById('kpiSteamHoursTotal').innerHTML = `${steamHoursTotal.toFixed(1)} <span style="font-size: 0.9rem;">ชม.</span>`;
  
  document.getElementById('kpiInventorySummary').innerHTML = `${stocks.netFuelOil.toLocaleString()} L / ${stocks.netAlum.toLocaleString()} kg`;
  document.getElementById('kpiInventoryDetail').textContent = `สารส้ม: ${stocks.netAlum}kg | ปูนขาว: ${stocks.netCaOH}kg | น้ำมันเตา: ${stocks.netFuelOil}L | LPG: ${stocks.netFuelLPG}kg`;
}

// Render Inventory Tab Dashboard with Auto-Calculated Subtraction
function renderInventoryView() {
  const stocks = getCalculatedStockBalances();

  const invAlumEl = document.getElementById('invCardAlum');
  const invCaOHEl = document.getElementById('invCardCaOH');
  const invSugarEl = document.getElementById('invCardSugar');
  const invOilEl = document.getElementById('invCardFuelOil');
  const invLPGEl = document.getElementById('invCardFuelLPG');

  if (invAlumEl) invAlumEl.innerHTML = `${stocks.netAlum.toLocaleString()} <span style="font-size: 0.9rem;">kg</span>`;
  if (invCaOHEl) invCaOHEl.innerHTML = `${stocks.netCaOH.toLocaleString()} <span style="font-size: 0.9rem;">kg</span>`;
  if (invSugarEl) invSugarEl.innerHTML = `${stocks.netSugar.toLocaleString()} <span style="font-size: 0.9rem;">kg</span>`;
  if (invOilEl) invOilEl.innerHTML = `${stocks.netFuelOil.toLocaleString()} <span style="font-size: 0.9rem;">ลิตร</span>`;
  if (invLPGEl) invLPGEl.innerHTML = `${stocks.netFuelLPG.toLocaleString()} <span style="font-size: 0.9rem;">kg</span>`;

  // Update Calculation Subtitles
  const subAlum = document.getElementById('subAlumCalc');
  const subCaOH = document.getElementById('subCaOHCalc');
  const subSugar = document.getElementById('subSugarCalc');
  const subOil = document.getElementById('subFuelOilCalc');
  const subLPG = document.getElementById('subFuelLPGCalc');

  const totalAlumUsed = logs.reduce((s, r) => s + (r.chemAlum || 0), 0);
  const totalCaOHUsed = logs.reduce((s, r) => s + (r.chemCaOH || 0), 0);
  const totalSugarUsed = logs.reduce((s, r) => s + (r.chemSugar || 0), 0);
  const totalFuelOilUsed = logs.reduce((s, r) => s + (r.fuelOil || 0), 0);
  const totalFuelLPGUsed = logs.reduce((s, r) => s + (r.fuelLPG || 0), 0);

  if (subAlum) subAlum.textContent = `ยกมา ${inventoryBase.stockAlum} - ใช้ไป ${totalAlumUsed} kg`;
  if (subCaOH) subCaOH.textContent = `ยกมา ${inventoryBase.stockCaOH} - ใช้ไป ${totalCaOHUsed} kg`;
  if (subSugar) subSugar.textContent = `ยกมา ${inventoryBase.stockSugar} - ใช้ไป ${totalSugarUsed} kg`;
  if (subOil) subOil.textContent = `ยกมา ${inventoryBase.stockFuelOil} - ใช้ไป ${totalFuelOilUsed} L`;
  if (subLPG) subLPG.textContent = `ยกมา ${inventoryBase.stockFuelLPG} - ใช้ไป ${totalFuelLPGUsed} kg`;

  // Inventory Charts
  createChart('inventoryChemChart', {
    type: 'bar',
    data: {
      labels: ['สารส้ม ALUM', 'ปูนขาว CaOH₂', 'น้ำตาล Sugar'],
      datasets: [{
        label: 'ยอดคงคลังสุทธิหลังหักลบ (kg)',
        data: [stocks.netAlum, stocks.netCaOH, stocks.netSugar],
        backgroundColor: ['#10b981', '#34d399', '#a7f3d0'],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  createChart('inventoryFuelChart', {
    type: 'bar',
    data: {
      labels: ['น้ำมันเตา (ลิตร)', 'แก๊ส LPG (kg)'],
      datasets: [{
        label: 'ยอดคงคลังสุทธิหลังหักลบ',
        data: [stocks.netFuelOil, stocks.netFuelLPG],
        backgroundColor: ['#ef4444', '#f87171'],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Render Logs Table with optional search query
function renderLogsTable(query = '') {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  const filtered = logs.filter(r => {
    const q = query.toLowerCase();
    return !q || 
      r.date.toLowerCase().includes(q) || 
      (r.electricRecorder && r.electricRecorder.toLowerCase().includes(q)) || 
      (r.chemRecorder && r.chemRecorder.toLowerCase().includes(q)) || 
      (r.steamRecorder && r.steamRecorder.toLowerCase().includes(q)) || 
      (r.notes && r.notes.toLowerCase().includes(q));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align: center; color: var(--text-muted); padding: 24px;">ไม่พบประวัติการบันทึกข้อมูล</td></tr>`;
    return;
  }

  // Calculate rolling stock balance for each row
  let runningAlum = inventoryBase.stockAlum;
  let runningCaOH = inventoryBase.stockCaOH;
  let runningOil = inventoryBase.stockFuelOil;
  let runningLPG = inventoryBase.stockFuelLPG;

  const logsAscending = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  const rowStockMap = {};

  logsAscending.forEach(r => {
    runningAlum -= (r.chemAlum || 0);
    runningCaOH -= (r.chemCaOH || 0);
    runningOil -= (r.fuelOil || 0);
    runningLPG -= (r.fuelLPG || 0);

    rowStockMap[r.id] = {
      alum: Math.max(0, runningAlum),
      caoh: Math.max(0, runningCaOH),
      oil: Math.max(0, runningOil),
      lpg: Math.max(0, runningLPG)
    };
  });

  tbody.innerHTML = filtered.map(r => {
    const formattedDate = new Date(r.date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    
    const electricInfo = `<strong style="color: #60a5fa;">${r.electricRecorder || '-'}</strong>` + (r.electricNotes ? `<br><small style="color: var(--text-muted);">${r.electricNotes}</small>` : '');
    const chemInfo = `<strong style="color: #34d399;">${r.chemRecorder || '-'}</strong>` + (r.chemNotes ? `<br><small style="color: var(--text-muted);">${r.chemNotes}</small>` : '');
    const steamInfo = `<strong style="color: #f472b6;">${r.steamRecorder || '-'}</strong>` + (r.steamNotes ? `<br><small style="color: var(--text-muted);">${r.steamNotes}</small>` : '');

    const rStock = rowStockMap[r.id] || { alum: 0, caoh: 0, oil: 0, lpg: 0 };
    const stockDetails = `
      <small style="color: #fbbf24;">
        สารส้มคงเหลือ: ${rStock.alum}kg | ปูนขาว: ${rStock.caoh}kg<br>
        น้ำมันเตา: ${rStock.oil}L | LPG: ${rStock.lpg}kg
      </small>
    `;

    const invRecorderInfo = inventoryBase.recorder ? `<strong style="color: #f59e0b;">${inventoryBase.recorder}</strong>` + (inventoryBase.notes ? `<br><small style="color: var(--text-muted);">${inventoryBase.notes}</small>` : '') : '-';

    return `
      <tr>
        <td><strong>${formattedDate}</strong></td>
        <td><span class="badge badge-solar">${r.solarRooftop.toLocaleString()}</span></td>
        <td><span class="badge badge-solar">${r.solarFarm.toLocaleString()}</span></td>
        <td><span class="badge badge-electricity">${r.useKrong.toLocaleString()}</span></td>
        <td><span class="badge badge-electricity">${r.useWaterPump.toLocaleString()}</span></td>
        <td>${electricInfo}</td>
        <td><span class="badge badge-chemical">${r.chemAlum} kg</span></td>
        <td><span class="badge badge-chemical">${r.chemCaOH} kg</span></td>
        <td><span class="badge badge-chemical">${r.chemSugar} kg</span></td>
        <td>${chemInfo}</td>
        <td><span class="badge badge-steam">${r.totalPlantHours.toFixed(1)}</span></td>
        <td>${r.fuelOil.toLocaleString()} ลิตร</td>
        <td>${r.fuelLPG.toLocaleString()} kg</td>
        <td>${steamInfo}</td>
        <td>${stockDetails}</td>
        <td>${invRecorderInfo}</td>
        <td>
          <button class="action-btn-sm delete" onclick="deleteRecord('${r.id}')"><i class="fa-solid fa-trash"></i> ลบ</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Record
window.deleteRecord = function(id) {
  if (confirm('คุณต้องการลบรายการบันทึกนี้ใช่หรือไม่?')) {
    logs = logs.filter(r => r.id !== id);
    saveData();
    showToast('ลบรายการบันทึกเรียบร้อย', 'success');
  }
};

// Render All Charts
function renderCharts() {
  renderDailyCharts();
  renderWeeklyCharts();
  renderMonthlyCharts();
  renderInventoryView();
}

// 1. Daily Charts
function renderDailyCharts() {
  const selectedDate = document.getElementById('dailyDatePicker')?.value;
  const dayLogs = logs.filter(r => r.dateOnly === selectedDate);

  const solarRooftop = dayLogs.reduce((s, r) => s + r.solarRooftop, 0);
  const solarFarm = dayLogs.reduce((s, r) => s + r.solarFarm, 0);
  const useKrong = dayLogs.reduce((s, r) => s + r.useKrong, 0);
  const useWaterPump = dayLogs.reduce((s, r) => s + r.useWaterPump, 0);

  // Daily Electricity Chart
  createChart('dailyElectricityChart', {
    type: 'bar',
    data: {
      labels: ['Solar Rooftop', 'Solar Farm', 'ใช้ไฟฟ้าPEA ณ กรง.ฯ', 'ใช้ไฟฟ้าPEA ณ โรงสูบน้ำแม่น้ำ'],
      datasets: [{
        label: 'หน่วย (kWh)',
        data: [solarRooftop, solarFarm, useKrong, useWaterPump],
        backgroundColor: ['#f59e0b', '#fbbf24', '#3b82f6', '#60a5fa'],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Daily Chemicals Chart
  const alum = dayLogs.reduce((s, r) => s + r.chemAlum, 0);
  const caoh = dayLogs.reduce((s, r) => s + r.chemCaOH, 0);
  const sugar = dayLogs.reduce((s, r) => s + r.chemSugar, 0);

  createChart('dailyChemicalChart', {
    type: 'doughnut',
    data: {
      labels: ['สารส้ม ALUM', 'ปูนขาว CaOH₂', 'น้ำตาล Sugar'],
      datasets: [{
        data: [alum, caoh, sugar],
        backgroundColor: ['#10b981', '#34d399', '#a7f3d0']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Daily Plant Runtime Hours
  const plantHours = {
    NC: dayLogs.reduce((s, r) => s + (r.plants?.nc?.hours || 0), 0),
    NG: dayLogs.reduce((s, r) => s + (r.plants?.ng?.hours || 0), 0),
    P: dayLogs.reduce((s, r) => s + (r.plants?.p?.hours || 0), 0),
    IMI: dayLogs.reduce((s, r) => s + (r.plants?.imi?.hours || 0), 0),
    B: dayLogs.reduce((s, r) => s + (r.plants?.b?.hours || 0), 0),
    ACID: dayLogs.reduce((s, r) => s + (r.plants?.acid?.hours || 0), 0)
  };

  createChart('dailyPlantHoursChart', {
    type: 'bar',
    data: {
      labels: ['NC', 'NG', 'P', 'IMI', 'B', 'ACID'],
      datasets: [{
        label: 'ชั่วโมงดำเนินงาน (ชม.)',
        data: Object.values(plantHours),
        backgroundColor: '#ec4899',
        borderRadius: 6
      }]
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
  });

  // Daily Fuel Chart
  const oil = dayLogs.reduce((s, r) => s + r.fuelOil, 0);
  const lpg = dayLogs.reduce((s, r) => s + r.fuelLPG, 0);

  createChart('dailyFuelChart', {
    type: 'bar',
    data: {
      labels: ['น้ำมันเตา (ลิตร)', 'แก๊ส LPG (kg)'],
      datasets: [{
        label: 'ปริมาณที่ใช้',
        data: [oil, lpg],
        backgroundColor: ['#ef4444', '#f87171'],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// 2. Weekly Charts (7 days)
function renderWeeklyCharts() {
  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const grouped = {};
  sorted.forEach(r => {
    if (!grouped[r.dateOnly]) {
      grouped[r.dateOnly] = { solar: 0, electric: 0, chem: 0, hours: 0 };
    }
    grouped[r.dateOnly].solar += (r.solarRooftop + r.solarFarm);
    grouped[r.dateOnly].electric += (r.useKrong + r.useWaterPump);
    grouped[r.dateOnly].chem += (r.chemAlum + r.chemCaOH + r.chemSugar);
    grouped[r.dateOnly].hours += r.totalPlantHours;
  });

  const last7Days = Object.keys(grouped).slice(-7);
  const solarData = last7Days.map(d => grouped[d].solar);
  const electricData = last7Days.map(d => grouped[d].electric);
  const chemData = last7Days.map(d => grouped[d].chem);
  const hoursData = last7Days.map(d => grouped[d].hours);

  createChart('weeklyElectricityChart', {
    type: 'line',
    data: {
      labels: last7Days,
      datasets: [
        { label: 'ผลิตไฟ (Solar Total kWh)', data: solarData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 },
        { label: 'ใช้ไฟฟ้า PEA รวม (kWh)', data: electricData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  createChart('weeklyChemicalChart', {
    type: 'bar',
    data: {
      labels: last7Days,
      datasets: [{ label: 'สารเคมีรวม (kg)', data: chemData, backgroundColor: '#10b981', borderRadius: 6 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  createChart('weeklyPlantHoursChart', {
    type: 'bar',
    data: {
      labels: last7Days,
      datasets: [{ label: 'ชั่วโมงไอน้ำรวม (ชม.)', data: hoursData, backgroundColor: '#ec4899', borderRadius: 6 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// 3. Monthly Charts
function renderMonthlyCharts() {
  const selectedMonth = document.getElementById('monthlyPicker')?.value;
  const monthLogs = logs.filter(r => r.dateOnly.startsWith(selectedMonth));

  const daysInMonth = {};
  monthLogs.forEach(r => {
    if (!daysInMonth[r.dateOnly]) {
      daysInMonth[r.dateOnly] = { solar: 0, electric: 0, chem: 0, fuelOil: 0 };
    }
    daysInMonth[r.dateOnly].solar += (r.solarRooftop + r.solarFarm);
    daysInMonth[r.dateOnly].electric += (r.useKrong + r.useWaterPump);
    daysInMonth[r.dateOnly].chem += (r.chemAlum + r.chemCaOH + r.chemSugar);
    daysInMonth[r.dateOnly].fuelOil += r.fuelOil;
  });

  const monthDays = Object.keys(daysInMonth).sort();

  createChart('monthlyEnergyChart', {
    type: 'line',
    data: {
      labels: monthDays,
      datasets: [
        { label: 'ผลิตไฟ Solar (kWh)', data: monthDays.map(d => daysInMonth[d].solar), borderColor: '#f59e0b', tension: 0.3 },
        { label: 'ใช้ไฟฟ้า PEA (kWh)', data: monthDays.map(d => daysInMonth[d].electric), borderColor: '#3b82f6', tension: 0.3 },
        { label: 'น้ำมันเตา (ลิตร)', data: monthDays.map(d => daysInMonth[d].fuelOil), borderColor: '#ef4444', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Generic Chart Creator Helper
function createChart(canvasId, config) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  charts[canvasId] = new Chart(ctx, config);
}

// Export to Excel using SheetJS with Separated Recorders, Notes, and Standalone Inventory Stocks
function exportToExcel() {
  if (logs.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับส่งออก Excel', 'error');
    return;
  }

  const stocks = getCalculatedStockBalances();

  const exportData = logs.map(r => ({
    'วัน-เวลาบันทึก': r.date,
    'Solar Rooftop (kWh)': r.solarRooftop,
    'Solar Farm (kWh)': r.solarFarm,
    'ผลิตไฟฟ้ารวม (kWh)': r.solarRooftop + r.solarFarm,
    'ใช้ไฟฟ้าPEA ณ กรง.ฯ (kWh)': r.useKrong,
    'ใช้ไฟฟ้าPEA ณ โรงสูบน้ำแม่น้ำ (kWh)': r.useWaterPump,
    'ใช้ไฟฟ้าPEAรวม (kWh)': r.useKrong + r.useWaterPump,
    'ผู้บันทึกส่วนไฟฟ้า': r.electricRecorder || '',
    'หมายเหตุส่วนไฟฟ้า': r.electricNotes || '',
    'ใช้สารส้ม ALUM (kg)': r.chemAlum,
    'ใช้ปูนขาว CaOH₂ (kg)': r.chemCaOH,
    'ใช้น้ำตาล Sugar (kg)': r.chemSugar,
    'ผู้บันทึกส่วนผลิตน้ำประปา': r.chemRecorder || '',
    'หมายเหตุส่วนน้ำประปา': r.chemNotes || '',
    'เวลา NC (ชม.)': r.plants?.nc?.hours || 0,
    'เวลา NG (ชม.)': r.plants?.ng?.hours || 0,
    'เวลา P (ชม.)': r.plants?.p?.hours || 0,
    'เวลา IMI (ชม.)': r.plants?.imi?.hours || 0,
    'เวลา B (ชม.)': r.plants?.b?.hours || 0,
    'เวลา ACID (ชม.)': r.plants?.acid?.hours || 0,
    'ชั่วโมงไอน้ำรวม 6 โรง (ชม.)': r.totalPlantHours,
    'ใช้น้ำมันเตา (ลิตร)': r.fuelOil,
    'ใช้แก๊ส LPG (kg)': r.fuelLPG,
    'ผู้บันทึกส่วนผลิตไอน้ำและเชื้อเพลิง': r.steamRecorder || '',
    'หมายเหตุส่วนผลิตไอน้ำและเชื้อเพลิง': r.steamNotes || '',
    'ยอดยกมาสารส้ม (kg)': inventoryBase.stockAlum,
    'คงคลังสารส้มสุทธิ (kg)': stocks.netAlum,
    'ยอดยกมาปูนขาว (kg)': inventoryBase.stockCaOH,
    'คงคลังปูนขาวสุทธิ (kg)': stocks.netCaOH,
    'ยอดยกมาน้ำตาล (kg)': inventoryBase.stockSugar,
    'คงคลังน้ำตาลสุทธิ (kg)': stocks.netSugar,
    'ยอดยกมาน้ำมันเตา (ลิตร)': inventoryBase.stockFuelOil,
    'คงคลังน้ำมันเตาสุทธิ (ลิตร)': stocks.netFuelOil,
    'ยอดยกมาแก๊ส LPG (kg)': inventoryBase.stockFuelLPG,
    'คงคลังแก๊ส LPGสุทธิ (kg)': stocks.netFuelLPG,
    'ผู้ปรับปรุงคลัง': inventoryBase.recorder || '',
    'หมายเหตุคลัง': inventoryBase.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานพลังงานและสารเคมี');

  const fileName = `รายงานติดตามพลังงาน_โรงงานซ่อมบำรุง_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  showToast(`ส่งออกไฟล์ ${fileName} สำเร็จ!`, 'success');
}

// Export PDF / Print Report
function exportToPdf() {
  window.print();
}

// Generate Realistic Sample Data for Demo/Testing with Inventory Auto-Calculated
function generateSampleData() {
  if (logs.length > 0 && !confirm('การสร้างข้อมูลตัวอย่างจะเพิ่มข้อมูลสมมติลงในระบบ ต้องการดำเนินการต่อหรือไม่?')) {
    return;
  }

  const electricStaffList = ['นายวิชัย (ช่างไฟฟ้า)', 'นายสมศักดิ์ (จนท.ไฟฟ้า)', 'นายสมชาย (หัวหน้าแผนกไฟฟ้า)'];
  const chemStaffList = ['นายอนันต์ (จนท.ประปา)', 'นายเกรียงไกร (จนท.สารเคมี)', 'นายประสิทธิ์ (ช่างน้ำประปา)'];
  const steamStaffList = ['นายธีรเดช (จนท.คุมโรงไอน้ำ)', 'นายสุพจน์ (วิศวกรโรงไอน้ำ)', 'นายชัชชัย (จนท.เชื้อเพลิง)'];

  const electricNotesList = ['สภาพแดดดี Solar ทำงานเต็มกำลัง', 'ทำความสะอาดแผงโซลาร์เซลล์', 'เปลี่ยนฟิวส์ตู้ควบคุมโรงสูบน้ำ', 'สภาวะไฟฟ้าปกติ'];
  const chemNotesList = ['ความขุ่นน้ำดิบปกติ', 'ล้างถังตกตะกอนประปา', 'เติมสารส้มและปูนขาวตามเกณฑ์', 'ตรวจวัดค่า pH สารเคมีปกติ'];
  const steamNotesList = ['วาล์วส่งไอน้ำโรง NC ดำเนินการปกติ', 'ซ่อมบำรุงท่อส่งไอน้ำโรง NG', 'แรงดันไอน้ำและเชื้อเพลิงอยู่ในเกณฑ์', 'ล้างหัวฉีดน้ำมันเตา'];

  inventoryBase = {
    stockAlum: 2000,
    stockCaOH: 1500,
    stockSugar: 500,
    stockFuelOil: 20000,
    stockFuelLPG: 5000,
    lastUpdated: new Date().toISOString(),
    recorder: 'นายสมศักดิ์ (จนท.คลังพัสดุ)',
    notes: 'ตั้งค่ายอดยกมาเริ่มต้นสำหรับการทดสอบ'
  };
  localStorage.setItem(INVENTORY_BASE_KEY, JSON.stringify(inventoryBase));
  populateInventoryFormValues();

  const today = new Date();

  for (let i = 14; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateOnly = d.toISOString().slice(0, 10);
    const fullDate = `${dateOnly}T08:30`;

    const ncH = +(4 + Math.random() * 4).toFixed(1);
    const ngH = +(3 + Math.random() * 3).toFixed(1);
    const pH = +(5 + Math.random() * 2).toFixed(1);
    const imiH = +(2 + Math.random() * 4).toFixed(1);
    const bH = +(4 + Math.random() * 3).toFixed(1);
    const acidH = +(3 + Math.random() * 3).toFixed(1);

    const cAlum = Math.round(45 + Math.random() * 25);
    const cCaOH = Math.round(30 + Math.random() * 15);
    const cSugar = Math.round(15 + Math.random() * 10);
    const fOil = Math.round(800 + Math.random() * 400);
    const fLPG = Math.round(150 + Math.random() * 80);

    const record = {
      id: (Date.now() - i * 1000).toString(),
      date: fullDate,
      dateOnly: dateOnly,
      solarRooftop: Math.round(120 + Math.random() * 80),
      solarFarm: Math.round(450 + Math.random() * 200),
      useKrong: Math.round(380 + Math.random() * 150),
      useWaterPump: Math.round(220 + Math.random() * 90),
      electricRecorder: electricStaffList[i % electricStaffList.length],
      electricNotes: electricNotesList[i % electricNotesList.length],

      chemAlum: cAlum,
      chemCaOH: cCaOH,
      chemSugar: cSugar,
      chemRecorder: chemStaffList[i % chemStaffList.length],
      chemNotes: chemNotesList[i % chemNotesList.length],

      fuelOil: fOil,
      fuelLPG: fLPG,
      plants: {
        nc: { start: '08:00', end: `${Math.floor(8+ncH)}:00`, hours: ncH },
        ng: { start: '08:30', end: `${Math.floor(8.5+ngH)}:00`, hours: ngH },
        p: { start: '08:00', end: `${Math.floor(8+pH)}:00`, hours: pH },
        imi: { start: '09:00', end: `${Math.floor(9+imiH)}:00`, hours: imiH },
        b: { start: '08:00', end: `${Math.floor(8+bH)}:00`, hours: bH },
        acid: { start: '08:00', end: `${Math.floor(8+acidH)}:00`, hours: acidH }
      },
      totalPlantHours: ncH + ngH + pH + imiH + bH + acidH,
      steamRecorder: steamStaffList[i % steamStaffList.length],
      steamNotes: steamNotesList[i % steamNotesList.length]
    };

    logs.push(record);
  }

  saveData();
  showToast('สร้างข้อมูลตัวอย่างย้อนหลัง 15 วัน สำเร็จ! (คำนวณหักลบคลังอัตโนมัติ)', 'success');
}

// Sync to Google Sheets Web App API
function syncSingleRecordToGoogle(record) {
  if (!settings.googleScriptUrl) return;
  
  // Attach calculated stock snapshot
  const stocks = getCalculatedStockBalances();
  const payload = {
    ...record,
    stockAlum: stocks.netAlum,
    stockCaOH: stocks.netCaOH,
    stockSugar: stocks.netSugar,
    stockFuelOil: stocks.netFuelOil,
    stockFuelLPG: stocks.netFuelLPG,
    inventoryRecorder: inventoryBase.recorder,
    inventoryNotes: inventoryBase.notes
  };

  fetch(settings.googleScriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => console.log('Synced record to Google Sheets'))
    .catch(err => console.error('Sync error:', err));
}

function testGoogleSync() {
  if (!settings.googleScriptUrl) {
    showToast('กรุณากรอก Google Apps Script URL ก่อนทดสอบ Sync', 'error');
    return;
  }
  showToast('กำลังส่งข้อมูลทดสอบไปยัง Google Sheets...', 'success');
  syncSingleRecordToGoogle({ test: true, timestamp: new Date().toISOString() });
}

// Backup JSON
function backupJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ logs, inventoryBase }, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `สำรองข้อมูลพลังงานและคลัง_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('ดาวน์โหลดไฟล์สำรองข้อมูล JSON แล้ว', 'success');
}

// Clear Data
function clearAllData() {
  if (confirm('คุณแน่ใจหรือว่าต้องการลบข้อมูลทั้งหมดในเครื่อง? (ไม่สามารถกู้คืนได้)')) {
    logs = [];
    saveData();
    showToast('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว', 'success');
  }
}

// Theme Toggle
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  const icon = document.querySelector('#themeToggleBtn i');
  if (icon) {
    icon.className = next === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// Toast Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
