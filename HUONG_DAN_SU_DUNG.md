# CẨM NANG HƯỚNG DẪN SỬ DỤNG HỆ THỐNG SPX SHOE HUB
## Hệ Thống Quản Lý Bán Hàng, Kho Giày & Vận Đơn SPX Express Toàn Diện
> **Website Quản Trị:** [https://baotinanhphugia.github.io/spx-shoe-hub/](https://baotinanhphugia.github.io/spx-shoe-hub/)  
> **Cơ Sở Dữ Liệu:** Google Sheets (15 bảng dữ liệu thời gian thực)  
> **Phiên Bản Hệ Thống:** v1.2.0 (Google Apps Script Web App v13)

---

## MỤC LỤC
1. [Thông Tin Truy Cập & Đăng Nhập Phân Quyền (RBAC)](#1-thông-tin-truy-cập--đăng-nhập-phân-quyền-rbac)
2. [Quy Trình Tạo Đơn & Nhận Diện Tin Nhắn Tự Động (Smart Parser)](#2-quy-trình-tạo-đơn--nhận-diện-tin-nhắn-tự-động-smart-parser)
3. [Quy Trình Đóng Gói & In Tem SPX Hàng Loạt Khổ A6 (Batch Printing)](#3-quy-trình-đóng-gói--in-tem-spx-hàng-loạt-khổ-a6-batch-printing)
4. [Quản Lý Danh Bạ Khách Hàng & Tích Lũy Doanh Số](#4-quản-lý-danh-bạ-khách-hàng--tích-lũy-doanh-số)
5. [Quản Lý Kho Hàng & Ma Trận Mẫu - Màu x Size](#5-quản-lý-kho-hàng--ma-trận-mẫu---màu-x-size)
6. [Quản Lý Sản Phẩm & Biến Thể SKU (Thêm - Sửa - Xóa)](#6-quản-lý-sản-phẩm--biến-thể-sku-thêm---sửa---xóa)
7. [Xử Lý Đổi Size & Hàng Hoàn QC (Đạt Chuẩn vs Hàng Lỗi)](#7-xử-lý-đổi-size--hàng-hoàn-qc-đạt-chuẩn-vs-hàng-lỗi)
8. [Đối Soát COD, Phí Ship & Dòng Tiền Về](#8-đối-soát-cod-phí-ship--dòng-tiền-về)
9. [Báo Cáo Doanh Số Đa Chiều & Xuất File Excel/CSV](#9-báo-cáo-doanh-số-đa-chiều--xuất-file-excelcsv)
10. [Cấu Hình Hệ Thống, Quản Lý Nhân Sự & Kết Nối SPX Live API](#10-cấu-hình-hệ-thống-quản-lý-nhân-sự--kết-nối-spx-live-api)
11. [Bộ Kiểm Thử Tự Động 17 Kịch Bản Nghiệm Thu (1-Click Run)](#11-bộ-kiểm-thử-tự-động-17-kịch-bản-nghiệm-thu-1-click-run)

---

## 1. THÔNG TIN TRUY CẬP & ĐĂNG NHẬP PHÂN QUYỀN (RBAC)

Hệ thống phân chia 4 vai trò rõ rệt, đảm bảo tính bảo mật và quyền hạn công việc:

| Vai trò | Email / SĐT Đăng nhập | Mã PIN mặc định | Phạm vi quyền hạn |
|:---|:---|:---:|:---|
| **Quản trị viên (ADMIN)** | `admin@shop.vn` | `123456` | Toàn quyền toàn hệ thống (Cấu hình, Nhân sự, Tồn kho, Khách hàng, Báo cáo, SPX API). |
| **Nhân viên Sale (SALE)** | `sale1@shop.vn` / `sale2@shop.vn` | `123456` | Tạo đơn, chốt đơn, xem danh sách đơn của chính mình, tra cứu khách hàng, đổi size. Không xem được đơn của Sale khác. |
| **Thủ kho (KHO)** | `kho@shop.vn` | `123456` | In tem vận đơn hàng loạt, tạo vận đơn SPX, bàn giao SPX, xem tồn kho, kiểm định hàng hoàn QC. |
| **Kế toán Đối soát (DOI_SOAT)** | `doisoat@shop.vn` | `123456` | Nhập file đối soát COD SPX/Ngân hàng, đối soát công nợ, xem báo cáo doanh thu & dòng tiền. |

> **Cách đăng nhập nhanh:** Tại màn hình đăng nhập, anh có thể bấm vào các nút màu xanh dưới form (*"Admin"*, *"Sale 1"*, *"Thủ Kho"*, *"Đối Soát"*) để hệ thống tự điền tài khoản mẫu.

---

## 2. QUY TRÌNH TẠO ĐƠN & NHẬN DIỆN TIN NHẮN TỰ ĐỘNG (SMART PARSER)

### Bước 1: Dán nhanh tin nhắn khách chat
1. Khách nhắn tin chốt mua giày qua **Zalo, Messenger, TikTok, Pancake hoặc SMS**.
2. Sale chỉ cần copy toàn bộ đoạn chat của khách.
   * *Ví dụ đoạn chat:* `Nguyễn Văn Nam 0988123456 Số 15 ngõ 120 Cầu Giấy, Dịch Vọng, Cầu Giấy, Hà Nội - Cho xem hàng trước khi nhận`
3. Vào mục **📝 Tạo đơn** $\to$ Dán vào ô **"Dán nhanh tin nhắn / thông tin khách chat vào đây..."** ở góc trên cùng.
4. Bấm nút **"⚡ Nhận diện tự động"**:
   * Tên khách hàng: Tự điền `Nguyễn Văn Nam`.
   * Số điện thoại: Tự lọc chuỗi số chuẩn `0988123456`.
   * Tỉnh/TP: Tự đối soát danh bạ 63 Tỉnh/TP $\to$ Chọn `Hà Nội`.
   * Mã phân tuyến SPX: Tự động gắn tuyến `VN_HAN`.
   * Địa chỉ chi tiết: Tự điền `Số 15 ngõ 120 Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy`.
   * Ghi chú giao hàng: Tự phát hiện chỉ dẫn *"Cho xem hàng trước khi nhận"*.

### Bước 2: Chọn sản phẩm giày
1. Chọn **Mẫu giày** (ví dụ: Oxford Brogue Cổ Điển - `GI-OX01`).
2. Chọn **Màu sắc** (Đen, Nâu...) và **Size** (38, 39, 40, 41, 42, 43, 44, 45).
3. Hệ thống sẽ hiển thị số đôi **Còn bán được** ngay cạnh ô chọn. Nếu hết hàng, hệ thống sẽ cảnh báo không cho thêm.
4. Bấm **"+ Thêm vào đơn"**. Có thể thêm nhiều đôi/nhiều mẫu vào cùng 1 đơn.

### Bước 3: Lưu đơn
* **Nút "Lưu Đơn Nháp" (DRAFT):** Dành cho khách chưa chắc chắn hoặc còn suy nghĩ. Đơn nháp **chưa trừ hàng tồn kho**.
* **Nút "⚡ CHỐT ĐƠN NGAY" (CONFIRMED):** Khách đã đồng ý mua. Hệ thống sẽ:
  * Khóa giao tác nguyên tử, trừ vào tồn khả dụng và tăng **Tồn đang giữ (Reserved)**.
  * Tự động lưu thông tin khách hàng vào tab `Customers` trên Google Sheets để tích lũy doanh số.

---

## 3. QUY TRÌNH ĐÓNG GÓI & IN TEM SPX HÀNG LOẠT KHỔ A6 (BATCH PRINTING)

Tính năng chuyên biệt dành cho **Thủ kho** vào các ca đóng gói hàng xuất xưởng:

1. Vào mục **📦 Đơn hàng**.
2. Sử dụng thanh Tab lọc nhanh:
   * **Tất cả đơn**: Xem toàn bộ đơn hàng.
   * **📦 Chờ in tem & Đóng gói**: Lọc các đơn đã chốt (`CONFIRMED`) đang chờ in phiếu giao.
   * **🖨️ Đã in tem chờ gửi**: Các đơn đã in tem xong, đang nằm tại khu vực đóng gói.
   * **🚚 Đang giao**: Các đơn đã giao cho tài xế SPX lấy hàng.
3. **Thao tác chọn đơn:**
   * Tích chọn từng ô vuông ở đầu mỗi dòng đơn hàng muốn in.
   * Hoặc tích vào ô vuông trên cùng của tiêu đề bảng để **Chọn tất cả**.
4. **Thanh công cụ thao tác hàng loạt màu cam sẽ xuất hiện:**
   * **🖨️ In tem SPX hàng loạt:** Hệ thống mở cửa sổ in chuyên dụng khổ **A6 (100x150mm) / A7** cho máy in nhiệt (Xprinter, HPRT, Shoptida...).
     * Mã vạch Code128 SVG nét căng, máy quét tít 100%.
     * Đầy đủ thông tin: Mã vận đơn SPX, Mã đơn shop, Tuyến SPX, Người gửi/Người nhận, Tiền thu hộ COD to rõ, Danh sách các đôi giày trong kiện hàng, Chỉ dẫn phát hàng.
     * Tự động phân trang `page-break-after: always` ngắt từng tem riêng biệt.
     * **Tự động chuyển trạng thái đơn** sang `LABEL_PRINTED` (Đã in tem).
   * **📦 Tạo vận đơn SPX:** Gửi thông tin hàng loạt đơn sang cổng SPX để lấy mã vận đơn.
   * **🚚 Bàn giao SPX:** Xác nhận tài xế bưu tá SPX đã đến kho lấy hàng $\to$ Hệ thống xuất kho thực tế, giảm tồn thực tế (`stockActual - 1`) và chuyển sang hàng đang giao (`stockShipping + 1`).

---

## 4. QUẢN LÝ DANH BẠ KHÁCH HÀNG & TÍCH LŨY DOANH SỐ

Toàn bộ thông tin khách mua hàng được đồng bộ tự động vào tab **Customers** trên Google Sheets:

* **Xem chỉ số tổng quan:**
  * Tổng số khách hàng trong hệ thống.
  * Số lượng khách **VIP** (Tổng chi tiêu tích lũy $\ge$ 3.000.000 đ).
  * Số lượng khách **Thân thiết** (Đã mua từ $\ge$ 2 đơn hàng).
  * Tổng doanh số tích lũy của toàn bộ khách hàng.
* **Tìm kiếm & Lọc:**
  * Gõ tìm nhanh theo Tên, Số điện thoại, Địa chỉ hoặc Tỉnh/Thành phố.
  * Lọc theo phân hạng: `Khách VIP`, `Khách Thân thiết`, `Khách Thường`.
* **Thao tác nhanh cho từng khách:**
  * **Nút "📝 Tạo đơn":** Bấm 1 chạm chuyển thẳng sang màn hình Tạo đơn và điền sẵn Họ tên, SĐT, Địa chỉ của khách này (không cần gõ lại).
  * **Nút "✏️ Sửa":** Sửa thông tin, địa chỉ, đổi phân hạng hoặc ghi chú sở thích size giày của khách.
  * **Nút "🗑️ Xóa":** Xóa khách hàng khỏi hệ thống Google Sheets.
  * **Nút "+ Thêm khách hàng":** Thêm khách hàng thủ công từ ngoài vào danh bạ.

---

## 5. QUẢN LÝ KHO HÀNG & MA TRẬN MẪU - MÀU X SIZE

Vào mục **🏬 Kho hàng** để theo dõi tồn kho theo thời gian thực:

### Cơ chế 7 trạng thái tồn kho chuẩn hóa:
1. **Tồn thực tế (`stockActual`):** Tổng số đôi giày hiện đang nằm trong kho vật lý.
2. **Tồn đang giữ (`stockReserved`):** Hàng đã chốt đơn cho khách nhưng chưa bàn giao cho SPX.
3. **Tồn khả dụng (`stockAvailable` / `stockSalable`):** Hàng thực sự còn để bán = `Tồn thực tế` - `Tồn đang giữ`. Chống bán trùng đôi cuối cùng tuyệt đối.
4. **Hàng đang giao (`stockShipping`):** Hàng đã bàn giao cho tài xế SPX và đang trên đường đi phát.
5. **Hàng đang chuyển hoàn (`stockReturning`):** Hàng giao không thành công, SPX đang chuyển trả lại shop.
6. **Hàng hoàn đạt chuẩn (`stockReturned`):** Hàng hoàn về kho đã kiểm định đạt chất lượng, cộng lại vào tồn bán.
7. **Hàng lỗi / Hỏng (`stockDefective`):** Hàng khách đi thử rách/bẩn/móp hộp, cách ly vào kho lỗi, không được bán ra.

### Điều chỉnh tồn kho (Admin & Thủ kho):
* Bấm nút **"⚖️ Điều chỉnh tồn (Admin)"**.
* Chọn SKU cần chỉnh $\to$ Chọn **Tăng tồn kho** (Nhập hàng mới) hoặc **Giảm tồn kho** (Xuất hủy/hỏng).
* Nhập số lượng và **Lý do bắt buộc** $\to$ Hệ thống ghi nhận lịch sử vào tab `StockMovements` và `AuditLogs`.

---

## 6. QUẢN LÝ SẢN PHẨM & BIẾN THỂ SKU (THÊM - SỬA - XÓA)

Vào mục **👟 Sản phẩm & Size**:

### Thêm sản phẩm mới:
1. Bấm nút **"+ Thêm sản phẩm mới"**.
2. Nhập Mã mẫu (ví dụ: `GI-CH01`), Tên sản phẩm (*Giày Chelsea Boot Nam Da Bò*), Giá bán niêm yết, Trọng lượng đóng gói mặc định (thường 800g - 1000g).
3. Bấm **"Lưu Sản Phẩm"**.

### Sinh biến thể Size hàng loạt (Auto Generate SKUs):
1. Bấm nút **"⚡ Sinh biến thể Size"**.
2. Chọn Mẫu sản phẩm vừa tạo.
3. Tích chọn các Màu sắc (Đen, Nâu bò, Nâu đậm...).
4. Tích chọn dải Size cần bán (Size 38, 39, 40, 41, 42, 43, 44).
5. Bấm **"Khởi tạo biến thể"** $\to$ Hệ thống tự động sinh toàn bộ danh sách SKU chuẩn hoá theo cú pháp:  
   `[MÃ MẪU]-[MÃ MÀU]-[SIZE]` (Ví dụ: `GI-CH01-DEN-40`, `GI-CH01-DEN-41`...) và tạo bản ghi tồn kho ban đầu bằng 0.

### Sửa và Xóa:
* Mỗi dòng sản phẩm hoặc SKU biến thể đều có nút **✏️ Sửa** (sửa tên, sửa giá) và nút **🗑️ Xóa** (xóa khỏi Google Sheets).

---

## 7. XỬ LÝ ĐỔI SIZE & HÀNG HOÀN QC (ĐẠT CHUẨN VS HÀNG LỖI)

Vào mục **🔄 Hàng hoàn & Đổi**:

### 1. Đổi Size liên kết đơn gốc:
* Khi khách nhận giày bị chật hoặc rộng:
  1. Chọn mã đơn hàng gốc.
  2. Chọn SKU cũ khách muốn trả lại (ví dụ: `GI-OX01-DEN-40`).
  3. Chọn SKU mới muốn đổi (ví dụ: `GI-OX01-DEN-41`).
  4. Nhập tiền chênh lệch (nếu có, ví dụ phí ship đổi 30.000 đ).
  5. Bấm **"Tạo Đơn Đổi Hàng"** $\to$ Hệ thống tự động tạo đơn hàng mới liên kết với đơn cũ, giữ size mới trong kho và chuẩn bị gửi SPX.

### 2. Kiểm định chất lượng hàng hoàn QC (Inspection):
* Khi bưu tá SPX mang kiện hàng hoàn trả lại kho:
  1. Thủ kho mở kiện hàng và kiểm tra tình trạng đôi giày.
  2. Bấm vào yêu cầu hoàn tương ứng trên danh sách.
  3. **Nếu giày còn nguyên vẹn:** Chọn **"Đạt chuẩn (Tái nhập bán)"** $\to$ Hệ thống giảm `stockReturning - 1` và tự động cộng lại vào `stockSalable + 1` để các Sale khác chốt bán tiếp.
  4. **Nếu giày bị xước/hỏng/dơ:** Chọn **"Hàng lỗi (Cách ly kho lỗi)"** $\to$ Hệ thống chuyển sang `stockDefective + 1`, tuyệt đối không cho phép bán lại.

---

## 8. ĐỐI SOÁT COD, PHÍ SHIP & DÒNG TIỀN VỀ

Vào mục **💰 Đối soát tiền**:

1. **Xem đơn chờ thu tiền:** Hệ thống liệt kê toàn bộ các đơn hàng đã bàn giao hoặc SPX báo phát thành công nhưng tiền COD chưa đối soát.
2. **Nhập file đối soát từ SPX:**
   * Tải file báo cáo đối soát dạng `.csv` hoặc copy bảng từ file Excel do SPX gửi về.
   * Dán vào ô đối soát $\to$ Bấm **"Xem trước đối soát"**.
   * Hệ thống tự động so khớp từng mã vận đơn `TrackingNumber`, số tiền COD thu hộ và tiền cước vận chuyển.
3. **Cơ chế chống đối soát trùng 2 lần (Anti-Duplicate):**
   * Nếu kế toán vô tình tải cùng 1 file đối soát 2 lần, hệ thống sẽ phát hiện mã đã thanh toán và gắn cờ `ALREADY_RECONCILED`, ngăn chặn nhân đôi tiền vào sổ sách.
4. Bấm **"Xác nhận Đối soát"** để cập nhật trạng thái đơn thành Đã thanh toán (`PAID`).

---

## 9. BÁO CÁO DOANH SỐ ĐA CHIỀU & XUẤT FILE EXCEL/CSV

Vào mục **📈 Báo cáo**:

Hệ thống hỗ trợ 2 góc nhìn kế toán chuyên nghiệp:
1. **Góc nhìn Cohort (Theo Ngày Chốt Đơn):**
   * Phản ánh chính xác hiệu suất làm việc của đội ngũ Sale trong ngày chốt đơn, doanh thu bán hàng được tạo ra hôm nay.
2. **Góc nhìn Dòng tiền (Theo Ngày Giao Hàng / Đối Soát):**
   * Phản ánh dòng tiền thực tế tiền về tài khoản ngân hàng của shop sau khi trừ chi phí vận chuyển.
3. **Xuất file:** Bấm nút **"📥 Xuất CSV"** để tải file báo cáo mở bằng Microsoft Excel hoặc Google Sheets.

---

## 10. CẤU HÌNH HỆ THỐNG, QUẢN LÝ NHÂN SỰ & KẾT NỐI SPX LIVE API

Vào mục **⚙️ Cấu hình**:

### 1. Quản lý Tài khoản & Nhân sự:
* Thêm nhân viên Sale, Kho hoặc Kế toán mới.
* Phân quyền vai trò và cấp mã PIN đăng nhập.
* Đổi mã PIN hoặc Xóa tài khoản nhân viên đã nghỉ việc.

### 2. Cấu hình Vận đơn & Tài khoản SPX Thật:
* **Thông tin Shop gửi hàng:** Tên Shop, SĐT hotline, Địa chỉ kho lấy hàng của SPX.
* **Chỉ dẫn phát hàng mặc định:** Cho xem hàng không cho thử (`VIEW_NO_TRY`), Cho thử hàng (`VIEW_TRY`), Không cho xem hàng (`NO_VIEW`).
* **Chuyển chế độ SPX:**
  * `MOCK`: Chế độ giả lập an toàn để đào tạo nhân viên mới thử nghiệm.
  * `REAL`: Chế độ thật kết nối trực tiếp cổng **Open API SPX Việt Nam** với chữ ký số `HMAC-SHA256`.
* **Nút "Kiểm tra kết nối SPX":** Bấm để test kết nối mạng với máy chủ SPX.

---

## 11. BỘ KIỂM THỬ TỰ ĐỘNG 17 KỊCH BẢN NGHIỆM THU (1-CLICK RUN)

Để đảm bảo hệ thống luôn hoạt động chuẩn xác 100%, Admin có thể chạy kiểm thử bất cứ lúc nào:
1. Vào mục **⚙️ Cấu hình** $\to$ Cuộn xuống mục **"Kiểm định hệ thống (Automated Acceptance Tests)"**.
2. Bấm nút **"🚀 Chạy Toàn Bộ 17 Kịch Bản Kiểm Thử"**.
3. Hệ thống sẽ tự động chạy song song và trả về kết quả chi tiết:
   * Chống bán trùng đôi cuối (2 sale chốt cùng mili-giây).
   * Chống bấm chốt đơn đúp 2 lần (Double Click Protection).
   * Rollback khi đơn nhiều SKU nhưng có 1 SKU hết hàng.
   * Giải phóng tồn giữ khi hủy đơn.
   * Bàn giao SPX xuất kho đúng 1 lần.
   * Xử lý SPX timeout không tạo trùng vận đơn.
   * Khóa giao tác nguyên tử ScriptLock.
   * Hàng chuyển hoàn chưa cộng vào tồn bán được.
   * QC hàng hoàn đạt chuẩn vs lỗi.
   * Đổi size liên kết mã đơn gốc.
   * Phân quyền RBAC Sale chỉ xem đơn của mình.
   * Theo dõi dòng tiền COD chờ đối soát.
   * Chống nhập trùng file đối soát COD.
   * Báo cáo nhất quán Cohort vs Dòng tiền.
   * Bảo toàn dữ liệu khi Webhook SPX gửi lặp.
   * Tự bóc tách thông tin khách hàng từ tin nhắn (Smart Parser).
   * In tem hàng loạt Code128 SVG & Cập nhật `LABEL_PRINTED`.

---
*Bản quyền hệ thống thuộc về **Bảo Tín Shoes** - Vận hành trên hạ tầng GitHub Pages & Google Cloud Apps Script.*
