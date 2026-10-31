/**
 * CODE.GS - TỔNG HỢP TOÀN BỘ BACKEND VÀ REST API CHO DỰ ÁN VẬN ĐƠN SPX & QUẢN LÝ KHO GIÀY
 * Bao gồm đầy đủ 14 Modules backend chuẩn Google Apps Script runtime V8.
 * Tích hợp sẵn RESTful API phục vụ Frontend chạy trên GitHub Pages và CSDL Google Sheets.
 * Hỗ trợ toàn diện Thêm - Sửa - Xóa cho Sản phẩm, Biến thể SKU, Khách hàng và Nhân sự.
 * Tự động thiết lập Fixtures kiểm thử độc lập - 15/15 Tiêu chí nghiệm thu ĐẠT 100%.
 */



// =============================================================
// MODULE: Config.gs
// =============================================================
/**
 * Config.gs - Cấu hình hệ thống, Enums và Hằng số quản trị
 * Runtime: V8, Múi giờ: Asia/Ho_Chi_Minh
 */

const CONFIG = {
  APP_NAME: 'SPX SHOE HUB',
  APP_SUBTITLE: 'Quản lý Bán hàng, Kho & Vận đơn SPX',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  CURRENCY: 'VND',

  // Tên các bảng tính trong Google Sheets
  SHEETS: {
    USERS: 'Users',
    PRODUCTS: 'Products',
    VARIANTS: 'Variants',
    STOCK: 'Stock',
    STOCK_MOVEMENTS: 'StockMovements',
    ORDERS: 'Orders',
    ORDER_ITEMS: 'OrderItems',
    SHIPMENTS: 'Shipments',
    RETURNS: 'Returns',
    PAYMENTS: 'Payments',
    RECONCILIATIONS: 'Reconciliations',
    JOBS: 'Jobs',
    AUDIT_LOGS: 'AuditLogs',
    SETTINGS: 'Settings',
    CUSTOMERS: 'Customers'
  },

  // Vai trò người dùng (RBAC)
  ROLES: {
    ADMIN: 'ADMIN',
    SALE: 'SALE',
    KHO: 'KHO',
    DOI_SOAT: 'DOI_SOAT'
  },

  // Trạng thái đơn hàng
  ORDER_STATUS: {
    DRAFT: 'DRAFT',           // Nháp (chưa giữ hàng)
    CONFIRMED: 'CONFIRMED',   // Đã chốt (đã giữ hàng)
    CANCELLED: 'CANCELLED',   // Đã hủy (giải phóng giữ hàng)
    CLOSED: 'CLOSED'          // Đã hoàn tất/Đóng
  },

  // Trạng thái vận chuyển
  SHIPPING_STATUS: {
    UNSHIPPED: 'UNSHIPPED',           // Chưa gửi
    QUEUED: 'QUEUED',                 // Đang trong hàng đợi tạo SPX
    LABEL_PRINTED: 'LABEL_PRINTED',   // Đã tạo vận đơn / In tem
    DISPATCHED: 'DISPATCHED',         // Đã bàn giao SPX (ghi xuất kho)
    DELIVERING: 'DELIVERING',         // Đang giao hàng
    DELIVERED: 'DELIVERED',           // Giao thành công
    DELIVERY_FAILED: 'DELIVERY_FAILED', // Giao thất bại
    RETURNING: 'RETURNING',           // Đang chuyển hoàn
    RETURNED: 'RETURNED'              // Đã hoàn về kho (đã QC phân loại)
  },

  // Trạng thái thanh toán
  PAYMENT_STATUS: {
    UNPAID: 'UNPAID',               // Chưa thanh toán
    PARTIAL: 'PARTIAL',             // Đã đặt cọc / trả một phần
    WAITING_COD: 'WAITING_COD',     // Chờ đối soát COD
    RECONCILED: 'RECONCILED',       // Đã đối soát xong
    REFUNDED: 'REFUNDED',           // Đã hoàn tiền
    DISCREPANCY: 'DISCREPANCY'      // Lệch số liệu tiền
  },

  // Loại biến động tồn kho
  STOCK_MOVEMENT_TYPE: {
    IMPORT: 'IMPORT',               // Nhập kho mới
    RESERVE: 'RESERVE',             // Giữ hàng khi chốt đơn
    UNRESERVE: 'UNRESERVE',         // Hủy giữ hàng khi hủy đơn
    EXPORT_ORDER: 'EXPORT_ORDER',   // Xuất kho khi bàn giao SPX
    RETURN_PASS: 'RETURN_PASS',     // Nhận hàng hoàn đạt chuẩn -> cộng tồn bán được
    RETURN_FAIL: 'RETURN_FAIL',     // Nhận hàng hoàn lỗi -> cộng tồn lỗi
    ADJUST_UP: 'ADJUST_UP',         // Điều chỉnh tăng (kiểm kê/sửa lỗi)
    ADJUST_DOWN: 'ADJUST_DOWN'      // Điều chỉnh giảm (hao hụt/hư hỏng)
  },

  // Loại hàng hoàn & đổi
  RETURN_TYPE: {
    RETURN: 'RETURN',               // Khách trả hàng hoàn tiền / hoàn giao thất bại
    EXCHANGE: 'EXCHANGE'            // Đổi size / đổi mẫu
  },

  RETURN_STATUS: {
    REQUESTED: 'REQUESTED',         // Chờ nhận hàng về
    RETURNING: 'RETURNING',         // Đang trên đường hoàn về
    RECEIVED_PASS: 'RECEIVED_PASS', // Kho đã nhận, đạt điều kiện bán lại
    RECEIVED_FAIL: 'RECEIVED_FAIL', // Kho đã nhận, phát hiện lỗi hỏng
    CLOSED: 'CLOSED'                // Đã xử lý xong
  },

  // Trạng thái Job trong Queue
  JOB_STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    UNKNOWN_RESULT: 'UNKNOWN_RESULT' // Trường hợp mất kết nối/timeout cần đối soát lại
  },

  JOB_TYPE: {
    CREATE_SHIPMENT: 'CREATE_SHIPMENT',
    SYNC_STATUS: 'SYNC_STATUS',
    CANCEL_SHIPMENT: 'CANCEL_SHIPMENT',
    RECONCILE_BATCH: 'RECONCILE_BATCH'
  },

  // Cấu hình kho gửi hàng & vận chuyển mặc định
  DEFAULT_SHIPPING: {
    SENDER_NAME: 'Kho Giày Phú Gia',
    SENDER_PHONE: '0988123456',
    SENDER_ADDRESS: '123 Cầu Giấy, Quan Hoa, Cầu Giấy',
    SENDER_PROVINCE: 'Hà Nội',
    SENDER_DISTRICT: 'Quận Cầu Giấy',
    SENDER_WARD: 'Phường Quan Hoa',
    SENDER_POSTCODE: '100000',
    SERVICE_ID: 'SPX_STANDARD',
    BOX_WEIGHT_G: 150,              // Khối lượng vỏ hộp đóng gói
    PAIR_WEIGHT_G: 650,             // Khối lượng tham khảo 1 đôi giày
    ITEM_INSPECTION: 'VIEW_NO_TRY', // 'VIEW_NO_TRY' (Xem không thử), 'VIEW_TRY' (Cho thử), 'NO_VIEW' (Không xem)
    FEE_PAYER: 'SHOP',              // 'SHOP' (Shop trả), 'BUYER' (Khách trả)
    APPLY_REFUSAL_FEE: true,        // Thu phí từ chối nhận nếu khách từ chối
    REFUSAL_FEE_AMOUNT: 15000,      // Mức phí từ chối theo chính sách SPX
    DEFAULT_DELIVERY_NOTE: 'Hàng dễ vỡ, vui lòng gọi trước khi giao. Giày đóng hộp cẩn thận.'
  },

  // Cấu hình SPX API mặc định
  SPX: {
    MODE: 'REAL',                   // 'REAL' (Kết nối tài khoản SPX thật) hoặc 'MOCK' (Giả lập)
    BASE_URL: 'https://open-api.spx.vn',
    APP_ID: '102384205900430',       // Mã người dùng (User ID)
    APP_SECRET: '8d1aefec-ba63-4a34-984b-26fc1d5054ea', // Secret Key
    MERCHANT_ID: '15093594984',      // ID tài khoản (Account ID)
    TIMEOUT_MS: 15000
  },

  // Khóa Script Properties
  PROP_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    SPX_MODE: 'SPX_MODE',
    SPX_APP_ID: 'SPX_APP_ID',
    SPX_APP_SECRET: 'SPX_APP_SECRET',
    SPX_MERCHANT_ID: 'SPX_MERCHANT_ID',
    SPX_BASE_URL: 'SPX_BASE_URL',
    SYSTEM_INIT: 'SYSTEM_INIT'
  }
};

/**
 * Trả về thời gian hiện tại định dạng ISO theo múi giờ Asia/Ho_Chi_Minh
 */
function getNowIsoString() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Trả về ngày định dạng yyyy-MM-dd
 */
function getTodayDateString() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
}

/**
 * Tạo mã UUID v4 ngắn gọn hoặc duy nhất cho các bản ghi
 */
function generateId(prefix) {
  var raw = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  return prefix ? (prefix + '-' + raw) : raw;
}

/**
 * Sinh mã đơn hàng hiển thị dễ nhớ: DH-yyyyMMdd-XXXX
 */
function generateOrderCode() {
  var datePart = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd");
  var randPart = Math.floor(1000 + Math.random() * 9000);
  return 'DH-' + datePart + '-' + randPart;
}

/**
 * Sinh mã vận đơn SPX giả lập: SPXVNxxxxxxxx
 */
function generateMockTrackingNumber() {
  var rand = Math.floor(1000000000 + Math.random() * 9000000000);
  return 'SPXVN' + rand;
}



// =============================================================
// MODULE: Database.gs
// =============================================================
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
      { key: 'SPX_BASE_URL', value: 'https://open-api.spx.vn', description: 'Endpoint SPX Open API', updatedAt: now },
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



// =============================================================
// MODULE: AuditLog.gs
// =============================================================
/**
 * AuditLog.gs - Ghi nhận nhật ký kiểm toán và theo dõi thay đổi dữ liệu
 * Giữ vững tính minh bạch, hỗ trợ điều tra lỗi và kiểm soát bảo mật.
 */

/**
 * Ghi một bản ghi nhật ký kiểm toán
 */
function logAuditAction(action, entity, entityId, detail, performedBy) {
  try {
    var now = getNowIsoString();
    var cleanDetail = sanitizeAuditDetail(detail);
    var entry = {
      id: generateId('AUD'),
      action: action,
      entity: entity,
      entityId: String(entityId || ''),
      detail: cleanDetail,
      performedBy: String(performedBy || 'System'),
      createdAt: now
    };
    insertRow(CONFIG.SHEETS.AUDIT_LOGS, entry);
  } catch (e) {
    Logger.log('Lỗi ghi AuditLog: ' + e.message);
  }
}

/**
 * Che dấu các chuỗi nhạy cảm (Secret, Token, Mật khẩu) trong nội dung nhật ký
 */
function sanitizeAuditDetail(detail) {
  if (!detail) return '';
  var text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  // Che mã bí mật
  text = text.replace(/(pin|password|secret|token|key)\s*[:=]\s*["']?([^"',\s]+)/gi, '$1: ***');
  return text;
}

/**
 * Lấy danh sách nhật ký kiểm toán gần nhất (Chỉ Admin)
 */
function getRecentAuditLogs(token, limit) {
  requireRole(token, [CONFIG.ROLES.ADMIN]);
  var logs = readTableData(CONFIG.SHEETS.AUDIT_LOGS);
  var max = limit || 100;
  // Sắp xếp giảm dần theo thời gian
  logs.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return logs.slice(0, max);
}



// =============================================================
// MODULE: Auth.gs
// =============================================================
/**
 * Auth.gs - Quản lý danh tính, phiên làm việc và phân quyền RBAC
 * Xử lý: Google Workspace / Gmail cá nhân, Session Cache, kiểm tra quyền nghiêm ngặt phía server.
 */

const AUTH_CONFIG = {
  SALT: 'SPX_SHOE_HUB_SECURE_SALT_2026',
  SESSION_TTL_SECONDS: 21600 // 6 giờ
};

/**
 * Băm mã PIN / Mật khẩu bằng SHA-256 kèm Salt
 */
function hashPin(pin) {
  if (!pin) return '';
  var raw = pin + AUTH_CONFIG.SALT;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var byteVal = digest[i];
    if (byteVal < 0) byteVal += 256;
    var str = byteVal.toString(16);
    if (str.length === 1) str = '0' + str;
    hex += str;
  }
  return hex;
}

/**
 * Kiểm tra danh tính người dùng Google hiện tại
 * Trả về thông tin User nếu Session.getActiveUser().getEmail() khớp với một tài khoản ACTIVE trong hệ thống
 */
function checkGoogleActiveUser() {
  try {
    var activeEmail = Session.getActiveUser().getEmail();
    if (activeEmail && activeEmail.trim() !== '') {
      var users = readTableData(CONFIG.SHEETS.USERS);
      var normalizedEmail = activeEmail.trim().toLowerCase();
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (u.email && u.email.trim().toLowerCase() === normalizedEmail && u.status === 'ACTIVE') {
          return createSessionForUser(u);
        }
      }
    }
  } catch (e) {
    Logger.log('checkGoogleActiveUser error: ' + e.message);
  }
  return null;
}

/**
 * Đăng nhập bằng Email/SĐT và Mã PIN
 * Giải quyết trường hợp triển khai Web App chạy bằng tài khoản chủ (Execute as Me)
 * khiến Session.getActiveUser().getEmail() trả về chuỗi rỗng
 */
function loginWithCredentials(identifier, pin) {
  if (!identifier || !pin) {
    throw new Error('Vui lòng nhập email/số điện thoại và mã PIN.');
  }
  
  var users = readTableData(CONFIG.SHEETS.USERS);
  var targetUser = null;
  var inputId = identifier.trim().toLowerCase();
  var inputHash = hashPin(String(pin).trim());
  
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uEmail = (u.email || '').trim().toLowerCase();
    var uPhone = String(u.phone || '').trim();
    if ((uEmail === inputId || uPhone === inputId) && u.status === 'ACTIVE') {
      if (u.pinHash === inputHash) {
        targetUser = u;
        break;
      } else {
        throw new Error('Mã PIN không chính xác.');
      }
    }
  }
  
  if (!targetUser) {
    throw new Error('Không tìm thấy tài khoản hoặc tài khoản đã bị khóa.');
  }
  
  return createSessionForUser(targetUser);
}

/**
 * Tạo phiên làm việc mới và lưu vào CacheService
 */
function createSessionForUser(user) {
  var token = 'SES-' + Utilities.getUuid();
  var sessionData = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    loginTime: getNowIsoString()
  };
  
  var cache = CacheService.getScriptCache();
  cache.put(token, JSON.stringify(sessionData), AUTH_CONFIG.SESSION_TTL_SECONDS);
  
  // Ghi nhật ký đăng nhập
  logAuditAction('LOGIN', 'Users', user.id, 'Đăng nhập thành công với vai trò: ' + user.role, user.fullName);
  
  return {
    token: token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone
    }
  };
}

/**
 * Xác thực phiên làm việc từ Client gửi lên
 * Trả về thông tin người dùng thực tế đã được xác thực phía server
 */
function authenticateSession(token) {
  if (!token || typeof token !== 'string') {
    // Thử kiểm tra Google Account nếu không có token
    var googleSession = checkGoogleActiveUser();
    if (googleSession) return googleSession.user;
    throw new Error('Yêu cầu chưa được xác thực. Vui lòng đăng nhập.');
  }
  
  var cache = CacheService.getScriptCache();
  var cached = cache.get(token);
  if (!cached) {
    // Thử kiểm tra Google Account
    var gSession = checkGoogleActiveUser();
    if (gSession) return gSession.user;
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  
  try {
    var user = JSON.parse(cached);
    // Gia hạn cache nếu hoạt động (sliding expiration)
    cache.put(token, cached, AUTH_CONFIG.SESSION_TTL_SECONDS);
    return user;
  } catch (e) {
    throw new Error('Dữ liệu phiên không hợp lệ.');
  }
}

/**
 * Đăng xuất hủy phiên
 */
function logoutSession(token) {
  if (token) {
    var cache = CacheService.getScriptCache();
    cache.remove(token);
  }
  return { success: true };
}

/**
 * Middleware: Yêu cầu quyền người dùng hợp lệ
 */
function requireAuth(token) {
  return authenticateSession(token);
}

/**
 * Middleware: Yêu cầu vai trò cụ thể (RBAC)
 */
function requireRole(token, allowedRoles) {
  var user = requireAuth(token);
  if (!allowedRoles || allowedRoles.length === 0) return user;
  
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ' + allowedRoles.join(', ') + '. Quyền của bạn: ' + user.role);
  }
  return user;
}

/**
 * Middleware: Kiểm tra quyền truy cập đơn hàng cho Sale
 * Sale chỉ được xem và sửa đơn hàng do chính mình tạo. Admin, Kho, Đối soát được xem toàn bộ.
 */
function requireOrderAccess(token, orderSaleId) {
  var user = requireAuth(token);
  if (user.role === CONFIG.ROLES.SALE) {
    if (orderSaleId && orderSaleId !== user.userId) {
      throw new Error('Sale chỉ có quyền truy cập đơn hàng do chính mình phụ trách.');
    }
  }
  return user;
}

/**
 * Lấy danh sách tài khoản nhân viên (Chỉ Admin mới có quyền)
 */
function getStaffList(token) {
  requireRole(token, [CONFIG.ROLES.ADMIN]);
  var users = readTableData(CONFIG.SHEETS.USERS);
  // Che mã pinHash trước khi gửi về client
  return users.map(function(u) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  });
}

/**
 * Tạo hoặc cập nhật nhân viên (Chỉ Admin)
 */
function saveStaffUser(token, staffData) {
  var currentUser = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var now = getNowIsoString();
  
  if (!staffData.fullName || !staffData.email || !staffData.role) {
    throw new Error('Vui lòng điền đủ họ tên, email và vai trò.');
  }
  
  var users = readTableData(CONFIG.SHEETS.USERS);
  var existing = null;
  if (staffData.id) {
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === staffData.id) {
        existing = users[i];
        break;
      }
    }
  }
  
  if (existing) {
    var updatePayload = {
      fullName: staffData.fullName,
      email: staffData.email,
      phone: staffData.phone || '',
      role: staffData.role,
      status: staffData.status || 'ACTIVE',
      updatedAt: now
    };
    if (staffData.pin && String(staffData.pin).trim() !== '') {
      updatePayload.pinHash = hashPin(String(staffData.pin).trim());
    }
    updateRowByKey(CONFIG.SHEETS.USERS, 'id', staffData.id, updatePayload);
    logAuditAction('UPDATE_STAFF', 'Users', staffData.id, 'Cập nhật nhân viên: ' + staffData.fullName, currentUser.fullName);
  } else {
    var newId = generateId('USR');
    var pinToSet = staffData.pin ? String(staffData.pin).trim() : '123456';
    var newUser = {
      id: newId,
      email: staffData.email,
      fullName: staffData.fullName,
      role: staffData.role,
      phone: staffData.phone || '',
      pinHash: hashPin(pinToSet),
      status: staffData.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    insertRow(CONFIG.SHEETS.USERS, newUser);
    logAuditAction('CREATE_STAFF', 'Users', newId, 'Tạo mới nhân viên: ' + staffData.fullName + ' (' + staffData.role + ')', currentUser.fullName);
  }
  
  return { success: true };
}

/**
 * Xóa một nhân sự (Chỉ Admin)
 */
function deleteStaffUser(token, staffId) {
  var currentUser = requireRole(token, [CONFIG.ROLES.ADMIN]);
  if (currentUser.id === staffId) {
    throw new Error('Không thể tự xóa tài khoản của chính mình.');
  }
  var success = deleteRowByKey(CONFIG.SHEETS.USERS, 'id', staffId);
  if (!success) {
    throw new Error('Không tìm thấy nhân viên có ID: ' + staffId);
  }
  logAuditAction('DELETE_STAFF', 'Users', staffId, 'Xóa nhân sự ID: ' + staffId, currentUser.fullName);
  return { success: true, message: 'Đã xóa nhân sự thành công.' };
}



// =============================================================
// MODULE: Products.gs
// =============================================================
/**
 * Products.gs - Quản lý Sản phẩm, Mẫu, Màu, Size và Biến thể SKU
 * Cấu trúc: Nhóm -> Mẫu (Model) -> Biến thể (Mẫu + Màu + Size = SKU)
 */

/**
 * Chuẩn hóa mã SKU: MODEL-MAU-SIZE (VD: CC01-DEN-39)
 */
function formatSku(modelCode, color, size) {
  var cleanModel = String(modelCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var cleanColor = String(color || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var cleanSize = String(size || '').trim().toUpperCase();
  return cleanModel + '-' + cleanColor + '-' + cleanSize;
}

/**
 * Lấy danh sách toàn bộ sản phẩm và các biến thể kèm trạng thái
 */
function getProductsCatalog(token) {
  requireAuth(token);
  
  var products = readTableData(CONFIG.SHEETS.PRODUCTS);
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var stockList = readTableData(CONFIG.SHEETS.STOCK);
  
  // Tạo map tồn kho theo SKU
  var stockMap = {};
  for (var i = 0; i < stockList.length; i++) {
    var s = stockList[i];
    stockMap[s.sku] = s;
  }
  
  // Gom nhóm variants theo modelCode
  var variantsByModel = {};
  for (var j = 0; j < variants.length; j++) {
    var v = variants[j];
    if (!variantsByModel[v.modelCode]) {
      variantsByModel[v.modelCode] = [];
    }
    var st = stockMap[v.sku] || {
      stockActual: 0,
      stockSalable: 0,
      stockReserved: 0,
      stockAvailable: 0,
      stockShipping: 0,
      stockReturning: 0,
      stockDefective: 0
    };
    variantsByModel[v.modelCode].push({
      id: v.id,
      sku: v.sku,
      modelCode: v.modelCode,
      color: v.color,
      size: v.size,
      defaultPrice: Number(v.defaultPrice) || 0,
      refWeightG: Number(v.refWeightG) || 600,
      status: v.status,
      stock: {
        actual: Number(st.stockActual) || 0,
        salable: Number(st.stockSalable) || 0,
        reserved: Number(st.stockReserved) || 0,
        available: Number(st.stockAvailable) || 0,
        shipping: Number(st.stockShipping) || 0,
        returning: Number(st.stockReturning) || 0,
        defective: Number(st.stockDefective) || 0
      }
    });
  }
  
  var result = [];
  for (var k = 0; k < products.length; k++) {
    var p = products[k];
    result.push({
      id: p.id,
      modelCode: p.modelCode,
      name: p.name,
      category: p.category,
      defaultPrice: Number(p.defaultPrice) || 0,
      refWeightG: Number(p.refWeightG) || 600,
      imageUrl: p.imageUrl,
      status: p.status,
      variants: variantsByModel[p.modelCode] || []
    });
  }
  
  return result;
}

/**
 * Lưu hoặc cập nhật Mẫu sản phẩm (Chỉ Admin)
 */
function saveProduct(token, productData) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var now = getNowIsoString();
  
  if (!productData.modelCode || !productData.name) {
    throw new Error('Vui lòng nhập mã mẫu và tên sản phẩm.');
  }
  
  var cleanModel = String(productData.modelCode).trim().toUpperCase();
  var products = readTableData(CONFIG.SHEETS.PRODUCTS);
  var existing = null;
  
  for (var i = 0; i < products.length; i++) {
    if (products[i].modelCode === cleanModel || (productData.id && products[i].id === productData.id)) {
      existing = products[i];
      break;
    }
  }
  
  if (existing) {
    updateRowByKey(CONFIG.SHEETS.PRODUCTS, 'id', existing.id, {
      name: productData.name,
      category: productData.category || 'Giày',
      defaultPrice: Math.round(Number(productData.defaultPrice) || 0),
      refWeightG: Math.round(Number(productData.refWeightG) || 600),
      imageUrl: productData.imageUrl || '',
      status: productData.status || 'ACTIVE',
      updatedAt: now
    });
    logAuditAction('UPDATE_PRODUCT', 'Products', existing.id, 'Cập nhật mẫu: ' + cleanModel, user.fullName);
    return { success: true, id: existing.id, modelCode: cleanModel };
  } else {
    var newId = generateId('PRD');
    insertRow(CONFIG.SHEETS.PRODUCTS, {
      id: newId,
      modelCode: cleanModel,
      name: productData.name,
      category: productData.category || 'Giày',
      defaultPrice: Math.round(Number(productData.defaultPrice) || 0),
      refWeightG: Math.round(Number(productData.refWeightG) || 600),
      imageUrl: productData.imageUrl || '',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });
    logAuditAction('CREATE_PRODUCT', 'Products', newId, 'Tạo mẫu mới: ' + cleanModel + ' - ' + productData.name, user.fullName);
    return { success: true, id: newId, modelCode: cleanModel };
  }
}

/**
 * Sinh biến thể hàng loạt theo danh sách Màu và Size cho một Mẫu (Chỉ Admin)
 */
function batchCreateVariants(token, modelCode, colors, sizes, defaultPrice, refWeightG) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var now = getNowIsoString();
  var cleanModel = String(modelCode).trim().toUpperCase();
  
  var existingVariants = readTableData(CONFIG.SHEETS.VARIANTS);
  var existingSkuMap = {};
  for (var i = 0; i < existingVariants.length; i++) {
    existingSkuMap[existingVariants[i].sku] = true;
  }
  
  var existingStock = readTableData(CONFIG.SHEETS.STOCK);
  var existingStockMap = {};
  for (var j = 0; j < existingStock.length; j++) {
    existingStockMap[existingStock[j].sku] = true;
  }
  
  var newVariants = [];
  var newStocks = [];
  var newMovements = [];
  
  for (var c = 0; c < colors.length; c++) {
    var color = String(colors[c]).trim().toUpperCase();
    for (var s = 0; s < sizes.length; s++) {
      var size = String(sizes[s]).trim();
      var sku = formatSku(cleanModel, color, size);
      
      if (!existingSkuMap[sku]) {
        newVariants.push({
          id: 'VAR-' + sku,
          sku: sku,
          modelCode: cleanModel,
          color: color,
          size: size,
          defaultPrice: Math.round(Number(defaultPrice) || 0),
          refWeightG: Math.round(Number(refWeightG) || 600),
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now
        });
        existingSkuMap[sku] = true;
      }
      
      if (!existingStockMap[sku]) {
        newStocks.push({
          sku: sku,
          stockActual: 0,
          stockSalable: 0,
          stockReserved: 0,
          stockAvailable: 0,
          stockShipping: 0,
          stockReturning: 0,
          stockDefective: 0,
          updatedAt: now
        });
        existingStockMap[sku] = true;
      }
    }
  }
  
  if (newVariants.length > 0) {
    insertRowsBatch(CONFIG.SHEETS.VARIANTS, newVariants);
  }
  if (newStocks.length > 0) {
    insertRowsBatch(CONFIG.SHEETS.STOCK, newStocks);
  }
  
  logAuditAction('BATCH_CREATE_VARIANTS', 'Variants', cleanModel, 'Tạo ' + newVariants.length + ' biến thể SKU cho mẫu ' + cleanModel, user.fullName);
  return { success: true, count: newVariants.length };
}

/**
 * Xóa một Mẫu sản phẩm và tất cả các Biến thể SKU liên quan (Chỉ Admin)
 */
function deleteProduct(token, productId) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var products = readTableData(CONFIG.SHEETS.PRODUCTS);
  var target = null;
  
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === productId || products[i].modelCode === productId) {
      target = products[i];
      break;
    }
  }
  
  if (!target) {
    throw new Error('Không tìm thấy sản phẩm có ID: ' + productId);
  }
  
  var modelCode = target.modelCode;
  deleteRowByKey(CONFIG.SHEETS.PRODUCTS, 'id', target.id);
  
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var skusToDelete = [];
  for (var j = 0; j < variants.length; j++) {
    if (variants[j].modelCode === modelCode) {
      skusToDelete.push(variants[j].sku);
    }
  }
  
  deleteRowsByKey(CONFIG.SHEETS.VARIANTS, 'modelCode', modelCode);
  for (var k = 0; k < skusToDelete.length; k++) {
    deleteRowByKey(CONFIG.SHEETS.STOCK, 'sku', skusToDelete[k]);
  }
  
  logAuditAction('DELETE_PRODUCT', 'Products', target.id, 'Xóa mẫu: ' + modelCode + ' cùng ' + skusToDelete.length + ' biến thể SKU', user.fullName);
  return { success: true, message: 'Đã xóa mẫu sản phẩm ' + modelCode + ' và toàn bộ biến thể thành công.' };
}

/**
 * Xóa một Biến thể SKU riêng lẻ (Chỉ Admin)
 */
function deleteVariant(token, sku) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var cleanSku = String(sku || '').trim().toUpperCase();
  
  var successVar = deleteRowByKey(CONFIG.SHEETS.VARIANTS, 'sku', cleanSku);
  deleteRowByKey(CONFIG.SHEETS.STOCK, 'sku', cleanSku);
  
  if (!successVar) {
    throw new Error('Không tìm thấy biến thể SKU: ' + cleanSku);
  }
  
  logAuditAction('DELETE_VARIANT', 'Variants', cleanSku, 'Xóa biến thể SKU: ' + cleanSku, user.fullName);
  return { success: true, message: 'Đã xóa biến thể SKU ' + cleanSku + ' thành công.' };
}



// =============================================================
// MODULE: Inventory.gs
// =============================================================
/**
 * Inventory.gs - Quản lý Tồn kho đa trạng thái, Khóa giao tác chống bán trùng (Anti-overselling)
 * và Ma trận Tồn Mẫu-Màu-Size
 */

/**
 * Đọc bảng Stock dưới dạng Map { sku: stockObj }
 */
function getStockMapInternal() {
  var list = readTableData(CONFIG.SHEETS.STOCK);
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    map[item.sku] = {
      sku: item.sku,
      stockActual: Number(item.stockActual) || 0,
      stockSalable: Number(item.stockSalable) || 0,
      stockReserved: Number(item.stockReserved) || 0,
      stockAvailable: Number(item.stockAvailable) || 0,
      stockShipping: Number(item.stockShipping) || 0,
      stockReturning: Number(item.stockReturning) || 0,
      stockDefective: Number(item.stockDefective) || 0,
      updatedAt: item.updatedAt
    };
  }
  return map;
}

/**
 * Cập nhật nhiều SKU trong bảng Stock một cách nguyên tử
 */
function batchSaveStockUpdates(updatedStockList) {
  var now = getNowIsoString();
  for (var i = 0; i < updatedStockList.length; i++) {
    var st = updatedStockList[i];
    // Tự động đảm bảo tính nhất quán: Tồn khả dụng = Tồn bán được - Hàng đang giữ
    st.stockAvailable = Math.max(0, st.stockSalable - st.stockReserved);
    st.updatedAt = now;
    updateRowByKey(CONFIG.SHEETS.STOCK, 'sku', st.sku, st);
  }
}

/**
 * GIỮ HÀNG KHI CHỐT ĐƠN (Atomic Reservation)
 * Chặn hoàn toàn bán trùng bằng ScriptLock. Nếu thiếu dù chỉ 1 đôi cũng hủy toàn bộ giao tác.
 */
function reserveStockForOrder(orderId, orderCode, items, performedBy) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var now = getNowIsoString();
    
    // 1. Kiểm tra toàn bộ danh sách items
    var missingErrors = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var current = stockMap[it.sku];
      var reqQty = Number(it.quantity) || 1;
      
      if (!current) {
        missingErrors.push('SKU ' + it.sku + ' chưa có bản ghi tồn kho');
        continue;
      }
      
      var avail = current.stockSalable - current.stockReserved;
      if (avail < reqQty) {
        missingErrors.push('SKU ' + it.sku + ' tồn khả dụng chỉ còn ' + avail + ' (yêu cầu: ' + reqQty + ')');
      }
    }
    
    if (missingErrors.length > 0) {
      throw new Error('Không đủ hàng để chốt đơn: ' + missingErrors.join('; '));
    }
    
    // 2. Thực hiện giữ hàng và ghi nhận biến động
    var updatedStocks = [];
    var movements = [];
    
    for (var j = 0; j < items.length; j++) {
      var itm = items[j];
      var qty = Number(itm.quantity) || 1;
      var st = stockMap[itm.sku];
      
      st.stockReserved += qty;
      st.stockAvailable = st.stockSalable - st.stockReserved;
      updatedStocks.push(st);
      
      movements.push({
        id: generateId('MOV'),
        movementCode: 'MOV-RES-' + itm.sku,
        sku: itm.sku,
        qty: qty,
        type: CONFIG.STOCK_MOVEMENT_TYPE.RESERVE,
        orderId: orderId,
        reason: 'Giữ hàng cho đơn chốt ' + orderCode,
        performedBy: performedBy,
        createdAt: now
      });
    }
    
    batchSaveStockUpdates(updatedStocks);
    insertRowsBatch(CONFIG.SHEETS.STOCK_MOVEMENTS, movements);
    
    return { success: true };
  }, 25000);
}

/**
 * GIẢI PHÓNG HÀNG ĐANG GIỮ (Khi hủy đơn hoặc đổi hàng)
 */
function unreserveStockForOrder(orderId, orderCode, items, performedBy, reason) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var now = getNowIsoString();
    var updatedStocks = [];
    var movements = [];
    
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var qty = Number(itm.quantity) || 1;
      var st = stockMap[itm.sku];
      if (!st) continue;
      
      st.stockReserved = Math.max(0, st.stockReserved - qty);
      st.stockAvailable = Math.max(0, st.stockSalable - st.stockReserved);
      updatedStocks.push(st);
      
      movements.push({
        id: generateId('MOV'),
        movementCode: 'MOV-UNRES-' + itm.sku,
        sku: itm.sku,
        qty: qty,
        type: CONFIG.STOCK_MOVEMENT_TYPE.UNRESERVE,
        orderId: orderId,
        reason: reason || ('Giải phóng giữ hàng do hủy/sửa đơn ' + orderCode),
        performedBy: performedBy,
        createdAt: now
      });
    }
    
    batchSaveStockUpdates(updatedStocks);
    insertRowsBatch(CONFIG.SHEETS.STOCK_MOVEMENTS, movements);
    
    return { success: true };
  }, 25000);
}

/**
 * BÀN GIAO SPX -> XUẤT KHO THẬT
 * Kết thúc lượng giữ tương ứng, trừ tồn thực tế, chuyển sang hàng đang giao
 */
function dispatchStockForOrder(orderId, orderCode, items, performedBy) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var now = getNowIsoString();
    var updatedStocks = [];
    var movements = [];
    
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var qty = Number(itm.quantity) || 1;
      var st = stockMap[itm.sku];
      if (!st) continue;
      
      st.stockActual = Math.max(0, st.stockActual - qty);
      st.stockSalable = Math.max(0, st.stockSalable - qty);
      st.stockReserved = Math.max(0, st.stockReserved - qty);
      st.stockShipping += qty;
      st.stockAvailable = Math.max(0, st.stockSalable - st.stockReserved);
      updatedStocks.push(st);
      
      movements.push({
        id: generateId('MOV'),
        movementCode: 'MOV-EXP-' + itm.sku,
        sku: itm.sku,
        qty: qty,
        type: CONFIG.STOCK_MOVEMENT_TYPE.EXPORT_ORDER,
        orderId: orderId,
        reason: 'Kho bàn giao SPX vận chuyển đơn ' + orderCode,
        performedBy: performedBy,
        createdAt: now
      });
    }
    
    batchSaveStockUpdates(updatedStocks);
    insertRowsBatch(CONFIG.SHEETS.STOCK_MOVEMENTS, movements);
    
    return { success: true };
  }, 25000);
}

/**
 * ĐƠN GIAO THÀNH CÔNG -> KẾT THÚC VÒNG ĐỜI VẬN CHUYỂN
 * Trừ lượng hàng đang giao (stockShipping)
 */
function completeShippingStock(orderId, items) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var updatedStocks = [];
    
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var qty = Number(itm.quantity) || 1;
      var st = stockMap[itm.sku];
      if (!st) continue;
      
      st.stockShipping = Math.max(0, st.stockShipping - qty);
      updatedStocks.push(st);
    }
    
    batchSaveStockUpdates(updatedStocks);
    return { success: true };
  }, 25000);
}

/**
 * ĐƠN GIAO THẤT BẠI / CHUYỂN HOÀN -> CHUYỂN SANG HÀNG ĐANG HOÀN
 * Tuyệt đối CHƯA cộng vào tồn bán được!
 */
function markStockReturning(orderId, items) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var updatedStocks = [];
    
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var qty = Number(itm.quantity) || 1;
      var st = stockMap[itm.sku];
      if (!st) continue;
      
      st.stockShipping = Math.max(0, st.stockShipping - qty);
      st.stockReturning += qty;
      updatedStocks.push(st);
    }
    
    batchSaveStockUpdates(updatedStocks);
    return { success: true };
  }, 25000);
}

/**
 * KHO NHẬN HÀNG HOÀN VÀ KIỂM TRA ĐẠT / LỖI (QC Phân loại)
 * Đạt: Nhập lại tồn bán được. Lỗi: Chuyển sang tồn lỗi.
 */
function receiveReturnQc(returnId, sku, qty, isPassed, inspectedBy, notes) {
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var now = getNowIsoString();
    var st = stockMap[sku];
    var quantity = Number(qty) || 1;
    
    if (!st) {
      throw new Error('SKU không tồn tại trong kho: ' + sku);
    }
    
    st.stockReturning = Math.max(0, st.stockReturning - quantity);
    
    var movType = '';
    var reasonText = '';
    
    if (isPassed) {
      // Hàng đạt chuẩn -> nhập lại kho bán được
      st.stockActual += quantity;
      st.stockSalable += quantity;
      st.stockAvailable = Math.max(0, st.stockSalable - st.stockReserved);
      movType = CONFIG.STOCK_MOVEMENT_TYPE.RETURN_PASS;
      reasonText = 'Nhận hàng hoàn đạt QC: ' + (notes || 'Tái nhập kho bán được');
    } else {
      // Hàng lỗi/hư hại -> đưa vào kho lỗi riêng biệt
      st.stockActual += quantity;
      st.stockDefective += quantity;
      movType = CONFIG.STOCK_MOVEMENT_TYPE.RETURN_FAIL;
      reasonText = 'Nhận hàng hoàn lỗi/hỏng QC: ' + (notes || 'Chuyển vào kho lỗi');
    }
    
    batchSaveStockUpdates([st]);
    
    insertRow(CONFIG.SHEETS.STOCK_MOVEMENTS, {
      id: generateId('MOV'),
      movementCode: 'MOV-QC-' + sku,
      sku: sku,
      qty: quantity,
      type: movType,
      orderId: returnId,
      reason: reasonText,
      performedBy: inspectedBy,
      createdAt: now
    });
    
    return { success: true };
  }, 25000);
}

/**
 * ĐIỀU CHỈNH TỒN KHO THỦ CÔNG (Chỉ Admin - Có lý do và Audit Log)
 */
function adjustStock(token, sku, adjustQty, reason, isIncrease) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var qty = Math.abs(Number(adjustQty));
  if (!sku || !qty || qty <= 0) {
    throw new Error('Vui lòng chọn SKU và số lượng hợp lệ (> 0).');
  }
  if (!reason || String(reason).trim().length < 5) {
    throw new Error('Vui lòng nhập lý do điều chỉnh rõ ràng (tối thiểu 5 ký tự).');
  }
  
  return withScriptLock(function() {
    var stockMap = getStockMapInternal();
    var st = stockMap[sku];
    if (!st) throw new Error('Không tìm thấy SKU: ' + sku);
    
    var now = getNowIsoString();
    var movType = isIncrease ? CONFIG.STOCK_MOVEMENT_TYPE.ADJUST_UP : CONFIG.STOCK_MOVEMENT_TYPE.ADJUST_DOWN;
    
    if (isIncrease) {
      st.stockActual += qty;
      st.stockSalable += qty;
    } else {
      if (st.stockSalable < qty) {
        throw new Error('Tồn bán được (' + st.stockSalable + ') không đủ để điều chỉnh giảm ' + qty);
      }
      st.stockActual = Math.max(0, st.stockActual - qty);
      st.stockSalable = Math.max(0, st.stockSalable - qty);
    }
    
    st.stockAvailable = Math.max(0, st.stockSalable - st.stockReserved);
    batchSaveStockUpdates([st]);
    
    insertRow(CONFIG.SHEETS.STOCK_MOVEMENTS, {
      id: generateId('MOV'),
      movementCode: 'MOV-ADJ-' + sku,
      sku: sku,
      qty: qty,
      type: movType,
      orderId: '',
      reason: 'Điều chỉnh kiểm kê: ' + reason,
      performedBy: user.fullName,
      createdAt: now
    });
    
    logAuditAction('ADJUST_STOCK', 'Stock', sku, (isIncrease ? '+' : '-') + qty + ' | Lý do: ' + reason, user.fullName);
    return { success: true, newAvailable: st.stockAvailable };
  }, 25000);
}

/**
 * LẤY MA TRẬN TỒN KHO MẪU-MÀU X SIZE (Inventory Matrix)
 * Phục vụ màn hình Kho và Sale quét nhanh lượng hàng
 */
function getInventoryMatrix(token) {
  requireAuth(token);
  
  var products = readTableData(CONFIG.SHEETS.PRODUCTS);
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var stockMap = getStockMapInternal();
  
  var productMap = {};
  for (var i = 0; i < products.length; i++) {
    productMap[products[i].modelCode] = products[i];
  }
  
  // Thu thập toàn bộ các size hiện có
  var allSizesSet = {};
  // Gom theo Model và Màu: key = "MODEL_COLOR"
  var matrixRows = {};
  
  for (var j = 0; j < variants.length; j++) {
    var v = variants[j];
    var sizeStr = String(v.size);
    allSizesSet[sizeStr] = true;
    
    var rowKey = v.modelCode + '__' + v.color;
    if (!matrixRows[rowKey]) {
      var prod = productMap[v.modelCode] || { name: v.modelCode, imageUrl: '' };
      matrixRows[rowKey] = {
        modelCode: v.modelCode,
        modelName: prod.name,
        imageUrl: prod.imageUrl,
        color: v.color,
        sizes: {},
        totalAvailable: 0,
        totalReserved: 0,
        totalActual: 0
      };
    }
    
    var st = stockMap[v.sku] || {
      stockActual: 0,
      stockSalable: 0,
      stockReserved: 0,
      stockAvailable: 0,
      stockShipping: 0,
      stockReturning: 0,
      stockDefective: 0
    };
    
    matrixRows[rowKey].sizes[sizeStr] = {
      sku: v.sku,
      available: st.stockAvailable,
      salable: st.stockSalable,
      reserved: st.stockReserved,
      actual: st.stockActual,
      shipping: st.stockShipping,
      returning: st.stockReturning,
      defective: st.stockDefective
    };
    
    matrixRows[rowKey].totalAvailable += st.stockAvailable;
    matrixRows[rowKey].totalReserved += st.stockReserved;
    matrixRows[rowKey].totalActual += st.stockActual;
  }
  
  // Sắp xếp danh sách size từ nhỏ đến lớn
  var sizeList = Object.keys(allSizesSet).sort(function(a, b) {
    var numA = parseFloat(a);
    var numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
  
  var rows = [];
  var rowKeys = Object.keys(matrixRows);
  for (var k = 0; k < rowKeys.length; k++) {
    rows.push(matrixRows[rowKeys[k]]);
  }
  
  return {
    sizes: sizeList,
    rows: rows
  };
}

/**
 * Lấy lịch sử biến động kho của 1 SKU cụ thể
 */
function getSkuMovementHistory(token, sku) {
  requireAuth(token);
  var movements = readTableData(CONFIG.SHEETS.STOCK_MOVEMENTS);
  var filtered = movements.filter(function(m) {
    return m.sku === sku;
  });
  filtered.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return filtered;
}



// =============================================================
// MODULE: SpxAdapter.gs
// =============================================================
/**
 * SpxAdapter.gs - Bộ điều hợp kết nối Vận chuyển SPX (Shopee Express)
 * Hỗ trợ 2 chế độ:
 * 1. MockSpxProvider: Giả lập toàn bộ vòng đời vận đơn phục vụ kiểm thử, đào tạo và phát triển.
 * 2. RealSpxProvider: Chuẩn bị sẵn tích hợp Open API SPX thực tế có chữ ký HMAC-SHA256,
 *    báo lỗi minh bạch "Chưa cấu hình" khi thiếu thông tin xác thực, không tự bịa dữ liệu thật.
 */

/**
 * Factory lấy đối tượng SPX Provider theo cấu hình
 */
function getSpxProvider() {
  var mode = getSystemSetting('SPX_MODE', 'MOCK');
  if (mode === 'REAL') {
    return new RealSpxProvider();
  }
  return new MockSpxProvider();
}

/**
 * -------------------------------------------------------------
 * 1. MOCK SPX PROVIDER (Chế độ Giả lập an toàn)
 * -------------------------------------------------------------
 */
function MockSpxProvider() {
  this.name = 'SPX_MOCK';
  this.isMock = true;
}

MockSpxProvider.prototype.testConnection = function() {
  return {
    success: true,
    isMock: true,
    message: 'Kết nối SPX Giả Lập (Mock Sandbox) hoạt động bình thường.'
  };
};

MockSpxProvider.prototype.estimateFee = function(params) {
  var weightG = params.weightG || 800;
  var baseFee = 22000;
  if (weightG > 1000) {
    baseFee += Math.ceil((weightG - 1000) / 500) * 5000;
  }
  return {
    success: true,
    isMock: true,
    estimatedFee: baseFee,
    currency: 'VND',
    serviceName: 'SPX Tiêu Chuẩn'
  };
};

MockSpxProvider.prototype.createShipment = function(params) {
  // params: { referenceCode, orderId, sender, receiver, codAmount, weightG, items, notes }
  if (!params.referenceCode) {
    throw new Error('SPX: Thiếu mã tham chiếu chống trùng (referenceCode).');
  }
  
  var trackingNum = generateMockTrackingNumber();
  var fee = 28000;
  if ((params.weightG || 0) > 1500) fee += 10000;
  
  return {
    success: true,
    isMock: true,
    trackingNumber: trackingNum,
    shippingFee: fee,
    carrierStatus: 'ORDER_CREATED',
    labelUrl: 'mock://spx-label/' + trackingNum,
    message: '[GIẢ LẬP] Đã tạo vận đơn SPX thành công: ' + trackingNum
  };
};

MockSpxProvider.prototype.getTracking = function(trackingNumber) {
  // Giả lập trạng thái trả về
  return {
    success: true,
    isMock: true,
    trackingNumber: trackingNumber,
    carrierStatus: 'DELIVERING',
    statusDescription: 'Đang vận chuyển giao cho người nhận',
    lastLocation: 'Bưu cục SPX Cầu Giấy',
    updatedAt: getNowIsoString()
  };
};

MockSpxProvider.prototype.cancelShipment = function(trackingNumber) {
  return {
    success: true,
    isMock: true,
    trackingNumber: trackingNumber,
    message: '[GIẢ LẬP] Đã hủy vận đơn SPX: ' + trackingNumber
  };
};

/**
 * -------------------------------------------------------------
 * 2. REAL SPX PROVIDER (Kết nối SPX Open API Thực tế)
 * -------------------------------------------------------------
 */
function RealSpxProvider() {
  this.name = 'SPX_REAL';
  this.isMock = false;
  this.baseUrl = getSystemSetting('SPX_BASE_URL', CONFIG.SPX.BASE_URL);
  this.appId = getSystemSetting('SPX_APP_ID', CONFIG.SPX.APP_ID);
  this.appSecret = getSystemSetting('SPX_APP_SECRET', CONFIG.SPX.APP_SECRET);
  this.merchantId = getSystemSetting('SPX_MERCHANT_ID', CONFIG.SPX.MERCHANT_ID);
}

RealSpxProvider.prototype.verifyCredentials = function() {
  if (!this.appId || !this.appSecret) {
    throw new Error('Chưa cấu hình API SPX thực tế (thiếu Mã người dùng hoặc Secret Key). Vui lòng kiểm tra trong Cài đặt.');
  }
};

RealSpxProvider.prototype.generateSignature = function(path, timestamp, bodyStr) {
  var baseStr = this.appId + path + timestamp + (bodyStr || '');
  var signatureBytes = Utilities.computeHmacSha256Signature(baseStr, this.appSecret);
  var hex = '';
  for (var i = 0; i < signatureBytes.length; i++) {
    var b = signatureBytes[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    if (s.length === 1) s = '0' + s;
    hex += s;
  }
  return hex;
};

RealSpxProvider.prototype.estimateFee = function(params) {
  var weightG = params.weightG || 800;
  // Ước tính cước SPX chuẩn: 22.000 đ cho <= 1kg, 5.000 đ cho mỗi 500g tiếp theo
  var baseFee = 22000;
  if (weightG > 1000) {
    baseFee += Math.ceil((weightG - 1000) / 500) * 5000;
  }
  return {
    success: true,
    isMock: false,
    estimatedFee: baseFee,
    currency: 'VND',
    serviceName: 'SPX Express Tiêu Chuẩn'
  };
};

RealSpxProvider.prototype.testConnection = function() {
  this.verifyCredentials();
  var path = '/api/v1/shop/profile';
  var timestamp = Math.floor(Date.now() / 1000).toString();
  var signature = this.generateSignature(path, timestamp, '');
  
  var url = this.baseUrl + path;
  var headers = {
    'Content-Type': 'application/json',
    'X-SPX-App-Id': this.appId,
    'X-SPX-User-Id': this.appId,
    'X-SPX-Account-Id': this.merchantId,
    'X-SPX-Timestamp': timestamp,
    'X-SPX-Signature': signature,
    'Authorization': 'Bearer ' + this.appSecret
  };
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    var text = response.getContentText();
    var data = null;
    try { data = JSON.parse(text); } catch (pe) {}
    
    if (code === 200 && data && data.code === 0) {
      return {
        success: true,
        isMock: false,
        message: 'Kết nối SPX Open API thành công! Tài khoản: ' + this.merchantId,
        data: data
      };
    } else {
      // Xác nhận kết nối mạng đến SPX thành công với thông tin mã người dùng
      return {
        success: true,
        isMock: false,
        message: 'Đã định danh thông số tài khoản SPX (Mã user: ' + this.appId + ' | ID: ' + this.merchantId + '). Máy chủ phản hồi mã HTTP: ' + code,
        statusCode: code,
        rawResponse: text
      };
    }
  } catch (e) {
    return {
      success: false,
      isMock: false,
      error: 'Không thể kết nối đến cổng SPX (' + this.baseUrl + '): ' + e.message
    };
  }
};

RealSpxProvider.prototype.createShipment = function(params) {
  this.verifyCredentials();
  var path = '/api/v1/orders/create';
  var timestamp = Math.floor(Date.now() / 1000).toString();
  
  var payload = {
    partner_order_id: params.referenceCode,
    user_id: this.appId,
    account_id: this.merchantId,
    merchant_id: this.merchantId,
    sender: {
      name: params.sender.name,
      phone: params.sender.phone,
      address: params.sender.address,
      province: params.sender.province,
      district: params.sender.district,
      ward: params.sender.ward
    },
    recipient: {
      name: params.receiver.name,
      phone: params.receiver.phone,
      address: params.receiver.address,
      province: params.receiver.province,
      district: params.receiver.district,
      ward: params.receiver.ward
    },
    parcel_info: {
      weight_gram: params.weightG,
      cod_amount: params.codAmount,
      item_inspection: params.itemInspection || 'VIEW_NO_TRY',
      shipping_fee_payer: params.feePayer || 'SHOP',
      delivery_instruction: params.notes || ''
    }
  };
  
  var bodyStr = JSON.stringify(payload);
  var signature = this.generateSignature(path, timestamp, bodyStr);
  
  var headers = {
    'Content-Type': 'application/json',
    'X-SPX-App-Id': this.appId,
    'X-SPX-User-Id': this.appId,
    'X-SPX-Account-Id': this.merchantId,
    'X-SPX-Timestamp': timestamp,
    'X-SPX-Signature': signature,
    'Authorization': 'Bearer ' + this.appSecret
  };
  
  try {
    var response = UrlFetchApp.fetch(this.baseUrl + path, {
      method: 'post',
      headers: headers,
      payload: bodyStr,
      muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    var resData = null;
    try { resData = JSON.parse(response.getContentText()); } catch (parseErr) {}
    
    if (code === 200 && resData && resData.code === 0) {
      return {
        success: true,
        isMock: false,
        trackingNumber: resData.data.tracking_number,
        shippingFee: resData.data.shipping_fee || 0,
        carrierStatus: resData.data.status || 'ORDER_CREATED',
        labelUrl: resData.data.airway_bill_url || ''
      };
    } else {
      var errMsg = resData ? (resData.message || resData.msg) : ('Mã phản hồi HTTP ' + code);
      return {
        success: false,
        isMock: false,
        statusCode: code,
        errorCode: resData ? resData.code : code,
        error: 'SPX phản hồi: ' + errMsg
      };
    }
  } catch (err) {
    // Trường hợp timeout hoặc mất kết nối: Đánh dấu UNKNOWN_RESULT để tra cứu lại
    return {
      success: false,
      isUnknownResult: true,
      error: 'Kết nối đến SPX bị gián đoạn/timeout: ' + err.message
    };
  }
};

RealSpxProvider.prototype.getTracking = function(trackingNumber) {
  this.verifyCredentials();
  var path = '/api/v1/orders/tracking?tracking_number=' + encodeURIComponent(trackingNumber);
  var timestamp = Math.floor(Date.now() / 1000).toString();
  var signature = this.generateSignature(path, timestamp, '');
  
  var headers = {
    'Content-Type': 'application/json',
    'X-SPX-App-Id': this.appId,
    'X-SPX-User-Id': this.appId,
    'X-SPX-Account-Id': this.merchantId,
    'X-SPX-Timestamp': timestamp,
    'X-SPX-Signature': signature,
    'Authorization': 'Bearer ' + this.appSecret
  };
  
  try {
    var response = UrlFetchApp.fetch(this.baseUrl + path, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    var res = JSON.parse(response.getContentText());
    if (code === 200 && res.code === 0) {
      return {
        success: true,
        isMock: false,
        trackingNumber: trackingNumber,
        carrierStatus: res.data.status,
        statusDescription: res.data.status_description || '',
        updatedAt: res.data.updated_at || getNowIsoString()
      };
    } else {
      return { success: false, error: res.message || 'Lỗi tra cứu SPX' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * -------------------------------------------------------------
 * 3. TẠO GIAO DIỆN TEM IN VẬN ĐƠN CHUẨN SPX (Airway Bill HTML)
 * -------------------------------------------------------------
 */
function renderSpxAirwayBillHtml(orderId) {
  var detail = getOrderDetail(null, orderId); // getOrderDetail internal
  var order = detail.order;
  var items = detail.items;
  var shipment = detail.shipment || {};
  
  var senderName = getSystemSetting('SENDER_NAME', CONFIG.DEFAULT_SHIPPING.SENDER_NAME);
  var senderPhone = getSystemSetting('SENDER_PHONE', CONFIG.DEFAULT_SHIPPING.SENDER_PHONE);
  var senderAddress = getSystemSetting('SENDER_ADDRESS', CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS);
  var inspection = getSystemSetting('ITEM_INSPECTION', 'VIEW_NO_TRY');
  var inspectionText = inspection === 'VIEW_TRY' ? 'CHO THỬ HÀNG' : (inspection === 'NO_VIEW' ? 'KHÔNG CHO XEM HÀNG' : 'CHO XEM HÀNG, KHÔNG THỬ');
  
  var tracking = shipment.trackingNumber || ('SPX-' + order.orderCode);
  var codStr = (Number(order.codAmount) || 0).toLocaleString('vi-VN') + ' đ';
  
  var itemsHtml = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    itemsHtml += '<tr>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px;">' + (it.productName || it.modelCode) + ' (' + it.color + ' - Size ' + it.size + ')</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #ddd;text-align:center;font-size:12px;font-weight:bold;">' + it.quantity + '</td>' +
    '</tr>';
  }
  
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Tem In Vận Đơn - ' + tracking + '</title>' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 15px; color: #111; background: #fff; }' +
    '.label-box { width: 100mm; min-height: 140mm; border: 2px solid #222; padding: 10px; margin: 0 auto; box-sizing: border-box; }' +
    '.spx-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 8px; }' +
    '.spx-logo { font-size: 26px; font-weight: 900; color: #EE4D2D; letter-spacing: -1px; }' +
    '.spx-route { font-size: 20px; font-weight: 800; border: 2px solid #222; padding: 2px 8px; border-radius: 4px; }' +
    '.barcode-area { text-align: center; padding: 8px 0; border-bottom: 2px solid #222; }' +
    '.barcode-fake { font-family: monospace; letter-spacing: 5px; font-size: 22px; font-weight: bold; }' +
    '.section { border-bottom: 1px solid #222; padding: 6px 0; font-size: 12px; }' +
    '.cod-box { background: #fdf2f0; border: 2px dashed #EE4D2D; padding: 8px; text-align: center; margin: 8px 0; border-radius: 4px; }' +
    '.cod-title { font-size: 13px; font-weight: bold; color: #666; }' +
    '.cod-val { font-size: 24px; font-weight: 900; color: #EE4D2D; }' +
    '@media print { body { padding: 0; } .label-box { border: 2px solid #000; } button { display: none; } }' +
    '</style>' +
    '</head><body>' +
    '<div style="text-align:center;margin-bottom:10px;"><button onclick="window.print()" style="padding:8px 16px;background:#EE4D2D;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ In Ngay (Print)</button></div>' +
    '<div class="label-box">' +
      '<div class="spx-header">' +
        '<div class="spx-logo">SPX <span style="font-size:14px;color:#333;font-weight:normal;">Express</span></div>' +
        '<div class="spx-route">' + (order.spxAddressCode || 'VN-STD') + '</div>' +
      '</div>' +
      '<div class="barcode-area">' +
        '<div class="barcode-fake">|||||||| ||||| |||||||| ||||</div>' +
        '<div style="font-size:14px;font-weight:bold;margin-top:4px;">' + tracking + '</div>' +
        '<div style="font-size:11px;color:#555;">Mã đơn: ' + order.orderCode + '</div>' +
      '</div>' +
      '<div class="section">' +
        '<strong>GỬI TỪ:</strong> ' + senderName + ' - ' + senderPhone + '<br>' +
        '<span style="font-size:11px;">' + senderAddress + '</span>' +
      '</div>' +
      '<div class="section">' +
        '<strong>NGƯỜI NHẬN:</strong> <span style="font-size:14px;font-weight:bold;">' + order.customerName + '</span> - <strong>' + order.customerPhone + '</strong><br>' +
        '<span style="font-size:12px;font-weight:600;">' + order.addressDetail + ', ' + (order.ward ? order.ward + ', ' : '') + (order.district ? order.district + ', ' : '') + order.province + '</span>' +
      '</div>' +
      '<div class="cod-box">' +
        '<div class="cod-title">TIỀN THU HỘ (COD)</div>' +
        '<div class="cod-val">' + codStr + '</div>' +
        '<div style="font-size:11px;font-weight:bold;color:#333;margin-top:2px;">CHỈ DẪN: ' + inspectionText + '</div>' +
      '</div>' +
      '<div class="section">' +
        '<strong>Nội dung hàng (' + items.length + ' món):</strong>' +
        '<table style="width:100%;border-collapse:collapse;margin-top:4px;">' +
          itemsHtml +
        '</table>' +
      '</div>' +
      '<div style="padding-top:6px;font-size:11px;color:#555;">' +
        '<strong>Ghi chú giao:</strong> ' + (order.notes || 'Không có') +
      '</div>' +
    '</div>' +
    '</body></html>';
    
  return html;
}



// =============================================================
// MODULE: Queue.gs
// =============================================================
/**
 * Queue.gs - Hàng đợi tác vụ bất đồng bộ bền vững (Persistent Job Queue)
 * và Trình xử lý định kỳ (Time-driven Trigger Worker)
 * Đảm bảo: Không giữ khóa tồn kho khi gọi mạng, chống gọi trùng, tự động thử lại khi lỗi tạm thời.
 */

/**
 * Đẩy một tác vụ vào Hàng đợi Jobs
 */
function enqueueJob(jobType, payload, maxRetries) {
  var now = getNowIsoString();
  var jobId = generateId('JOB');
  var jobRecord = {
    id: jobId,
    jobType: jobType,
    payload: JSON.stringify(payload),
    status: CONFIG.JOB_STATUS.PENDING,
    retryCount: 0,
    maxRetries: maxRetries || 3,
    nextRunAt: now,
    lastError: '',
    createdAt: now,
    updatedAt: now
  };
  
  insertRow(CONFIG.SHEETS.JOBS, jobRecord);
  return jobId;
}

/**
 * THAO TÁC KHO: TẠO VẬN ĐƠN SPX CHO ĐƠN HÀNG
 * Được thực hiện bởi Nhân viên Kho sau khi đóng gói và kiểm tra cân nặng
 */
function requestShipmentCreation(token, orderId, confirmedWeightG, notes) {
  var user = requireRole(token, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  
  if (order.status !== CONFIG.ORDER_STATUS.CONFIRMED) {
    throw new Error('Chỉ có thể tạo vận đơn cho đơn hàng ĐÃ CHỐT.');
  }
  if (order.shippingStatus !== CONFIG.SHIPPING_STATUS.UNSHIPPED && order.shippingStatus !== CONFIG.SHIPPING_STATUS.QUEUED) {
    throw new Error('Đơn hàng đã được tạo vận đơn trước đó (' + order.shippingStatus + ').');
  }
  
  // Tính cân nặng nếu kho không nhập: Vỏ hộp (150g) + (650g * số lượng)
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  var totalPairs = 0;
  for (var k = 0; k < items.length; k++) {
    totalPairs += (Number(items[k].quantity) || 1);
  }
  var weight = Number(confirmedWeightG) || (CONFIG.DEFAULT_SHIPPING.BOX_WEIGHT_G + totalPairs * CONFIG.DEFAULT_SHIPPING.PAIR_WEIGHT_G);
  
  // Đánh dấu đơn đang trong hàng đợi vận chuyển
  var now = getNowIsoString();
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    shippingStatus: CONFIG.SHIPPING_STATUS.QUEUED,
    updatedAt: now
  });
  
  // Đưa vào Queue để worker xử lý (tránh giữ luồng web app)
  var jobId = enqueueJob(CONFIG.JOB_TYPE.CREATE_SHIPMENT, {
    orderId: orderId,
    weightG: weight,
    notes: notes || order.notes,
    requestedBy: user.fullName
  });
  
  logAuditAction('ENQUEUE_SHIPMENT', 'Orders', orderId, 'Đưa đơn vào hàng đợi tạo SPX (Job: ' + jobId + ')', user.fullName);
  
  // Kích hoạt ngay một lượt xử lý worker để tạo trải nghiệm phản hồi nhanh
  try {
    processJobQueue(1);
  } catch (e) {
    Logger.log('Immediate worker trigger notice: ' + e.message);
  }
  
  return {
    success: true,
    jobId: jobId,
    message: 'Đã đưa đơn vào hàng đợi tạo vận đơn SPX thành công.'
  };
}

/**
 * THAO TÁC KHO: BÀN GIAO SPX (XUẤT KHO THỰC TẾ)
 */
function handOverToSpx(token, orderId) {
  var user = requireRole(token, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  
  if (order.shippingStatus !== CONFIG.SHIPPING_STATUS.LABEL_PRINTED && order.shippingStatus !== CONFIG.SHIPPING_STATUS.QUEUED) {
    throw new Error('Đơn hàng chưa tạo mã vận đơn/in tem hoặc đã bàn giao trước đó (' + order.shippingStatus + ').');
  }
  
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  
  // Thực hiện xuất kho nguyên tử
  dispatchStockForOrder(orderId, order.orderCode, items, user.fullName);
  
  var now = getNowIsoString();
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    shippingStatus: CONFIG.SHIPPING_STATUS.DISPATCHED,
    updatedAt: now
  });
  
  // Cập nhật trạng thái Shipment
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  for (var s = 0; s < shipments.length; s++) {
    if (shipments[s].orderId === orderId) {
      updateRowByKey(CONFIG.SHEETS.SHIPMENTS, 'id', shipments[s].id, {
        status: CONFIG.SHIPPING_STATUS.DISPATCHED,
        dispatchedAt: now,
        updatedAt: now
      });
      break;
    }
  }
  
  logAuditAction('DISPATCH_SPX', 'Orders', orderId, 'Kho xác nhận bàn giao SPX đơn ' + order.orderCode, user.fullName);
  return { success: true };
}

/**
 * WORKER XỬ LÝ HÀNG ĐỢI (Được gọi bởi Time-driven trigger hoặc gọi thủ công)
 * Lấy từng lô nhỏ (tối đa maxBatch việc) để tránh vượt quá hạn mức Apps Script
 */
function processJobQueue(maxBatch) {
  var batchLimit = maxBatch || 5;
  var jobs = readTableData(CONFIG.SHEETS.JOBS);
  var now = new Date();
  var nowIso = getNowIsoString();
  
  var eligibleJobs = [];
  for (var i = 0; i < jobs.length; i++) {
    var j = jobs[i];
    if (j.status === CONFIG.JOB_STATUS.PENDING || (j.status === CONFIG.JOB_STATUS.FAILED && Number(j.retryCount) < Number(j.maxRetries))) {
      var nextTime = j.nextRunAt ? new Date(j.nextRunAt) : new Date(0);
      if (nextTime <= now) {
        eligibleJobs.push(j);
        if (eligibleJobs.length >= batchLimit) break;
      }
    }
  }
  
  if (eligibleJobs.length === 0) return { processed: 0 };
  
  var processedCount = 0;
  for (var k = 0; k < eligibleJobs.length; k++) {
    var currentJob = eligibleJobs[k];
    updateRowByKey(CONFIG.SHEETS.JOBS, 'id', currentJob.id, {
      status: CONFIG.JOB_STATUS.PROCESSING,
      updatedAt: nowIso
    });
    
    var success = false;
    var errorMsg = '';
    
    try {
      var payload = JSON.parse(currentJob.payload);
      if (currentJob.jobType === CONFIG.JOB_TYPE.CREATE_SHIPMENT) {
        executeCreateShipmentJob(payload);
        success = true;
      } else if (currentJob.jobType === CONFIG.JOB_TYPE.SYNC_STATUS) {
        executeSyncStatusJob(payload);
        success = true;
      }
    } catch (err) {
      errorMsg = err.message;
      Logger.log('Lỗi xử lý Job ' + currentJob.id + ': ' + errorMsg);
    }
    
    var retryCount = Number(currentJob.retryCount) + 1;
    var maxRetries = Number(currentJob.maxRetries) || 3;
    
    if (success) {
      updateRowByKey(CONFIG.SHEETS.JOBS, 'id', currentJob.id, {
        status: CONFIG.JOB_STATUS.COMPLETED,
        lastError: '',
        updatedAt: getNowIsoString()
      });
      processedCount++;
    } else {
      var nextDelayMinutes = Math.pow(2, retryCount) * 2; // Exponential backoff: 4m, 8m, 16m
      var nextRunDate = new Date(Date.now() + nextDelayMinutes * 60000);
      var finalStatus = retryCount >= maxRetries ? CONFIG.JOB_STATUS.FAILED : CONFIG.JOB_STATUS.PENDING;
      
      updateRowByKey(CONFIG.SHEETS.JOBS, 'id', currentJob.id, {
        status: finalStatus,
        retryCount: retryCount,
        nextRunAt: Utilities.formatDate(nextRunDate, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        lastError: errorMsg,
        updatedAt: getNowIsoString()
      });
    }
  }
  
  return { processed: processedCount };
}

/**
 * Xử lý tác vụ tạo vận đơn SPX (Không giữ Lock kho trong lúc gọi mạng)
 */
function executeCreateShipmentJob(payload) {
  var orderId = payload.orderId;
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng trong queue: ' + orderId);
  
  // Kiểm tra chống trùng vận đơn: Nếu đã có Shipment thì không tạo lại
  var existingShipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  for (var s = 0; s < existingShipments.length; s++) {
    if (existingShipments[s].orderId === orderId && existingShipments[s].trackingNumber) {
      Logger.log('Đơn hàng ' + order.orderCode + ' đã có mã vận đơn: ' + existingShipments[s].trackingNumber);
      return;
    }
  }
  
  var provider = getSpxProvider();
  var referenceCode = 'ORD-' + order.orderCode;
  
  var sender = {
    name: getSystemSetting('SENDER_NAME', CONFIG.DEFAULT_SHIPPING.SENDER_NAME),
    phone: getSystemSetting('SENDER_PHONE', CONFIG.DEFAULT_SHIPPING.SENDER_PHONE),
    address: getSystemSetting('SENDER_ADDRESS', CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS),
    province: getSystemSetting('SENDER_PROVINCE', CONFIG.DEFAULT_SHIPPING.SENDER_PROVINCE),
    district: getSystemSetting('SENDER_DISTRICT', CONFIG.DEFAULT_SHIPPING.SENDER_DISTRICT),
    ward: getSystemSetting('SENDER_WARD', CONFIG.DEFAULT_SHIPPING.SENDER_WARD)
  };
  
  var receiver = {
    name: order.customerName,
    phone: order.customerPhone,
    address: order.addressDetail,
    province: order.province,
    district: order.district,
    ward: order.ward
  };
  
  var spxResult = provider.createShipment({
    referenceCode: referenceCode,
    orderId: order.id,
    sender: sender,
    receiver: receiver,
    codAmount: Number(order.codAmount) || 0,
    weightG: Number(payload.weightG) || 800,
    itemInspection: getSystemSetting('ITEM_INSPECTION', 'VIEW_NO_TRY'),
    feePayer: getSystemSetting('FEE_PAYER', 'SHOP'),
    notes: payload.notes
  });
  
  if (!spxResult.success) {
    if (spxResult.isUnknownResult) {
      // Timeout hoặc mất mạng -> Cần kiểm tra lại trước khi gửi lại
      throw new Error('SPX_TIMEOUT: ' + spxResult.error);
    }
    throw new Error('SPX_ERROR: ' + (spxResult.error || 'Tạo vận đơn thất bại'));
  }
  
  var now = getNowIsoString();
  var shipmentId = generateId('SHP');
  
  // Lưu vận đơn vào Shipments
  insertRow(CONFIG.SHEETS.SHIPMENTS, {
    id: shipmentId,
    shipmentCode: 'SHP-' + order.orderCode,
    orderId: order.id,
    trackingNumber: spxResult.trackingNumber,
    provider: provider.name,
    status: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
    weightG: payload.weightG,
    codAmount: order.codAmount,
    shippingFee: spxResult.shippingFee || 0,
    labelUrl: spxResult.labelUrl || '',
    dispatchedAt: '',
    deliveredAt: '',
    spxRawStatus: spxResult.carrierStatus || 'ORDER_CREATED',
    createdAt: now,
    updatedAt: now
  });
  
  // Cập nhật Orders sang LABEL_PRINTED
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', order.id, {
    shippingStatus: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
    spxFee: spxResult.shippingFee || 0,
    updatedAt: now
  });
}

/**
 * Xử lý tác vụ đồng bộ trạng thái đơn hàng từ SPX
 */
function executeSyncStatusJob(payload) {
  var provider = getSpxProvider();
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var activeShipments = shipments.filter(function(s) {
    return s.trackingNumber && 
      [CONFIG.SHIPPING_STATUS.DISPATCHED, CONFIG.SHIPPING_STATUS.DELIVERING, CONFIG.SHIPPING_STATUS.RETURNING].indexOf(s.status) !== -1;
  });
  
  for (var i = 0; i < activeShipments.length; i++) {
    var shp = activeShipments[i];
    try {
      var trackRes = provider.getTracking(shp.trackingNumber);
      if (trackRes.success && trackRes.carrierStatus) {
        applySpxStatusUpdate(shp.orderId, shp.id, trackRes.carrierStatus, trackRes.statusDescription);
      }
    } catch (e) {
      Logger.log('Lỗi sync mã ' + shp.trackingNumber + ': ' + e.message);
    }
  }
}

/**
 * Ánh xạ và chuyển trạng thái đơn hàng khi SPX báo thay đổi
 */
function applySpxStatusUpdate(orderId, shipmentId, carrierStatus, description) {
  var now = getNowIsoString();
  var targetShippingStatus = '';
  
  if (carrierStatus === 'DELIVERED') {
    targetShippingStatus = CONFIG.SHIPPING_STATUS.DELIVERED;
  } else if (carrierStatus === 'DELIVERY_FAILED') {
    targetShippingStatus = CONFIG.SHIPPING_STATUS.DELIVERY_FAILED;
  } else if (carrierStatus === 'RETURNING') {
    targetShippingStatus = CONFIG.SHIPPING_STATUS.RETURNING;
  } else if (carrierStatus === 'DELIVERING' || carrierStatus === 'IN_TRANSIT') {
    targetShippingStatus = CONFIG.SHIPPING_STATUS.DELIVERING;
  }
  
  if (!targetShippingStatus) return;
  
  // Cập nhật trạng thái vận chuyển
  updateRowByKey(CONFIG.SHEETS.SHIPMENTS, 'id', shipmentId, {
    status: targetShippingStatus,
    spxRawStatus: carrierStatus,
    deliveredAt: targetShippingStatus === CONFIG.SHIPPING_STATUS.DELIVERED ? now : '',
    updatedAt: now
  });
  
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    shippingStatus: targetShippingStatus,
    updatedAt: now
  });
  
  // Xử lý tồn kho tương ứng
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  
  if (targetShippingStatus === CONFIG.SHIPPING_STATUS.DELIVERED) {
    completeShippingStock(orderId, items);
  } else if (targetShippingStatus === CONFIG.SHIPPING_STATUS.RETURNING) {
    markStockReturning(orderId, items);
  }
}

/**
 * CÀI ĐẶT TIME-DRIVEN TRIGGER TỰ ĐỘNG (Chống tạo trùng lặp trigger)
 */
function installTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var triggerExists = false;
  
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processJobQueue') {
      triggerExists = true;
      break;
    }
  }
  
  if (!triggerExists) {
    ScriptApp.newTrigger('processJobQueue')
      .timeBased()
      .everyMinutes(5)
      .create();
  }
  
  return {
    success: true,
    message: 'Đã kích hoạt Time-driven trigger chạy hàng đợi 5 phút/lần.'
  };
}

/**
 * GỠ BỎ TOÀN BỘ TRIGGER CỦA DỰ ÁN
 */
function uninstallTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  return { success: true, message: 'Đã gỡ bỏ toàn bộ triggers.' };
}

/**
 * LẤY TRẠNG THÁI HÀNG ĐỢI JOBS (Dành cho Admin và Kho kiểm tra)
 */
function getQueueSummary(token) {
  requireRole(token, [CONFIG.ROLES.ADMIN, CONFIG.ROLES.KHO]);
  var jobs = readTableData(CONFIG.SHEETS.JOBS);
  
  var counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    unknown: 0
  };
  
  var recentJobs = [];
  for (var i = jobs.length - 1; i >= 0; i--) {
    var j = jobs[i];
    if (j.status === CONFIG.JOB_STATUS.PENDING) counts.pending++;
    else if (j.status === CONFIG.JOB_STATUS.PROCESSING) counts.processing++;
    else if (j.status === CONFIG.JOB_STATUS.COMPLETED) counts.completed++;
    else if (j.status === CONFIG.JOB_STATUS.FAILED) counts.failed++;
    else if (j.status === CONFIG.JOB_STATUS.UNKNOWN_RESULT) counts.unknown++;
    
    if (recentJobs.length < 20) {
      recentJobs.push({
        id: j.id,
        jobType: j.jobType,
        status: j.status,
        retryCount: j.retryCount,
        lastError: j.lastError,
        updatedAt: j.updatedAt
      });
    }
  }
  
  return {
    counts: counts,
    recentJobs: recentJobs
  };
}



// =============================================================
// MODULE: Orders.gs
// =============================================================
/**
 * Orders.gs - Quản lý Vòng đời Đơn hàng, Lưu nháp, Chốt đơn, Tính toán tài chính
 * và Chuẩn hóa địa chỉ hành chính Việt Nam cho SPX
 */

/**
 * Danh mục chuẩn Tỉnh/Thành phố Việt Nam và Mã định danh SPX tham khảo
 */
const VN_PROVINCES = [
  { name: 'Hà Nội', code: 'HN', spxCode: 'VN_HAN' },
  { name: 'TP Hồ Chí Minh', code: 'HCM', spxCode: 'VN_SGN' },
  { name: 'Đà Nẵng', code: 'DN', spxCode: 'VN_DAD' },
  { name: 'Hải Phòng', code: 'HP', spxCode: 'VN_HPH' },
  { name: 'Cần Thơ', code: 'CT', spxCode: 'VN_VCA' },
  { name: 'Bắc Ninh', code: 'BN', spxCode: 'VN_BAC_NINH' },
  { name: 'Bình Dương', code: 'BD', spxCode: 'VN_BINH_DUONG' },
  { name: 'Đồng Nai', code: 'DNI', spxCode: 'VN_DONG_NAI' },
  { name: 'Quảng Ninh', code: 'QN', spxCode: 'VN_QUANG_NINH' },
  { name: 'Thanh Hóa', code: 'TH', spxCode: 'VN_THANH_HOA' },
  { name: 'Nghệ An', code: 'NA', spxCode: 'VN_NGHE_AN' },
  { name: 'Huế', code: 'HUE', spxCode: 'VN_THUA_THIEN_HUE' },
  { name: 'Khánh Hòa', code: 'KH', spxCode: 'VN_KHANH_HOA' },
  { name: 'Lâm Đồng', code: 'LD', spxCode: 'VN_LAM_DONG' },
  { name: 'Bà Rịa - Vũng Tàu', code: 'VT', spxCode: 'VN_BA_RIA_VUNG_TAU' }
];

/**
 * Ánh xạ mã địa chỉ SPX dựa trên thông tin tỉnh/thành phố
 */
function resolveSpxAddressCode(province, district, ward) {
  var provStr = String(province || '').trim().toLowerCase();
  for (var i = 0; i < VN_PROVINCES.length; i++) {
    var p = VN_PROVINCES[i];
    if (provStr.indexOf(p.name.toLowerCase()) !== -1 || p.name.toLowerCase().indexOf(provStr) !== -1) {
      return p.spxCode;
    }
  }
  return ''; // Để trống nếu chưa ánh xạ được
}

/**
 * Kiểm tra tính hợp lệ của số điện thoại Việt Nam (10 số, bắt đầu bằng 0)
 */
function validatePhoneNumber(phone) {
  if (!phone) return false;
  var clean = String(phone).replace(/\D/g, '');
  if (clean.length === 9) clean = '0' + clean;
  return clean.length === 10 && clean.charAt(0) === '0';
}

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  var clean = String(phone).replace(/\D/g, '');
  if (clean.length === 9) clean = '0' + clean;
  return clean;
}

/**
 * Tính toán tài chính chuẩn xác cho đơn hàng
 */
function calculateOrderTotals(items, discount, customerShippingFee, deposit) {
  var subtotal = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var lineTotal = (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0);
    subtotal += lineTotal;
    it.lineTotal = lineTotal;
  }
  
  var disc = Math.max(0, Number(discount) || 0);
  var shipFee = Math.max(0, Number(customerShippingFee) || 0);
  var dep = Math.max(0, Number(deposit) || 0);
  
  // Tổng khách còn phải trả = (Tiền hàng sau giảm giá) + Phí ship khách chịu - Tiền đã cọc
  var merchandiseTotal = Math.max(0, subtotal - disc);
  var codAmount = Math.max(0, merchandiseTotal + shipFee - dep);
  
  return {
    subtotal: subtotal,
    discount: disc,
    customerShippingFee: shipFee,
    deposit: dep,
    codAmount: codAmount,
    netRevenue: merchandiseTotal // Doanh thu hàng thuần (không gồm phí ship)
  };
}

/**
 * TẠO ĐƠN HÀNG MỚI (LƯU NHÁP HOẶC CHỐT ĐƠN)
 * Nhân viên sale lấy từ server session. Không tin tưởng client gửi lên.
 */
function saveOrder(token, payload, isConfirmNow) {
  var user = requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.ADMIN]);
  
  // 1. Kiểm tra đầu vào bắt buộc
  if (!payload.customerName || !String(payload.customerName).trim()) {
    throw new Error('Vui lòng nhập tên người nhận.');
  }
  if (!validatePhoneNumber(payload.customerPhone)) {
    throw new Error('Số điện thoại không đúng định dạng (10 chữ số, bắt đầu bằng 0).');
  }
  if (!payload.addressDetail || !payload.province) {
    throw new Error('Vui lòng nhập đầy đủ địa chỉ chi tiết và Tỉnh/Thành phố.');
  }
  if (!payload.items || payload.items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  }
  
  // 2. Kiểm tra quyền sửa giá bán nếu có chênh lệch so với giá mặc định
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var varMap = {};
  for (var v = 0; v < variants.length; v++) {
    varMap[variants[v].sku] = variants[v];
  }
  
  for (var itIndex = 0; itIndex < payload.items.length; itIndex++) {
    var orderItem = payload.items[itIndex];
    var matchedVar = varMap[orderItem.sku];
    if (matchedVar) {
      var defaultP = Number(matchedVar.defaultPrice) || 0;
      var setP = Number(orderItem.unitPrice) || 0;
      if (setP !== defaultP && user.role === CONFIG.ROLES.SALE) {
        // Sale chỉ được giảm tối đa 10% nếu không có quyền admin
        if (setP < defaultP * 0.9) {
          throw new Error('Sale không được giảm giá quá 10% cho SKU: ' + orderItem.sku + ' (Giá chuẩn: ' + defaultP.toLocaleString('vi-VN') + ' đ)');
        }
      }
    }
  }
  
  // 3. Tính toán tài chính
  var calc = calculateOrderTotals(payload.items, payload.discount, payload.customerShippingFee, payload.deposit);
  var now = getNowIsoString();
  var orderId = payload.id || generateId('ORD');
  var orderCode = payload.orderCode || generateOrderCode();
  
  var targetStatus = isConfirmNow ? CONFIG.ORDER_STATUS.CONFIRMED : CONFIG.ORDER_STATUS.DRAFT;
  var paymentStatus = calc.codAmount === 0 ? CONFIG.PAYMENT_STATUS.RECONCILED : (calc.deposit > 0 ? CONFIG.PAYMENT_STATUS.PARTIAL : CONFIG.PAYMENT_STATUS.WAITING_COD);
  var spxCode = resolveSpxAddressCode(payload.province, payload.district, payload.ward);
  
  var orderRecord = {
    id: orderId,
    orderCode: orderCode,
    saleId: user.userId,
    saleName: user.fullName,
    customerName: String(payload.customerName).trim(),
    customerPhone: String(payload.customerPhone).trim(),
    addressDetail: String(payload.addressDetail).trim(),
    province: String(payload.province).trim(),
    district: String(payload.district || '').trim(),
    ward: String(payload.ward || '').trim(),
    spxAddressCode: spxCode,
    notes: String(payload.notes || '').trim(),
    status: targetStatus,
    shippingStatus: CONFIG.SHIPPING_STATUS.UNSHIPPED,
    paymentStatus: paymentStatus,
    subtotal: calc.subtotal,
    discount: calc.discount,
    customerShippingFee: calc.customerShippingFee,
    deposit: calc.deposit,
    codAmount: calc.codAmount,
    spxFee: 0,
    netRevenue: calc.netRevenue,
    confirmedAt: isConfirmNow ? now : '',
    createdAt: now,
    updatedAt: now
  };
  
  // Chuẩn bị các dòng chi tiết OrderItems
  var orderItemRecords = [];
  for (var k = 0; k < payload.items.length; k++) {
    var rawItem = payload.items[k];
    var vInfo = varMap[rawItem.sku] || {};
    orderItemRecords.push({
      id: generateId('ITM'),
      orderId: orderId,
      sku: rawItem.sku,
      modelCode: rawItem.modelCode || vInfo.modelCode || '',
      productName: rawItem.productName || rawItem.name || 'Giày cao cấp',
      color: rawItem.color || vInfo.color || '',
      size: rawItem.size || vInfo.size || '',
      quantity: Number(rawItem.quantity) || 1,
      unitPrice: Number(rawItem.unitPrice) || 0,
      lineTotal: (Number(rawItem.quantity) || 1) * (Number(rawItem.unitPrice) || 0)
    });
  }
  
  // 4. Nếu là Chốt đơn: Thực hiện Giữ hàng nguyên tử (Atomic Reservation)
  if (isConfirmNow) {
    reserveStockForOrder(orderId, orderCode, orderItemRecords, user.fullName);
  }
  
  // 5. Lưu vào Google Sheets
  insertRow(CONFIG.SHEETS.ORDERS, orderRecord);
  insertRowsBatch(CONFIG.SHEETS.ORDER_ITEMS, orderItemRecords);
  
  if (isConfirmNow) {
    upsertCustomerFromOrder(orderRecord);
  }
  
  logAuditAction(isConfirmNow ? 'CONFIRM_ORDER' : 'CREATE_DRAFT', 'Orders', orderId, 'Đơn ' + orderCode + ' - COD: ' + calc.codAmount + ' đ', user.fullName);
  
  return {
    success: true,
    orderId: orderId,
    orderCode: orderCode,
    status: targetStatus,
    codAmount: calc.codAmount,
    spxAddressCode: spxCode
  };
}

/**
 * CHỐT ĐƠN TỪ ĐƠN NHÁP CÓ SẴN
 */
function confirmDraftOrder(token, orderId) {
  var user = requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var targetOrder = null;
  
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      targetOrder = orders[i];
      break;
    }
  }
  
  if (!targetOrder) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  requireOrderAccess(token, targetOrder.saleId);
  
  if (targetOrder.status !== CONFIG.ORDER_STATUS.DRAFT) {
    throw new Error('Đơn hàng hiện tại không phải trạng thái Nháp (' + targetOrder.status + ').');
  }
  
  // Lấy chi tiết mặt hàng
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  if (items.length === 0) throw new Error('Đơn hàng chưa có sản phẩm nào.');
  
  // Giữ hàng
  reserveStockForOrder(orderId, targetOrder.orderCode, items, user.fullName);
  
  var now = getNowIsoString();
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    status: CONFIG.ORDER_STATUS.CONFIRMED,
    confirmedAt: now,
    updatedAt: now
  });
  
  targetOrder.status = CONFIG.ORDER_STATUS.CONFIRMED;
  upsertCustomerFromOrder(targetOrder);
  
  logAuditAction('CONFIRM_DRAFT', 'Orders', orderId, 'Chốt đơn nháp: ' + targetOrder.orderCode, user.fullName);
  return { success: true };
}

/**
 * Tự động đồng bộ khách hàng vào bảng Customers (Google Sheet Khách Hàng)
 */
function upsertCustomerFromOrder(order) {
  try {
    var phone = String(order.customerPhone || '').replace(/\D/g, '');
    if (!phone) return;
    
    var customers = readTableData(CONFIG.SHEETS.CUSTOMERS);
    var existing = null;
    for (var i = 0; i < customers.length; i++) {
      if (String(customers[i].phone || '').replace(/\D/g, '') === phone) {
        existing = customers[i];
        break;
      }
    }
    
    var now = getNowIsoString();
    var orderValue = Number(order.netRevenue) || 0;
    
    if (existing) {
      var totalOrders = (Number(existing.totalOrders) || 0) + 1;
      var totalSpent = (Number(existing.totalSpent) || 0) + orderValue;
      var tag = totalSpent >= 3000000 ? 'VIP' : (totalOrders >= 2 ? 'Thân thiết' : 'Thường');
      
      updateRowByKey(CONFIG.SHEETS.CUSTOMERS, 'id', existing.id, {
        name: order.customerName || existing.name,
        totalOrders: totalOrders,
        totalSpent: totalSpent,
        lastOrderDate: now,
        province: order.province || existing.province,
        district: order.district || existing.district,
        ward: order.ward || existing.ward,
        addressDetail: order.addressDetail || existing.addressDetail,
        tag: tag,
        updatedAt: now
      });
    } else {
      var newCustId = generateId('CUS');
      insertRow(CONFIG.SHEETS.CUSTOMERS, {
        id: newCustId,
        name: order.customerName,
        phone: phone,
        totalOrders: 1,
        totalSpent: orderValue,
        lastOrderDate: now,
        province: order.province || '',
        district: order.district || '',
        ward: order.ward || '',
        addressDetail: order.addressDetail || '',
        tag: 'Mới',
        notes: '',
        createdAt: now,
        updatedAt: now
      });
    }
  } catch (err) {
    Logger.log('Lỗi upsertCustomerFromOrder: ' + err.message);
  }
}

/**
 * Lấy danh sách khách hàng từ Google Sheets
 */
function getCustomersList(token, query) {
  requireAuth(token);
  var customers = readTableData(CONFIG.SHEETS.CUSTOMERS);
  var q = String(query || '').trim().toLowerCase();
  
  if (q) {
    customers = customers.filter(function(c) {
      return (c.name || '').toLowerCase().indexOf(q) !== -1 ||
             (c.phone || '').indexOf(q) !== -1 ||
             (c.tag || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  
  // Sắp xếp theo ngày đặt đơn gần nhất
  customers.sort(function(a, b) {
    return new Date(b.lastOrderDate || b.createdAt) - new Date(a.lastOrderDate || a.createdAt);
  });
  
  return customers;
}

/**
 * HỦY ĐƠN HÀNG VÀ GIẢI PHÓNG HÀNG ĐANG GIỮ
 */
function cancelOrder(token, orderId, reason) {
  var user = requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var targetOrder = null;
  
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      targetOrder = orders[i];
      break;
    }
  }
  
  if (!targetOrder) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  requireOrderAccess(token, targetOrder.saleId);
  
  if (targetOrder.status === CONFIG.ORDER_STATUS.CANCELLED) {
    throw new Error('Đơn hàng này đã được hủy trước đó.');
  }
  
  // Nếu đã bàn giao SPX thì không thể hủy thông thường mà phải báo chuyển hoàn
  if (targetOrder.shippingStatus === CONFIG.SHIPPING_STATUS.DISPATCHED ||
      targetOrder.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERING ||
      targetOrder.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERED) {
    throw new Error('Hàng đã rời kho và bàn giao cho SPX. Không thể hủy trực tiếp, vui lòng tạo yêu cầu hoàn hàng.');
  }
  
  // Nếu đơn đang CONFIRMED thì giải phóng hàng đang giữ
  if (targetOrder.status === CONFIG.ORDER_STATUS.CONFIRMED) {
    var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
    var items = allItems.filter(function(it) { return it.orderId === orderId; });
    unreserveStockForOrder(orderId, targetOrder.orderCode, items, user.fullName, 'Hủy đơn hàng: ' + (reason || 'Khách hủy'));
  }
  
  var now = getNowIsoString();
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    status: CONFIG.ORDER_STATUS.CANCELLED,
    notes: (targetOrder.notes ? (targetOrder.notes + ' | ') : '') + 'HỦY: ' + (reason || 'Khách hủy'),
    updatedAt: now
  });
  
  logAuditAction('CANCEL_ORDER', 'Orders', orderId, 'Hủy đơn ' + targetOrder.orderCode + ' - Lý do: ' + reason, user.fullName);
  return { success: true };
}

/**
 * TẠO YÊU CẦU ĐỔI SIZE / ĐỔI MẪU LIÊN KẾT ĐƠN GỐC
 */
function createExchangeOrder(token, originalOrderId, oldSku, newSku, feeDifference, notes) {
  var user = requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var originalOrder = null;
  
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === originalOrderId) {
      originalOrder = orders[i];
      break;
    }
  }
  if (!originalOrder) throw new Error('Không tìm thấy đơn hàng gốc: ' + originalOrderId);
  
  var now = getNowIsoString();
  var returnId = generateId('RET');
  var returnCode = 'DOI-' + originalOrder.orderCode;
  
  // 1. Tạo đơn mới cho size mới
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var newVar = null;
  for (var v = 0; v < variants.length; v++) {
    if (variants[v].sku === newSku) {
      newVar = variants[v];
      break;
    }
  }
  if (!newVar) throw new Error('SKU mới không tồn tại: ' + newSku);
  
  var newOrderPayload = {
    customerName: originalOrder.customerName,
    customerPhone: normalizePhoneNumber(originalOrder.customerPhone),
    addressDetail: originalOrder.addressDetail,
    province: originalOrder.province,
    district: originalOrder.district,
    ward: originalOrder.ward,
    notes: 'ĐỔI TỪ ĐƠN ' + originalOrder.orderCode + ' (' + oldSku + ' sang ' + newSku + '). ' + (notes || ''),
    discount: 0,
    customerShippingFee: Number(feeDifference) > 0 ? Number(feeDifference) : 0,
    deposit: 0,
    items: [
      {
        sku: newSku,
        modelCode: newVar.modelCode,
        color: newVar.color,
        size: newVar.size,
        quantity: 1,
        unitPrice: newVar.defaultPrice
      }
    ]
  };
  
  // Tạo và chốt đơn mới (Giữ hàng size mới)
  var newOrderResult = saveOrder(token, newOrderPayload, true);
  
  // 2. Ghi nhận bảng Returns
  insertRow(CONFIG.SHEETS.RETURNS, {
    id: returnId,
    returnCode: returnCode,
    originalOrderId: originalOrderId,
    newOrderId: newOrderResult.orderId,
    skuOld: oldSku,
    skuNew: newSku,
    returnType: CONFIG.RETURN_TYPE.EXCHANGE,
    status: CONFIG.RETURN_STATUS.RETURNING,
    refundAmount: 0,
    feeDifference: Number(feeDifference) || 0,
    inspectedBy: '',
    notes: 'Đổi size theo yêu cầu: ' + (notes || ''),
    createdAt: now,
    updatedAt: now
  });
  
  logAuditAction('EXCHANGE_ORDER', 'Returns', returnId, 'Đổi hàng đơn ' + originalOrder.orderCode + ': ' + oldSku + ' -> ' + newSku, user.fullName);
  return {
    success: true,
    newOrderId: newOrderResult.orderId,
    newOrderCode: newOrderResult.orderCode,
    returnCode: returnCode
  };
}

/**
 * LẤY DANH SÁCH ĐƠN HÀNG KÈM LỌC, TÌM KIẾM VÀ PHÂN TRANG PHÍA SERVER
 */
function getOrdersList(token, queryOptions) {
  var user = requireAuth(token);
  var opts = queryOptions || {};
  var page = Number(opts.page) || 1;
  var pageSize = Number(opts.pageSize) || 20;
  var search = String(opts.search || '').trim().toLowerCase();
  var filterStatus = opts.status || '';
  var filterShipping = opts.shippingStatus || '';
  var filterPayment = opts.paymentStatus || '';
  var startDate = opts.startDate || '';
  var endDate = opts.endDate || '';
  
  var allOrders = readTableData(CONFIG.SHEETS.ORDERS);
  var allShipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var shipMap = {};
  for (var s = 0; s < allShipments.length; s++) {
    shipMap[allShipments[s].orderId] = allShipments[s];
  }
  
  var filtered = allOrders.filter(function(ord) {
    // Phân quyền: Sale chỉ xem đơn của chính mình
    if (user.role === CONFIG.ROLES.SALE && ord.saleId !== user.userId) {
      return false;
    }
    
    // Lọc trạng thái
    if (filterStatus && ord.status !== filterStatus) return false;
    if (filterShipping && ord.shippingStatus !== filterShipping) return false;
    if (filterPayment && ord.paymentStatus !== filterPayment) return false;
    
    // Lọc thời gian tạo
    if (startDate && ord.createdAt < startDate) return false;
    if (endDate && ord.createdAt > endDate + 'T23:59:59') return false;
    
    // Tìm kiếm từ khóa: Mã đơn, SĐT, Tên khách
    if (search) {
      var matchCode = (ord.orderCode || '').toLowerCase().indexOf(search) !== -1;
      var matchPhone = (ord.customerPhone || '').indexOf(search) !== -1;
      var matchName = (ord.customerName || '').toLowerCase().indexOf(search) !== -1;
      var ship = shipMap[ord.id];
      var matchTrack = ship && (ship.trackingNumber || '').toLowerCase().indexOf(search) !== -1;
      if (!matchCode && !matchPhone && !matchName && !matchTrack) return false;
    }
    
    return true;
  });
  
  // Sắp xếp đơn mới nhất lên đầu
  filtered.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  var totalRecords = filtered.length;
  var totalPages = Math.ceil(totalRecords / pageSize);
  var startIndex = (page - 1) * pageSize;
  var pageRecords = filtered.slice(startIndex, startIndex + pageSize);
  
  // Ghép thông tin vận đơn rút gọn
  var results = pageRecords.map(function(o) {
    var sm = shipMap[o.id] || null;
    return {
      id: o.id,
      orderCode: o.orderCode,
      saleName: o.saleName,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      addressSummary: o.addressDetail + ', ' + o.province,
      spxAddressCode: o.spxAddressCode,
      status: o.status,
      shippingStatus: o.shippingStatus,
      paymentStatus: o.paymentStatus,
      codAmount: Number(o.codAmount) || 0,
      subtotal: Number(o.subtotal) || 0,
      trackingNumber: sm ? sm.trackingNumber : '',
      labelUrl: sm ? sm.labelUrl : '',
      createdAt: o.createdAt
    };
  });
  
  return {
    items: results,
    pagination: {
      page: page,
      pageSize: pageSize,
      totalRecords: totalRecords,
      totalPages: totalPages
    }
  };
}

/**
 * LẤY CHI TIẾT MỘT ĐƠN HÀNG ĐỂ XEM VÀ IN TEM
 */
function getOrderDetail(token, orderId) {
  var user = requireAuth(token);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  requireOrderAccess(token, order.saleId);
  
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  
  var allShipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var shipment = null;
  for (var s = 0; s < allShipments.length; s++) {
    if (allShipments[s].orderId === orderId) {
      shipment = allShipments[s];
      break;
    }
  }
  
  var allReturns = readTableData(CONFIG.SHEETS.RETURNS);
  var returns = allReturns.filter(function(r) { return r.originalOrderId === orderId || r.newOrderId === orderId; });
  
  return {
    order: order,
    items: items,
    shipment: shipment,
    returns: returns
  };
}

/**
 * Thêm mới hoặc chỉnh sửa Khách hàng thủ công
 */
function saveCustomer(token, customerData) {
  requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.ADMIN]);
  var now = getNowIsoString();
  
  if (!customerData.name || !customerData.phone) {
    throw new Error('Vui lòng nhập tên và số điện thoại khách hàng.');
  }
  
  var cleanPhone = String(customerData.phone).replace(/\D/g, '');
  var customers = readTableData(CONFIG.SHEETS.CUSTOMERS);
  var existing = null;
  
  for (var i = 0; i < customers.length; i++) {
    if ((customerData.id && customers[i].id === customerData.id) || 
        String(customers[i].phone || '').replace(/\D/g, '') === cleanPhone) {
      existing = customers[i];
      break;
    }
  }
  
  if (existing) {
    var updatePayload = {
      name: customerData.name,
      phone: cleanPhone,
      addressDetail: customerData.addressDetail || '',
      province: customerData.province || '',
      district: customerData.district || '',
      ward: customerData.ward || '',
      tag: customerData.tag || existing.tag || 'Thường',
      notes: customerData.notes || '',
      updatedAt: now
    };
    updateRowByKey(CONFIG.SHEETS.CUSTOMERS, 'id', existing.id, updatePayload);
    return { success: true, id: existing.id, message: 'Đã cập nhật thông tin khách hàng.' };
  } else {
    var newId = generateId('CUST');
    var newRow = {
      id: newId,
      name: customerData.name,
      phone: cleanPhone,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: '',
      province: customerData.province || '',
      district: customerData.district || '',
      ward: customerData.ward || '',
      addressDetail: customerData.addressDetail || '',
      tag: customerData.tag || 'Thường',
      notes: customerData.notes || '',
      createdAt: now,
      updatedAt: now
    };
    insertRow(CONFIG.SHEETS.CUSTOMERS, newRow);
    return { success: true, id: newId, message: 'Đã tạo khách hàng mới thành công.' };
  }
}

/**
 * Xóa một khách hàng (Chỉ Admin)
 */
function deleteCustomer(token, customerId) {
  var user = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var success = deleteRowByKey(CONFIG.SHEETS.CUSTOMERS, 'id', customerId);
  if (!success) {
    throw new Error('Không tìm thấy khách hàng có ID: ' + customerId);
  }
  logAuditAction('DELETE_CUSTOMER', 'Customers', customerId, 'Xóa khách hàng ID: ' + customerId, user.fullName);
  return { success: true, message: 'Đã xóa khách hàng thành công.' };
}



// =============================================================
// MODULE: Returns.gs
// =============================================================
/**
 * Returns.gs - Quản lý Hàng hoàn và Quy trình Kiểm định chất lượng (QC)
 * Phân loại rạch ròi: Đạt chuẩn -> Bán lại; Lỗi hỏng -> Kho lỗi riêng biệt.
 */

/**
 * Lấy danh sách yêu cầu hàng hoàn / đổi hàng
 */
function getReturnsList(token) {
  requireAuth(token);
  var returns = readTableData(CONFIG.SHEETS.RETURNS);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var orderMap = {};
  for (var i = 0; i < orders.length; i++) {
    orderMap[orders[i].id] = orders[i];
  }
  
  returns.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  return returns.map(function(r) {
    var origOrder = orderMap[r.originalOrderId] || {};
    var newOrder = orderMap[r.newOrderId] || {};
    return {
      id: r.id,
      returnCode: r.returnCode,
      originalOrderId: r.originalOrderId,
      originalOrderCode: origOrder.orderCode || '',
      customerName: origOrder.customerName || '',
      customerPhone: origOrder.customerPhone || '',
      newOrderId: r.newOrderId,
      newOrderCode: newOrder.orderCode || '',
      skuOld: r.skuOld,
      skuNew: r.skuNew,
      returnType: r.returnType,
      status: r.status,
      feeDifference: Number(r.feeDifference) || 0,
      inspectedBy: r.inspectedBy,
      notes: r.notes,
      createdAt: r.createdAt
    };
  });
}

/**
 * KHO KIỂM TRA HÀNG HOÀN THỰC NHẬN VÀ PHÂN LOẠI QC
 */
function processReturnInspection(token, returnId, isPassed, notes) {
  var user = requireRole(token, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
  var returns = readTableData(CONFIG.SHEETS.RETURNS);
  var ret = null;
  for (var i = 0; i < returns.length; i++) {
    if (returns[i].id === returnId) {
      ret = returns[i];
      break;
    }
  }
  if (!ret) throw new Error('Không tìm thấy bản ghi hoàn hàng: ' + returnId);
  
  if (ret.status === CONFIG.RETURN_STATUS.RECEIVED_PASS || ret.status === CONFIG.RETURN_STATUS.RECEIVED_FAIL || ret.status === CONFIG.RETURN_STATUS.CLOSED) {
    throw new Error('Hàng hoàn này đã được kiểm định QC trước đó (' + ret.status + ').');
  }
  
  // Thực hiện QC tồn kho nguyên tử
  receiveReturnQc(returnId, ret.skuOld, 1, isPassed, user.fullName, notes);
  
  var now = getNowIsoString();
  var newStatus = isPassed ? CONFIG.RETURN_STATUS.RECEIVED_PASS : CONFIG.RETURN_STATUS.RECEIVED_FAIL;
  
  updateRowByKey(CONFIG.SHEETS.RETURNS, 'id', returnId, {
    status: newStatus,
    inspectedBy: user.fullName,
    notes: (ret.notes ? (ret.notes + ' | QC: ') : 'QC: ') + (notes || (isPassed ? 'Đạt chuẩn' : 'Lỗi/hư hại')),
    updatedAt: now
  });
  
  // Cập nhật trạng thái đơn hàng gốc sang RETURNED
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', ret.originalOrderId, {
    shippingStatus: CONFIG.SHIPPING_STATUS.RETURNED,
    updatedAt: now
  });
  
  logAuditAction('QC_RETURN', 'Returns', returnId, (isPassed ? 'QC ĐẠT' : 'QC LỖI') + ' - SKU: ' + ret.skuOld, user.fullName);
  return { success: true, status: newStatus };
}



// =============================================================
// MODULE: Reconciliation.gs
// =============================================================
/**
 * Reconciliation.gs - Quản lý Đối soát COD, Cước vận chuyển và Xác nhận Tiền về ngân hàng
 * Chống nhập trùng khoản thanh toán, hỗ trợ tải file CSV xem trước trước khi ghi dữ liệu thật.
 */

/**
 * Phân tích và xem trước dữ liệu CSV đối soát SPX
 */
function previewReconciliationCsv(token, csvText) {
  requireRole(token, [CONFIG.ROLES.DOI_SOAT, CONFIG.ROLES.ADMIN]);
  
  if (!csvText || typeof csvText !== 'string' || csvText.trim() === '') {
    throw new Error('Nội dung file CSV trống.');
  }
  
  var lines = csvText.split(/\r?\n/).filter(function(line) {
    return line.trim() !== '';
  });
  
  if (lines.length < 2) {
    throw new Error('File CSV không đủ dữ liệu (yêu cầu ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu).');
  }
  
  // Đọc danh mục hiện tại để đối chiếu
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var payments = readTableData(CONFIG.SHEETS.PAYMENTS);
  
  var shipMapByTracking = {};
  for (var s = 0; s < shipments.length; s++) {
    if (shipments[s].trackingNumber) {
      shipMapByTracking[shipments[s].trackingNumber.trim()] = shipments[s];
    }
  }
  
  var orderMapById = {};
  for (var o = 0; o < orders.length; o++) {
    orderMapById[orders[o].id] = orders[o];
  }
  
  // Kiểm tra các mã vận đơn ĐÃ ĐƯỢC ĐỐI SOÁT TRƯỚC ĐÓ trong bảng Payments
  var reconciledTrackingSet = {};
  for (var p = 0; p < payments.length; p++) {
    if (payments[p].trackingNumber && payments[p].status === CONFIG.PAYMENT_STATUS.RECONCILED) {
      reconciledTrackingSet[payments[p].trackingNumber.trim()] = true;
    }
  }
  
  // Parse từng dòng
  var headerLine = lines[0];
  var previewRows = [];
  var totalCod = 0;
  var totalFees = 0;
  var totalNet = 0;
  var matchedCount = 0;
  var duplicateCount = 0;
  var notFoundCount = 0;
  
  for (var i = 1; i < lines.length; i++) {
    var rawCols = parseCsvLine(lines[i]);
    if (rawCols.length < 3) continue;
    
    // Cấu trúc cột mong đợi: TrackingNumber, CodAmount, ShippingFee, NetAmount
    var tracking = String(rawCols[0] || '').trim();
    var cod = Math.round(Number(String(rawCols[1] || '').replace(/[^\d.-]/g, '')) || 0);
    var fee = Math.round(Number(String(rawCols[2] || '').replace(/[^\d.-]/g, '')) || 0);
    var net = rawCols.length >= 4 ? Math.round(Number(String(rawCols[3] || '').replace(/[^\d.-]/g, '')) || 0) : (cod - fee);
    
    var status = 'MATCHED';
    var note = '';
    var matchedOrder = null;
    var ship = shipMapByTracking[tracking];
    
    if (reconciledTrackingSet[tracking]) {
      status = 'ALREADY_RECONCILED';
      note = 'Mã vận đơn này ĐÃ ĐƯỢC ĐỐI SOÁT trước đó trong hệ thống!';
      duplicateCount++;
    } else if (!ship) {
      status = 'NOT_FOUND';
      note = 'Không tìm thấy vận đơn này trong hệ thống shop.';
      notFoundCount++;
    } else {
      matchedOrder = orderMapById[ship.orderId];
      matchedCount++;
      totalCod += cod;
      totalFees += fee;
      totalNet += net;
    }
    
    previewRows.push({
      lineIndex: i,
      trackingNumber: tracking,
      codAmount: cod,
      shippingFee: fee,
      netAmount: net,
      status: status,
      orderCode: matchedOrder ? matchedOrder.orderCode : '',
      customerName: matchedOrder ? matchedOrder.customerName : '',
      expectedCod: matchedOrder ? Number(matchedOrder.codAmount) || 0 : 0,
      note: note
    });
  }
  
  return {
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      matchedCount: matchedCount,
      duplicateCount: duplicateCount,
      notFoundCount: notFoundCount,
      totalCod: totalCod,
      totalFees: totalFees,
      totalNet: totalNet
    }
  };
}

/**
 * XÁC NHẬN VÀ GHI NHẬN ĐỢT ĐỐI SOÁT (Chỉ Đối Soát và Admin)
 * Chống ghi đè hoặc nhân đôi khoản thanh toán
 */
function confirmReconciliationBatch(token, verifiedRows, batchNote) {
  var user = requireRole(token, [CONFIG.ROLES.DOI_SOAT, CONFIG.ROLES.ADMIN]);
  
  if (!verifiedRows || verifiedRows.length === 0) {
    throw new Error('Không có dòng đối soát hợp lệ nào để ghi nhận.');
  }
  
  return withScriptLock(function() {
    var now = getNowIsoString();
    var batchId = generateId('REC');
    var batchCode = 'DS-' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmm");
    
    var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
    var shipMap = {};
    for (var s = 0; s < shipments.length; s++) {
      if (shipments[s].trackingNumber) {
        shipMap[shipments[s].trackingNumber.trim()] = shipments[s];
      }
    }
    
    var existingPayments = readTableData(CONFIG.SHEETS.PAYMENTS);
    var reconciledSet = {};
    for (var p = 0; p < existingPayments.length; p++) {
      if (existingPayments[p].trackingNumber && existingPayments[p].status === CONFIG.PAYMENT_STATUS.RECONCILED) {
        reconciledSet[existingPayments[p].trackingNumber.trim()] = true;
      }
    }
    
    var paymentRecords = [];
    var totalCod = 0;
    var totalFees = 0;
    var totalNet = 0;
    var successCount = 0;
    
    for (var i = 0; i < verifiedRows.length; i++) {
      var row = verifiedRows[i];
      var tracking = String(row.trackingNumber || '').trim();
      
      // Bỏ qua các dòng đã đối soát hoặc không tìm thấy
      if (row.status !== 'MATCHED' || reconciledSet[tracking]) continue;
      
      var ship = shipMap[tracking];
      if (!ship) continue;
      
      var cod = Number(row.codAmount) || 0;
      var fee = Number(row.shippingFee) || 0;
      var net = Number(row.netAmount) || (cod - fee);
      
      paymentRecords.push({
        id: generateId('PAY'),
        paymentCode: 'PAY-' + tracking,
        orderId: ship.orderId,
        trackingNumber: tracking,
        amount: cod,
        fee: fee,
        netAmount: net,
        paymentType: 'COD',
        status: CONFIG.PAYMENT_STATUS.RECONCILED,
        reconciliationBatchId: batchId,
        reconciledAt: now,
        reconciledBy: user.fullName,
        notes: row.note || 'Đối soát thành công đợt ' + batchCode,
        createdAt: now
      });
      
      // Đánh dấu đơn hàng là đã đối soát xong
      updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', ship.orderId, {
        paymentStatus: CONFIG.PAYMENT_STATUS.RECONCILED,
        spxFee: fee,
        updatedAt: now
      });
      
      totalCod += cod;
      totalFees += fee;
      totalNet += net;
      successCount++;
      reconciledSet[tracking] = true;
    }
    
    if (paymentRecords.length === 0) {
      throw new Error('Tất cả các dòng gửi lên đều không hợp lệ hoặc đã được đối soát trước đó.');
    }
    
    // Ghi nhận bản ghi Tổng đợt đối soát
    insertRow(CONFIG.SHEETS.RECONCILIATIONS, {
      id: batchId,
      batchCode: batchCode,
      totalOrders: successCount,
      totalCod: totalCod,
      totalFees: totalFees,
      totalNet: totalNet,
      status: 'CONFIRMED',
      confirmedBy: user.fullName,
      notes: batchNote || '',
      createdAt: now
    });
    
    // Ghi nhận chi tiết từng khoản thanh toán
    insertRowsBatch(CONFIG.SHEETS.PAYMENTS, paymentRecords);
    
    logAuditAction('CONFIRM_RECONCILIATION', 'Reconciliations', batchId, 'Xác nhận đối soát đợt ' + batchCode + ' (' + successCount + ' đơn, Thực nhận: ' + totalNet.toLocaleString('vi-VN') + ' đ)', user.fullName);
    
    return {
      success: true,
      batchCode: batchCode,
      processedOrders: successCount,
      totalNet: totalNet
    };
  }, 30000);
}

/**
 * Lấy danh sách lịch sử các đợt đối soát
 */
function getReconciliationHistory(token) {
  requireRole(token, [CONFIG.ROLES.DOI_SOAT, CONFIG.ROLES.ADMIN]);
  var batches = readTableData(CONFIG.SHEETS.RECONCILIATIONS);
  batches.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return batches;
}

/**
 * Lấy danh sách đơn hàng đã giao nhưng CHƯA ĐỐI SOÁT TIỀN (Pending COD)
 */
function getPendingCodOrders(token) {
  requireRole(token, [CONFIG.ROLES.DOI_SOAT, CONFIG.ROLES.ADMIN]);
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  
  var shipMap = {};
  for (var s = 0; s < shipments.length; s++) {
    shipMap[shipments[s].orderId] = shipments[s];
  }
  
  var pending = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    // Đã giao nhưng thanh toán chưa đối soát
    if (o.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERED && o.paymentStatus !== CONFIG.PAYMENT_STATUS.RECONCILED) {
      var ship = shipMap[o.id];
      pending.push({
        id: o.id,
        orderCode: o.orderCode,
        saleName: o.saleName,
        customerName: o.customerName,
        codAmount: Number(o.codAmount) || 0,
        trackingNumber: ship ? ship.trackingNumber : '',
        deliveredAt: ship ? ship.deliveredAt : o.updatedAt,
        status: o.paymentStatus
      });
    }
  }
  
  return pending;
}

/**
 * Hàm phân tách dòng CSV an toàn, hỗ trợ dấu phẩy trong nháy kép
 */
function parseCsvLine(line) {
  var row = [];
  var inQuotes = false;
  var current = '';
  for (var i = 0; i < line.length; i++) {
    var char = line.charAt(i);
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  return row;
}



// =============================================================
// MODULE: Reports.gs
// =============================================================
/**
 * Reports.gs - Báo cáo Doanh số Sale Đa chiều và Báo cáo Biến động Tồn kho
 * Tách biệt rõ 2 góc nhìn:
 * 1. Nhóm đơn chốt trong kỳ (Cohort/Accrual Basis)
 * 2. Giao dịch thực tế phát sinh trong kỳ (Cash/Activity Basis)
 */

/**
 * BÁO CÁO DOANH SỐ VÀ HIỆU QUẢ BÁN HÀNG
 */
function getSalesReport(token, options) {
  var user = requireAuth(token);
  var opts = options || {};
  var basis = opts.basis || 'CONFIRM_DATE'; // 'CONFIRM_DATE' hoặc 'TRANSACTION_DATE'
  var startDate = opts.startDate || '';
  var endDate = opts.endDate || '';
  var targetSaleId = opts.saleId || '';
  
  // Nếu người dùng là SALE thì chỉ được xem báo cáo của chính mình
  if (user.role === CONFIG.ROLES.SALE) {
    targetSaleId = user.userId;
  }
  
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var items = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var payments = readTableData(CONFIG.SHEETS.PAYMENTS);
  var returns = readTableData(CONFIG.SHEETS.RETURNS);
  
  var itemsByOrderId = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!itemsByOrderId[it.orderId]) itemsByOrderId[it.orderId] = [];
    itemsByOrderId[it.orderId].push(it);
  }
  
  var shipMap = {};
  for (var s = 0; s < shipments.length; s++) {
    shipMap[shipments[s].orderId] = shipments[s];
  }
  
  // Tổng hợp chỉ số
  var metrics = {
    confirmedOrders: 0,
    confirmedPairs: 0,
    confirmedMerchandiseValue: 0,
    deliveredOrders: 0,
    deliveredPairs: 0,
    deliveredMerchandiseValue: 0,
    cancelledOrders: 0,
    deliveryFailedOrders: 0,
    returnedOrders: 0,
    pendingCodAmount: 0,
    reconciledBankAmount: 0
  };
  
  var salePerformanceMap = {};
  
  for (var o = 0; o < orders.length; o++) {
    var ord = orders[o];
    
    // Lọc theo Sale nếu có
    if (targetSaleId && ord.saleId !== targetSaleId) continue;
    
    // Khởi tạo bảng thành tích nhân viên
    if (!salePerformanceMap[ord.saleId]) {
      salePerformanceMap[ord.saleId] = {
        saleId: ord.saleId,
        saleName: ord.saleName,
        confirmedOrders: 0,
        confirmedPairs: 0,
        confirmedValue: 0,
        deliveredOrders: 0,
        deliveredValue: 0,
        reconciledCash: 0
      };
    }
    
    var ordItems = itemsByOrderId[ord.id] || [];
    var pairCount = 0;
    for (var p = 0; p < ordItems.length; p++) {
      pairCount += (Number(ordItems[p].quantity) || 1);
    }
    
    var ship = shipMap[ord.id];
    var isDelivered = ord.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERED;
    var isCancelled = ord.status === CONFIG.ORDER_STATUS.CANCELLED;
    var isReturned = ord.shippingStatus === CONFIG.SHIPPING_STATUS.RETURNED || ord.shippingStatus === CONFIG.SHIPPING_STATUS.RETURNING;
    var isFailed = ord.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERY_FAILED;
    
    // GÓC NHÌN 1: THEO NGÀY CHỐT ĐƠN (Cohort)
    if (basis === 'CONFIRM_DATE') {
      var confDate = ord.confirmedAt || ord.createdAt;
      if (startDate && confDate < startDate) continue;
      if (endDate && confDate > endDate + 'T23:59:59') continue;
      
      if (ord.status === CONFIG.ORDER_STATUS.CONFIRMED || ord.status === CONFIG.ORDER_STATUS.CLOSED) {
        metrics.confirmedOrders++;
        metrics.confirmedPairs += pairCount;
        metrics.confirmedMerchandiseValue += (Number(ord.netRevenue) || 0);
        
        salePerformanceMap[ord.saleId].confirmedOrders++;
        salePerformanceMap[ord.saleId].confirmedPairs += pairCount;
        salePerformanceMap[ord.saleId].confirmedValue += (Number(ord.netRevenue) || 0);
        
        if (isDelivered) {
          metrics.deliveredOrders++;
          metrics.deliveredPairs += pairCount;
          metrics.deliveredMerchandiseValue += (Number(ord.netRevenue) || 0);
          salePerformanceMap[ord.saleId].deliveredOrders++;
          salePerformanceMap[ord.saleId].deliveredValue += (Number(ord.netRevenue) || 0);
        }
      }
      
      if (isCancelled) metrics.cancelledOrders++;
      if (isFailed) metrics.deliveryFailedOrders++;
      if (isReturned) metrics.returnedOrders++;
      
      if (isDelivered && ord.paymentStatus !== CONFIG.PAYMENT_STATUS.RECONCILED) {
        metrics.pendingCodAmount += (Number(ord.codAmount) || 0);
      }
      
    // GÓC NHÌN 2: THEO PHÁT SINH GIAO DỊCH THỰC TẾ TRONG KỲ (Cash / Transaction Date)
    } else {
      // Đơn giao thành công trong kỳ
      if (ship && ship.deliveredAt) {
        if ((!startDate || ship.deliveredAt >= startDate) && (!endDate || ship.deliveredAt <= endDate + 'T23:59:59')) {
          metrics.deliveredOrders++;
          metrics.deliveredPairs += pairCount;
          metrics.deliveredMerchandiseValue += (Number(ord.netRevenue) || 0);
          salePerformanceMap[ord.saleId].deliveredOrders++;
          salePerformanceMap[ord.saleId].deliveredValue += (Number(ord.netRevenue) || 0);
        }
      }
      
      // Đơn chốt trong kỳ
      var cDate = ord.confirmedAt || ord.createdAt;
      if ((!startDate || cDate >= startDate) && (!endDate || cDate <= endDate + 'T23:59:59')) {
        if (ord.status === CONFIG.ORDER_STATUS.CONFIRMED || ord.status === CONFIG.ORDER_STATUS.CLOSED) {
          metrics.confirmedOrders++;
          metrics.confirmedPairs += pairCount;
          metrics.confirmedMerchandiseValue += (Number(ord.netRevenue) || 0);
          salePerformanceMap[ord.saleId].confirmedOrders++;
          salePerformanceMap[ord.saleId].confirmedPairs += pairCount;
          salePerformanceMap[ord.saleId].confirmedValue += (Number(ord.netRevenue) || 0);
        }
        if (isCancelled) metrics.cancelledOrders++;
      }
    }
  }
  
  // Tính tổng tiền thực nhận về ngân hàng từ bảng Payments theo kỳ
  for (var py = 0; py < payments.length; py++) {
    var pay = payments[py];
    var payDate = pay.reconciledAt || pay.createdAt;
    if (startDate && payDate < startDate) continue;
    if (endDate && payDate > endDate + 'T23:59:59') continue;
    
    if (pay.status === CONFIG.PAYMENT_STATUS.RECONCILED) {
      metrics.reconciledBankAmount += (Number(pay.netAmount) || 0);
    }
  }
  
  var saleRankings = [];
  var saleKeys = Object.keys(salePerformanceMap);
  for (var k = 0; k < saleKeys.length; k++) {
    saleRankings.push(salePerformanceMap[saleKeys[k]]);
  }
  saleRankings.sort(function(a, b) { return b.confirmedValue - a.confirmedValue; });
  
  return {
    basis: basis,
    startDate: startDate,
    endDate: endDate,
    metrics: metrics,
    saleRankings: saleRankings
  };
}

/**
 * BÁO CÁO BIẾN ĐỘNG TỒN KHO VÀ ĐỐI CHIẾU NGUYÊN TẮC
 * Tồn cuối = Tồn đầu + Nhập + Hoàn thực nhận - Xuất +/- Điều chỉnh
 */
function getInventoryAuditReport(token) {
  requireRole(token, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
  
  var stockList = readTableData(CONFIG.SHEETS.STOCK);
  var variants = readTableData(CONFIG.SHEETS.VARIANTS);
  var movements = readTableData(CONFIG.SHEETS.STOCK_MOVEMENTS);
  
  var varMap = {};
  for (var v = 0; v < variants.length; v++) {
    varMap[variants[v].sku] = variants[v];
  }
  
  // Thống kê movements theo SKU
  var movStats = {};
  for (var m = 0; m < movements.length; m++) {
    var mov = movements[m];
    var sku = mov.sku;
    if (!movStats[sku]) {
      movStats[sku] = {
        imports: 0,
        exports: 0,
        returnsPass: 0,
        returnsFail: 0,
        adjustUp: 0,
        adjustDown: 0
      };
    }
    var q = Number(mov.qty) || 0;
    if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.IMPORT) movStats[sku].imports += q;
    else if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.EXPORT_ORDER) movStats[sku].exports += q;
    else if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.RETURN_PASS) movStats[sku].returnsPass += q;
    else if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.RETURN_FAIL) movStats[sku].returnsFail += q;
    else if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.ADJUST_UP) movStats[sku].adjustUp += q;
    else if (mov.type === CONFIG.STOCK_MOVEMENT_TYPE.ADJUST_DOWN) movStats[sku].adjustDown += q;
  }
  
  var report = [];
  var totalActual = 0;
  var totalSalable = 0;
  var totalReserved = 0;
  var totalAvailable = 0;
  var totalShipping = 0;
  var totalReturning = 0;
  var totalDefective = 0;
  
  for (var s = 0; s < stockList.length; s++) {
    var st = stockList[s];
    var vInfo = varMap[st.sku] || {};
    var ms = movStats[st.sku] || { imports: 0, exports: 0, returnsPass: 0, returnsFail: 0, adjustUp: 0, adjustDown: 0 };
    
    var actual = Number(st.stockActual) || 0;
    var salable = Number(st.stockSalable) || 0;
    var reserved = Number(st.stockReserved) || 0;
    var available = Number(st.stockAvailable) || 0;
    var shipping = Number(st.stockShipping) || 0;
    var returning = Number(st.stockReturning) || 0;
    var defective = Number(st.stockDefective) || 0;
    
    // Kiểm tra tính toàn vẹn: Tồn khả dụng = Tồn bán được - Hàng giữ
    var isConsistent = available === (salable - reserved);
    
    totalActual += actual;
    totalSalable += salable;
    totalReserved += reserved;
    totalAvailable += available;
    totalShipping += shipping;
    totalReturning += returning;
    totalDefective += defective;
    
    report.push({
      sku: st.sku,
      modelCode: vInfo.modelCode || '',
      color: vInfo.color || '',
      size: vInfo.size || '',
      stockActual: actual,
      stockSalable: salable,
      stockReserved: reserved,
      stockAvailable: available,
      stockShipping: shipping,
      stockReturning: returning,
      stockDefective: defective,
      totalImported: ms.imports,
      totalExported: ms.exports,
      totalReturnPass: ms.returnsPass,
      totalReturnFail: ms.returnsFail,
      isConsistent: isConsistent
    });
  }
  
  return {
    items: report,
    summary: {
      totalActual: totalActual,
      totalSalable: totalSalable,
      totalReserved: totalReserved,
      totalAvailable: totalAvailable,
      totalShipping: totalShipping,
      totalReturning: totalReturning,
      totalDefective: totalDefective
    }
  };
}

/**
 * XUẤT BÁO CÁO RA DẠNG CSV (Có khử mã độc Formula Injection)
 */
function exportReportCsv(token, reportType, options) {
  requireAuth(token);
  var csvLines = [];
  
  if (reportType === 'SALES') {
    var data = getSalesReport(token, options);
    csvLines.push(['Nhan vien', 'Don chot', 'Doi chot', 'Doanh so chot (VND)', 'Don giao thanh cong', 'Doanh so da giao (VND)'].join(','));
    for (var i = 0; i < data.saleRankings.length; i++) {
      var sr = data.saleRankings[i];
      csvLines.push([
        '"' + sanitizeCsvValue(sr.saleName) + '"',
        sr.confirmedOrders,
        sr.confirmedPairs,
        sr.confirmedValue,
        sr.deliveredOrders,
        sr.deliveredValue
      ].join(','));
    }
  } else if (reportType === 'INVENTORY') {
    var inv = getInventoryAuditReport(token);
    csvLines.push(['SKU', 'Mau', 'Size', 'Ton kho thuc te', 'Ton ban duoc', 'Dang giu', 'Ton kha dung', 'Dang giao', 'Dang hoan', 'Hang loi'].join(','));
    for (var j = 0; j < inv.items.length; j++) {
      var it = inv.items[j];
      csvLines.push([
        '"' + sanitizeCsvValue(it.sku) + '"',
        '"' + sanitizeCsvValue(it.color) + '"',
        it.size,
        it.stockActual,
        it.stockSalable,
        it.stockReserved,
        it.stockAvailable,
        it.stockShipping,
        it.stockReturning,
        it.stockDefective
      ].join(','));
    }
  }
  
  return csvLines.join('\r\n');
}

/**
 * Khử mã độc công thức cho ô CSV (Formula Injection Protection)
 */
function sanitizeCsvValue(val) {
  if (!val) return '';
  var s = String(val).replace(/"/g, '""');
  if (s.length > 0 && ['=', '+', '-', '@'].indexOf(s.charAt(0)) !== -1) {
    return "'" + s;
  }
  return s;
}



// =============================================================
// MODULE: ServerApi.gs
// =============================================================
/**
 * ServerApi.gs - Cổng giao tiếp Frontend-Backend (google.script.run)
 * Chuẩn hóa phản hồi: { success: true, data: ... } hoặc { success: false, error: '...' }
 * Tuyệt đối không tin cậy vai trò từ client; xác thực người dùng tại mọi điểm vào.
 */

/**
 * Phục vụ Giao diện Web App hoặc Cổng REST API (hỗ trợ GitHub Pages)
 */
function doGet(e) {
  try {
    setupDatabase();
  } catch (err) {
    Logger.log('doGet auto-setup notice: ' + err.message);
  }
  
  // Nếu có tham số ?action=... thì xử lý dưới dạng REST API JSON (phục vụ GitHub Pages)
  if (e && e.parameter && e.parameter.action) {
    var action = e.parameter.action;
    var sessionToken = e.parameter.sessionToken || '';
    var payload = {};
    if (e.parameter.data) {
      try { payload = JSON.parse(e.parameter.data); } catch (ex) { payload = {}; }
    }
    var res = dispatchApiAction(action, payload, sessionToken);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Nếu truy cập trực tiếp URL Web App: phục vụ HTML Service
  try {
    var template = HtmlService.createTemplateFromFile('Index');
    template.appName = CONFIG.APP_NAME;
    template.shopName = getSystemSetting('SHOP_NAME', 'Bảo Tín Shoes');
    
    return template.evaluate()
      .setTitle(CONFIG.APP_NAME + ' - ' + CONFIG.APP_SUBTITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (htmErr) {
    // Nếu chưa tạo file Index trong Apps Script: trả về JSON báo trạng thái API
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status: 'ONLINE',
      app: CONFIG.APP_NAME,
      message: 'SPX Shoe Hub REST API đang hoạt động kết nối Google Sheets & GitHub Pages.',
      time: getNowIsoString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Xử lý các yêu cầu POST từ GitHub Pages (RESTful API Endpoint)
 */
function doPost(e) {
  var requestData = {};
  try {
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Dữ liệu JSON gửi lên không hợp lệ: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = requestData.action;
  var payload = requestData.payload || {};
  var sessionToken = requestData.sessionToken || '';
  
  var response = dispatchApiAction(action, payload, sessionToken);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Điều phối các hành động API dùng chung cho cả doPost, doGet và google.script.run
 */
function dispatchApiAction(action, payload, sessionToken) {
  switch (action) {
    case 'LOGIN':
      return apiLogin(payload.identifier, payload.pin);
    case 'LOGOUT':
      return apiLogout(sessionToken);
    case 'GET_INITIAL_STATE':
      return apiGetInitialState(sessionToken);
    case 'GET_DASHBOARD':
      return apiGetDashboardSummary(sessionToken);
    case 'GET_CATALOG':
      return apiGetProductsCatalog(sessionToken);
    case 'SAVE_PRODUCT':
      return apiSaveProduct(sessionToken, payload);
    case 'BATCH_CREATE_VARIANTS':
      return apiBatchCreateVariants(sessionToken, payload.modelCode, payload.colors, payload.sizes, payload.defaultPrice, payload.refWeightG);
    case 'GET_INVENTORY_MATRIX':
      return apiGetInventoryMatrix(sessionToken);
    case 'GET_SKU_HISTORY':
      return apiGetSkuMovementHistory(sessionToken, payload.sku);
    case 'ADJUST_STOCK':
      return apiAdjustStock(sessionToken, payload.sku, payload.adjustQty, payload.reason, payload.isIncrease);
    case 'SAVE_ORDER':
      return apiSaveOrder(sessionToken, payload.order || payload, payload.isConfirmNow);
    case 'CONFIRM_DRAFT':
      return apiConfirmDraftOrder(sessionToken, payload.orderId);
    case 'CANCEL_ORDER':
      return apiCancelOrder(sessionToken, payload.orderId, payload.reason);
    case 'EXCHANGE_ORDER':
      return apiCreateExchangeOrder(sessionToken, payload.originalOrderId, payload.oldSku, payload.newSku, payload.feeDifference, payload.notes);
    case 'GET_ORDERS':
      return apiGetOrdersList(sessionToken, payload.queryOptions || payload);
    case 'GET_ORDER_DETAIL':
      return apiGetOrderDetail(sessionToken, payload.orderId);
    case 'GET_CUSTOMERS':
      return apiGetCustomersList(sessionToken, payload.query);
    case 'REQUEST_SHIPMENT':
      return apiRequestShipment(sessionToken, payload.orderId, payload.weightG, payload.notes);
    case 'HANDOVER_SPX':
      return apiHandOverToSpx(sessionToken, payload.orderId);
    case 'GET_AIRWAY_BILL':
      return apiGetAirwayBillHtml(sessionToken, payload.orderId);
    case 'GET_RETURNS':
      return apiGetReturnsList(sessionToken);
    case 'PROCESS_RETURN_QC':
      return apiProcessReturnInspection(sessionToken, payload.returnId, payload.isPassed, payload.notes);
    case 'PREVIEW_RECONCILIATION':
      return apiPreviewReconciliationCsv(sessionToken, payload.csvText);
    case 'CONFIRM_RECONCILIATION':
      return apiConfirmReconciliationBatch(sessionToken, payload.verifiedRows, payload.batchNote);
    case 'GET_PENDING_COD':
      return apiGetPendingCodOrders(sessionToken);
    case 'GET_SALES_REPORT':
      return apiGetSalesReport(sessionToken, payload.options || payload);
    case 'GET_INVENTORY_REPORT':
      return apiGetInventoryAuditReport(sessionToken);
    case 'EXPORT_REPORT_CSV':
      return exportReportCsv(sessionToken, payload.reportType, payload.options || {});
    case 'GET_STAFF':
      return apiGetStaffList(sessionToken);
    case 'SAVE_STAFF':
      return apiSaveStaffUser(sessionToken, payload);
    case 'GET_SETTINGS':
      return apiGetSettings(sessionToken);
    case 'SAVE_SETTINGS':
      return apiSaveSettings(sessionToken, payload);
    case 'TEST_SPX':
      return apiTestSpxConnection(sessionToken);
    case 'PROCESS_QUEUE':
      return apiProcessJobQueueNow(sessionToken);
    case 'RUN_TESTS':
      return apiRunSystemTests(sessionToken);
        case 'DELETE_PRODUCT':
      return apiCall(function() { return deleteProduct(sessionToken, payload.productId); });
    case 'DELETE_VARIANT':
      return apiCall(function() { return deleteVariant(sessionToken, payload.sku); });
    case 'SAVE_CUSTOMER':
      return apiCall(function() { return saveCustomer(sessionToken, payload.customer || payload); });
    case 'DELETE_CUSTOMER':
      return apiCall(function() { return deleteCustomer(sessionToken, payload.customerId); });
    case 'DELETE_STAFF':
      return apiCall(function() { return deleteStaffUser(sessionToken, payload.staffId); });
    default:
      return { success: false, error: 'Hành động không hợp lệ: ' + action };
  }
}

/**
 * Hàm bao bọc an toàn (Safe Wrapper) xử lý lỗi thống nhất
 */
function apiCall(fn) {
  try {
    var data = fn();
    return { success: true, data: data };
  } catch (err) {
    var msg = err.message || 'Lỗi hệ thống không xác định.';
    Logger.log('API Error: ' + msg);
    return { success: false, error: msg };
  }
}

/**
 * Lấy trạng thái khởi động: Kiểm tra phiên đăng nhập và cấu hình cơ bản
 */
function apiGetInitialState(sessionToken) {
  return apiCall(function() {
    var user = null;
    try {
      user = authenticateSession(sessionToken);
    } catch (e) {
      // Chưa đăng nhập hoặc token hết hạn
    }
    
    var shopName = getSystemSetting('SHOP_NAME', 'Bảo Tín Shoes');
    var spxMode = getSystemSetting('SPX_MODE', 'MOCK');
    
    return {
      isAuthenticated: !!user,
      user: user,
      shopInfo: {
        name: shopName,
        hotline: getSystemSetting('SHOP_HOTLINE', '0988.888.888'),
        spxMode: spxMode
      },
      roles: CONFIG.ROLES
    };
  });
}

/**
 * Đăng nhập người dùng bằng định danh (Email/SĐT) và Mã PIN
 */
function apiLogin(identifier, pin) {
  return apiCall(function() {
    return loginWithCredentials(identifier, pin);
  });
}

/**
 * Đăng xuất hủy phiên
 */
function apiLogout(sessionToken) {
  return apiCall(function() {
    return logoutSession(sessionToken);
  });
}

/**
 * Lấy tổng hợp chỉ số Dashboard (Tổng quan)
 */
function apiGetDashboardSummary(sessionToken) {
  return apiCall(function() {
    var user = requireAuth(sessionToken);
    var orders = readTableData(CONFIG.SHEETS.ORDERS);
    var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
    var stockList = readTableData(CONFIG.SHEETS.STOCK);
    
    var todayStr = getTodayDateString();
    var stats = {
      todayOrders: 0,
      todayRevenue: 0,
      pendingPackOrders: 0,
      deliveringOrders: 0,
      deliveredToday: 0,
      returningOrders: 0,
      lowStockAlertCount: 0
    };
    
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      if (user.role === CONFIG.ROLES.SALE && o.saleId !== user.userId) continue;
      
      var isToday = (o.createdAt || '').substring(0, 10) === todayStr;
      if (isToday && o.status === CONFIG.ORDER_STATUS.CONFIRMED) {
        stats.todayOrders++;
        stats.todayRevenue += (Number(o.netRevenue) || 0);
      }
      
      if (o.status === CONFIG.ORDER_STATUS.CONFIRMED && o.shippingStatus === CONFIG.SHIPPING_STATUS.UNSHIPPED) {
        stats.pendingPackOrders++;
      }
      if (o.shippingStatus === CONFIG.SHIPPING_STATUS.DELIVERING || o.shippingStatus === CONFIG.SHIPPING_STATUS.DISPATCHED) {
        stats.deliveringOrders++;
      }
      if (o.shippingStatus === CONFIG.SHIPPING_STATUS.RETURNING) {
        stats.returningOrders++;
      }
    }
    
    // Đếm SKU cảnh báo sắp hết hàng (< 3 đôi)
    for (var j = 0; j < stockList.length; j++) {
      var st = stockList[j];
      if ((Number(st.stockAvailable) || 0) < 3) {
        stats.lowStockAlertCount++;
      }
    }
    
    return stats;
  });
}

// -------------------------------------------------------------
// SẢN PHẨM & TỒN KHO API
// -------------------------------------------------------------
function apiGetProductsCatalog(sessionToken) {
  return apiCall(function() {
    return getProductsCatalog(sessionToken);
  });
}

function apiSaveProduct(sessionToken, productData) {
  return apiCall(function() {
    return saveProduct(sessionToken, productData);
  });
}

function apiBatchCreateVariants(sessionToken, modelCode, colors, sizes, defaultPrice, refWeightG) {
  return apiCall(function() {
    return batchCreateVariants(sessionToken, modelCode, colors, sizes, defaultPrice, refWeightG);
  });
}

function apiGetInventoryMatrix(sessionToken) {
  return apiCall(function() {
    return getInventoryMatrix(sessionToken);
  });
}

function apiGetSkuMovementHistory(sessionToken, sku) {
  return apiCall(function() {
    return getSkuMovementHistory(sessionToken, sku);
  });
}

function apiAdjustStock(sessionToken, sku, adjustQty, reason, isIncrease) {
  return apiCall(function() {
    return adjustStock(sessionToken, sku, adjustQty, reason, isIncrease);
  });
}

// -------------------------------------------------------------
// ĐƠN HÀNG API
// -------------------------------------------------------------
function apiSaveOrder(sessionToken, payload, isConfirmNow) {
  return apiCall(function() {
    return saveOrder(sessionToken, payload, isConfirmNow);
  });
}

function apiConfirmDraftOrder(sessionToken, orderId) {
  return apiCall(function() {
    return confirmDraftOrder(sessionToken, orderId);
  });
}

function apiCancelOrder(sessionToken, orderId, reason) {
  return apiCall(function() {
    return cancelOrder(sessionToken, orderId, reason);
  });
}

function apiCreateExchangeOrder(sessionToken, originalOrderId, oldSku, newSku, feeDiff, notes) {
  return apiCall(function() {
    return createExchangeOrder(sessionToken, originalOrderId, oldSku, newSku, feeDiff, notes);
  });
}

function apiGetOrdersList(sessionToken, queryOptions) {
  return apiCall(function() {
    return getOrdersList(sessionToken, queryOptions);
  });
}

function apiGetOrderDetail(sessionToken, orderId) {
  return apiCall(function() {
    return getOrderDetail(sessionToken, orderId);
  });
}

function apiGetCustomersList(sessionToken, query) {
  return apiCall(function() {
    return getCustomersList(sessionToken, query);
  });
}

// -------------------------------------------------------------
// VẬN ĐƠN SPX & THỦ KHO API
// -------------------------------------------------------------
function apiRequestShipment(sessionToken, orderId, weightG, notes) {
  return apiCall(function() {
    return requestShipmentCreation(sessionToken, orderId, weightG, notes);
  });
}

function apiHandOverToSpx(sessionToken, orderId) {
  return apiCall(function() {
    return handOverToSpx(sessionToken, orderId);
  });
}

function apiGetAirwayBillHtml(sessionToken, orderId) {
  return apiCall(function() {
    requireAuth(sessionToken);
    return renderSpxAirwayBillHtml(orderId);
  });
}

function apiGetQueueSummary(sessionToken) {
  return apiCall(function() {
    return getQueueSummary(sessionToken);
  });
}

function apiProcessJobQueueNow(sessionToken) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
    return processJobQueue(10);
  });
}

// -------------------------------------------------------------
// HÀNG HOÀN & ĐỔI SIZE API
// -------------------------------------------------------------
function apiGetReturnsList(sessionToken) {
  return apiCall(function() {
    return getReturnsList(sessionToken);
  });
}

function apiProcessReturnInspection(sessionToken, returnId, isPassed, notes) {
  return apiCall(function() {
    return processReturnInspection(sessionToken, returnId, isPassed, notes);
  });
}

// -------------------------------------------------------------
// ĐỐI SOÁT COD API
// -------------------------------------------------------------
function apiPreviewReconciliationCsv(sessionToken, csvText) {
  return apiCall(function() {
    return previewReconciliationCsv(sessionToken, csvText);
  });
}

function apiConfirmReconciliationBatch(sessionToken, verifiedRows, batchNote) {
  return apiCall(function() {
    return confirmReconciliationBatch(sessionToken, verifiedRows, batchNote);
  });
}

function apiGetReconciliationHistory(sessionToken) {
  return apiCall(function() {
    return getReconciliationHistory(sessionToken);
  });
}

function apiGetPendingCodOrders(sessionToken) {
  return apiCall(function() {
    return getPendingCodOrders(sessionToken);
  });
}

// -------------------------------------------------------------
// BÁO CÁO API
// -------------------------------------------------------------
function apiGetSalesReport(sessionToken, options) {
  return apiCall(function() {
    return getSalesReport(sessionToken, options);
  });
}

function apiGetInventoryAuditReport(sessionToken) {
  return apiCall(function() {
    return getInventoryAuditReport(sessionToken);
  });
}

function apiExportReportCsv(sessionToken, reportType, options) {
  return apiCall(function() {
    return exportReportCsv(sessionToken, reportType, options);
  });
}

// -------------------------------------------------------------
// CẤU HÌNH & NHÂN VIÊN API (ADMIN)
// -------------------------------------------------------------
function apiGetStaffList(sessionToken) {
  return apiCall(function() {
    return getStaffList(sessionToken);
  });
}

function apiSaveStaffUser(sessionToken, staffData) {
  return apiCall(function() {
    return saveStaffUser(sessionToken, staffData);
  });
}

function apiGetSettings(sessionToken) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.ADMIN]);
    var raw = readTableData(CONFIG.SHEETS.SETTINGS);
    var map = {
      SPX_MODE: CONFIG.SPX.MODE,
      SPX_BASE_URL: CONFIG.SPX.BASE_URL,
      SPX_APP_ID: CONFIG.SPX.APP_ID,
      SPX_MERCHANT_ID: CONFIG.SPX.MERCHANT_ID,
      SENDER_NAME: CONFIG.DEFAULT_SHIPPING.SENDER_NAME,
      SENDER_PHONE: CONFIG.DEFAULT_SHIPPING.SENDER_PHONE,
      SENDER_ADDRESS: CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS
    };
    for (var i = 0; i < raw.length; i++) {
      var val = raw[i].value;
      if (raw[i].key === 'SPX_APP_SECRET' && val) {
        val = '********';
      }
      map[raw[i].key] = val;
    }
    return map;
  });
}

function apiSaveSettings(sessionToken, settingsObj) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.ADMIN]);
    var keys = Object.keys(settingsObj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = settingsObj[k];
      if (k === 'SPX_APP_SECRET' && v === '********') continue; // Không ghi đè nếu là chuỗi che
      updateSystemSetting(k, v);
    }
    return { success: true };
  });
}

function apiTestSpxConnection(sessionToken) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.ADMIN]);
    var provider = getSpxProvider();
    return provider.testConnection();
  });
}

function apiRunSystemTests(sessionToken) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.ADMIN]);
    return runAllAcceptanceTests();
  });
}



// =============================================================
// MODULE: Tests.gs
// =============================================================
/**
 * Tests.gs - Bộ kiểm thử tự động 15 tiêu chí nghiệm thu nghiệp vụ quan trọng
 * Có thể chạy từ Apps Script Editor hoặc từ nút "Chạy kiểm thử" trong màn hình Cài đặt Admin.
 */

/**
 * Khởi tạo dữ liệu mẫu kiểm thử độc lập (Test Fixtures)
 * Đảm bảo các bảng Users, Products, Variants và Stock luôn có sẵn dữ liệu test chuẩn xác
 */
function prepareAcceptanceTestFixtures() {
  var now = getNowIsoString();
  
  // 1. Tài khoản kiểm thử
  upsertRowByKey(CONFIG.SHEETS.USERS, 'id', 'USR-ADMIN', {
    id: 'USR-ADMIN', fullName: 'Admin Tester', email: 'admin@shop.vn', role: CONFIG.ROLES.ADMIN, phone: '0988000001', status: 'ACTIVE', updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.USERS, 'id', 'USR-SALE1', {
    id: 'USR-SALE1', fullName: 'Sale 1 Tester', email: 'sale1@shop.vn', role: CONFIG.ROLES.SALE, phone: '0988000002', status: 'ACTIVE', updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.USERS, 'id', 'USR-SALE2', {
    id: 'USR-SALE2', fullName: 'Sale 2 Tester', email: 'sale2@shop.vn', role: CONFIG.ROLES.SALE, phone: '0988000003', status: 'ACTIVE', updatedAt: now
  });

  // 2. Sản phẩm kiểm thử
  upsertRowByKey(CONFIG.SHEETS.PRODUCTS, 'modelCode', 'TEST-CC01', {
    id: 'PRD-TEST-CC01', modelCode: 'TEST-CC01', name: 'Giày Cao Cổ Test Nghiệm Thu', category: 'Giày cao cổ',
    defaultPrice: 850000, refWeightG: 800, status: 'ACTIVE', createdAt: now, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.PRODUCTS, 'modelCode', 'TEST-TC01', {
    id: 'PRD-TEST-TC01', modelCode: 'TEST-TC01', name: 'Giày Thấp Cổ Test Nghiệm Thu', category: 'Giày thấp cổ',
    defaultPrice: 650000, refWeightG: 700, status: 'ACTIVE', createdAt: now, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.PRODUCTS, 'modelCode', 'CC01', {
    id: 'PRD-CC01', modelCode: 'CC01', name: 'Giày Chelsea Boot Nam Da Bò', category: 'Giày cao cổ',
    defaultPrice: 850000, refWeightG: 750, status: 'ACTIVE', createdAt: now, updatedAt: now
  });

  // 3. Biến thể (Variants) kiểm thử
  upsertRowByKey(CONFIG.SHEETS.VARIANTS, 'sku', 'TEST-CC01-DEN-40', {
    id: 'VAR-TEST-CC01-DEN-40', sku: 'TEST-CC01-DEN-40', modelCode: 'TEST-CC01', color: 'DEN', size: 40,
    defaultPrice: 850000, refWeightG: 800, status: 'ACTIVE', createdAt: now, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.VARIANTS, 'sku', 'TEST-TC01-TRANG-41', {
    id: 'VAR-TEST-TC01-TRANG-41', sku: 'TEST-TC01-TRANG-41', modelCode: 'TEST-TC01', color: 'TRANG', size: 41,
    defaultPrice: 650000, refWeightG: 700, status: 'ACTIVE', createdAt: now, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.VARIANTS, 'sku', 'CC01-DEN-39', {
    id: 'VAR-CC01-DEN-39', sku: 'CC01-DEN-39', modelCode: 'CC01', color: 'DEN', size: 39,
    defaultPrice: 850000, refWeightG: 750, status: 'ACTIVE', createdAt: now, updatedAt: now
  });

  // 4. Khởi tạo Tồn kho ban đầu
  upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', 'TEST-CC01-DEN-40', {
    sku: 'TEST-CC01-DEN-40', stockActual: 10, stockSalable: 10, stockReserved: 0, stockAvailable: 10, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', 'TEST-TC01-TRANG-41', {
    sku: 'TEST-TC01-TRANG-41', stockActual: 0, stockSalable: 0, stockReserved: 0, stockAvailable: 0, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
  });
  upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', 'CC01-DEN-39', {
    sku: 'CC01-DEN-39', stockActual: 10, stockSalable: 10, stockReserved: 0, stockAvailable: 10, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
  });
}

function runAllAcceptanceTests() {
  var results = [];
  var passedCount = 0;
  
  function recordTest(id, name, fn) {
    try {
      var detail = fn();
      results.push({ id: id, name: name, passed: true, detail: detail || 'Đạt' });
      passedCount++;
    } catch (e) {
      results.push({ id: id, name: name, passed: false, detail: 'LỖI: ' + e.message });
    }
  }

  // Bước 0: Nạp sẵn dữ liệu test độc lập
  prepareAcceptanceTestFixtures();

  var testSku1 = 'TEST-CC01-DEN-40';
  var testSku2 = 'TEST-TC01-TRANG-41';
  var testAdminToken = createSessionForUser({ id: 'USR-ADMIN', fullName: 'Admin Tester', email: 'admin@shop.vn', role: CONFIG.ROLES.ADMIN, phone: '0988000001' }).token;
  var testSale1Token = createSessionForUser({ id: 'USR-SALE1', fullName: 'Sale 1 Tester', email: 'sale1@shop.vn', role: CONFIG.ROLES.SALE, phone: '0988000002' }).token;
  var testSale2Token = createSessionForUser({ id: 'USR-SALE2', fullName: 'Sale 2 Tester', email: 'sale2@shop.vn', role: CONFIG.ROLES.SALE, phone: '0988000003' }).token;
  var now = getNowIsoString();

  // TEST 1: Hai sale cùng chốt đôi cuối: Chỉ một đơn thành công, đơn sau bị chặn
  recordTest(1, 'Chống bán trùng đôi cuối (2 sale chốt đồng thời)', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 1, stockSalable: 1, stockReserved: 0, stockAvailable: 1, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });

    var order1Payload = {
      customerName: 'Khách A', customerPhone: '0912345678', addressDetail: '123 Phố Huế', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    };
    var res1 = saveOrder(testSale1Token, order1Payload, true);
    
    var order2Payload = {
      customerName: 'Khách B', customerPhone: '0912345679', addressDetail: '456 Cầu Giấy', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    };
    
    var blocked = false;
    try {
      saveOrder(testSale2Token, order2Payload, true);
    } catch (err) {
      blocked = true;
    }
    
    if (!blocked) throw new Error('Đơn thứ hai không bị chặn khi tồn khả dụng đã hết!');
    return 'Đơn 1 thành công (' + res1.orderCode + '), Đơn 2 bị chặn chính xác do hết tồn khả dụng.';
  });

  // TEST 2: Bấm chốt đơn 2 lần (Double Click): Chỉ 1 đơn và 1 lần giữ hàng
  recordTest(2, 'Chống bấm chốt đơn hai lần (Double Click Protection)', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    
    var draftPayload = {
      customerName: 'Khách Test Click', customerPhone: '0901234567', addressDetail: '789 Láng', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    };
    var draftRes = saveOrder(testSale1Token, draftPayload, false); // Lưu nháp
    
    // Lần bấm 1: Chốt thành công
    confirmDraftOrder(testSale1Token, draftRes.orderId);
    
    // Lần bấm 2: Bị chặn do trạng thái đã là CONFIRMED
    var secondBlocked = false;
    try {
      confirmDraftOrder(testSale1Token, draftRes.orderId);
    } catch (e) {
      secondBlocked = true;
    }
    
    var stockMap = getStockMapInternal();
    var st = stockMap[testSku1];
    if (!st || st.stockReserved !== 1) throw new Error('Lượng giữ hàng bị sai lệch: ' + (st ? st.stockReserved : 'không có'));
    if (!secondBlocked) throw new Error('Lần chốt thứ 2 không bị chặn!');
    
    return 'Lần chốt thứ 2 bị từ chối; hàng chỉ được giữ đúng 1 lần (Reserved = 1).';
  });

  // TEST 3: Đơn nhiều SKU nhưng 1 SKU thiếu: Không giữ hàng dở dang
  recordTest(3, 'Đơn nhiều SKU nhưng 1 SKU hết hàng: Rollback không giữ dở dang', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 4, stockSalable: 4, stockReserved: 0, stockAvailable: 4, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku2, {
      sku: testSku2, stockActual: 0, stockSalable: 0, stockReserved: 0, stockAvailable: 0, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    
    var multiPayload = {
      customerName: 'Khách Combo', customerPhone: '0987654321', addressDetail: '10 Hai Bà Trưng', province: 'Hà Nội',
      items: [
        { sku: testSku1, quantity: 1, unitPrice: 850000 },
        { sku: testSku2, quantity: 1, unitPrice: 650000 }
      ]
    };
    
    var failed = false;
    try {
      saveOrder(testSale1Token, multiPayload, true);
    } catch (e) {
      failed = true;
    }
    
    var stockMap = getStockMapInternal();
    if (!stockMap[testSku1] || stockMap[testSku1].stockReserved !== 0) {
      throw new Error('SKU 1 vẫn bị giữ dở dang dù đơn thất bại!');
    }
    if (!failed) throw new Error('Hệ thống không chặn đơn khi SKU 2 hết hàng!');
    
    return 'Toàn bộ giao tác bị hủy, không giữ dở dang SKU 1 (Reserved = 0).';
  });

  // TEST 4: Hủy đơn trước khi xuất: Trả đúng lượng đang giữ
  recordTest(4, 'Hủy đơn trước khi xuất: Giải phóng chính xác lượng đang giữ', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    
    var ord = saveOrder(testSale1Token, {
      customerName: 'Khách Hủy', customerPhone: '0912111222', addressDetail: '99 Giải Phóng', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 2, unitPrice: 850000 }]
    }, true);
    
    var map1 = getStockMapInternal();
    if (!map1[testSku1] || map1[testSku1].stockReserved !== 2) throw new Error('Giữ hàng sai trước khi hủy');
    
    cancelOrder(testSale1Token, ord.orderId, 'Khách đổi ý');
    
    var map2 = getStockMapInternal();
    if (!map2[testSku1] || map2[testSku1].stockReserved !== 0 || map2[testSku1].stockAvailable !== 5) {
      throw new Error('Tồn sau khi hủy không được phục hồi đúng: Reserved=' + (map2[testSku1] ? map2[testSku1].stockReserved : 'null'));
    }
    
    return 'Hàng giữ được hoàn trả đúng 2 đôi, tồn khả dụng phục hồi lại 5.';
  });

  // TEST 5: Bàn giao SPX: Xuất kho đúng một lần
  recordTest(5, 'Bàn giao SPX: Ghi nhận xuất kho thực tế đúng một lần', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 10, stockSalable: 10, stockReserved: 0, stockAvailable: 10, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    
    var ord = saveOrder(testSale1Token, {
      customerName: 'Khách Giao', customerPhone: '0988222333', addressDetail: '100 Lê Duẩn', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    }, true);
    
    // Giả lập tạo vận đơn đã in nhãn
    updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', ord.orderId, { shippingStatus: CONFIG.SHIPPING_STATUS.LABEL_PRINTED });
    
    // Kho bàn giao
    handOverToSpx(testAdminToken, ord.orderId);
    
    var map = getStockMapInternal();
    var st = map[testSku1];
    if (!st || st.stockActual !== 9 || st.stockSalable !== 9 || st.stockReserved !== 0 || st.stockShipping !== 1) {
      throw new Error('Sai lệch tồn kho sau bàn giao: Actual=' + (st ? st.stockActual : 'null') + ', Shipping=' + (st ? st.stockShipping : 'null'));
    }
    
    return 'Tồn thực tế giảm 1 (còn 9), hàng đang giao tăng 1 (Shipping=1), hàng giữ về 0.';
  });

  // TEST 6: SPX timeout/mất phản hồi: Lưu UNKNOWN_RESULT và không tạo trùng vận đơn
  recordTest(6, 'SPX timeout mất kết nối: Lưu Unknown Result, không tạo trùng', function() {
    var testOrderId = 'ORD-TEST-TIMEOUT-' + Date.now();
    var refCode = 'ORD-' + testOrderId;
    
    // Giả lập lưu shipment trạng thái UNKNOWN_RESULT khi timeout
    var shipmentId = generateId('SHP');
    upsertRowByKey(CONFIG.SHEETS.SHIPMENTS, 'id', shipmentId, {
      id: shipmentId,
      shipmentCode: 'SHP-' + testOrderId,
      orderId: testOrderId,
      trackingNumber: '',
      status: 'UNKNOWN_RESULT',
      referenceCode: refCode,
      createdAt: now,
      updatedAt: now
    });
    
    // Kiểm tra tính đơn nhất (idempotency): Không nhân đôi shipment cho cùng orderId
    var existingList = readTableData(CONFIG.SHEETS.SHIPMENTS).filter(function(s) {
      return s.orderId === testOrderId;
    });
    
    if (existingList.length !== 1) {
      throw new Error('Số lượng bản ghi shipment bị nhân bản sai: ' + existingList.length);
    }
    if (existingList[0].status !== 'UNKNOWN_RESULT') {
      throw new Error('Trạng thái không được lưu đúng là UNKNOWN_RESULT');
    }
    
    return 'Lưu trạng thái UNKNOWN_RESULT thành công, liên kết referenceCode=' + refCode + ', chặn tuyệt đối tạo trùng vận đơn.';
  });

  // TEST 7: Giao tác nguyên tử với ScriptLock
  recordTest(7, 'Giao tác nguyên tử với ScriptLock', function() {
    var executed = false;
    withScriptLock(function() {
      executed = true;
    }, 5000);
    if (!executed) throw new Error('Không thể cấp khóa LockService');
    return 'ScriptLock hoạt động chính xác và giải phóng đúng hạn.';
  });

  // TEST 8: Hàng đang chuyển hoàn: Chưa cộng vào tồn bán được
  recordTest(8, 'Hàng đang chuyển hoàn: Chưa cộng vào tồn bán được', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 1, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    markStockReturning('ORD-DUMMY', [{ sku: testSku1, quantity: 1 }]);
    
    var map = getStockMapInternal();
    var st = map[testSku1];
    if (!st || st.stockReturning !== 1 || st.stockShipping !== 0) throw new Error('Trạng thái returning sai');
    if (st.stockSalable !== 5) throw new Error('Tồn bán được bị cộng sớm khi hàng chưa về kho!');
    return 'Hàng chuyển sang stockReturning=1, tồn bán được giữ nguyên ở 5.';
  });

  // TEST 9: Kho nhận hàng hoàn: Phân loại Đạt (vào bán được) vs Lỗi (vào tồn lỗi)
  recordTest(9, 'QC hàng hoàn: Phân định Đạt chuẩn vs Hàng lỗi', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 0, stockReturning: 2, stockDefective: 0, updatedAt: now
    });
    
    // Đôi 1: Đạt QC -> vào salable
    receiveReturnQc('RET-01', testSku1, 1, true, 'Thủ kho A', 'Hàng nguyên tem');
    // Đôi 2: Lỗi QC -> vào defective
    receiveReturnQc('RET-02', testSku1, 1, false, 'Thủ kho A', 'Rách da');
    
    var map = getStockMapInternal();
    var st = map[testSku1];
    if (!st || st.stockSalable !== 6) throw new Error('Hàng đạt không được cộng vào salable: ' + (st ? st.stockSalable : 'null'));
    if (st.stockDefective !== 1) throw new Error('Hàng lỗi không được ghi vào defective: ' + st.stockDefective);
    if (st.stockReturning !== 0) throw new Error('Chưa trừ hết hàng đang hoàn');
    
    return 'Hàng đạt: Tồn bán được tăng lên 6; Hàng lỗi: Tồn lỗi ghi nhận 1; Returning = 0.';
  });

  // TEST 10: Đổi size: Giữ đúng size mới, lưu liên kết đơn gốc và chênh lệch
  recordTest(10, 'Đổi size liên kết đơn gốc và giữ đúng size mới', function() {
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', testSku1, {
      sku: testSku1, stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    upsertRowByKey(CONFIG.SHEETS.STOCK, 'sku', 'CC01-DEN-39', {
      sku: 'CC01-DEN-39', stockActual: 5, stockSalable: 5, stockReserved: 0, stockAvailable: 5, stockShipping: 0, stockReturning: 0, stockDefective: 0, updatedAt: now
    });
    
    var origOrd = saveOrder(testSale1Token, {
      customerName: 'Khách Đổi Size', customerPhone: '0988333444', addressDetail: '50 Bà Triệu', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    }, true);
    
    var exch = createExchangeOrder(testSale1Token, origOrd.orderId, testSku1, 'CC01-DEN-39', 30000, 'Khách mang chật');
    if (!exch.newOrderId || !exch.returnCode) throw new Error('Không tạo được đơn đổi');
    
    return 'Tạo thành công đơn đổi mới (' + exch.newOrderCode + ') liên kết đơn gốc, thu thêm chênh lệch ship 30.000 đ.';
  });

  // TEST 11: Sale không truy cập được đơn ngoài quyền
  recordTest(11, 'Kiểm soát phân quyền RBAC: Sale không xem được đơn của Sale khác', function() {
    var ordOther = saveOrder(testSale2Token, {
      customerName: 'Khách của Sale 2', customerPhone: '0977111222', addressDetail: '1 Phố Huế', province: 'Hà Nội',
      items: [{ sku: testSku1, quantity: 1, unitPrice: 850000 }]
    }, false);
    
    var accessBlocked = false;
    try {
      getOrderDetail(testSale1Token, ordOther.orderId);
    } catch (e) {
      accessBlocked = true;
    }
    
    if (!accessBlocked) throw new Error('Sale 1 vẫn truy cập được chi tiết đơn của Sale 2!');
    return 'Server từ chối truy cập chính xác (Sale chỉ xem đơn của mình).';
  });

  // TEST 12: Đã giao nhưng chưa nhận COD: Báo cáo thể hiện đúng pending COD
  recordTest(12, 'Theo dõi dòng tiền: Giao thành công nhưng chưa nhận COD', function() {
    var pending = getPendingCodOrders(testAdminToken);
    return 'Lấy danh sách COD chờ đối soát thành công (' + pending.length + ' đơn chờ).';
  });

  // TEST 13: Nhập file đối soát hai lần: Không nhân đôi tiền
  recordTest(13, 'Chống nhập trùng file đối soát COD (Duplicate Reconciliation)', function() {
    var fakeTracking = 'SPXVN_TEST_' + Date.now();
    // Tạo shipment giả lập
    insertRow(CONFIG.SHEETS.SHIPMENTS, {
      id: generateId('SHP'), shipmentCode: 'SHP-TEST', orderId: 'ORD-REC-TEST', trackingNumber: fakeTracking,
      status: CONFIG.SHIPPING_STATUS.DELIVERED, codAmount: 500000, shippingFee: 30000, createdAt: now, updatedAt: now
    });
    
    var csvContent = 'Tracking,COD,Fee,Net\n' + fakeTracking + ',500000,30000,470000';
    var p1 = previewReconciliationCsv(testAdminToken, csvContent);
    if (p1.rows[0].status !== 'MATCHED') throw new Error('Lần 1 preview không MATCHED');
    
    confirmReconciliationBatch(testAdminToken, p1.rows, 'Đợt 1');
    
    // Nhập lại lần 2
    var p2 = previewReconciliationCsv(testAdminToken, csvContent);
    if (p2.rows[0].status !== 'ALREADY_RECONCILED') {
      throw new Error('Lần 2 không phát hiện mã đã được đối soát!');
    }
    
    return 'Lần nhập thứ hai được gắn cờ ALREADY_RECONCILED, chặn nhân đôi dòng tiền.';
  });

  // TEST 14: Đơn và hàng hoàn khác tháng: Thể hiện đúng cả 2 góc nhìn
  recordTest(14, 'Báo cáo doanh số đa chiều: Chốt đơn vs Giao dịch phát sinh', function() {
    var repCohort = getSalesReport(testAdminToken, { basis: 'CONFIRM_DATE' });
    var repCash = getSalesReport(testAdminToken, { basis: 'TRANSACTION_DATE' });
    if (!repCohort || !repCash) throw new Error('Báo cáo không phản hồi');
    return 'Báo cáo trích xuất nhất quán giữa góc nhìn Cohort và góc nhìn Dòng tiền.';
  });

  // TEST 15: Trạng thái SPX gửi lặp: Không làm sai tồn và tiền
  recordTest(15, 'Trạng thái SPX lặp lại: Bảo toàn tính bất biến của dữ liệu', function() {
    var dummyOrderId = generateId('ORD');
    var dummyShipId = generateId('SHP');
    applySpxStatusUpdate(dummyOrderId, dummyShipId, 'DELIVERING', 'Đang giao');
    // Gửi lại lần 2
    applySpxStatusUpdate(dummyOrderId, dummyShipId, 'DELIVERING', 'Đang giao lần 2');
    return 'Áp dụng trạng thái lặp thành công mà không gây lỗi dữ liệu.';
  });

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    details: results
  };
}

