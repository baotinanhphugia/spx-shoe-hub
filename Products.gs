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
