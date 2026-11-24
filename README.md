# Roll To Survive

Game sinh tồn theo lượt trên web, mọi hành động giải quyết bằng xúc xắc D20. Bản MVP dựa trên GDD-00 → GDD-04.

## Chạy game

Yêu cầu: **Node.js 22+**. Không cần cài database: khi chạy trên máy, ván chơi được lưu vào file SQLite qua thư viện libSQL.

```powershell
npm install
npm run dev
```

Mở http://localhost:5173 — Vite phục vụ giao diện, API chạy ở cổng 3001.

Bản production (một server duy nhất phục vụ cả giao diện và API):

```powershell
npm run build
npm start
```

Mặc định cổng 3001 (đổi bằng biến `PORT`), dữ liệu lưu ở `data/rts.db` (đổi bằng `RTS_DB`).

## Deploy lên Vercel

Vercel chạy API dưới dạng Vercel Function. Function không giữ được file giữa các lần chạy, nên **bắt buộc** dùng database Turso (SQLite trên cloud, có sẵn trong Vercel Marketplace, gói miễn phí đủ dùng).

Cấu hình đã có sẵn trong repo:

- `vercel.json`: build giao diện (`npm run build` → `client/dist`), chuyển mọi request `/api/*` vào function.
- `api/index.ts`: function bọc lại đúng server Fastify dùng khi chạy local.
- `server/src/db.ts`: dùng Turso khi có biến `TURSO_DATABASE_URL` (+ `TURSO_AUTH_TOKEN`), còn lại dùng file SQLite local.

Các bước:

1. Đăng nhập https://vercel.com → **Add New… → Project** → chọn repo `rollToSurvive` trên GitHub → **Import**.
2. Ở màn hình cấu hình: Framework Preset để **Other**, Root Directory để trống (thư mục gốc). Không cần sửa Build/Output — Vercel đọc từ `vercel.json`. Bấm **Deploy**.
3. Sau khi project được tạo: tab **Storage → Create Database → Turso** → tạo database và **Connect** vào project (chọn cả Production và Preview).
4. Vào **Settings → Environment Variables**, kiểm tra đã có `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN`. Nếu integration đặt tên khác, thêm 2 biến này bằng tay, lấy giá trị từ trang quản lý database Turso.
5. Tab **Deployments** → bản deploy mới nhất → **⋯ → Redeploy** để function nhận biến môi trường.
6. Mở địa chỉ `https://<tên-project>.vercel.app`, kiểm tra `/api/meta` trả về JSON rồi tạo ván mới.

Từ đó, mỗi lần push lên nhánh `main` Vercel sẽ tự deploy lại. Ván chơi lưu trên Turso, không mất khi deploy.

Kiểm thử và mô phỏng cân bằng:

```powershell
npm test
npm run sim -- 300 60
```

Xuất danh mục nội dung (mã ACT/EVT/CON, phân loại, tier/độ hiếm) ra `docs/content-catalog.csv`:

```powershell
npm run content:export
```

### Soạn nội dung bằng Excel (data-driven content)

Đây là công cụ nội bộ cho Game Designer — người chơi không thấy file Excel (thư mục `docs/` và `server/scripts/` không nằm trong bản deploy, xem `.vercelignore`). Hành động và sự kiện mới có thể viết hoàn toàn trong `docs/content-pack.xlsx`, không cần sửa code:

1. Mở `docs/content-pack.xlsx`, đọc sheet **README** (cú pháp điều kiện, hậu quả, mods, đối kháng…).
2. Thêm dòng vào 4 sheet **Actions**, **Events**, **Choices**, **Outcomes**. Các sheet màu nâu liệt kê mọi ID hợp lệ (hậu quả, vật phẩm, địa điểm, nội dung có sẵn).
3. Nhập vào game — bộ kiểm tra báo lỗi bằng tiếng Việt và không ghi gì nếu còn lỗi:

```powershell
npm run content:import
```

4. Chạy `npm test` và `npm run dev` để chơi thử. Dùng `npm run content:import -- --check` để chỉ kiểm tra, `npm run content:template` để tạo lại file Excel từ nội dung hiện tại.

File sinh ra là `server/src/content/data/pack.ts` (không sửa tay).

## Kiến trúc

| Thư mục | Nội dung |
| --- | --- |
| `server/src/engine/` | Luật game: D20 (`check.ts`), dòng thời gian & đêm (`time.ts`), Event Director (`director.ts`), thoát đảo (`escape.ts`), giao dịch hành động (`game.ts`), chiếu dữ liệu cho client (`view.ts`) |
| `server/src/content/` | **Dữ liệu nội dung**: hành động, sự kiện, vật phẩm, công thức, công trình, vùng đất, và `balance.ts` chứa toàn bộ con số cân bằng |
| `server/src/app.ts` | API Fastify + lưu ván libSQL: file local hoặc Turso (`db.ts`) |
| `api/index.ts`, `vercel.json` | Entry cho Vercel Function và cấu hình deploy |
| `client/src/` | Giao diện React (tiếng Việt) |
| `shared/types.ts` | Kiểu dữ liệu API dùng chung |

Nguyên tắc kỹ thuật:

- **Server quyết định mọi kết quả.** Client chỉ gửi "muốn làm gì". Xúc xắc dùng RNG có seed lưu trong save, nên tải lại trang không thể tung lại.
- **Mỗi hành động là một giao dịch.** Trạng thái được sao chép, áp dụng toàn bộ chi phí, roll và hậu quả, rồi ghi một lần vào DB có kiểm tra `version`. Bấm hai lần hay dùng nhiều tab cũng không nhận thưởng hai lần.
- **Client chỉ thấy những gì nhân vật biết.** Vùng chưa khám phá, lịch tàu, nước suối bị ô nhiễm… bị ẩn cho tới khi nhân vật phát hiện.
- **Không cần tài khoản.** Mã ván chơi lưu trong `localStorage` của trình duyệt.

## Nội dung MVP

- 5 vùng (Bãi biển, Rừng rậm, Dòng suối, Núi đá, Mũi Hải Đăng), 16 địa điểm phụ, 7 tuyến đường. Mỗi ván, địa điểm phụ, đường bị chặn và đồ trong xác tàu được sắp xếp ngẫu nhiên (Hybrid Island).
- Khoảng 30 loại hành động, 13 công thức chế tạo, 7 công trình, bè 3 giai đoạn.
- 20 sự kiện: bão (có báo trước), thú rừng, ô nhiễm nguồn nước (chuỗi sự kiện), tàu và máy bay đi ngang…
- 10 loại thời tiết (`server/src/content/weather.ts`), mỗi loại có hiệu ứng riêng lên xúc xắc, năng lượng, độ khát, ban đêm, lửa trại, nước mưa và ra khơi.
- 3 cách thoát đảo: đóng bè, phát tín hiệu cứu hộ, liều mình ra khơi (thử được ngay từ Ngày 1).
- 5 thuộc tính (tăng theo mốc ngày sống sót), 6 kỹ năng học qua thử thách (lặp việc dễ thì nhận ít XP).

Mọi con số đều là **giá trị tạm** trong `server/src/content/balance.ts` và các file nội dung, cần điều chỉnh qua chơi thử.
