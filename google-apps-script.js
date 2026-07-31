function doPost(e) {
  try {
    // 1. ตรวจสอบวัตถุ e เมื่อไม่มีข้อมูลส่งเข้ามา
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "notice",
        message: "Google Apps Script พร้อมใช้งาน! โปรดทดสอบ Sync ผ่านแอปหน้าเว็บ"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. ตรวจสอบไฟล์ Google Sheets
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "ไม่พบ Google Sheet! กรุณาสร้าง Apps Script จากภายใน Google Sheets โดยตรง"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = ss.getActiveSheet();
    var data = {};
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = {};
    }
    
    // หากเป็นรายการทดสอบ Sync
    if (data.test) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Sync Test Success" }))
             .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ตรวจสอบและสร้างแถวหัวตารางหากยังไม่มีข้อมูล
    if (sheet.getLastRow() === 0) {
      var headers = [
        "วัน-เวลาบันทึก",
        "Solar Rooftop (kWh)",
        "Solar Farm (kWh)",
        "ใช้ไฟฟ้าPEA ณ กรง.ฯ (kWh)",
        "ใช้ไฟฟ้าPEA ณ โรงสูบน้ำแม่น้ำ (kWh)",
        "ผู้บันทึกส่วนไฟฟ้า",
        "หมายเหตุส่วนไฟฟ้า",
        "ใช้สารส้ม ALUM (kg)",
        "ใช้ปูนขาว CaOH2 (kg)",
        "ใช้น้ำตาล Sugar (kg)",
        "ผู้บันทึกส่วนผลิตน้ำประปา",
        "หมายเหตุส่วนผลิตน้ำประปา",
        "NC (ชม.)",
        "NG (ชม.)",
        "P (ชม.)",
        "IMI (ชม.)",
        "B (ชม.)",
        "ACID (ชม.)",
        "ชั่วโมงไอน้ำรวม (ชม.)",
        "ใช้น้ำมันเตา (ลิตร)",
        "ใช้แก๊ส LPG (kg)",
        "ผู้บันทึกส่วนผลิตไอน้ำและเชื้อเพลิง",
        "หมายเหตุส่วนผลิตไอน้ำและเชื้อเพลิง",
        "คงคลังสารส้มสุทธิ (kg)",
        "คงคลังปูนขาวสุทธิ (kg)",
        "คงคลังน้ำตาลสุทธิ (kg)",
        "คงคลังน้ำมันเตาสุทธิ (ลิตร)",
        "คงคลังแก๊ส LPGสุทธิ (kg)",
        "ผู้ปรับปรุงคลัง",
        "หมายเหตุคลัง"
      ];
      sheet.appendRow(headers);
    }
    
    // คำนวณชั่วโมงการทำงานของแต่ละโรงงาน
    var ncH = (data.plants && data.plants.nc && data.plants.nc.hours) ? data.plants.nc.hours : 0;
    var ngH = (data.plants && data.plants.ng && data.plants.ng.hours) ? data.plants.ng.hours : 0;
    var pH = (data.plants && data.plants.p && data.plants.p.hours) ? data.plants.p.hours : 0;
    var imiH = (data.plants && data.plants.imi && data.plants.imi.hours) ? data.plants.imi.hours : 0;
    var bH = (data.plants && data.plants.b && data.plants.b.hours) ? data.plants.b.hours : 0;
    var acidH = (data.plants && data.plants.acid && data.plants.acid.hours) ? data.plants.acid.hours : 0;
    
    // สร้างแถวข้อมูลใหม่
    var row = [
      data.date || new Date().toISOString(),
      data.solarRooftop || 0,
      data.solarFarm || 0,
      data.useKrong || 0,
      data.useWaterPump || 0,
      data.electricRecorder || "",
      data.electricNotes || "",
      data.chemAlum || 0,
      data.chemCaOH || 0,
      data.chemSugar || 0,
      data.chemRecorder || "",
      data.chemNotes || "",
      ncH,
      ngH,
      pH,
      imiH,
      bH,
      acidH,
      data.totalPlantHours || 0,
      data.fuelOil || 0,
      data.fuelLPG || 0,
      data.steamRecorder || "",
      data.steamNotes || "",
      data.stockAlum || 0,
      data.stockCaOH || 0,
      data.stockSugar || 0,
      data.stockFuelOil || 0,
      data.stockFuelLPG || 0,
      data.inventoryRecorder || "",
      data.inventoryNotes || ""
    ];
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
           .setMimeType(ContentService.MimeType.JSON);
           
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
           .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Google Apps Script Web App พร้อมใช้งาน!"
  })).setMimeType(ContentService.MimeType.JSON);
}
