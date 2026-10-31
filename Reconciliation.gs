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
