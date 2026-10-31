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
function executeCreateShipmentJob(payload, extraOptions) {
  var orderId = (typeof payload === 'object' && payload !== null) ? payload.orderId : payload;
  var weightG = (payload && payload.weightG) || (extraOptions && extraOptions.weightG) || 800;
  var notes = (payload && payload.notes) || (extraOptions && extraOptions.notes) || '';
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
  
  var allItems = readTableData(CONFIG.SHEETS.ORDER_ITEMS);
  var orderItems = allItems.filter(function(it) { return it.orderId === orderId; });

  var spxResult = provider.createShipment({
    referenceCode: referenceCode,
    orderId: order.id,
    sender: sender,
    receiver: receiver,
    items: orderItems,
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
    orderSn: spxResult.orderSn || '',
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
    trackingNumber: spxResult.trackingNumber,
    orderSn: spxResult.orderSn || '',
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
