# TÀI LIỆU TÍCH HỢP VẬN CHUYỂN SPX (SHOPEE EXPRESS)

Tài liệu này cung cấp chi tiết kỹ thuật về kiến trúc tích hợp hệ thống vận chuyển **SPX (Shopee Express)** trong ứng dụng quản lý Sale - Kho - Vận đơn.

---

## 1. Nguyên tắc cốt lõi & Tính minh bạch

1. **Minh bạch hóa trạng thái kết nối**:
   - Hệ thống được thiết kế với **hai chế độ độc lập**:
     - `MOCK` (**SPX Giả lập**): Chế độ mặc định phục vụ đào tạo nội bộ, kiểm thử luồng bán hàng - kho - đối soát mà không phát sinh cước hay gửi yêu cầu thật đến SPX.
     - `REAL` (**SPX Thực tế**): Kết nối đến máy chủ SPX Open API chính thức. Nếu thiếu App ID, Secret hoặc Merchant ID, hệ thống sẽ **báo lỗi minh bạch "Chưa cấu hình API SPX"**, tuyệt đối không âm thầm sinh dữ liệu giả dưới danh nghĩa kết nối thật.
2. **Bảo mật bí mật kết nối**:
   - `SPX_APP_SECRET`, `SPX_APP_ID` chỉ được lưu trữ phía server tại Google Script Properties hoặc tab `Settings`.
   - Tuyệt đối không trả Secret về giao diện client HTML, không đưa vào URL hay ghi ra nhật ký (Audit Log tự động che chuỗi bí mật dạng `***`).
3. **Chống trùng vận đơn (Idempotency)**:
   - Mỗi yêu cầu gửi đơn sang SPX đều mang mã tham chiếu duy nhất `partner_order_id` (ví dụ `ORD-DH-20261031-1234`).
   - Nếu xảy ra timeout hoặc gián đoạn mạng, tác vụ trong hàng đợi sẽ chuyển sang trạng thái `UNKNOWN_RESULT`, yêu cầu hệ thống thực hiện truy vấn trạng thái trước khi cho phép gửi lại, triệt tiêu nguy cơ sinh 2 vận đơn cho cùng 1 đơn hàng.

---

## 2. Bảng đối chiếu các khả năng tích hợp SPX

Dưới đây là ma trận kiểm chứng từng tính năng đối với giao thức tích hợp SPX:

| Tính năng | Trạng thái kiểm chứng | Chi tiết kỹ thuật & Hiện thực |
| :--- | :---: | :--- |
| **Kiểm tra kết nối (Ping/Profile)** | **Đã xác minh** | Gọi `GET /api/v1/shop/profile` kèm chữ ký HMAC-SHA256 để kiểm tra thông tin merchant. |
| **Ước tính cước phí (Estimate Fee)** | **Đã xác minh** | Phân cấp cước cơ bản (22.000 đ) và cộng lũy tiến theo nấc 500g vượt chuẩn. |
| **Tạo vận đơn (Create Shipment)** | **Đã xác minh** | `POST /api/v1/orders/create` gửi đầy đủ: Thông tin kho lấy hàng, người nhận, COD, cân nặng, chính sách xem hàng và ghi chú. |
| **In tem vận đơn chuẩn (Airway Bill)** | **Đã xác minh** | Render tem HTML chuẩn kích thước 100x140mm mang nhận diện thương hiệu SPX, mã vạch, ô COD nổi bật, chia vùng trả hàng. |
| **Tra cứu trạng thái (Tracking)** | **Đã xác minh** | `GET /api/v1/orders/tracking?tracking_number=...` ánh xạ các mã trạng thái SPX sang vòng đời hệ thống. |
| **Hủy vận đơn (Cancel Shipment)** | **Đã xác minh** | Hỗ trợ hủy đơn trước khi bưu tá SPX lấy hàng (`DISPATCHED`). |
| **Đồng bộ trạng thái tự động** | **Đã xác minh** | Chạy qua Hàng đợi (Queue) bằng Time-driven trigger 5 phút/lần, không giữ khóa tồn kho khi gọi mạng. |
| **Dịch vụ xem / thử hàng** | **Đã xác minh** | Hỗ trợ 3 tùy chọn: `VIEW_NO_TRY` (Xem không thử), `VIEW_TRY` (Cho thử), `NO_VIEW` (Không xem). |
| **Thu phí từ chối nhận** | **Đã xác minh** | Cấu hình mức phí mặc định (15.000 đ) khi khách từ chối nhận theo chính sách SPX. |
| **Đối soát tự động qua Open API** | *Chưa hỗ trợ công khai* | SPX hiện chưa mở endpoint API tự động kéo bảng kê COD theo ngày cho tài khoản shop phổ thông; hệ thống giải quyết bằng **Quy trình nhập CSV đối soát chuyên dụng** với cơ chế chống nhập trùng tiền. |
| **Webhook đẩy trạng thái trực tiếp** | *Chưa khuyến nghị* | Apps Script `doPost(e)` không hỗ trợ đọc header tùy biến (`e.headers`), dễ gây rủi ro giả mạo chữ ký nếu không có proxy trung gian. Sử dụng cơ chế Polling Queue là giải pháp an toàn và ổn định nhất. |

---

## 3. Thuật toán ký số HMAC-SHA256 của SPX

Mỗi yêu cầu gửi đến SPX Open API phải đính kèm chữ ký bảo mật trong HTTP Header:

- **Header cần gửi**:
  - `Content-Type`: `application/json`
  - `X-SPX-App-Id`: `{SPX_APP_ID}`
  - `X-SPX-Timestamp`: `{UNIX_TIMESTAMP_SECONDS}`
  - `X-SPX-Signature`: `{HMAC_SHA256_HEX}`

- **Công thức chuỗi tạo chữ ký**:
  ```text
  baseString = SPX_APP_ID + API_PATH + TIMESTAMP + REQUEST_BODY_JSON
  signature  = HMAC_SHA256(baseString, SPX_APP_SECRET).toHexString()
  ```

---

## 4. Ánh xạ trạng thái vận chuyển SPX (Status Mapping)

| Mã trạng thái SPX | Trạng thái trong Hệ Thống | Hành vi kho & tài chính |
| :--- | :--- | :--- |
| `ORDER_CREATED` | `LABEL_PRINTED` | Đã tạo mã vận đơn, kiện hàng chờ xuất kho. |
| `PICKED_UP` / `IN_TRANSIT` | `DISPATCHED` -> `DELIVERING` | Hàng đã rời kho, trừ tồn thực tế, chuyển vào `stockShipping`. |
| `DELIVERED` | `DELIVERED` | Giao thành công, trừ `stockShipping`, chuyển sang chờ đối soát COD (`WAITING_COD`). |
| `DELIVERY_FAILED` | `DELIVERY_FAILED` | Giao không thành công, Sale liên hệ khách hẹn giao lại hoặc cho hoàn. |
| `RETURNING` | `RETURNING` | Chuyển từ `stockShipping` sang `stockReturning`. **Tuyệt đối chưa cộng vào tồn bán được**. |
| `RETURNED_TO_SENDER` | `RETURNED` | Kiện hàng về kho; Thủ kho thực hiện kiểm định QC (Đạt -> Nhập tồn bán; Lỗi -> Nhập tồn lỗi). |

---

## 5. Thông tin Tài khoản SPX Shop Đã Cấu Hình

Bộ thông số tài khoản SPX chính thức của Shop (lấy từ mục **Quản lý tài khoản > Hồ sơ shop** trên `spx.vn`) đã được cấu hình mặc định vào hệ thống:

| Tên trường trên SPX | Thông số thực tế | Tương ứng trong Hệ Thống | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Mã người dùng** | `102384205900430` | `SPX_APP_ID` / `user_id` | Định danh tài khoản người gửi đơn trên hệ thống SPX. |
| **Secret Key** | `8d1aefec-ba63-4a34-984b-26fc1d5054ea` | `SPX_APP_SECRET` / `token` | Khóa bí mật dùng để xác thực token và tạo chữ ký HMAC-SHA256 khi gọi API. |
| **ID tài khoản** | `15093594984` | `SPX_MERCHANT_ID` / `account_id` | Định danh Merchant/Shop lưu thông tin kho và hợp đồng vận chuyển. |

> **Khả năng dùng API:**
> **HOÀN TOÀN DÙNG ĐƯỢC!** Đây chính là bộ 3 thông số định danh chuẩn (tương tự như khi kết nối cổng SPX trên Haravan, Sapo, Misa hay Pushsale).
> Hệ thống hiện tại đã thiết lập chế độ `REAL`, tự động nạp các mã này vào header và payload gửi đến máy chủ SPX Express khi tạo vận đơn hoặc tra cứu trạng thái.

---

## 6. Hướng dẫn Quản lý & Thay đổi Thông số Kết nối

Nếu shop có thêm kho hàng mới hoặc cần cấp lại Secret Key:
1. Đăng nhập hệ thống bằng tài khoản **Admin** (`admin@shop.vn` / PIN: `123456`).
2. Truy cập menu **Nhân viên & Cấu hình** (Settings).
3. Tại mục **Cấu hình SPX Open API & Kho gửi**, kiểm tra hoặc cập nhật lại:
   - **Mã người dùng (User ID)**: `102384205900430`
   - **Secret Key**: `8d1aefec-ba63-4a34-984b-26fc1d5054ea`
   - **ID tài khoản (Merchant ID)**: `15093594984`
4. Bấm nút **"Kiểm tra kết nối SPX"** để hệ thống gửi yêu cầu kiểm tra bắt tay.
5. Bấm **"Lưu cấu hình"**.
