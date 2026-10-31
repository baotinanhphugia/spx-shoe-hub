/**
 * Config.gs - Cấu hình hệ thống, Enums và Hằng số quản trị
 * Runtime: V8, Múi giờ: Asia/Ho_Chi_Minh
 */

const CONFIG = {
  APP_NAME: 'SPX SHOE HUB',
  APP_SUBTITLE: 'Quản lý Bán hàng, Kho & Vận đơn SPX',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  CURRENCY: 'VND',

  // Tên các bảng tính trong Google Sheets
  SHEETS: {
    USERS: 'Users',
    PRODUCTS: 'Products',
    VARIANTS: 'Variants',
    STOCK: 'Stock',
    STOCK_MOVEMENTS: 'StockMovements',
    ORDERS: 'Orders',
    ORDER_ITEMS: 'OrderItems',
    SHIPMENTS: 'Shipments',
    RETURNS: 'Returns',
    PAYMENTS: 'Payments',
    RECONCILIATIONS: 'Reconciliations',
    JOBS: 'Jobs',
    AUDIT_LOGS: 'AuditLogs',
    SETTINGS: 'Settings',
    CUSTOMERS: 'Customers'
  },

  // Vai trò người dùng (RBAC)
  ROLES: {
    ADMIN: 'ADMIN',
    SALE: 'SALE',
    KHO: 'KHO',
    DOI_SOAT: 'DOI_SOAT'
  },

  // Trạng thái đơn hàng
  ORDER_STATUS: {
    DRAFT: 'DRAFT',           // Nháp (chưa giữ hàng)
    CONFIRMED: 'CONFIRMED',   // Đã chốt (đã giữ hàng)
    CANCELLED: 'CANCELLED',   // Đã hủy (giải phóng giữ hàng)
    CLOSED: 'CLOSED'          // Đã hoàn tất/Đóng
  },

  // Trạng thái vận chuyển
  SHIPPING_STATUS: {
    UNSHIPPED: 'UNSHIPPED',           // Chưa gửi
    QUEUED: 'QUEUED',                 // Đang trong hàng đợi tạo SPX
    LABEL_PRINTED: 'LABEL_PRINTED',   // Đã tạo vận đơn / In tem
    DISPATCHED: 'DISPATCHED',         // Đã bàn giao SPX (ghi xuất kho)
    DELIVERING: 'DELIVERING',         // Đang giao hàng
    DELIVERED: 'DELIVERED',           // Giao thành công
    DELIVERY_FAILED: 'DELIVERY_FAILED', // Giao thất bại
    RETURNING: 'RETURNING',           // Đang chuyển hoàn
    RETURNED: 'RETURNED'              // Đã hoàn về kho (đã QC phân loại)
  },

  // Trạng thái thanh toán
  PAYMENT_STATUS: {
    UNPAID: 'UNPAID',               // Chưa thanh toán
    PARTIAL: 'PARTIAL',             // Đã đặt cọc / trả một phần
    WAITING_COD: 'WAITING_COD',     // Chờ đối soát COD
    RECONCILED: 'RECONCILED',       // Đã đối soát xong
    REFUNDED: 'REFUNDED',           // Đã hoàn tiền
    DISCREPANCY: 'DISCREPANCY'      // Lệch số liệu tiền
  },

  // Loại biến động tồn kho
  STOCK_MOVEMENT_TYPE: {
    IMPORT: 'IMPORT',               // Nhập kho mới
    RESERVE: 'RESERVE',             // Giữ hàng khi chốt đơn
    UNRESERVE: 'UNRESERVE',         // Hủy giữ hàng khi hủy đơn
    EXPORT_ORDER: 'EXPORT_ORDER',   // Xuất kho khi bàn giao SPX
    RETURN_PASS: 'RETURN_PASS',     // Nhận hàng hoàn đạt chuẩn -> cộng tồn bán được
    RETURN_FAIL: 'RETURN_FAIL',     // Nhận hàng hoàn lỗi -> cộng tồn lỗi
    ADJUST_UP: 'ADJUST_UP',         // Điều chỉnh tăng (kiểm kê/sửa lỗi)
    ADJUST_DOWN: 'ADJUST_DOWN'      // Điều chỉnh giảm (hao hụt/hư hỏng)
  },

  // Loại hàng hoàn & đổi
  RETURN_TYPE: {
    RETURN: 'RETURN',               // Khách trả hàng hoàn tiền / hoàn giao thất bại
    EXCHANGE: 'EXCHANGE'            // Đổi size / đổi mẫu
  },

  RETURN_STATUS: {
    REQUESTED: 'REQUESTED',         // Chờ nhận hàng về
    RETURNING: 'RETURNING',         // Đang trên đường hoàn về
    RECEIVED_PASS: 'RECEIVED_PASS', // Kho đã nhận, đạt điều kiện bán lại
    RECEIVED_FAIL: 'RECEIVED_FAIL', // Kho đã nhận, phát hiện lỗi hỏng
    CLOSED: 'CLOSED'                // Đã xử lý xong
  },

  // Trạng thái Job trong Queue
  JOB_STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    UNKNOWN_RESULT: 'UNKNOWN_RESULT' // Trường hợp mất kết nối/timeout cần đối soát lại
  },

  JOB_TYPE: {
    CREATE_SHIPMENT: 'CREATE_SHIPMENT',
    SYNC_STATUS: 'SYNC_STATUS',
    CANCEL_SHIPMENT: 'CANCEL_SHIPMENT',
    RECONCILE_BATCH: 'RECONCILE_BATCH'
  },

  // Cấu hình kho gửi hàng & vận chuyển mặc định (Đã đồng bộ chính xác với tài khoản SPX của Shop)
  DEFAULT_SHIPPING: {
    SENDER_NAME: 'Lê Thị Thu Hằng',
    SENDER_PHONE: '03981138678',
    SENDER_PHONE_INTL: '843981138678',
    SENDER_ADDRESS: 'Cửa Hàng Phú Gia, Phố Trương Xá',
    SENDER_PROVINCE: 'Tỉnh Hưng Yên',
    SENDER_PROVINCE_ID: 6100016,
    SENDER_DISTRICT: 'Xã Nghĩa Dân',
    SENDER_DISTRICT_ID: 6102399,
    SENDER_WARD: 'Xã Nghĩa Dân',
    SENDER_POSTCODE: '',
    SENDER_ADDRESS_ID: '2072983108141670400',
    SENDER_ADDRESS_PK_ID: 42528070,
    ADDRESS_VERSION: 2,
    SERVICE_ID: 53001,              // SPX Standard Service (Giao hàng Tiêu Chuẩn)
    BOX_WEIGHT_G: 150,              // Khối lượng vỏ hộp đóng gói
    PAIR_WEIGHT_G: 650,             // Khối lượng tham khảo 1 đôi giày
    ITEM_INSPECTION: 'VIEW_NO_TRY', // 'VIEW_NO_TRY' (Xem không thử), 'VIEW_TRY' (Cho thử), 'NO_VIEW' (Không xem)
    FEE_PAYER: 'SHOP',              // 'SHOP' (Shop trả), 'BUYER' (Khách trả)
    APPLY_REFUSAL_FEE: true,        // Thu phí từ chối nhận nếu khách từ chối
    REFUSAL_FEE_AMOUNT: 15000,      // Mức phí từ chối theo chính sách SPX
    DEFAULT_DELIVERY_NOTE: 'Hàng dễ vỡ, vui lòng gọi trước khi giao. Giày đóng hộp cẩn thận.'
  },

  // Cấu hình SPX API mặc định
  SPX: {
    MODE: 'REAL',                   // 'REAL' (Kết nối tài khoản SPX thật) hoặc 'MOCK' (Giả lập)
    BASE_URL: 'https://spx.vn',
    APP_ID: '102384205900430',       // Mã người dùng (User ID)
    APP_SECRET: '8d1aefec-ba63-4a34-984b-26fc1d5054ea', // Secret Key
    MERCHANT_ID: '15093594984',      // ID tài khoản (Account ID)
    COOKIE: 'spx_token=ffY01SJcbz7YbaqH3FTB0JMQIZHgDwDQWiP6tDvCzDQugXaIQDWRlIf1TW5qtmXr; spx_sid=3bc86c05279940a853cb2b5d4a6748dabfcbfe908562e6789136674ae48c96bd; login_type=1; login_status=true; nss_cid=VN;',
    TIMEOUT_MS: 20000
  },

  // Khóa Script Properties
  PROP_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    SPX_MODE: 'SPX_MODE',
    SPX_APP_ID: 'SPX_APP_ID',
    SPX_APP_SECRET: 'SPX_APP_SECRET',
    SPX_MERCHANT_ID: 'SPX_MERCHANT_ID',
    SPX_BASE_URL: 'SPX_BASE_URL',
    SPX_COOKIE: 'SPX_COOKIE',
    SYSTEM_INIT: 'SYSTEM_INIT'
  }
};

/**
 * Trả về thời gian hiện tại định dạng ISO theo múi giờ Asia/Ho_Chi_Minh
 */
function getNowIsoString() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Trả về ngày định dạng yyyy-MM-dd
 */
function getTodayDateString() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
}

/**
 * Tạo mã UUID v4 ngắn gọn hoặc duy nhất cho các bản ghi
 */
function generateId(prefix) {
  var raw = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  return prefix ? (prefix + '-' + raw) : raw;
}

/**
 * Sinh mã đơn hàng hiển thị dễ nhớ: DH-yyyyMMdd-XXXX
 */
function generateOrderCode() {
  var datePart = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd");
  var randPart = Math.floor(1000 + Math.random() * 9000);
  return 'DH-' + datePart + '-' + randPart;
}

/**
 * Sinh mã vận đơn SPX giả lập: SPXVNxxxxxxxx
 */
function generateMockTrackingNumber() {
  var rand = Math.floor(1000000000 + Math.random() * 9000000000);
  return 'SPXVN' + rand;
}
