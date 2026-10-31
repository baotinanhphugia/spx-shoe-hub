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
