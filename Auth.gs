/**
 * Auth.gs - Quản lý danh tính, phiên làm việc và phân quyền RBAC
 * Xử lý: Google Workspace / Gmail cá nhân, Session Cache, kiểm tra quyền nghiêm ngặt phía server.
 */

const AUTH_CONFIG = {
  SALT: 'SPX_SHOE_HUB_SECURE_SALT_2026',
  SESSION_TTL_SECONDS: 21600 // 6 giờ
};

/**
 * Băm mã PIN / Mật khẩu bằng SHA-256 kèm Salt
 */
function hashPin(pin) {
  if (!pin) return '';
  var raw = pin + AUTH_CONFIG.SALT;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var byteVal = digest[i];
    if (byteVal < 0) byteVal += 256;
    var str = byteVal.toString(16);
    if (str.length === 1) str = '0' + str;
    hex += str;
  }
  return hex;
}

/**
 * Kiểm tra danh tính người dùng Google hiện tại
 * Trả về thông tin User nếu Session.getActiveUser().getEmail() khớp với một tài khoản ACTIVE trong hệ thống
 */
function checkGoogleActiveUser() {
  try {
    var activeEmail = Session.getActiveUser().getEmail();
    if (activeEmail && activeEmail.trim() !== '') {
      var users = readTableData(CONFIG.SHEETS.USERS);
      var normalizedEmail = activeEmail.trim().toLowerCase();
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (u.email && u.email.trim().toLowerCase() === normalizedEmail && u.status === 'ACTIVE') {
          return createSessionForUser(u);
        }
      }
    }
  } catch (e) {
    Logger.log('checkGoogleActiveUser error: ' + e.message);
  }
  return null;
}

/**
 * Đăng nhập bằng Email/SĐT và Mã PIN
 * Giải quyết trường hợp triển khai Web App chạy bằng tài khoản chủ (Execute as Me)
 * khiến Session.getActiveUser().getEmail() trả về chuỗi rỗng
 */
function loginWithCredentials(identifier, pin) {
  if (!identifier || !pin) {
    throw new Error('Vui lòng nhập email/số điện thoại và mã PIN.');
  }
  
  var users = readTableData(CONFIG.SHEETS.USERS);
  var targetUser = null;
  var inputId = identifier.trim().toLowerCase();
  var inputHash = hashPin(String(pin).trim());
  
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uEmail = (u.email || '').trim().toLowerCase();
    var uPhone = String(u.phone || \"\").trim();
    if ((uEmail === inputId || uPhone === inputId) && u.status === 'ACTIVE') {
      if (u.pinHash === inputHash) {
        targetUser = u;
        break;
      } else {
        throw new Error('Mã PIN không chính xác.');
      }
    }
  }
  
  if (!targetUser) {
    throw new Error('Không tìm thấy tài khoản hoặc tài khoản đã bị khóa.');
  }
  
  return createSessionForUser(targetUser);
}

/**
 * Tạo phiên làm việc mới và lưu vào CacheService
 */
function createSessionForUser(user) {
  var token = 'SES-' + Utilities.getUuid();
  var sessionData = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    loginTime: getNowIsoString()
  };
  
  var cache = CacheService.getScriptCache();
  cache.put(token, JSON.stringify(sessionData), AUTH_CONFIG.SESSION_TTL_SECONDS);
  
  // Ghi nhật ký đăng nhập
  logAuditAction('LOGIN', 'Users', user.id, 'Đăng nhập thành công với vai trò: ' + user.role, user.fullName);
  
  return {
    token: token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone
    }
  };
}

/**
 * Xác thực phiên làm việc từ Client gửi lên
 * Trả về thông tin người dùng thực tế đã được xác thực phía server
 */
function authenticateSession(token) {
  if (!token || typeof token !== 'string') {
    // Thử kiểm tra Google Account nếu không có token
    var googleSession = checkGoogleActiveUser();
    if (googleSession) return googleSession.user;
    throw new Error('Yêu cầu chưa được xác thực. Vui lòng đăng nhập.');
  }
  
  var cache = CacheService.getScriptCache();
  var cached = cache.get(token);
  if (!cached) {
    // Thử kiểm tra Google Account
    var gSession = checkGoogleActiveUser();
    if (gSession) return gSession.user;
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  
  try {
    var user = JSON.parse(cached);
    // Gia hạn cache nếu hoạt động (sliding expiration)
    cache.put(token, cached, AUTH_CONFIG.SESSION_TTL_SECONDS);
    return user;
  } catch (e) {
    throw new Error('Dữ liệu phiên không hợp lệ.');
  }
}

/**
 * Đăng xuất hủy phiên
 */
function logoutSession(token) {
  if (token) {
    var cache = CacheService.getScriptCache();
    cache.remove(token);
  }
  return { success: true };
}

/**
 * Middleware: Yêu cầu quyền người dùng hợp lệ
 */
function requireAuth(token) {
  return authenticateSession(token);
}

/**
 * Middleware: Yêu cầu vai trò cụ thể (RBAC)
 */
function requireRole(token, allowedRoles) {
  var user = requireAuth(token);
  if (!allowedRoles || allowedRoles.length === 0) return user;
  
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ' + allowedRoles.join(', ') + '. Quyền của bạn: ' + user.role);
  }
  return user;
}

/**
 * Middleware: Kiểm tra quyền truy cập đơn hàng cho Sale
 * Sale chỉ được xem và sửa đơn hàng do chính mình tạo. Admin, Kho, Đối soát được xem toàn bộ.
 */
function requireOrderAccess(token, orderSaleId) {
  var user = requireAuth(token);
  if (user.role === CONFIG.ROLES.SALE) {
    if (orderSaleId && orderSaleId !== user.userId) {
      throw new Error('Sale chỉ có quyền truy cập đơn hàng do chính mình phụ trách.');
    }
  }
  return user;
}

/**
 * Lấy danh sách tài khoản nhân viên (Chỉ Admin mới có quyền)
 */
function getStaffList(token) {
  requireRole(token, [CONFIG.ROLES.ADMIN]);
  var users = readTableData(CONFIG.SHEETS.USERS);
  // Che mã pinHash trước khi gửi về client
  return users.map(function(u) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  });
}

/**
 * Tạo hoặc cập nhật nhân viên (Chỉ Admin)
 */
function saveStaffUser(token, staffData) {
  var currentUser = requireRole(token, [CONFIG.ROLES.ADMIN]);
  var now = getNowIsoString();
  
  if (!staffData.fullName || !staffData.email || !staffData.role) {
    throw new Error('Vui lòng điền đủ họ tên, email và vai trò.');
  }
  
  var users = readTableData(CONFIG.SHEETS.USERS);
  var existing = null;
  if (staffData.id) {
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === staffData.id) {
        existing = users[i];
        break;
      }
    }
  }
  
  if (existing) {
    var updatePayload = {
      fullName: staffData.fullName,
      email: staffData.email,
      phone: staffData.phone || '',
      role: staffData.role,
      status: staffData.status || 'ACTIVE',
      updatedAt: now
    };
    if (staffData.pin && String(staffData.pin).trim() !== '') {
      updatePayload.pinHash = hashPin(String(staffData.pin).trim());
    }
    updateRowByKey(CONFIG.SHEETS.USERS, 'id', staffData.id, updatePayload);
    logAuditAction('UPDATE_STAFF', 'Users', staffData.id, 'Cập nhật nhân viên: ' + staffData.fullName, currentUser.fullName);
  } else {
    var newId = generateId('USR');
    var pinToSet = staffData.pin ? String(staffData.pin).trim() : '123456';
    var newUser = {
      id: newId,
      email: staffData.email,
      fullName: staffData.fullName,
      role: staffData.role,
      phone: staffData.phone || '',
      pinHash: hashPin(pinToSet),
      status: staffData.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    insertRow(CONFIG.SHEETS.USERS, newUser);
    logAuditAction('CREATE_STAFF', 'Users', newId, 'Tạo mới nhân viên: ' + staffData.fullName + ' (' + staffData.role + ')', currentUser.fullName);
  }
  
  return { success: true };
}
