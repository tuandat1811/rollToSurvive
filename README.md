# Roll To Survive

Game sinh tồn theo lượt trên web, mọi hành động giải quyết bằng xúc xắc D20. Bản MVP dựa trên GDD-00 → GDD-04.

## Chạy game

Yêu cầu: **Node.js 22.13+** (dùng SQLite có sẵn trong Node, không cần cài database).

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

Kiểm thử và mô phỏng cân bằng:

```powershell
npm test
npm run sim -- 300 60
```

## Kiến trúc

| Thư mục | Nội dung |
| --- | --- |
| `server/src/engine/` | Luật game: D20 (`check.ts`), dòng thời gian & đêm (`time.ts`), Event Director (`director.ts`), thoát đảo (`escape.ts`), giao dịch hành động (`game.ts`), chiếu dữ liệu cho client (`view.ts`) |
| `server/src/content/` | **Dữ liệu nội dung**: hành động, sự kiện, vật phẩm, công thức, công trình, vùng đất, và `balance.ts` chứa toàn bộ con số cân bằng |
| `server/src/app.ts` | API Fastify + lưu ván SQLite (`db.ts`) |
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
- 3 cách thoát đảo: đóng bè, phát tín hiệu cứu hộ, liều mình ra khơi (thử được ngay từ Ngày 1).
- 5 thuộc tính (tăng theo mốc ngày sống sót), 6 kỹ năng học qua thử thách (lặp việc dễ thì nhận ít XP).

Mọi con số đều là **giá trị tạm** trong `server/src/content/balance.ts` và các file nội dung, cần điều chỉnh qua chơi thử.
