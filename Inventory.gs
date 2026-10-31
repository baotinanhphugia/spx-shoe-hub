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
