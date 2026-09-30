# Reading Tracker Backend

Node.js + Express + TypeScript + mysql2. Đã triển khai 8 endpoint trong tài liệu API, gồm health, tìm kiếm, chi tiết, ảnh bìa và CRUD tủ sách. Frontend đã nối API thật từ 2026-09-30.

## Chạy local

Chạy trong thư mục `tracker_be`:

```bash
npm install
cp .env.example .env
```

Điền mật khẩu MySQL của bạn vào `DB_PASSWORD` trong `.env`. Cổng MySQL local đang dùng là **3307**; cổng HTTP backend mặc định là **3000**. Database `reading_tracker` cần tồn tại. Không commit `.env`.

```bash
npm run dev
```

Kiểm tra bằng trình duyệt hoặc terminal:

```bash
curl -i http://localhost:3000/api/health
```

MySQL trả lời được: HTTP 200, `{"data":{"status":"ok","database":"ok"}}`.
MySQL không truy cập được (sai mật khẩu, chưa chạy, sai tên database...): HTTP 503 với mã lỗi `DATABASE_UNAVAILABLE`.

## Đọc luồng code

1. `src/server.ts`: entry; đọc môi trường, import app, mở cổng HTTP bằng `listen`.
2. `src/app.ts`: tạo Express app và đăng ký route GET `/api/health`.
3. `src/config/database.ts`: cấu hình pool kết nối MySQL từ môi trường.
4. Khi nhận request, route chờ `SELECT 1`; thành công trả 200, thất bại trả 503. Truy vấn không sửa dữ liệu và không gọi Open Library.

Pool tái sử dụng kết nối; khởi tạo pool chưa chứng minh DB kết nối được, nên health phải thực hiện truy vấn thật. Timeout kết nối và truy vấn là 5 giây mỗi loại; đây không phải timeout tổng của toàn bộ request khi phải chờ pool.

Health chỉ xác nhận database nhận truy vấn được, không kiểm tra schema bảng hay Open Library.

Route health nhỏ được đặt ngay trong `app.ts`. Route tìm kiếm đi qua router, controller, service và repository bên dưới.

## Các lệnh

- `npm run dev`: chạy TypeScript và tự khởi động lại khi sửa file.
- `npm run typecheck`: kiểm tra kiểu, không tạo JavaScript.
- `npm run build`: biên dịch vào `dist/`.
- `npm start`: chạy `dist/server.js` sau build.

Xem [danh sách API](../docs/backend-api.md).

## API tìm kiếm sách

```bash
curl -i 'http://localhost:3000/api/books?q=James%20Clear&page=1'
```

`q` bắt buộc, trim rồi kiểm tra 3–200 ký tự. `page` mặc định 1, phải là số nguyên dương hợp lệ. Mỗi trang có tối đa 20 sách; các bản ghi upstream không có Work ID hợp lệ được bỏ qua. `pagination.total` là tổng upstream báo về.

Luồng đọc code:

1. `app.ts` gắn `booksRouter` vào `/api/books` và đặt middleware lỗi ở cuối.
2. `routes/books.routes.ts` chuyển GET `/` tới controller `searchBooks`.
3. `controllers/books.controller.ts` kiểm tra query, gọi service và repository, ghép `inShelf` rồi trả JSON.
4. `services/open-library.service.ts` gọi Search API bằng `fetch`, chỉ yêu cầu các trường cần thiết, chuẩn hóa Work ID và metadata thiếu. Timeout upstream 10 giây; giãn request tối thiểu 1 giây, tối đa 40 lượt chờ; không tự retry. Cache metadata 5 phút, tối đa 100 khóa trong một tiến trình.
5. `repositories/books.repository.ts` JOIN hai bảng, bind Work ID vào các dấu `?`. Một query cho cả trang; sách chỉ có metadata nhưng không có mục tủ không được đánh dấu `inShelf`.
6. `middlewares/error-handler.ts` trả lỗi JSON thống nhất; Express 5 chuyển lỗi từ async handler tới middleware này. Không trả lỗi SQL hoặc stack trace. Lỗi HTTP từ Open Library được ghi vào terminal BE với URL, status và statusText; lỗi kết nối/đọc JSON ghi tên lỗi, thông báo và causeCode nếu có. URL log có chứa từ khóa tìm kiếm, chỉ chia sẻ phần cần thiết khi debug.
7. `types/book.ts` mô tả kiểu dữ liệu tìm kiếm đã chuẩn hóa.

Kết quả có dạng `{ data: [{ workId, title, authors, coverUrl, firstPublishYear, inShelf }], pagination: { page, limit, total } }`.

Cache không chứa `inShelf`: mỗi lượt tìm kiếm đọc lại membership từ DB. API không INSERT dữ liệu. Trang rỗng không cần query MySQL. DB lỗi khi cần tra membership trả 503, không tự gán tất cả sách là chưa thêm.

`coverUrl` là đường dẫn `/api/covers/:coverId`; endpoint ảnh bìa đã triển khai. Vue đã nối API thật.

## Kiểm tra tìm kiếm

```bash
npm test
```

Test gửi HTTP thật vào Express với Open Library/MySQL được stub để kiểm tra validation, mapping, phân trang, membership, cache và lỗi 502/503/504. Không cần mật khẩu DB để chạy test này.

Đã smoke test ngày 2026-09-29 với Open Library và MySQL local thật: tìm `James Clear`, trang 1 trả 200 và 20 kết quả. Không tạo hoặc sửa dữ liệu khi kiểm tra.

Tham khảo [Open Library Search API](https://openlibrary.org/dev/docs/api/search).

## API chi tiết sách

```bash
curl -i http://localhost:3000/api/books/OL17930368W
```

Luồng xử lý:

1. `books.routes.ts` đăng ký `/:workId`; controller `getBookDetails` kiểm tra ID có dạng `OL...W`, tối đa 32 ký tự. Sai định dạng trả 400.
2. Repository `findSavedBook` LEFT JOIN `books` với `shelf_books`. Có metadata thì trả snapshot và membership ngay, không cần Open Library. Sách đã xóa khỏi tủ vẫn có thể có metadata và trả `inShelf: false`.
3. Nếu DB chưa có metadata, service `getOpenLibraryBook` gọi Work JSON để lấy mô tả/subjects/bìa, Search API theo Work ID chính xác để lấy tên tác giả/năm đầu tiên, và danh sách 20 edition đầu để tìm số trang gợi ý.
4. Metadata thiếu trả null hoặc mảng rỗng. Description hỗ trợ cả chuỗi và object có `value`. Work không tồn tại trả 404; upstream lỗi/timeout trả 502/504; lỗi truy cập DB trả 503.
5. Cache chi tiết 5 phút, tối đa 100 Work. Membership không cache; sau khi chờ upstream, controller đọc lại membership từ DB.

Response: `{ data: { workId, title, authors, coverUrl, firstPublishYear, description, subjects, suggestedTotalPages, suggestedEditionId, inShelf } }`.

`suggestedTotalPages` lấy từ edition đầu tiên có số trang nguyên dương trong 20 edition được kiểm tra. Đây không phải số trang chung cho mọi bản sách; `suggestedEditionId` nêu rõ edition nguồn, người dùng vẫn cần xác nhận. Không tìm được thì cả hai trường null. Với snapshot MySQL, cả hai cũng null vì bảng `books` không lưu số trang/edition; không lấy tổng trang cá nhân để giả làm thông tin edition. Chưa tự chọn edition theo ngôn ngữ hoặc tìm hết mọi edition.

Search index có thể chưa có Work mới: tên tác giả trả `[]`, năm trả null trong trường hợp đó. Lỗi upstream thực sự vẫn trả lỗi, không giả thành dữ liệu thiếu. Không INSERT hoặc UPDATE khi xem chi tiết.

Đã kiểm tra ngày 2026-09-29: build và toàn bộ test tìm kiếm/chi tiết qua; gọi thật `OL17930368W` với MySQL local và Open Library trả 200. Số trang gợi ý khi kiểm tra là 448, edition `OL62451445M`; kết quả upstream có thể thay đổi.

Nguồn: [Open Library Works và Editions API](https://openlibrary.org/dev/docs/api/books).

## API ảnh bìa

Mở `http://localhost:3000/api/covers/12539702` trên trình duyệt khi BE đang chạy, hoặc:

```bash
curl -o /tmp/reading-tracker-cover.jpg http://localhost:3000/api/covers/12539702
```

- `routes/covers.routes.ts`: route GET `/:coverId`.
- `controllers/covers.controller.ts`: ID chỉ gồm chữ số, bắt đầu 1–9, trong giới hạn số nguyên an toàn JavaScript. Sai trả 400 trước khi gọi upstream.
- `services/covers.service.ts`: tải `https://covers.openlibrary.org/b/id/{coverId}-M.jpg?default=false`. Host và kích thước M cố định; không nhận URL từ client. `default=false` giúp bìa không tồn tại trả 404 thay vì ảnh trắng mặc định.
- Controller dùng `res.send(buffer)` để gửi bytes với Content-Type của ảnh, không dùng `res.json` và không redirect trình duyệt sang Open Library.
- Không truy vấn MySQL, không lưu ảnh vào database hay ổ đĩa.

Timeout 10 giây cho fetch và đọc body, không tự retry. Chấp nhận MIME JPEG/PNG/WebP/GIF, từ chối body rỗng, giới hạn 2 MiB bằng cách đếm bytes khi đọc từng chunk. Header `nosniff` và `Cache-Control: public, max-age=3600` chỉ đặt khi tải ảnh thành công. Đây là cache HTTP một giờ cho trình duyệt/proxy; chưa có cache ảnh trong RAM của BE.

Lỗi JSON theo middleware chung: 400 `VALIDATION_ERROR`; 404 `COVER_NOT_FOUND`; 502 `OPEN_LIBRARY_ERROR` hoặc `INVALID_COVER`; 504 `OPEN_LIBRARY_TIMEOUT`. FE sẽ xử lý lỗi ảnh để hiển thị placeholder khi nối API.

Kiểm tra 2026-09-30: `npm test` qua cả ba nhóm tìm kiếm/chi tiết/ảnh bìa. Proxy thật với cover ID 12539702 trả 200, image/jpeg, 16.107 bytes. Test cô lập xác nhận ảnh được truyền nguyên bytes và không cần gọi MySQL.

Tham khảo [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers). Tài liệu upstream đề xuất dùng URL ảnh trực tiếp trên trang public; ứng dụng này dùng proxy theo spec yêu cầu mọi request Open Library đi qua BE.

## API tủ sách

### Lấy danh sách và thống kê

```bash
curl 'http://localhost:3000/api/shelf?status=reading'
```

Bỏ `status` để lấy toàn bộ tủ. Trả `{ data: { items, stats: { total, reading, completed } } }`. Thống kê luôn trên toàn tủ, không phụ thuộc tab. Một SELECT JOIN lấy snapshot toàn tủ; service tính stats và lọc theo status, phù hợp phạm vi tủ nhỏ hiện tại.

### Thêm sách

```bash
curl -X POST http://localhost:3000/api/shelf \
  -H 'Content-Type: application/json' \
  -d '{"workId":"OL17930368W","status":"want_to_read","totalPages":320}'
```

Trả 201 với mục tủ vừa tạo. Tổng trang trong ví dụ là lựa chọn người dùng cần xác nhận. Backend lấy metadata từ DB/Open Library; body không nhận title, authors hoặc ngày đọc. Thêm trùng trả 409. Lấy metadata trước transaction, rồi lưu hai bảng cùng transaction; lỗi rollback. UNIQUE bảo vệ cả hai request thêm đồng thời.

### Cập nhật và xóa

Thay `1` bằng `data.id` của mục tủ, không phải `bookId` hay Work ID:

```bash
curl -X PATCH http://localhost:3000/api/shelf/1 \
  -H 'Content-Type: application/json' \
  -d '{"currentPage":100,"rating":4,"notes":"Đọc đến chương 5"}'

curl -X PATCH http://localhost:3000/api/shelf/1 \
  -H 'Content-Type: application/json' \
  -d '{"status":"completed"}'

curl -X DELETE http://localhost:3000/api/shelf/1
```

PATCH trả 200 với mục tủ sau sửa; DELETE trả 204 không body. Mục không tồn tại trả 404. Xóa chỉ tác động `shelf_books`, giữ metadata `books`. Thêm lại bắt đầu mục tủ mới, không khôi phục dữ liệu đọc cũ.

Validation: số trang là số nguyên, totalPages > 0, currentPage từ 0 đến tổng; rating 1–5 hoặc null; notes tối đa 1.000 ký tự hoặc null. PATCH không nhận body rỗng, trường lạ, sửa totalPages, hoặc đồng thời status và currentPage. JSON sai trả 400, body quá 32 KiB trả 413. ID BIGINT trả bằng chuỗi để không mất chính xác; thời gian trả ISO UTC.

### Quy tắc chuyển trạng thái đang áp dụng

| Thao tác | Tiến độ và ngày đọc |
| --- | --- |
| Thêm Muốn đọc | 0 trang, chưa có ngày bắt đầu/kết thúc |
| Thêm Đang đọc | 0 trang, bắt đầu = hiện tại |
| Thêm Đã đọc | Đủ trang, kết thúc = hiện tại, bắt đầu null |
| Chuyển Đang đọc | Ghi ngày bắt đầu nếu chưa có, bỏ ngày kết thúc; nếu từ Đã đọc thì về 0 trang |
| Chuyển Đã đọc | Đủ trang, ghi ngày kết thúc, giữ ngày bắt đầu |
| Chuyển Muốn đọc | Về 0 trang, bỏ ngày kết thúc, giữ ngày bắt đầu đầu tiên |
| Cập nhật trang = tổng | Tự hoàn thành; không thay ngày hoàn thành nếu đã hoàn thành |
| Trang > 0 và < tổng | Tự sang Đang đọc, ghi ngày bắt đầu nếu thiếu, bỏ ngày kết thúc |
| Trang = 0 | Muốn đọc/Đang đọc giữ trạng thái; Đã đọc sang Đang đọc |
| Chỉ sửa rating/notes hoặc gửi cùng status | Giữ nguyên tiến độ và ngày đọc |

`services/shelf.service.ts` chứa hàm thuần `applyShelfPatch` tính quy tắc. `repositories/shelf.repository.ts` khóa mục tủ bằng `SELECT ... FOR UPDATE`, đọc trạng thái mới nhất, tính và lưu cùng transaction. Trường không gửi được giữ nguyên, kể cả khi các request sửa riêng tiến độ và rating chạy đồng thời.

### Kiểm tra MySQL thật

```bash
npm test
RUN_MYSQL_TESTS=1 node --test tests/shelf-mysql.test.cjs
```

Lệnh đầu build và chạy unit/HTTP test, bỏ qua integration MySQL mặc định. Lệnh thứ hai dùng kết nối trong `.env` nhưng tạo database test tên ngẫu nhiên, chạy schema và xóa database test trong `finally`; tài khoản cần quyền CREATE/DROP DATABASE. Không sửa database ứng dụng. Open Library được stub trong integration để kết quả ổn định; MySQL và HTTP Express là thật.

Đã kiểm tra 2026-09-30: CRUD, thống kê toàn tủ, thêm trùng đồng thời, rollback sau lỗi CHECK, PATCH đồng thời không mất trường, xóa giữ metadata và thêm lại, UTC và ID lớn hơn giới hạn số nguyên an toàn JavaScript.
