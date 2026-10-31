/**
 * AuditLog.gs - Ghi nhận nhật ký kiểm toán và theo dõi thay đổi dữ liệu
 * Giữ vững tính minh bạch, hỗ trợ điều tra lỗi và kiểm soát bảo mật.
 */

/**
 * Ghi một bản ghi nhật ký kiểm toán
 */
function logAuditAction(action, entity, entityId, detail, performedBy) {
  try {
    var now = getNowIsoString();
    var cleanDetail = sanitizeAuditDetail(detail);
    var entry = {
      id: generateId('AUD'),
      action: action,
      entity: entity,
      entityId: String(entityId || ''),
      detail: cleanDetail,
      performedBy: String(performedBy || 'System'),
      createdAt: now
    };
    insertRow(CONFIG.SHEETS.AUDIT_LOGS, entry);
  } catch (e) {
    Logger.log('Lỗi ghi AuditLog: ' + e.message);
  }
}

/**
 * Che dấu các chuỗi nhạy cảm (Secret, Token, Mật khẩu) trong nội dung nhật ký
 */
function sanitizeAuditDetail(detail) {
  if (!detail) return '';
  var text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  // Che mã bí mật
  text = text.replace(/(pin|password|secret|token|key)\s*[:=]\s*["']?([^"',\s]+)/gi, '$1: ***');
  return text;
}

/**
 * Lấy danh sách nhật ký kiểm toán gần nhất (Chỉ Admin)
 */
function getRecentAuditLogs(token, limit) {
  requireRole(token, [CONFIG.ROLES.ADMIN]);
  var logs = readTableData(CONFIG.SHEETS.AUDIT_LOGS);
  var max = limit || 100;
  // Sắp xếp giảm dần theo thời gian
  logs.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return logs.slice(0, max);
}
