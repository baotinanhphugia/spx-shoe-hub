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
  var shipments = readTableData(CONFIG.SHEETS.SHIPMENTS);
  
  var orderMap = {};
  for (var i = 0; i < orders.length; i++) {
    orderMap[orders[i].id] = orders[i];
  }
  
  var shipMap = {};
  for (var s = 0; s < shipments.length; s++) {
    if (shipments[s].orderId) {
      shipMap[shipments[s].orderId] = shipments[s];
    }
  }
  
  returns.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  return returns.map(function(r) {
    var origOrder = orderMap[r.originalOrderId] || {};
    var newOrder = orderMap[r.newOrderId] || {};
    var origShip = shipMap[r.originalOrderId] || {};
    var newShip = shipMap[r.newOrderId] || {};
    
    // Ưu tiên lấy Mã vận đơn SPX chuẩn từ bảng Shipments hoặc Orders
    var spxTracking = r.trackingNumber || origShip.trackingNumber || origOrder.trackingNumber || '';
    var spxOrderSn = origShip.orderSn || origOrder.orderSn || '';
    
    return {
      id: r.id,
      returnCode: r.returnCode,
      trackingNumber: spxTracking,
      orderSn: spxOrderSn,
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
