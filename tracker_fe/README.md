# Gác sách — Vue frontend

Vue 3 + TypeScript + Vue Router + Tailwind CSS 4. Frontend đã dùng API backend thật cho tìm kiếm, chi tiết, ảnh bìa và CRUD tủ sách; không còn nguồn dữ liệu mock trong `src/`.

## Chạy local

Khởi động backend trong terminal riêng:

```bash
cd tracker_be
npm run dev
```

Backend dùng PORT trong `.env`; môi trường local hiện tại đang chạy cổng **8080**. Tiếp theo trong `tracker_fe`:

```bash
npm install
npm run dev
```

Mở URL Vite in trong terminal, thường là http://localhost:5173. Vite proxy `/api` tới http://127.0.0.1:8080 để cả JSON và ảnh bìa đi cùng origin với FE.

Nếu BE dùng cổng khác, tạo `.env.local` trong `tracker_fe` từ `.env.example` và đặt:

```dotenv
API_PROXY_TARGET=http://127.0.0.1:3000
```

Khởi động lại Vite sau khi đổi biến môi trường. Biến này chỉ dùng cho dev/preview proxy; không chứa mật khẩu database. Khi deploy static build, reverse proxy hosting cần chuyển `/api` tới BE; Vite build không tự tạo proxy production.

## Luồng dữ liệu

- `services/api.ts`: fetch `/api`, đọc lỗi chung, mapping DTO backend sang model UI. BIGINT mục tủ giữ dạng chuỗi; Work ID là định danh sách. Request tối đa 90 giây và có thể hủy khi đổi tìm kiếm/đóng modal.
- `composables/useLibrary.ts`: tải toàn tủ, cập nhật state từ response sau mutation thành công. Request GET bị mutation làm cũ sẽ được tải lại; badge dùng membership mới từ response hoặc mutation thành công.
- `SearchView.vue`: từ khóa sau khi bỏ khoảng trắng đầu/cuối phải có 3–200 ký tự; báo lỗi ngay dưới ô nhập nếu không hợp lệ và không gọi API; phân trang 20 sách, loading/empty/error và retry; hủy tìm kiếm cũ để tránh ghi đè kết quả mới.
- `BookDetailsDialog.vue`: tải chi tiết khi mở; hiển thị số trang gợi ý/edition, người dùng xác nhận tổng trang trước khi POST.
- `BookshelfView.vue`: tải tủ thật, lọc ba tab và thống kê từ toàn tủ; lỗi tải có nút thử lại.
- `EditBookDialog.vue`: PATCH `status` hoặc `currentPage`, không gửi đồng thời. Rating/notes gửi cùng request. Dùng trạng thái backend trả về để chuyển tab sau lưu.
- `BookCover.vue`: ảnh qua `/api/covers/:coverId`; thiếu/lỗi ảnh hiển thị placeholder.
- `AppDialog.vue`: khóa đóng trong khi đang ghi dữ liệu; nút submit bị vô hiệu hóa tránh gửi lặp.

Các thao tác lưu MySQL, tải lại trang không reset dữ liệu. Không tự tạo dữ liệu mẫu. Thông tin thư mục và tủ chỉ cập nhật khi có request/thao tác, chưa có đồng bộ realtime giữa các tab.

Không có `<style>` block hoặc inline style trong UI. Giữ utility Tailwind và theme hiện tại. Preview tĩnh trong `docs/ui-preview` chỉ là tài liệu thiết kế lịch sử, không được import vào ứng dụng.

## Kiểm tra

```bash
npm run build
npm test
```

Build gồm `vue-tsc` và Vite. Test state dùng module Vue thật qua Vite SSR với API stub để tái hiện refresh trùng mutation, membership mới/cũ và xóa thất bại, không sửa database.

Kiểm tra browser ngày 2026-09-30 trên FE/BE/MySQL thật:

- Tìm Atomic Habits, mở chi tiết, phân trang; từ khóa không có kết quả.
- Thêm sách, sửa 29/100 trang, rating 4, ghi chú; reload vẫn giữ dữ liệu.
- Sửa 100/100 tự chuyển Đã đọc; hủy xóa, retry sau lỗi xóa, xóa và reload không còn sách test.
- Lỗi tìm kiếm giả lập để kiểm tra thông báo và retry; runtime không dùng mock.
- Mobile 375px không tràn ngang, không có request browser tới Open Library trực tiếp, không có lỗi JavaScript.

Sách test đã được xóa khỏi tủ sau kiểm tra. Metadata sách vẫn được giữ trong `books` theo thiết kế backend. Chưa deploy.

Xem [API backend](../docs/backend-api.md) và [README backend](../tracker_be/README.md).
