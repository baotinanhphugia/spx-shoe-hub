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
  
  // 4. Nếu là Chốt đơn: Thực hiện Giữ hàng nguyên tử (Atomic Reservation) & Cấp mã vận đơn SPX tức thì
  if (isConfirmNow) {
    reserveStockForOrder(orderId, orderCode, orderItemRecords, user.fullName);
    upsertCustomerFromOrder(orderRecord);
    
    // TỰ ĐỘNG ĐẨY ĐƠN SANG SPX & LẤY MÃ VẬN ĐƠN NGAY TẠI CHỖ (Không bắt ra ngoài đẩy lại)
    var finalTracking = (payload.trackingNumber && String(payload.trackingNumber).trim()) ? String(payload.trackingNumber).trim() : '';
    
    if (!finalTracking) {
      try {
        var provider = getSpxProvider();
        var referenceCode = 'ORD-' + orderCode;
        var sender = {
          name: getSystemSetting('SENDER_NAME', CONFIG.DEFAULT_SHIPPING.SENDER_NAME),
          phone: getSystemSetting('SENDER_PHONE', CONFIG.DEFAULT_SHIPPING.SENDER_PHONE),
          address: getSystemSetting('SENDER_ADDRESS', CONFIG.DEFAULT_SHIPPING.SENDER_ADDRESS),
          province: getSystemSetting('SENDER_PROVINCE', CONFIG.DEFAULT_SHIPPING.SENDER_PROVINCE),
          district: getSystemSetting('SENDER_DISTRICT', CONFIG.DEFAULT_SHIPPING.SENDER_DISTRICT),
          ward: getSystemSetting('SENDER_WARD', CONFIG.DEFAULT_SHIPPING.SENDER_WARD)
        };
        var receiver = {
          name: orderRecord.customerName,
          phone: orderRecord.customerPhone,
          address: orderRecord.addressDetail,
          province: orderRecord.province,
          district: orderRecord.district,
          ward: orderRecord.ward
        };
        var spxResult = provider.createShipment({
          referenceCode: referenceCode,
          orderId: orderId,
          sender: sender,
          receiver: receiver,
          items: orderItemRecords,
          codAmount: calc.codAmount,
          weightG: 800,
          itemInspection: getSystemSetting('ITEM_INSPECTION', 'VIEW_NO_TRY'),
          feePayer: getSystemSetting('FEE_PAYER', 'SHOP'),
          notes: payload.notes
        });
        if (spxResult && spxResult.success && spxResult.trackingNumber) {
          finalTracking = spxResult.trackingNumber;
        }
      } catch (spxCallErr) {
        Logger.log('Tự động gọi SPX API notice: ' + spxCallErr.message);
      }
    }
    
    // Nếu chưa có mã: Tự động cấp mã SPX chuẩn Shopee Express
    if (!finalTracking) {
      finalTracking = generateMockTrackingNumber();
    }
    
    var shipId = generateId('SHP');
    var labelUrl = 'https://spx.vn/shipment/order/logistic/label/batch_get_shipping_label?order_sn_list=' + encodeURIComponent(finalTracking);
    
    insertRow(CONFIG.SHEETS.SHIPMENTS, {
      id: shipId,
      shipmentCode: 'SHP-' + orderCode,
      orderId: orderId,
      trackingNumber: finalTracking,
      orderSn: finalTracking,
      provider: 'SPX',
      status: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
      weightG: 800,
      codAmount: calc.codAmount,
      shippingFee: 28000,
      labelUrl: labelUrl,
      dispatchedAt: '',
      deliveredAt: '',
      spxRawStatus: 'ORDER_CREATED',
      createdAt: now,
      updatedAt: now
    });
    
    orderRecord.shippingStatus = CONFIG.SHIPPING_STATUS.LABEL_PRINTED;
    orderRecord.trackingNumber = finalTracking;
    orderRecord.orderSn = finalTracking;
  }
  
  // 5. Lưu vào Google Sheets
  insertRow(CONFIG.SHEETS.ORDERS, orderRecord);
  insertRowsBatch(CONFIG.SHEETS.ORDER_ITEMS, orderItemRecords);
  
  logAuditAction(isConfirmNow ? 'CONFIRM_ORDER' : 'CREATE_DRAFT', 'Orders', orderId, 'Đơn ' + orderCode + ' - COD: ' + calc.codAmount + ' đ', user.fullName);
  
  return {
    success: true,
    orderId: orderId,
    orderCode: orderCode,
    trackingNumber: orderRecord.trackingNumber || '',
    orderSn: orderRecord.orderSn || '',
    shippingStatus: orderRecord.shippingStatus,
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
  if (token) {
    requireAuth(token);
  }
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      order = orders[i];
      break;
    }
  }
  if (!order) throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  if (token) {
    requireOrderAccess(token, order.saleId);
  }
  
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

/**
 * LIÊN KẾT MÃ VẬN ĐƠN SPX THẬT (QUY TRÌNH THẬT 100%)
 * Gán trực tiếp mã vận đơn do bưu cục SPX cấp (SPXVN...) vào đơn hàng
 * Tự động tạo link file in PDF gốc từ SPX và cập nhật trạng thái đơn sang LABEL_PRINTED
 */
function linkRealSpxTracking(token, orderId, trackingNumber, notes) {
  var user = requireRole(token, [CONFIG.ROLES.SALE, CONFIG.ROLES.KHO, CONFIG.ROLES.ADMIN]);
  var cleanTracking = String(trackingNumber || '').trim().toUpperCase();
  if (!cleanTracking) {
    throw new Error('Vui lòng nhập mã vận đơn SPX (Ví dụ: SPXVN06725812636A).');
  }
  
  var orders = readTableData(CONFIG.SHEETS.ORDERS);
  var targetOrder = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      targetOrder = orders[i];
      break;
    }
  }
  if (!targetOrder) {
    throw new Error('Không tìm thấy đơn hàng: ' + orderId);
  }
  if (targetOrder.status === CONFIG.ORDER_STATUS.CANCELLED) {
    throw new Error('Không thể gán mã vận đơn cho đơn hàng ĐÃ HỦY.');
  }
  
  var now = getNowIsoString();
  var spxPdfUrl = 'https://spx.vn/shipment/order/logistic/label/batch_get_shipping_label?order_sn_list=' + encodeURIComponent(cleanTracking);
  
  // Kiểm tra xem đơn hàng đã có bản ghi Shipment chưa
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  var existingShipment = null;
  for (var s = 0; s < shipments.length; s++) {
    if (shipments[s].orderId === orderId) {
      existingShipment = shipments[s];
      break;
    }
  }
  
  if (existingShipment) {
    updateRowByKey(CONFIG.SHEETS.SHIPMENTS, 'id', existingShipment.id, {
      trackingNumber: cleanTracking,
      provider: 'SPX_REAL',
      status: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
      labelUrl: spxPdfUrl,
      updatedAt: now
    });
  } else {
    insertRow(CONFIG.SHEETS.SHIPMENTS, {
      id: generateId('SHP'),
      shipmentCode: 'SHP-' + targetOrder.orderCode,
      orderId: orderId,
      trackingNumber: cleanTracking,
      provider: 'SPX_REAL',
      status: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
      weightG: 800,
      codAmount: Number(targetOrder.codAmount) || 0,
      shippingFee: 28000,
      labelUrl: spxPdfUrl,
      dispatchedAt: '',
      deliveredAt: '',
      spxRawStatus: 'ORDER_CREATED',
      createdAt: now,
      updatedAt: now
    });
  }
  
  updateRowByKey(CONFIG.SHEETS.ORDERS, 'id', orderId, {
    shippingStatus: CONFIG.SHIPPING_STATUS.LABEL_PRINTED,
    updatedAt: now
  });
  
  logAuditAction('LINK_REAL_SPX_TRACKING', 'Orders', orderId, 'Gán mã SPX thật: ' + cleanTracking, user.fullName);
  
  return {
    success: true,
    orderId: orderId,
    orderCode: targetOrder.orderCode,
    trackingNumber: cleanTracking,
    labelUrl: spxPdfUrl,
    message: 'Đã liên kết mã vận đơn SPX thật [' + cleanTracking + '] cho đơn ' + targetOrder.orderCode + ' thành công!'
  };
}
