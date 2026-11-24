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
            <small>Giảm nhanh nhất. Lấy nước ở suối, hứng nước mưa, hoặc uống nước dừa ở bãi biển.</small>
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
          <li>
            Trước khi xác nhận, bạn luôn thấy <b>tung mấy viên xúc xắc</b> và <b>cần ra bao nhiêu điểm</b> cho từng mức kết quả.
          </li>
          <li>Công cụ tốt và kỹ năng cao giúp tăng cơ hội — nhưng rủi ro không bao giờ biến mất.</li>
          <li>Thất bại vẫn cho kinh nghiệm. Kỹ năng tăng khi bạn dùng nó; thuộc tính tăng khi sống sót đủ lâu.</li>
        </ul>
      </>
    ),
  },
  {
    icon: '⚔️',
    title: 'Nhiều kiểu thử thách',
    body: (
      <ul className="guide-list">
        <li>
          <b>Đối kháng:</b> khi đuổi khỉ hay đối đầu lợn rừng, đối thủ cũng tung xúc xắc — bạn cần tổng điểm cao hơn tổng của nó.
        </li>
        <li>
          <b>Chuẩn bị:</b> dành một buổi theo dõi lối mòn thú, bắt mồi hay khảo sát đường leo → lần thử tiếp theo được <b>tung 2 viên, lấy viên cao</b>.
        </li>
        <li>
          <b>Hy sinh tài nguyên:</b> trước khi tung, có thể đốt dầu đèn, dùng mồi, buộc thêm dây… để cộng điểm.
        </li>
        <li>
          <b>Leo thang rủi ro:</b> lặn vào khoang tàu chìm hay thám hiểm hang sâu — mỗi chặng sâu hơn nhiều đồ quý hơn, nhưng thất bại là đánh rơi đồ. Biết dừng đúng lúc!
        </li>
      </ul>
    ),
  },
  {
    icon: '🗺️',
    title: 'Một hòn đảo biết thay đổi',
    body: (
      <ul className="guide-list">
        <li>
          <b>Khám phá</b> để mở vùng mới, địa điểm và đường đi. Mỗi ván, hòn đảo được sắp xếp khác nhau và có <b>2 đặc điểm ngẫu nhiên</b> (mưa nhiều, mùa khô, thú dữ, tàu qua lại thường xuyên…) — xem ở tab Bản đồ.
        </li>
        <li>
          <b>Thời tiết</b> thay đổi mỗi ngày. Bão rất nguy hiểm nhưng luôn có dấu hiệu báo trước.
        </li>
        <li>
          <b>Sự kiện bất ngờ</b> xuất hiện dưới dạng thẻ — bạn chọn cách phản ứng. Mối nguy lớn (lợn rừng phá trại, sạt lở, sập hang) luôn có <b>điềm báo</b> trước — kịp phòng bị thì thiệt hại nhỏ hơn nhiều.
        </li>
        <li>
          Gặp chuỗi xui? Đảo đôi khi cũng mở ra <b>cơ hội hồi phục</b>. Đồ trôi dạt hay kho đồ cũ chỉ ở đó vài ngày — đừng để lỡ.
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
      </>
    ),
  },
  {
    icon: '🧭',
    title: 'Màn hình chơi gồm những gì?',
    body: (
      <>
        <div className="guide-goals">
          <div>
            <b>❤️ Sinh lực & Ăn uống nhanh</b>
            <span>4 chỉ số sinh tồn, các trạng thái đang mắc, và nút ăn/uống đồ đang mang theo — không tốn thời gian.</span>
          </div>
          <div>
            <b>🌤️ Thời tiết hôm nay</b>
            <span>Mỗi loại thời tiết có buff ▲ và nerf ▼ riêng. Hãy lên kế hoạch theo trời.</span>
          </div>
          <div>
            <b>🎲 Bảng hành động</b>
<span>
              Tab <b>📋 Tất cả hành động</b> liệt kê mọi việc làm được ở nơi bạn đứng, chia theo nhóm; <b>⭐ Đề xuất</b> gợi ý việc nên làm lúc này. Mỗi thẻ ghi số buổi, năng lượng và điểm cần tung (ví dụ "d20 ≥ 8").
            </span>
          </div>
          <div>
            <b>🗺️ Bản đồ · 🎒 Hành trang · ⛺ Căn cứ · 📓 Nhật ký</b>
            <span>Đường đi và vùng đã khám phá; đồ mang theo và kho; công trình, bè, lịch tàu; mọi điều đã xảy ra.</span>
          </div>
          <div>
            <b>⭐ Nhân vật</b>
            <span>Thuộc tính và kỹ năng. Điểm thuộc tính mới nhận được khi sống sót qua các mốc ngày.</span>
          </div>
        </div>
        <p className="muted small">
          Bấm <b>📖 Hướng dẫn</b> trên thanh trên cùng để xem lại các trang này bất cứ lúc nào.
        </p>
      </>
    ),
  },
  {
    icon: '🏕️',
    title: 'Nhiệm vụ đầu tiên: dựng lều tạm',
    body: (
      <>
        <p className="narr">Đêm đầu tiên trên đảo sẽ rất khắc nghiệt nếu không có chỗ trú. Trước khi làm gì khác, hãy dựng một căn cứ.</p>
        <ul className="guide-list">
          <li>
            <b>Thu thập</b> ở Bãi biển để có <b>gỗ, lá cọ và xơ dừa</b>.
          </li>
          <li>
            Đủ vật liệu thì chọn <b>Dựng lều tạm</b> — nơi đó trở thành căn cứ của bạn.
          </li>
          <li>Trong ngày 1, chỉ những việc dẫn tới căn cứ được mở khóa. Dựng xong lều, cả hòn đảo mở ra.</li>
        </ul>
        <p className="muted small">Thẻ nhiệm vụ ở đầu bảng hành động cho biết bạn còn thiếu gì. Nếu trời tối mà chưa xong, bạn sẽ dựng vội một chiếc lều tạm bợ.</p>
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
