/**
 * Database.gs - Lớp truy xuất, khởi tạo schema và giao tác dữ liệu Google Sheets
 * Đảm bảo: Khóa LockService chống xung đột, ghi hàng loạt (batching), chống chèn công thức.
 */

// Định nghĩa cấu trúc các cột cho từng Sheet
const SCHEMA = {
  [CONFIG.SHEETS.USERS]: [
    'id', 'email', 'fullName', 'role', 'phone', 'pinHash', 'status', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.PRODUCTS]: [
    'id', 'modelCode', 'name', 'category', 'defaultPrice', 'refWeightG', 'imageUrl', 'status', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.VARIANTS]: [
    'id', 'sku', 'modelCode', 'color', 'size', 'defaultPrice', 'refWeightG', 'status', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.STOCK]: [
    'sku', 'stockActual', 'stockSalable', 'stockReserved', 'stockAvailable', 'stockShipping', 'stockReturning', 'stockDefective', 'updatedAt'
  ],
  [CONFIG.SHEETS.STOCK_MOVEMENTS]: [
    'id', 'movementCode', 'sku', 'qty', 'type', 'orderId', 'reason', 'performedBy', 'createdAt'
  ],
  [CONFIG.SHEETS.ORDERS]: [
    'id', 'orderCode', 'saleId', 'saleName', 'customerName', 'customerPhone', 'addressDetail', 'province', 'district', 'ward', 'spxAddressCode', 'notes', 'status', 'shippingStatus', 'paymentStatus', 'subtotal', 'discount', 'customerShippingFee', 'deposit', 'codAmount', 'spxFee', 'netRevenue', 'confirmedAt', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.ORDER_ITEMS]: [
    'id', 'orderId', 'sku', 'modelCode', 'productName', 'color', 'size', 'quantity', 'unitPrice', 'lineTotal'
  ],
  [CONFIG.SHEETS.SHIPMENTS]: [
    'id', 'shipmentCode', 'orderId', 'trackingNumber', 'provider', 'status', 'weightG', 'codAmount', 'shippingFee', 'labelUrl', 'dispatchedAt', 'deliveredAt', 'spxRawStatus', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.RETURNS]: [
    'id', 'returnCode', 'originalOrderId', 'newOrderId', 'skuOld', 'skuNew', 'returnType', 'status', 'refundAmount', 'feeDifference', 'inspectedBy', 'notes', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.PAYMENTS]: [
    'id', 'paymentCode', 'orderId', 'trackingNumber', 'amount', 'fee', 'netAmount', 'paymentType', 'status', 'reconciliationBatchId', 'reconciledAt', 'reconciledBy', 'notes', 'createdAt'
  ],
  [CONFIG.SHEETS.RECONCILIATIONS]: [
    'id', 'batchCode', 'totalOrders', 'totalCod', 'totalFees', 'totalNet', 'status', 'confirmedBy', 'notes', 'createdAt'
  ],
  [CONFIG.SHEETS.JOBS]: [
    'id', 'jobType', 'payload', 'status', 'retryCount', 'maxRetries', 'nextRunAt', 'lastError', 'createdAt', 'updatedAt'
  ],
  [CONFIG.SHEETS.AUDIT_LOGS]: [
    'id', 'action', 'entity', 'entityId', 'detail', 'performedBy', 'createdAt'
  ],
  [CONFIG.SHEETS.SETTINGS]: [
    'key', 'value', 'description', 'updatedAt'
  ],
  [CONFIG.SHEETS.CUSTOMERS]: [
    'id', 'name', 'phone', 'totalOrders', 'totalSpent', 'lastOrderDate', 'province', 'district', 'ward', 'addressDetail', 'tag', 'notes', 'createdAt', 'updatedAt'
  ]
};

/**
 * Lấy đối tượng Spreadsheet đang hoạt động hoặc mở theo ID cấu hình trong ScriptProperties
 */
function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty(CONFIG.PROP_KEYS.SPREADSHEET_ID);
  if (sheetId && sheetId.trim() !== '') {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log('Không thể mở Sheet theo ID: ' + sheetId + '. Thử getActiveSpreadsheet...');
    }
  }
  
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty(CONFIG.PROP_KEYS.SPREADSHEET_ID, active.getId());
    return active;
  }
  
  throw new Error('Chưa cấu hình Google Spreadsheet. Hãy đặt SPREADSHEET_ID trong Script Properties.');
}

/**
 * Khử mã độc chèn công thức (Formula Injection Protection)
 * Nếu giá trị bắt đầu bằng =, +, -, @ thì thêm dấu ' phía trước
 */
function sanitizeForSheet(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  var str = String(value);
  if (str.length > 0) {
    var firstChar = str.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
      return "'" + str;
    }
    // Ép kiểu chuỗi số có số 0 ở đầu (ví dụ số điện thoại) để Google Sheet không cắt mất số 0
    if (firstChar === '0' && /^\d+$/.test(str)) {
      return "'" + str;
    }
  }
  return str;
}

/**
 * Thực thi một hàm dưới sự bảo vệ của ScriptLock (LockService)
 * Đảm bảo các giao tác kiểm tra tồn, chốt đơn, xuất kho diễn ra nguyên tử
 */
function withScriptLock(callback, timeoutMs) {
  var lock = LockService.getScriptLock();
  var timeout = timeoutMs || 30000;
  var hasLock = false;
  try {
    hasLock = lock.tryLock(timeout);
    if (!hasLock) {
      throw new Error('Hệ thống đang bận xử lý giao tác khác. Vui lòng thử lại sau giây lát.');
    }
    return callback();
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Đọc toàn bộ dữ liệu từ Sheet dưới dạng mảng các Object
 */
function readTableData(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      if (key) {
        var cellVal = row[j];
        // Nếu giá trị chuỗi có dấu nháy đơn đầu để chống formula injection thì gỡ ra
        if (typeof cellVal === 'string' && cellVal.charAt(0) === "'" && 
           ['=', '+', '-', '@'].indexOf(cellVal.charAt(1)) !== -1) {
          cellVal = cellVal.substring(1);
        }
        obj[key] = cellVal;
      }
    }
    result.push(obj);
  }
  return result;
}

/**
 * Thêm một hàng mới vào Sheet theo Schema
 */
function insertRow(sheetName, obj) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  
  var headers = SCHEMA[sheetName];
  if (!headers) throw new Error('Schema chưa định nghĩa cho: ' + sheetName);
  
  var rowValues = [];
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = obj[key] !== undefined ? obj[key] : '';
    rowValues.push(sanitizeForSheet(val));
  }
  
  sheet.appendRow(rowValues);
  return obj;
}

/**
 * Thêm nhiều hàng mới vào Sheet (Batch insert)
 */
function insertRowsBatch(sheetName, objList) {
  if (!objList || objList.length === 0) return;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  
  var headers = SCHEMA[sheetName];
  if (!headers) throw new Error('Schema chưa định nghĩa cho: ' + sheetName);
  
  var matrix = [];
  for (var k = 0; k < objList.length; k++) {
    var obj = objList[k];
    var rowValues = [];
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      var val = obj[key] !== undefined ? obj[key] : '';
      rowValues.push(sanitizeForSheet(val));
    }
    matrix.push(rowValues);
  }
  
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, matrix.length, headers.length).setValues(matrix);
}

/**
 * Cập nhật một hàng theo ID hoặc theo trường khóa chính
 */
function updateRowByKey(sheetName, keyField, keyValue, updateObj) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyColIndex = headers.indexOf(keyField);
  if (keyColIndex === -1) throw new Error('Không tìm thấy cột khóa ' + keyField + ' trong ' + sheetName);
  
  var colData = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < colData.length; i++) {
    if (String(colData[i][0]) === String(keyValue)) {
      var targetRow = i + 2;
      var existingRowValues = sheet.getRange(targetRow, 1, 1, lastCol).getValues()[0];
      
      for (var j = 0; j < headers.length; j++) {
        var colName = headers[j];
        if (updateObj[colName] !== undefined) {
          existingRowValues[j] = sanitizeForSheet(updateObj[colName]);
        }
      }
      
      sheet.getRange(targetRow, 1, 1, lastCol).setValues([existingRowValues]);
      return true;
    }
  }
  return false;
}

/**
 * Cập nhật một hàng theo khóa chính, nếu chưa tồn tại thì tự động thêm mới (Upsert)
 */
function upsertRowByKey(sheetName, keyField, keyValue, updateObj) {
  var updated = updateRowByKey(sheetName, keyField, keyValue, updateObj);
  if (!updated) {
    var newObj = {};
    for (var k in updateObj) {
      if (updateObj.hasOwnProperty(k)) newObj[k] = updateObj[k];
    }
    newObj[keyField] = keyValue;
    insertRow(sheetName, newObj);
    return true;
  }
  return true;
}


/**
 * Xóa một hàng theo trường khóa chính
 */
function deleteRowByKey(sheetName, keyField, keyValue) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyColIndex = headers.indexOf(keyField);
  if (keyColIndex === -1) throw new Error('Không tìm thấy cột khóa ' + keyField + ' trong ' + sheetName);
  
  var colData = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < colData.length; i++) {
    if (String(colData[i][0]) === String(keyValue)) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

/**
 * Xóa nhiều dòng khớp giá trị khóa
 */
function deleteRowsByKey(sheetName, keyField, keyValue) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyColIndex = headers.indexOf(keyField);
  if (keyColIndex === -1) throw new Error('Không tìm thấy cột khóa ' + keyField + ' trong ' + sheetName);
  
  var colData = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
  var deletedCount = 0;
  for (var i = colData.length - 1; i >= 0; i--) {
    if (String(colData[i][0]) === String(keyValue)) {
      sheet.deleteRow(i + 2);
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * Xóa toàn bộ dữ liệu trong bảng (giữ lại dòng tiêu đề 1)
 */
function clearTableData(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
}

/**
 * XÓA TOÀN BỘ DỮ LIỆU ĐƠN HÀNG CŨ VÀ ĐƯA KHO VỀ TRẠNG THÁI SẠCH
 */
function resetAllOrderTestData(token) {
  requireRole(token, [CONFIG.ROLES.ADMIN]);
  return withScriptLock(function() {
    clearTableData(CONFIG.SHEETS.ORDERS);
    clearTableData(CONFIG.SHEETS.ORDER_ITEMS);
    clearTableData(CONFIG.SHEETS.SHIPMENTS);
    clearTableData(CONFIG.SHEETS.RETURNS);
    clearTableData(CONFIG.SHEETS.PAYMENTS);
    clearTableData(CONFIG.SHEETS.RECONCILIATIONS);
    clearTableData(CONFIG.SHEETS.JOBS);
    clearTableData(CONFIG.SHEETS.STOCK_MOVEMENTS);
    
    // Hồi phục lại toàn bộ Tồn kho khả dụng (đưa hàng giữ, đang giao, đang hoàn về 0)
    var stocks = readTableData(CONFIG.SHEETS.STOCK);
    for (var s = 0; s < stocks.length; s++) {
      stocks[s].stockReserved = 0;
      stocks[s].stockShipping = 0;
      stocks[s].stockReturning = 0;
      stocks[s].stockAvailable = Number(stocks[s].stockSalable) || Number(stocks[s].stockActual) || 0;
      stocks[s].updatedAt = getNowIsoString();
    }
    batchSaveStockUpdates(stocks);
    
    logAuditAction('RESET_ALL_TEST_DATA', 'Database', 'ALL', 'Đã xóa toàn bộ đơn mẫu cũ và đưa kho về trạng thái sạch ban đầu', 'Admin');
    return { success: true, message: 'Đã xóa sạch toàn bộ đơn mẫu cũ và đưa kho về trạng thái sạch 100%!' };
  }, 30000);
}

/**
 * Khởi tạo cấu trúc các Sheet, định dạng tiêu đề và dữ liệu mẫu nếu chưa có
 * Hoạt động IDEMPOTENT - Không xóa dữ liệu nếu đã có sẵn.
 */
function setupDatabase() {
  var ss = getSpreadsheet();
  var sheetNames = Object.keys(SCHEMA);
  
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    
    // Kiểm tra và khởi tạo tiêu đề cột
    var headers = SCHEMA[name];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#EE4D2D'); // Màu cam đỏ đặc trưng SPX
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  
  // Nạp dữ liệu mẫu ban đầu nếu bảng Users còn trống
  seedInitialDataIfEmpty();
  
  return {
    success: true,
    message: 'Khởi tạo schema và các bảng tính thành công.'
  };
}

/**
 * Nạp dữ liệu mẫu ban đầu: Tài khoản, Sản phẩm, Tồn kho, Cài đặt mặc định
 */
function seedInitialDataIfEmpty() {
  var users = readTableData(CONFIG.SHEETS.USERS);
  if (users.length === 0) {
    // 1. Tạo Users mẫu với mật khẩu PIN: 123456
    var now = getNowIsoString();
    var defaultPinHash = hashPin('123456');
    var sampleUsers = [
      {
        id: 'USR-ADMIN',
        email: 'admin@shop.vn',
        fullName: 'Quản Trị Viên Shop',
        role: CONFIG.ROLES.ADMIN,
        phone: '0988000001',
        pinHash: defaultPinHash,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'USR-SALE1',
        email: 'sale1@shop.vn',
        fullName: 'Nguyễn Văn Nam (Sale)',
        role: CONFIG.ROLES.SALE,
        phone: '0988000002',
        pinHash: defaultPinHash,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'USR-KHO',
        email: 'kho@shop.vn',
        fullName: 'Trần Khoa (Thủ Kho)',
        role: CONFIG.ROLES.KHO,
        phone: '0988000003',
        pinHash: defaultPinHash,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'USR-DOISOAT',
        email: 'doisoat@shop.vn',
        fullName: 'Lê Thu Trang (Đối Soát)',
        role: CONFIG.ROLES.DOI_SOAT,
        phone: '0988000004',
        pinHash: defaultPinHash,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      }
    ];
    insertRowsBatch(CONFIG.SHEETS.USERS, sampleUsers);
  }
  
  var products = readTableData(CONFIG.SHEETS.PRODUCTS);
  if (products.length === 0) {
    var now = getNowIsoString();
    // 2. Tạo Sản phẩm mẫu
    var sampleProducts = [
      {
        id: 'PRD-CC01',
        modelCode: 'CC01',
        name: 'Giày Chelsea Boot Nam Da Bò Cao Cổ',
        category: 'Giày cao cổ',
        defaultPrice: 850000,
        refWeightG: 750,
        imageUrl: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=400&q=80',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'PRD-TC01',
        modelCode: 'TC01',
        name: 'Giày Sneaker Da Thấp Cổ Classic',
        category: 'Giày thấp cổ',
        defaultPrice: 650000,
        refWeightG: 600,
        imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'PRD-TC02',
        modelCode: 'TC02',
        name: 'Giày Loafer Da Thấp Cổ Penny Đen',
        category: 'Giày thấp cổ',
        defaultPrice: 720000,
        refWeightG: 550,
        imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=400&q=80',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      }
    ];
    insertRowsBatch(CONFIG.SHEETS.PRODUCTS, sampleProducts);
    
    // 3. Tạo Biến thể (Variants) và Tồn kho (Stock)
    var sampleVariants = [];
    var sampleStock = [];
    var initialMovements = [];
    
    // CC01: Màu Đen & Nâu, size 39 đến 43
    var colorsCC = ['DEN', 'NAU'];
    var sizesCC = [39, 40, 41, 42, 43];
    for (var c = 0; c < colorsCC.length; c++) {
      var color = colorsCC[c];
      for (var s = 0; s < sizesCC.length; s++) {
        var size = sizesCC[s];
        var sku = 'CC01-' + color + '-' + size;
        sampleVariants.push({
          id: 'VAR-' + sku,
          sku: sku,
          modelCode: 'CC01',
          color: color,
          size: size,
          defaultPrice: 850000,
          refWeightG: 750,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now
        });
        
        var initQty = 15; // Mỗi SKU có 15 đôi
        sampleStock.push({
          sku: sku,
          stockActual: initQty,
          stockSalable: initQty,
          stockReserved: 0,
          stockAvailable: initQty,
          stockShipping: 0,
          stockReturning: 0,
          stockDefective: 0,
          updatedAt: now
        });
        
        initialMovements.push({
          id: generateId('MOV'),
          movementCode: 'MOV-INIT-' + sku,
          sku: sku,
          qty: initQty,
          type: CONFIG.STOCK_MOVEMENT_TYPE.IMPORT,
          orderId: '',
          reason: 'Nhập tồn đầu kỳ hệ thống',
          performedBy: 'Hệ thống tự động',
          createdAt: now
        });
      }
    }
    
    // TC01: Màu Trắng & Đen, size 38 đến 42
    var colorsTC = ['TRANG', 'DEN'];
    var sizesTC = [38, 39, 40, 41, 42];
    for (var c2 = 0; c2 < colorsTC.length; c2++) {
      var color2 = colorsTC[c2];
      for (var s2 = 0; s2 < sizesTC.length; s2++) {
        var size2 = sizesTC[s2];
        var sku2 = 'TC01-' + color2 + '-' + size2;
        sampleVariants.push({
          id: 'VAR-' + sku2,
          sku: sku2,
          modelCode: 'TC01',
          color: color2,
          size: size2,
          defaultPrice: 650000,
          refWeightG: 600,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now
        });
        
        var initQty2 = 20;
        sampleStock.push({
          sku: sku2,
          stockActual: initQty2,
          stockSalable: initQty2,
          stockReserved: 0,
          stockAvailable: initQty2,
          stockShipping: 0,
          stockReturning: 0,
          stockDefective: 0,
          updatedAt: now
        });
        
        initialMovements.push({
          id: generateId('MOV'),
          movementCode: 'MOV-INIT-' + sku2,
          sku: sku2,
          qty: initQty2,
          type: CONFIG.STOCK_MOVEMENT_TYPE.IMPORT,
          orderId: '',
          reason: 'Nhập tồn đầu kỳ hệ thống',
          performedBy: 'Hệ thống tự động',
          createdAt: now
        });
      }
    }
    
    insertRowsBatch(CONFIG.SHEETS.VARIANTS, sampleVariants);
    insertRowsBatch(CONFIG.SHEETS.STOCK, sampleStock);
    insertRowsBatch(CONFIG.SHEETS.STOCK_MOVEMENTS, initialMovements);
  }
  
  // 4. Cài đặt hệ thống ban đầu
  var settings = readTableData(CONFIG.SHEETS.SETTINGS);
  if (settings.length === 0) {
    var now = getNowIsoString();
    var defaultSettings = [
      { key: 'SHOP_NAME', value: 'Bảo Tín Shoes', description: 'Tên shop hiển thị', updatedAt: now },
      { key: 'SHOP_HOTLINE', value: '0988.888.888', description: 'Hotline CSKH', updatedAt: now },
      { key: 'SPX_MODE', value: 'REAL', description: 'Chế độ SPX: REAL (Thực tế) hoặc MOCK (Giả lập)', updatedAt: now },
      { key: 'SPX_BASE_URL', value: 'https://spx.vn', description: 'Endpoint SPX Open API', updatedAt: now },
      { key: 'SPX_APP_ID', value: '102384205900430', description: 'Mã người dùng (User ID) SPX', updatedAt: now },
      { key: 'SPX_APP_SECRET', value: '8d1aefec-ba63-4a34-984b-26fc1d5054ea', description: 'Secret Key SPX', updatedAt: now },
      { key: 'SPX_MERCHANT_ID', value: '15093594984', description: 'ID tài khoản (Account ID) SPX', updatedAt: now },
      { key: 'SENDER_NAME', value: CONFIG.DEFAULT_SHIPPING.SENDER_NAME, description: 'Tên người gửi trên đơn SPX', updatedAt: now },
      { key: 'SENDER_PHONE', value: CONFIG.DEFAULT_SHIPPING.SENDER_PHONE, description: 'Điện thoại kho lấy hàng', updatedAt: now },
      { key: 'SENDER_ADDRESS', value: CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS, description: 'Địa chỉ kho lấy hàng', updatedAt: now },
      { key: 'SENDER_PROVINCE', value: CONFIG.DEFAULT_SHIPPING.SENDER_PROVINCE, description: 'Tỉnh/Thành kho lấy hàng', updatedAt: now },
      { key: 'SENDER_DISTRICT', value: CONFIG.DEFAULT_SHIPPING.SENDER_DISTRICT, description: 'Quận/Huyện kho lấy hàng', updatedAt: now },
      { key: 'SENDER_WARD', value: CONFIG.DEFAULT_SHIPPING.SENDER_WARD, description: 'Phường/Xã kho lấy hàng', updatedAt: now },
      { key: 'ITEM_INSPECTION', value: CONFIG.DEFAULT_SHIPPING.ITEM_INSPECTION, description: 'Chính sách xem hàng (VIEW_NO_TRY/VIEW_TRY/NO_VIEW)', updatedAt: now },
      { key: 'FEE_PAYER', value: CONFIG.DEFAULT_SHIPPING.FEE_PAYER, description: 'Bên trả phí vận chuyển SPX (SHOP/BUYER)', updatedAt: now },
      { key: 'APPLY_REFUSAL_FEE', value: 'true', description: 'Áp dụng thu phí khi khách từ chối nhận', updatedAt: now },
      { key: 'REFUSAL_FEE_AMOUNT', value: '15000', description: 'Mức phí từ chối nhận (VND)', updatedAt: now },
      { key: 'DEFAULT_DELIVERY_NOTE', value: CONFIG.DEFAULT_SHIPPING.DEFAULT_DELIVERY_NOTE, description: 'Ghi chú đơn giao mặc định', updatedAt: now }
    ];
    insertRowsBatch(CONFIG.SHEETS.SETTINGS, defaultSettings);
  }
}

/**
 * Lấy cấu hình hệ thống từ bảng Settings (kèm giá trị mặc định fallback từ Config)
 */
function getSystemSetting(key, defaultValue) {
  var settings = readTableData(CONFIG.SHEETS.SETTINGS);
  for (var i = 0; i < settings.length; i++) {
    if (settings[i].key === key && settings[i].value !== undefined && settings[i].value !== '') {
      return settings[i].value;
    }
  }
  // Fallback sang cấu hình trong CONFIG nếu chưa có trong Sheets
  if (key === 'SPX_MODE') return CONFIG.SPX.MODE;
  if (key === 'SPX_BASE_URL') return CONFIG.SPX.BASE_URL;
  if (key === 'SPX_APP_ID') return CONFIG.SPX.APP_ID;
  if (key === 'SPX_APP_SECRET') return CONFIG.SPX.APP_SECRET;
  if (key === 'SPX_MERCHANT_ID') return CONFIG.SPX.MERCHANT_ID;
  return defaultValue;
}

/**
 * Cập nhật cấu hình hệ thống
 */
function updateSystemSetting(key, value) {
  var now = getNowIsoString();
  var updated = updateRowByKey(CONFIG.SHEETS.SETTINGS, 'key', key, {
    value: value,
    updatedAt: now
  });
  if (!updated) {
    insertRow(CONFIG.SHEETS.SETTINGS, {
      key: key,
      value: value,
      description: 'Thiết lập tuỳ chỉnh',
      updatedAt: now
    });
  }
}

/**
 * Tạo bản sao lưu Spreadsheet (Backup Database)
 */
function backupDatabase() {
  var ss = getSpreadsheet();
  var timeStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd_HHmmss");
  var backupName = ss.getName() + '_BACKUP_' + timeStr;
  var copy = ss.copy(backupName);
  return {
    success: true,
    backupId: copy.getId(),
    backupUrl: copy.getUrl(),
    backupName: backupName
  };
}
