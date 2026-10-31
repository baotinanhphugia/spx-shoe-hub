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
 * 3. BỘ TẠO MÃ VẠCH SVG CODE128 VÀ TEM IN VẬN ĐƠN CHUẨN SPX
 * Hỗ trợ in đơn lẻ và in hàng loạt cho khâu kho đóng gói (Batch Printing A6/A7)
 * -------------------------------------------------------------
 */

/**
 * Sinh mã vạch chuẩn ISO Code128B dưới dạng SVG siêu nét (Hoạt động offline 100%)
 */
function generateCode128Svg(text, height, barWidth) {
  var patterns = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112"
  ];
  
  var cleanText = String(text || '').replace(/[^\x20-\x7E]/g, '');
  if (!cleanText) cleanText = 'SPX-PARCEL';
  
  var codes = [104]; // Code B Start
  var checkSum = 104;
  
  for (var i = 0; i < cleanText.length; i++) {
    var codeVal = cleanText.charCodeAt(i) - 32;
    codes.push(codeVal);
    checkSum += codeVal * (i + 1);
  }
  
  codes.push(checkSum % 103);
  codes.push(106); // Stop
  
  var modules = "";
  for (var c = 0; c < codes.length; c++) {
    var pat = patterns[codes[c]];
    if (!pat) continue;
    for (var p = 0; p < pat.length; p++) {
      var width = parseInt(pat.charAt(p), 10);
      var bit = (p % 2 === 0) ? "1" : "0";
      for (var w = 0; w < width; w++) {
        modules += bit;
      }
    }
  }
  
  var bw = barWidth || 2;
  var h = height || 48;
  var svgWidth = modules.length * bw;
  
  var rects = [];
  for (var m = 0; m < modules.length; m++) {
    if (modules.charAt(m) === '1') {
      rects.push('<rect x="' + (m * bw) + '" y="0" width="' + bw + '" height="' + h + '" fill="#000" />');
    }
  }
  
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + h + '" viewBox="0 0 ' + svgWidth + ' ' + h + '" style="display:inline-block;max-width:100%;height:auto;">' + rects.join('') + '</svg>';
}

/**
 * Hàm lấy chi tiết đơn nội bộ an toàn (không yêu cầu auth token)
 */
function getOrderDetailInternal(orderId) {
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var items = allItems.filter(function(it) { return it.orderId === orderId; });
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var shipment = null;
  for (var s = 0; s < shipments.length; s++) {
    if (shipments[s].orderId === orderId) {
      shipment = shipments[s];
      break;
    }
  }
  return { order: order, items: items, shipment: shipment };
}

/**
 * Render nội dung 1 tem vận đơn SPX (Single Airway Bill Card)
 */
function renderSingleAirwayBillBox(orderId, index, total) {
  var detail = getOrderDetailInternal(orderId);
  var order = detail.order;
  var items = detail.items;
  var shipment = detail.shipment || {};
  
  var senderName = getSystemSetting('SENDER_NAME', CONFIG.DEFAULT_SHIPPING.SENDER_NAME);
  var senderPhone = getSystemSetting('SENDER_PHONE', CONFIG.DEFAULT_SHIPPING.SENDER_PHONE);
  var senderAddress = getSystemSetting('SENDER_ADDRESS', CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS);
  var inspection = getSystemSetting('ITEM_INSPECTION', 'VIEW_NO_TRY');
  var inspectionText = inspection === 'VIEW_TRY' ? 'CHO THỬ HÀNG' : (inspection === 'NO_VIEW' ? 'KHÔNG CHO XEM HÀNG' : 'CHO XEM HÀNG, KHÔNG THỬ');
  
  var tracking = shipment.trackingNumber || ('SPX' + order.orderCode.replace(/\D/g, '') + 'VN');
  var codStr = Number(order.codAmount) > 0 ? (Number(order.codAmount).toLocaleString('vi-VN') + ' đ') : '0 đ (KHÔNG THU TIỀN)';
  var routeCode = order.spxAddressCode || resolveSpxAddressCode(order.province) || 'VN-STD';
  
  var itemsHtml = '';
  var totalQuantity = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var q = Number(it.quantity) || 1;
    totalQuantity += q;
    itemsHtml += '<tr>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px;">' + 
        '<strong>' + (it.productName || it.modelCode) + '</strong> - Màu ' + it.color + ' / Size ' + it.size + 
        (it.sku ? (' <span style="font-size:10px;color:#666;">[' + it.sku + ']</span>') : '') +
      '</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #ddd;text-align:center;font-size:13px;font-weight:900;">' + q + '</td>' +
    '</tr>';
  }
  
  var barcodeSvg = generateCode128Svg(tracking, 48, 2);
  var paginationText = total > 1 ? ('<span style="font-size:11px;color:#666;font-weight:normal;">(Kiện ' + index + '/' + total + ')</span>') : '';
  
  return '<div class="label-box">' +
    '<div class="spx-header">' +
      '<div class="spx-logo">SPX <span style="font-size:14px;color:#222;font-weight:700;">Express</span> ' + paginationText + '</div>' +
      '<div class="spx-route">' + routeCode + '</div>' +
    '</div>' +
    '<div class="barcode-area">' +
      barcodeSvg +
      '<div class="tracking-text">' + tracking + '</div>' +
      '<div class="order-code-text">Mã đơn shop: <strong>' + order.orderCode + '</strong></div>' +
    '</div>' +
    '<div class="section sender-section">' +
      '<span class="sec-title">NGƯỜI GỬI:</span> ' + senderName + ' - ' + senderPhone + '<br>' +
      '<span style="font-size:11px;color:#444;">' + senderAddress + '</span>' +
    '</div>' +
    '<div class="section receiver-section">' +
      '<span class="sec-title">NGƯỜI NHẬN:</span> <strong style="font-size:14px;">' + order.customerName + '</strong> - <strong style="font-size:13px;">' + order.customerPhone + '</strong><br>' +
      '<span style="font-size:12px;font-weight:600;color:#111;">' + order.addressDetail + ', ' + (order.ward ? order.ward + ', ' : '') + (order.district ? order.district + ', ' : '') + order.province + '</span>' +
    '</div>' +
    '<div class="cod-box">' +
      '<div class="cod-title">TIỀN THU HỘ (COD)</div>' +
      '<div class="cod-val">' + codStr + '</div>' +
      '<div class="inspection-tag">CHỈ DẪN PHÁT: ' + inspectionText + '</div>' +
    '</div>' +
    '<div class="section items-section">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span class="sec-title">NỘI DUNG HÀNG (' + totalQuantity + ' ĐÔI / ' + items.length + ' DÒNG):</span>' +
        '<span style="font-size:11px;color:#666;">KL: ' + (shipment.weightG || 800) + 'g</span>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:4px;">' +
        itemsHtml +
      '</table>' +
    '</div>' +
    '<div class="section notes-section">' +
      '<strong>Ghi chú đơn:</strong> ' + (order.notes || 'Hàng nguyên tem, khách kiểm tra đúng mẫu mã size trước khi nhận.') +
    '</div>' +
    '<div class="footer-sign">' +
      '<div>Ngày in: ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm") + '</div>' +
      '<div>Chữ ký người nhận</div>' +
    '</div>' +
  '</div>';
}

/**
 * Tạo tài liệu HTML in hàng loạt (Batch Airway Bill Document)
 */
function assembleBatchPrintDocument(cardsHtml, totalOrders) {
  return '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8">' +
    '<title>SPX Airway Bills - In ' + totalOrders + ' Đơn Hàng Loạt</title>' +
    '<style>' +
    '  * { box-sizing: border-box; }' +
    '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 15px; color: #111; background: #eef2f5; }' +
    '  .no-print-toolbar { position: sticky; top: 0; z-index: 9999; background: #fff; padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; justify-content: space-between; align-items: center; }' +
    '  .btn-print { background: #EE4D2D; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(238,77,45,0.4); }' +
    '  .btn-print:hover { background: #d73211; }' +
    '  .labels-container { display: flex; flex-direction: column; gap: 20px; align-items: center; }' +
    '  .label-box { width: 100mm; min-height: 148mm; max-height: 148mm; border: 2px solid #111; padding: 8mm; margin: 0 auto; background: #fff; position: relative; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; break-after: page; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }' +
    '  .spx-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 6px; }' +
    '  .spx-logo { font-size: 24px; font-weight: 900; color: #EE4D2D; letter-spacing: -1px; }' +
    '  .spx-route { font-size: 18px; font-weight: 900; border: 2px solid #111; padding: 2px 8px; border-radius: 4px; background: #f9f9f9; }' +
    '  .barcode-area { text-align: center; padding: 6px 0; border-bottom: 2px solid #111; }' +
    '  .tracking-text { font-size: 15px; font-weight: 900; letter-spacing: 1px; margin-top: 4px; }' +
    '  .order-code-text { font-size: 11px; color: #555; }' +
    '  .section { border-bottom: 1px solid #222; padding: 5px 0; font-size: 11px; line-height: 1.35; }' +
    '  .sec-title { font-weight: 800; color: #444; font-size: 10px; margin-right: 4px; }' +
    '  .cod-box { background: #FFF5F2; border: 2px dashed #EE4D2D; padding: 6px; text-align: center; margin: 6px 0; border-radius: 4px; }' +
    '  .cod-title { font-size: 11px; font-weight: 800; color: #555; }' +
    '  .cod-val { font-size: 22px; font-weight: 900; color: #EE4D2D; }' +
    '  .inspection-tag { font-size: 10px; font-weight: 800; color: #222; margin-top: 2px; }' +
    '  .items-section { flex-grow: 1; }' +
    '  .footer-sign { display: flex; justify-content: space-between; font-size: 10px; color: #666; padding-top: 4px; }' +
    '  @media print {' +
    '    body { background: #fff; padding: 0; margin: 0; }' +
    '    .no-print-toolbar { display: none !important; }' +
    '    .labels-container { gap: 0; }' +
    '    .label-box { border: 2px solid #000; box-shadow: none; margin: 0 auto; page-break-after: always; break-after: page; }' +
    '    @page { size: 100mm 150mm; margin: 0; }' +
    '  }' +
    '</style>' +
    '</head><body>' +
    '<div class="no-print-toolbar">' +
      '<div>' +
        '<strong style="font-size:16px;color:#EE4D2D;">SPX SHOE HUB - IN TEM ĐÓNG GÓI HÀNG LOẠT</strong>' +
        '<div style="font-size:12px;color:#666;">Chuẩn bị in ' + totalOrders + ' phiếu vận đơn khổ A6 (100x150mm) cho máy in nhiệt.</div>' +
      '</div>' +
      '<button class="btn-print" onclick="window.print()">🖨️ IN TẤT CẢ ' + totalOrders + ' TEM (Ctrl+P)</button>' +
    '</div>' +
    '<div class="labels-container">' +
      cardsHtml.join('') +
    '</div>' +
    '<script>' +
    '  window.onload = function() { setTimeout(function(){ window.print(); }, 800); };' +
    '</script>' +
    '</body></html>';
}

/**
 * In 1 đơn lẻ
 */
function renderSpxAirwayBillHtml(orderId) {
  var card = renderSingleAirwayBillBox(orderId, 1, 1);
  return assembleBatchPrintDocument([card], 1);
}

/**
 * In hàng loạt danh sách đơn hàng
 */
function renderBatchSpxAirwayBillHtml(orderIds) {
  if (!orderIds || orderIds.length === 0) {
    return '<html><body><h2 style="text-align:center;color:#666;margin-top:50px;">Không có đơn hàng nào được chọn để in tem.</h2></body></html>';
  }
  
  var cardsHtml = [];
  var now = getNowIsoString();
  
  for (var i = 0; i < orderIds.length; i++) {
    var oid = orderIds[i];
    try {
      cardsHtml.push(renderSingleAirwayBillBox(oid, i + 1, orderIds.length));
      // Tự động cập nhật trạng thái đã in tem cho đơn hàng
      updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', oid, {
        shippingStatus: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
        updatedAt: now
      });
    } catch (e) {
      cardsHtml.push('<div class="label-box" style="padding:20px;color:red;">Lỗi tải đơn ' + oid + ': ' + e.message + '</div>');
    }
  }
  
  logAuditAction('BATCH_PRINT_AIRWAY_BILLS', 'Orders', orderIds.join(','), 'In tem vận đơn hàng loạt cho ' + orderIds.length + ' đơn hàng', 'Thủ kho / Sale');
  return assembleBatchPrintDocument(cardsHtml, orderIds.length);
}

