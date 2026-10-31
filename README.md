# HƯỚNG DẪN TRIỂN KHAI VÀ VẬN HÀNH HỆ THỐNG SPX SHOE HUB
## Web App Nội Bộ Quản Lý SALE – KHO GIÀY – VẬN ĐƠN SPX
### Kiến trúc Hiện Đại: GitHub Pages (Frontend) + Google Apps Script (Backend REST API) + Google Sheets (Database)

Hệ thống được thiết kế hoàn chỉnh theo quy chuẩn giao diện và nghiệp vụ của **SPX (Shopee Express)**. Hệ thống tách biệt hoàn toàn giữa giao diện người dùng và tầng xử lý nghiệp vụ, đảm bảo tốc độ phản hồi cực nhanh, không phụ thuộc vào khung iframe của Google Apps Script, đồng thời bảo vệ toàn vẹn dữ liệu trong Google Spreadsheet và vận hành tự động với Open API SPX thật của shop.

---

## 1. Kiến Trúc Hệ Thống (Architecture Overview)

```
[ Trình duyệt Web / Mobile ]
            │
            ▼
┌──────────────────────────────────────────────┐
│  FRONTEND: GitHub Pages (index.html)        │
│  - Giao diện SPX tone Cam đỏ #EE4D2D         │
│  - 11 Phân hệ nghiệp vụ chuyên sâu           │
│  - Lưu phiên đăng nhập bảo mật (localStorage)│
│  - Tự động gợi ý & tra cứu khách quen        │
│  - Tra cứu mã bưu cục SPX Route              │
└──────────────────────┬───────────────────────┘
                       │ HTTP POST (CORS-friendly: text/plain)
                       ▼
┌──────────────────────────────────────────────┐
│  BACKEND: Google Apps Script Web App (API)   │
│  - doPost(e) / doGet(e) RESTful JSON Router  │
│  - Phân quyền RBAC 4 vai trò nghiêm ngặt     │
│  - Khóa nguyên tử LockService (chống trùng)  │
│  - Hàng đợi ngầm (Queue) + Trigger 5 phút    │
│  - Kết nối SPX Live API (HMAC-SHA256)        │
└──────────────────────┬───────────────────────┘
                       │ Sheets API v4
                       ▼
┌──────────────────────────────────────────────┐
│  DATABASE: Google Spreadsheet (15 Tabs)      │
│  - Users, Products, Variants, Stock,         │
│  - StockMovements, Orders, OrderItems,       │
│  - Shipments, Returns, Payments,             │
│  - Reconciliations, Jobs, AuditLogs,         │
│  - Settings, Customers (Khách hàng)          │
└──────────────────────────────────────────────┘
```

---

## 2. Thông Tin Kết Nối SPX Thật Của Shop

Hệ thống đã được tích hợp sẵn thông số tài khoản SPX Live thật do chủ shop cung cấp:
- **Nền tảng:** Open API SPX Việt Nam (`https://spx.vn`)
- **Mã người dùng (User ID / App ID):** `102384205900430`
- **Mã bảo mật (Secret Key / API Token):** `8d1aefec-ba63-4a34-984b-26fc1d5054ea`
- **ID tài khoản (Account ID / Merchant ID):** `15093594984`
- **Mã dịch vụ vận chuyển:** `SPX_STANDARD` (Giao hàng tiêu chuẩn SPX)
- **Cơ chế xác thực:** Chữ ký số mã hóa `HMAC-SHA256` tự động theo thời gian thực (Timestamp Unix).

---

## 3. Cấu Trúc Thư Mục Dự Án

```text
├── index.html              # Frontend chạy trên GitHub Pages (Single Page App độc lập)
├── Index.html              # Frontend chạy bên trong Google Apps Script (HTML Service)
├── Code.gs                 # File hợp nhất 14 module backend (Dùng copy-paste 1 lần vào Apps Script)
├── appsscript.json         # File cấu hình Manifest (V8 runtime, timeZone Asia/Ho_Chi_Minh, Sheets API)
├── Config.gs               # Hằng số cấu hình, Enums, thông số SPX, bảng tính 15 tab
├── Database.gs             # Schema 15 bảng tính, cơ chế khóa LockService, chống Formula Injection
├── Auth.gs                 # Xác thực token, phân quyền RBAC 4 vai trò, mã hóa SHA-256 PIN
├── AuditLog.gs             # Nhật ký kiểm toán hành động, che giấu dữ liệu nhạy cảm (PII/Secret)
├── Products.gs             # Quản lý danh mục giày, mẫu mã, màu sắc, hệ size EU và SKU chuẩn hóa
├── Inventory.gs            # Quản lý 7 trạng thái tồn kho, ma trận Mẫu-Màu x Size, kiểm soát khả dụng
├── Orders.gs               # Vòng đời đơn hàng, giữ hàng khi chốt, đổi size, đồng bộ tab Customers
├── SpxAdapter.gs           # Bộ điều hợp kết nối SPX Live API & Mock, in phiếu giao hàng chuẩn 100x140mm
├── Queue.gs                # Hàng đợi bất đồng bộ xử lý vận đơn, Time-driven Trigger 5 phút
├── Returns.gs              # Quy trình kiểm định chất lượng hàng hoàn QC (nhập lại bán vs hàng lỗi)
├── Reconciliation.gs       # Đối soát tiền COD, phí ship, import CSV ngân hàng, khóa chống đối soát trùng
├── Reports.gs              # Báo cáo Cohort theo ngày chốt đơn vs Dòng tiền theo ngày giao hàng, xuất CSV
├── ServerApi.gs            # Bộ định tuyến RESTful API (doPost, doGet, dispatchApiAction)
├── Tests.gs                # Bộ 15 bài kiểm thử nghiệm thu tự động toàn bộ luồng nghiệp vụ
├── SPX_INTEGRATION.md      # Tài liệu chi tiết thông số kết nối, API mapping và trạng thái SPX
└── README.md               # Sổ tay hướng dẫn chi tiết từ A-Z
```

---

## 4. Hướng Dẫn Triển Khai Chi Tiết (3 Bước)

### PHẦN 1: Triển Khai Backend Google Apps Script & Google Sheets

1. **Tạo Google Spreadsheet mới:**
   - Mở [Google Drive](https://drive.google.com/) -> Bấm **Mới (New)** -> **Google Trang tính (Google Sheets)**.
   - Đặt tên file là: `SPX_SHOE_HUB_DATABASE`.
   - Copy **ID của Google Sheet** trên thanh địa chỉ URL:
     `https://docs.google.com/spreadsheets/d/`**`[SPREADSHEET_ID]`**`/edit`

2. **Mở Google Apps Script:**
   - Trên file Google Sheets vừa tạo, vào menu **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
   - Đổi tên dự án Apps Script thành `SPX_Shoe_Hub_Backend`.

3. **Cập nhật mã nguồn Backend:**
   - Xóa toàn bộ nội dung file `Mã.gs` mặc định.
   - Mở file [Code.gs](file:///Volumes/192.168.1.109/du%CC%9B%CC%A3%20a%CC%81n%20va%CC%A3%CC%82n%20%C4%91o%CC%9Bn%20/Code.gs) trong thư mục dự án, copy toàn bộ nội dung và dán vào trình soạn thảo Apps Script.
   - Vào **Cài đặt dự án (Project Settings)** (biểu tượng bánh răng bên trái) -> Tích chọn **Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa**.
   - Mở file `appsscript.json` trong Apps Script, dán toàn bộ nội dung từ file [appsscript.json](file:///Volumes/192.168.1.109/du%CC%9B%CC%A3%20a%CC%81n%20va%CC%A3%CC%82n%20%C4%91o%CC%9Bn%20/appsscript.json) của dự án.
   - Tại mục **Dịch vụ (Services)** cạnh danh sách file bên trái, bấm dấu `+`, chọn **Google Sheets API** (phiên bản `v4`), nhấn **Thêm (Add)**.

4. **Khởi tạo 15 Bảng Cơ sở Dữ liệu & Dữ liệu Mẫu:**
   - Trên thanh công cụ trên cùng của Apps Script, tại ô chọn hàm, chọn hàm `setupDatabase`.
   - Nhấn nút **Chạy (Run)**.
   - Google sẽ hiện hộp thoại yêu cầu cấp quyền: Bấm **Xem lại quyền** -> Chọn tài khoản Google của bạn -> Bấm **Nâng cao (Advanced)** -> Bấm **Đi tới SPX_Shoe_Hub_Backend (Không an toàn)** -> Bấm **Cho phép (Allow)**.
   - *Hàm sẽ tự động tạo đủ 15 tab tính định dạng chuẩn nhận diện SPX, gồm: Users, Products, Variants, Stock, StockMovements, Orders, OrderItems, Shipments, Returns, Payments, Reconciliations, Jobs, AuditLogs, Settings, và Customers; đồng thời nạp 4 nhân viên mẫu và danh mục giày hot ban đầu.*

5. **Cài đặt Trigger tự động cho Hàng đợi Vận đơn (Queue):**
   - Tại ô chọn hàm, chọn hàm `installTriggers`.
   - Bấm **Chạy (Run)**.
   - Hệ thống sẽ tự động kích hoạt tiến trình xử lý ngầm mỗi 5 phút/lần.

6. **Triển khai Web App (Deploy REST API):**
   - Ở góc trên bên phải, bấm nút xanh **Triển khai (Deploy)** -> Chọn **Triển khai mới (New deployment)**.
   - Bấm vào biểu tượng bánh răng bên cạnh mục *Chọn loại*, chọn **Ứng dụng web (Web app)**.
   - Điền thông tin:
     - **Mô tả (Description):** `SPX Shoe Hub REST API v1.0`
     - **Thực thi dưới dạng (Execute as):** **Tôi (Me - your email)**
     - **Ai có quyền truy cập (Who has access):** **Bất kỳ ai (Anyone)** *(Bắt buộc chọn Anyone để GitHub Pages có thể gửi yêu cầu API)*.
   - Nhấn nút **Triển khai (Deploy)**.
   - Copy đường link **URL ứng dụng web** (có dạng: `https://script.google.com/macros/s/AKfycb.../exec`).

---

### PHẦN 2: Triển Khai Frontend Lên GitHub Pages

1. **Tạo GitHub Repository mới:**
   - Đăng nhập vào [GitHub](https://github.com/) -> Bấm **New Repository**.
   - Đặt tên repository: ví dụ `spx-shoe-hub`.
   - Chọn chế độ **Public**.
   - Bấm **Create repository**.

2. **Tải file giao diện lên Repository:**
   - Tải file [index.html](file:///Volumes/192.168.1.109/du%CC%9B%CC%A3%20a%CC%81n%20va%CC%A3%CC%82n%20%C4%91o%CC%9Bn%20/index.html) ở thư mục gốc dự án lên repository (có thể dùng `git push` hoặc kéo thả trực tiếp trên giao diện web của GitHub bằng nút **Add file** -> **Upload files**).
   - Đảm bảo file nằm ngay tại thư mục gốc của repository với tên `index.html` (chữ thường).

3. **Bật tính năng GitHub Pages:**
   - Vào tab **Settings** của repository trên GitHub.
   - Tại thanh menu bên trái, chọn mục **Pages**.
   - Ở phần **Build and deployment** -> **Source**: Chọn **Deploy from a branch**.
   - Ở phần **Branch**: Chọn nhánh `main` (hoặc `master`), thư mục `/ (root)`, rồi bấm **Save**.
   - Chờ khoảng 30-60 giây, GitHub Pages sẽ tạo ra liên kết website có dạng:
     `https://<your-username>.github.io/spx-shoe-hub/`

---

### PHẦN 3: Kết Nối Frontend & Backend (Chỉ 1 Click)

1. Mở trang web GitHub Pages vừa tạo trên trình duyệt.
2. Bấm vào nút **🔗 API Backend** (hoặc nút **Chưa nối API**) ở góc trên bên phải thanh Header.
3. Hộp thoại cấu hình hiện ra: Dán đường link **Web App URL** (`.../exec`) đã copy ở Phần 1 vào ô nhập.
4. Bấm **Kiểm tra kết nối (Ping)**: Hệ thống sẽ gửi tín hiệu kiểm tra và báo `✅ Kết nối thành công!`.
5. Bấm **Lưu & Kết nối**. Trình duyệt sẽ lưu URL vào bộ nhớ và tự động hiển thị đèn xanh `🟢 Nối Sheets OK`.

*(Mẹo: Bạn cũng có thể mở link kèm tham số: `https://<your-username>.github.io/spx-shoe-hub/?api=https://script.google.com/macros/s/.../exec` để hệ thống tự động lưu cấu hình mà không cần nhập tay).*

---

## 5. Tài Khoản Đăng Nhập Mặc Định

Hệ thống đã nạp sẵn 4 tài khoản ứng với 4 vai trò để kiểm thử và phân quyền thực tế:

| Vai trò (Role) | Tài khoản (Email/SĐT) | Mã PIN mặc định | Quyền hạn nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@baotinshoes.vn` | `123456` | Toàn quyền quản trị hệ thống, quản lý nhân viên, cấu hình SPX, điều chỉnh kho có lý do, xem toàn bộ báo cáo doanh thu & dòng tiền. |
| **SALE** | `sale1@baotinshoes.vn` | `123456` | Tạo đơn hàng, tra cứu tự động khách quen, xem danh sách đơn của mình, kiểm tra tồn kho khả dụng theo thời gian thực. Không có quyền tự sửa tồn kho hay duyệt tiền. |
| **KHO (Warehouse)** | `kho@baotinshoes.vn` | `123456` | Xem danh sách đơn cần soạn, đóng gói kiện hàng, xác nhận cân nặng thực tế, in tem vận đơn SPX (100x140mm), bàn giao vận chuyển, tiếp nhận & kiểm định chất lượng hàng hoàn (QC). |
| **ĐỐI SOÁT (Finance)** | `ketoan@baotinshoes.vn` | `123456` | Xem danh sách COD đang chờ về, tải lên file CSV sao kê chuyển khoản/SPX để đối chiếu tự động, xác nhận tiền thực về ngân hàng, ghi nhận chênh lệch cước. |

---

## 6. Hướng Dẫn Vận Hành Nghiệp Vụ Chuẩn SPX

### 1. Phân hệ Khách hàng & Tự động Tra cứu Khách quen (Tab Customers)
- Mọi đơn hàng khi được chốt thành công sẽ tự động đồng bộ sang tab **Customers** trên Google Sheets.
- Hệ thống tự động tính lũy kế số đơn hàng, tổng số tiền đã chi để phân loại:
  - **VIP:** Chi tiêu từ 3.000.000 đ trở lên.
  - **Thân thiết:** Đã mua từ 2 đơn trở lên.
  - **Mới:** Khách mua lần đầu.
- **Tính năng Auto-lookup khi tạo đơn:** Khi nhân viên Sale gõ số điện thoại khách hàng (đủ 10 số), hệ thống sẽ lập tức quét cơ sở dữ liệu. Nếu là khách quen, thanh thông báo màu xanh sẽ hiện lên kèm huy hiệu hạng khách hàng, và tự động điền Tên, Địa chỉ, Tỉnh/thành, Phường/xã giúp Sale tạo đơn cực nhanh chỉ trong vài giây.

### 2. Quản lý Tồn kho 7 Chỉ số & Chống Bán Trùng (Atomic Locking)
- **Tồn thực tế (`physicalQty`):** Số lượng giày thực tế đang nằm trong kho.
- **Tồn đủ điều kiện bán (`sellableQty`):** Hàng nguyên tem, đạt tiêu chuẩn xuất bán.
- **Hàng đang giữ (`reservedQty`):** Số lượng đã được khóa cho các đơn hàng đã chốt nhưng chưa bàn giao cho SPX.
- **Tồn khả dụng (`availableQty`):** `availableQty = sellableQty - reservedQty`.
- **Hàng đang giao (`deliveringQty`):** Hàng đã xuất kho và đang trên đường giao bởi SPX.
- **Hàng đang hoàn (`returningQty`):** Hàng khách từ chối nhận hoặc giao không thành công, đang trên đường quay về kho.
- **Hàng lỗi (`damagedQty`):** Hàng bị rách hộp, lỗi da hoặc trầy xước trong quá trình hoàn về, được lưu trữ riêng để thanh lý.

*Quy tắc chống bán trùng:* Khi Sale bấm "Chốt đơn", `Database.withScriptLock` sẽ khóa dữ liệu trong 10 giây để kiểm tra và trừ tồn khả dụng nguyên tử. Nếu 2 nhân viên chốt đôi giày cuối cùng cùng một giây, hệ thống chỉ chấp nhận đơn chốt trước, đơn sau sẽ bị chặn kèm thông báo "Tồn khả dụng không đủ".

### 3. Vận đơn SPX & In Tem Nhiệt Chuẩn 100x140mm
- Khi đơn hàng ở trạng thái `CONFIRMED`, nhân viên Kho sẽ đóng hàng, cân thực tế và bấm **Yêu cầu lấy hàng SPX**.
- Hệ thống sẽ gọi Open API của SPX để lấy mã vận đơn (Tracking No: ví dụ `SPXVN039281726`).
- Nhân viên bấm **In phiếu giao SPX**: Hệ thống tạo bản in định dạng chuẩn nhiệt 100x140mm gồm đầy đủ Barcode Code128, thông tin người gửi, người nhận, tiền COD nổi bật và ô ghi chú xem hàng/thử hàng theo đúng tài liệu SPX.
- Khi Shipper SPX đến lấy hàng, nhân viên bấm **Bàn giao cho SPX**: Lúc này hệ thống tự động xuất kho (giảm tồn thực tế và giải phóng hàng đang giữ).

### 4. Quy trình Tiếp nhận & Kiểm định Hàng hoàn (QC Returns)
- Khi SPX trả hàng về kho, nhân viên Kho vào mục **Hàng hoàn & Đổi**:
  - Chọn đơn hàng hoàn.
  - Bấm **Kiểm tra chất lượng (QC)**.
  - Nếu hàng còn mới nguyên vẹn: Chọn **Đạt tiêu chuẩn** -> Hệ thống tự động cộng lại vào **Tồn bán được**.
  - Nếu giày bị hư hỏng, rách bao bì: Chọn **Lỗi/Hỏng** -> Hệ thống đưa vào **Tồn lỗi** và yêu cầu ghi rõ lý do.

### 5. Đối soát COD & Tiền về Ngân hàng (Reconciliation)
- Kế toán tải file CSV sao kê từ ngân hàng hoặc báo cáo thanh toán từ cổng SPX.
- Dán nội dung vào phân hệ **Đối soát tiền**: Hệ thống tự động phân tích mã đơn, số tiền COD thực nhận so với số tiền cần thu.
- Hệ thống phát hiện và cảnh báo ngay lập tức các đơn hàng bị lệch tiền hoặc đơn hàng đã từng được đối soát trước đó (`ALREADY_RECONCILED`), bảo vệ shop khỏi thất thoát tài chính.

### 6. Chạy Kiểm Thử Nghiệm Thu Tự Động (15 Test Cases)
- Tại màn hình **Cấu hình & Nhân sự**, quản trị viên có thể bấm nút **Chạy 15 Kịch bản Kiểm thử Nghiệm thu**.
- Hệ thống sẽ tự động chạy toàn bộ 15 bài kiểm tra:
  1. Kiểm tra cấu hình và múi giờ `Asia/Ho_Chi_Minh`.
  2. Khởi tạo và kiểm tra cấu trúc 15 bảng Google Sheets.
  3. Xác thực quyền RBAC cho 4 vai trò.
  4. Quản lý danh mục sản phẩm và sinh mã SKU chuẩn.
  5. Đảm bảo tính toán công thức tồn kho khả dụng.
  6. Kiểm tra cơ chế khóa ScriptLock chống bán trùng.
  7. Quy trình lưu nháp không giữ hàng.
  8. Quy trình chốt đơn giữ hàng chính xác.
  9. Hủy đơn giải phóng hàng đang giữ về tồn khả dụng.
  10. Bàn giao SPX xuất kho và cập nhật trạng thái.
  11. Đổi size giày kế thừa đơn gốc và bù trừ chênh lệch.
  12. Quy trình kiểm định QC hàng hoàn (Đạt vs Lỗi).
  13. Chống nhập trùng đối soát COD.
  14. Báo cáo doanh số phân tách theo Cohort và Dòng tiền.
  15. Kiểm tra ký số HMAC-SHA256 kết nối Open API SPX.

---

## 7. Bảo Mật & Lưu Ý Quan Trọng

1. **Bảo mật Script Properties:** Các khóa nhạy cảm (`SPX_APP_SECRET`, mật khẩu, session token) được lưu trữ an toàn trong `PropertiesService.getScriptProperties()`. Khi trả dữ liệu ra bên ngoài, hệ thống tự động che dấu dạng `********`.
2. **Chống tấn công Formula Injection:** Mọi chuỗi ký tự do khách hàng hoặc nhân viên nhập vào bắt đầu bằng `=`, `+`, `-`, `@` đều được tự động chèn dấu nháy đơn `'` trước khi ghi vào Google Sheets để ngăn chặn việc chạy mã độc hại trong bảng tính.
3. **Múi giờ đồng nhất:** Toàn bộ hệ thống chạy trên múi giờ Việt Nam `Asia/Ho_Chi_Minh` (GMT+7) và định dạng ngày giờ chuẩn ISO-8601.
4. **Tiền tệ:** Toàn bộ số tiền đều được lưu dưới dạng số nguyên VND, loại bỏ hoàn toàn sai số dấu phẩy động.
