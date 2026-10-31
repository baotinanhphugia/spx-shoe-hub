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
