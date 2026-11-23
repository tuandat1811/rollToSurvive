import { useState, type ReactNode } from 'react';
import { Bar, Modal } from './ui.tsx';

interface Slide {
  icon: string;
  title: string;
  body: ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: '🏝️',
    title: 'Bạn đang chơi gì?',
    body: (
      <>
        <p className="narr">
          Con tàu của bạn bị đắm trong bão. Bạn tỉnh dậy một mình trên một hòn đảo hoang, chỉ có vài món đồ trong tay.
        </p>
        <div className="guide-goals">
          <div>
            <b>🏆 Chiến thắng</b>
            <span>Rời khỏi đảo: đóng bè ra khơi, hoặc ra hiệu cho tàu/máy bay cứu.</span>
          </div>
          <div>
            <b>💀 Thua cuộc</b>
            <span>Sức khỏe về 0. Mỗi ván là một hành trình riêng — chết là hết.</span>
          </div>
        </div>
        <p className="muted small">Không có giới hạn số ngày. Bạn có thể thử thoát đảo bất cứ lúc nào — nhưng chuẩn bị càng kỹ, cơ hội càng cao.</p>
      </>
    ),
  },
  {
    icon: '⏱️',
    title: 'Thời gian: 4 buổi mỗi ngày',
    body: (
      <>
        <div className="slots guide-slots">
          <span className="now">🌅 Sáng</span>
          <span>☀️ Trưa</span>
          <span>🌇 Chiều</span>
          <span>🌙 Tối</span>
        </div>
        <ul className="guide-list">
          <li>
            Mỗi <b>hành động chính</b> (tìm thức ăn, lấy nước, di chuyển, chế tạo…) tốn <b>1 buổi</b>.
          </li>
          <li>
            <b>Ăn, uống, cất đồ</b> thì <b>không tốn thời gian</b>.
          </li>
          <li>Sau buổi Tối, nhân vật ngủ qua đêm. Có lều và lửa trại thì hồi sức tốt hơn nhiều.</li>
        </ul>
        <p className="muted small">Thời gian là tài nguyên quý nhất: mỗi buổi dành cho việc này là bỏ lỡ việc khác.</p>
      </>
    ),
  },
  {
    icon: '❤️',
    title: 'Giữ cho mình sống sót',
    body: (
      <>
        <div className="guide-vitals">
          <div>
            <span>❤️ Sức khỏe</span>
            <Bar value={90} color="var(--health)" />
            <small>Về 0 là kết thúc.</small>
          </div>
          <div>
            <span>🍖 No bụng</span>
            <Bar value={60} color="var(--hunger)" />
            <small>Giảm dần. Về 0: mất Sức khỏe.</small>
          </div>
          <div>
            <span>💧 Nước</span>
            <Bar value={40} color="var(--thirst)" />
            <small>Giảm nhanh nhất. Về 0: mất Sức khỏe rất nhanh.</small>
          </div>
          <div>
            <span>⚡ Năng lượng</span>
            <Bar value={75} color="var(--energy)" />
            <small>Tốn khi hành động. Hồi khi nghỉ và ngủ.</small>
          </div>
        </div>
        <p className="muted small">
          Dưới 25 bạn sẽ bị trừ điểm khi tung xúc xắc. Bị thương, ngộ độc, nhiễm lạnh… cũng là trạng thái cần chữa trị.
        </p>
      </>
    ),
  },
  {
    icon: '🎲',
    title: 'Mọi hành động là một canh bạc',
    body: (
      <>
        <div className="formula" style={{ justifyContent: 'center', margin: '6px 0 12px' }}>
          <span className="term die">d20</span>
          <span className="term">+ Thuộc tính</span>
          <span className="term">+ Kỹ năng</span>
          <span className="term pos">+ Trang bị, hoàn cảnh</span>
          <span className="faint">so với</span>
          <span className="term dc">DC</span>
        </div>
        <div className="guide-tiers">
          <span className="t-crit_success">Vang dội</span>
          <span className="t-success">Thành công</span>
          <span className="t-partial">Một phần</span>
          <span className="t-failure">Thất bại</span>
          <span className="t-crit_failure">Thảm hại</span>
        </div>
        <ul className="guide-list">
          <li>Trước khi xác nhận, bạn luôn thấy <b>xác suất từng kết quả</b>.</li>
          <li>Công cụ tốt và kỹ năng cao giúp tăng cơ hội — nhưng rủi ro không bao giờ biến mất.</li>
          <li>Thất bại vẫn cho kinh nghiệm. Kỹ năng tăng khi bạn dùng nó; thuộc tính tăng khi sống sót đủ lâu.</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🗺️',
    title: 'Một hòn đảo biết thay đổi',
    body: (
      <ul className="guide-list">
        <li>
          <b>Khám phá</b> để mở vùng mới, địa điểm và đường đi. Mỗi ván, hòn đảo được sắp xếp khác nhau.
        </li>
        <li>
          <b>Thời tiết</b> thay đổi mỗi ngày. Bão rất nguy hiểm nhưng luôn có dấu hiệu báo trước.
        </li>
        <li>
          <b>Sự kiện bất ngờ</b> xuất hiện dưới dạng thẻ — bạn chọn cách phản ứng.
        </li>
        <li>
          Tài nguyên khai thác quá mức sẽ cạn dần và cần thời gian hồi phục. Thế giới nhớ những gì bạn đã làm.
        </li>
      </ul>
    ),
  },
  {
    icon: '⛵',
    title: 'Ba con đường rời đảo',
    body: (
      <>
        <div className="guide-goals">
          <div>
            <b>🛶 Đóng bè</b>
            <span>Đóng bè ở Bãi biển (3 giai đoạn), mang đủ nước, hiểu hải lưu, rồi vượt 3 chặng biển.</span>
          </div>
          <div>
            <b>🔥 Phát tín hiệu</b>
            <span>Tàu đi qua theo lịch. Đứng ở nơi nhìn ra biển và đốt lửa tín hiệu. Leo núi để biết lịch tàu.</span>
          </div>
          <div>
            <b>🌊 Liều mình</b>
            <span>Ôm khúc gỗ lao ra biển ngay hôm nay. Cơ hội cực thấp.</span>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Bảng <b>🎯 Việc cần làm</b> phía trên danh sách hành động sẽ dẫn bạn từng bước. Bấm <b>📖 Hướng dẫn</b> trên thanh trên cùng để xem lại trang này.
        </p>
      </>
    ),
  },
];

export default function IntroGuide({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <Modal onClose={onClose} wide>
      <div className="guide-head">
        <div className="guide-dots" aria-label={`Trang ${i + 1}/${SLIDES.length}`}>
          {SLIDES.map((_, k) => (
            <button key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} onClick={() => setI(k)} aria-label={`Trang ${k + 1}`} />
          ))}
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          Bỏ qua
        </button>
      </div>
      <div className="modal-head">
        <span className="big">{s.icon}</span>
        <div>
          <div className="tiny faint">
            HƯỚNG DẪN · {i + 1}/{SLIDES.length}
          </div>
          <h2>{s.title}</h2>
        </div>
      </div>
      <div className="modal-body guide-body">{s.body}</div>
      <div className="modal-foot">
        {i > 0 && (
          <button className="btn ghost" onClick={() => setI(i - 1)}>
            ← Trước
          </button>
        )}
        <button className="btn primary" onClick={() => (last ? onClose() : setI(i + 1))} autoFocus>
          {last ? 'Bắt đầu sinh tồn' : 'Tiếp →'}
        </button>
      </div>
    </Modal>
  );
}
