# Mini Reading Tracker — Vue.js Frontend

Ứng dụng web theo dõi đọc sách cá nhân (Gác sách), xây dựng bằng **Vue 3**, **TypeScript**, **Vite**, **Vue Router 4** và **Tailwind CSS 4**. 

Frontend kết nối trực tiếp với Backend Node.js riêng biệt; **toàn bộ request tìm kiếm, chi tiết tác phẩm, ảnh bìa và dữ liệu tủ sách đều đi qua Backend proxy**, tuyệt đối không gọi trực tiếp Open Library từ browser theo đúng yêu cầu đề bài.

---

## 🌐 Demo Trực Tuyến (Production)

* **Frontend Web (HTTPS)**: [https://107.167.81.82.sslip.io](https://107.167.81.82.sslip.io)
* **Backend Health Check (HTTPS)**: [https://107.167.81.82.sslip.io/api/health](https://107.167.81.82.sslip.io/api/health)
* **Nền tảng triển khai**: Ubuntu 22.04 LTS VPS, Nginx Reverse Proxy, Let's Encrypt SSL Certbot.

---

## 🛠 Công nghệ sử dụng

* **Core**: Vue 3.5 (Composition API với `<script setup>`), TypeScript.
* **Build Tool**: Vite 8 (tối ưu hóa module, HMR siêu nhanh).
* **Routing**: Vue Router 4 (HTML5 History Mode với Nginx fallback).
* **Styling**: Tailwind CSS 4 (thiết kế responsive, sạch sẽ, không dùng inline styles).
* **Quản lý trạng thái (State)**: Composable-based reactive store (`useLibrary`) đồng bộ thống kê và membership badge.
* **Kiểm thử**: Vue SSR test runner (`tests/library.test.mjs`), `vue-tsc` type-check.

---

## 📱 Các màn hình & Tính năng chính

### 1. Màn hình Tìm kiếm sách (Trang chủ `/`)
* **Ô tìm kiếm**: Tìm theo tên sách hoặc tên tác giả, validation 3–200 ký tự ngay tại giao diện.
* **Chống spam & Hủy request cũ**: Tích hợp `AbortController`, tự động hủy các request tìm kiếm cũ nếu người dùng tìm kiếm từ khóa mới trước khi request trước hoàn tất.
* **Hiển thị danh sách/lưới**: Ảnh bìa, tên sách, tác giả, năm xuất bản đầu tiên.
* **Badge "Đã thêm"**: Tự động nhận diện sách đã có trong tủ để hiển thị badge và ngăn thêm trùng lặp.
* **Phân trang (Pagination)**: 20 kết quả/trang, hỗ trợ nút Trước/Sau và chuyển trang mượt mà.
* **Trạng thái giao diện đầy đủ**:
  * Trạng thái rỗng ban đầu (hướng dẫn tìm kiếm).
  * Trạng thái đang tải (Loading spinner).
  * Trạng thái không tìm thấy kết quả.
  * Trạng thái lỗi (kèm nút "Thử lại").

### 2. Màn hình Chi tiết sách (Modal Dialog)
* **Thông tin tác phẩm**: Bìa sách, tên sách, tác giả, mô tả nội dung, danh sách chủ đề (subjects), năm xuất bản.
* **Số trang**: Tự động lấy số trang gợi ý từ Open Library editions, cho phép người dùng kiểm tra và điều chỉnh theo bản sách thực tế đang cầm trên tay.
* **Thêm vào tủ sách**: Chọn trạng thái ban đầu:
  * *Muốn đọc* (`want_to_read`): Đặt tiến độ 0 trang.
  * *Đang đọc* (`reading`): Ghi nhận mốc thời gian bắt đầu đọc.
  * *Đã đọc* (`completed`): Tự động đặt tiến độ 100% trang, ghi nhận mốc thời gian đọc xong.

### 3. Màn hình Tủ sách của tôi (`/shelf`)
* **Thống kê nhanh toàn tủ**: Tổng số sách, số đang đọc, số đã đọc xong (luôn tính trên toàn bộ tủ sách, không phụ thuộc vào tab đang xem).
* **3 Tab lọc trạng thái**: *Muốn đọc* / *Đang đọc* / *Đã đọc*.
* **Theo dõi tiến độ**:
  * Thanh tiến độ trực quan (%) tính theo `(current_page / total_pages) * 100`.
  * Cập nhật số trang đang đọc: Nếu nhập đủ tổng số trang $\rightarrow$ tự động chuyển sang *Đã đọc* và ghi nhận thời gian hoàn thành.
  * Chấm điểm đánh giá 1–5 sao ⭐ và ghi chú cá nhân (tối đa 1.000 ký tự).
  * Thay đổi trạng thái đọc nhanh chóng.
  * Xóa sách khỏi tủ: Có modal popup xác nhận hiển thị rõ tên cuốn sách để tránh bấm nhầm.

---

## 🚀 Hướng dẫn chạy Local

### 1. Yêu cầu môi trường
* Node.js `>= 22.18.0` hoặc `>= 24.12.0`
* Backend Node.js (`tracker_be`) đang chạy ở cổng `8080` (hoặc cổng cấu hình).

### 2. Cài đặt và khởi chạy
```bash
# Di chuyển vào thư mục frontend
cd tracker_fe

# Cài đặt dependencies chuẩn xác theo lockfile
npm ci

# Khởi chạy môi trường phát triển (Dev server)
npm run dev
```

Mở trình duyệt tại địa chỉ in ra trên terminal, mặc định là: **`http://localhost:5173`**.

Vite dev server đã được cấu hình proxy tự động toàn bộ request `/api` sang `http://127.0.0.1:8080`:
```ts
// vite.config.ts
server: { proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true } } }
```

Nếu Backend chạy ở cổng khác, bạn có thể tạo file `.env.local` để ghi đè:
```dotenv
API_PROXY_TARGET=http://127.0.0.1:3000
```

### 3. Build Production & Kiểm thử
```bash
# Kiểm tra kiểu TypeScript
npm run type-check

# Biên dịch mã nguồn ra thư mục dist/
npm run build

# Chạy test suite
npm test
```

---

## 🏗 Kiến trúc thư mục Frontend

```text
tracker_fe/
├── public/                 # Favicon và tài nguyên tĩnh
├── src/
│   ├── assets/             # CSS chính và cấu hình Tailwind
│   ├── components/         # Các UI component tái sử dụng
│   │   ├── AppDialog.vue        # Base modal dialog accessible (khóa khi submit)
│   │   ├── BookCover.vue        # Component render ảnh bìa proxy kèm placeholder
│   │   ├── BookDetailsDialog.vue# Modal xem chi tiết và thêm sách vào tủ
│   │   └── EditBookDialog.vue   # Modal cập nhật tiến độ, sao và ghi chú
│   ├── composables/        # State logic
│   │   └── useLibrary.ts   # Quản lý tủ sách, đồng bộ thống kê & membership
│   ├── router/             # Cấu hình Vue Router (routes / và /shelf)
│   ├── services/           # Tầng giao tiếp API
│   │   └── api.ts          # Fetch wrapper, error envelope parser, AbortController
│   ├── types/              # Định nghĩa kiểu dữ liệu TypeScript (Book, ShelfItem, DTO)
│   ├── views/              # Các màn hình chính
│   │   ├── SearchView.vue  # Màn hình tìm kiếm sách (Home)
│   │   └── BookshelfView.vue# Màn hình tủ sách cá nhân (3 tabs)
│   ├── App.vue             # Root layout & navigation header
│   └── main.ts             # Entry point
├── tests/                  # Bộ test tự động
│   └── library.test.mjs    # Test reactivity, state update và rollback khi lỗi
├── index.html              # HTML template
├── package.json
└── vite.config.ts          # Cấu hình Vite, Tailwind và proxy
```

---

## 🔒 Triển khai Production & Bảo mật (Deployment)

Frontend được deploy cùng Backend trên máy chủ VPS:

1. **Build tĩnh**:
   * Chạy `npm run build` tạo gói bundle tối ưu hóa trong thư mục `dist/`.
2. **Web Server & Reverse Proxy (Nginx)**:
   * **Phục vụ Static**: Phục vụ các file tĩnh trong `dist/` với chỉ thị `try_files $uri $uri/ /index.html;` giúp người dùng refresh trang ở bất kỳ route nào của Vue Router đều không bị lỗi 404.
   * **Bật Gzip**: Nén gzip các file js/css giúp tốc độ tải ban đầu chỉ mất vài chục ms.
   * **API Proxy**: Nginx tự động chuyển hướng đường dẫn `/api/` về Backend Node.js tại cổng local `8080`.
3. **Bảo mật HTTPS (SSL)**:
   * Sử dụng chứng chỉ Let's Encrypt SSL được cấu hình tự động thông qua `certbot`.
   * Tự động điều hướng toàn bộ request HTTP (port 80) sang HTTPS (port 443).
   * Không lưu trữ bất kỳ thông tin nhạy cảm hay mật khẩu database nào trong frontend bundle.

---

## 💡 Giả định, Hạn chế & Hướng phát triển

### Giả định thiết kế
* **Người dùng đơn (Single User)**: Ứng dụng tập trung vào tính cá nhân hóa của một người dùng, không yêu cầu hệ thống đăng nhập/phân quyền.
* **Xác nhận số trang**: Số trang lấy từ Open Library có thể biến động tùy theo phiên bản xuất bản (edition); do đó hệ thống cho phép người dùng tự xác nhận/chỉnh sửa số trang thực tế của cuốn sách trước khi lưu vào tủ.

### Hạn chế hiện tại
* Chưa có đồng bộ thời gian thực (Real-time WebSocket) giữa nhiều tab trình duyệt mở cùng lúc (cần bấm refresh hoặc thao tác để làm mới dữ liệu).
* Open Library API đôi khi có thời gian phản hồi biến động tùy thuộc vào mạng quốc tế.

### Hướng phát triển tiếp theo
* **Đa người dùng**: Bổ sung xác thực OAuth/JWT để mỗi người dùng có một tủ sách riêng biệt.
* **Lịch sử đọc (Reading Log)**: Ghi lại từng buổi đọc (ngày nào đọc bao nhiêu trang).
* **PWA & Offline Mode**: Hỗ trợ Service Worker để người dùng có thể xem lại tủ sách khi mất kết nối mạng.
* **Thống kê chuyên sâu**: Biểu đồ số trang đã đọc theo tuần/tháng bằng thư viện biểu đồ.
