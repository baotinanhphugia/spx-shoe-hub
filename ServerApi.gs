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
    case 'GET_BATCH_AIRWAY_BILLS':
      return apiGetBatchAirwayBillHtml(sessionToken, payload.orderIds);
    case 'BATCH_CREATE_SHIPMENTS':
      return apiBatchCreateShipments(sessionToken, payload.orderIds);
    case 'LINK_SPX_TRACKING':
      return apiLinkSpxTracking(sessionToken, payload.orderId, payload.trackingNumber, payload.notes);
    case 'BATCH_HANDOVER_SPX':
      return apiBatchHandOverToSpx(sessionToken, payload.orderIds);
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

function apiGetBatchAirwayBillHtml(sessionToken, orderIds) {
  return apiCall(function() {
    requireAuth(sessionToken);
    return renderBatchSpxAirwayBillHtml(orderIds);
  });
}

function apiBatchCreateShipments(sessionToken, orderIds) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
    var list = orderIds || [];
    var successCount = 0;
    var errors = [];
    for (var i = 0; i < list.length; i++) {
      try {
        requestShipmentCreation(sessionToken, list[i]);
        successCount++;
      } catch (e) {
        errors.push(list[i] + ': ' + e.message);
      }
    }
    return { successCount: successCount, total: list.length, errors: errors };
  });
}

function apiLinkSpxTracking(sessionToken, orderId, trackingNumber, notes) {
  return apiCall(function() {
    return linkRealSpxTracking(sessionToken, orderId, trackingNumber, notes);
  });
}

function apiBatchHandOverToSpx(sessionToken, orderIds) {
  return apiCall(function() {
    requireRole(sessionToken, [CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
    var list = orderIds || [];
    var successCount = 0;
    var errors = [];
    for (var i = 0; i < list.length; i++) {
      try {
        handOverToSpx(sessionToken, list[i]);
        successCount++;
      } catch (e) {
        errors.push(list[i] + ': ' + e.message);
      }
    }
    return { successCount: successCount, total: list.length, errors: errors };
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
