import { hasStructure } from '../engine/ctx.ts';
import type { GameState } from '../engine/types.ts';

// Guided first steps. Completion is derived from durable state (flags, structures,
// discoveries) so it survives reloads and never regresses.

export interface TutorialStep {
  id: string;
  phase: 'Sống sót ngày đầu' | 'Hướng tới thoát đảo';
  title: string;
  hint: string;
  done: (s: GameState) => boolean;
  /** action the guide points at, given the current situation */
  action?: (s: GameState) => string | undefined;
}

const did = (s: GameState, ...keys: string[]) => keys.some((k) => !!s.flags[`done:${k}`]);
const hasAnyBuildMaterials = (s: GameState) => s.inventory.some((x) => x.id === 'wood') && s.inventory.some((x) => x.id === 'palm');

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'wreck',
    phase: 'Sống sót ngày đầu',
    title: 'Lục soát xác tàu',
    hint: 'Xác tàu ở Bãi biển còn đồ hữu ích: dao, dây thừng, đồ hộp, nồi đun nước… Mỗi hành động tốn 1 buổi và thường phải tung D20.',
    done: (s) => did(s, 'search_wreck'),
    action: (s) => (s.location === 'coast' ? 'search_wreck' : 'travel:coast'),
  },
  {
    id: 'consume',
    phase: 'Sống sót ngày đầu',
    title: 'Ăn hoặc uống một thứ gì đó',
    hint: 'Ăn uống KHÔNG tốn thời gian — bấm nút bên dưới, hoặc dùng ô "Ăn uống nhanh" bất cứ lúc nào. Giữ No bụng và Nước trên 25 để không bị trừ điểm khi tung xúc xắc.',
    done: (s) => did(s, 'consume'),
  },
  {
    id: 'food',
    phase: 'Sống sót ngày đầu',
    title: 'Kiếm thức ăn',
    hint: 'Tìm thức ăn ở Bãi biển (dừa, sò ốc) hoặc Rừng rậm (trái cây). Đồ sống như sò ốc, cá, thịt nên nấu chín để no hơn và không bị đau bụng.',
    done: (s) => did(s, 'forage', 'fish', 'hunt'),
    action: (s) => (s.location === 'coast' || s.location === 'jungle' ? 'forage' : 'travel:coast'),
  },
  {
    id: 'river',
    phase: 'Sống sót ngày đầu',
    title: 'Đi tới Dòng suối',
    hint: 'Bãi biển không có nước ngọt. Dòng suối là nguồn nước chính của đảo. Di chuyển sang vùng kề bên tốn 1 buổi và năng lượng.',
    done: (s) => did(s, 'travel:river'),
    action: () => 'travel:river',
  },
  {
    id: 'water',
    phase: 'Sống sót ngày đầu',
    title: 'Lấy nước',
    hint: 'Nước suối chưa xử lý có thể gây đau bụng. Có bình chứa càng nhiều thì mang được càng nhiều nước — tìm thêm lon, nồi trong xác tàu hoặc làm gáo dừa.',
    done: (s) => did(s, 'collect_water:river', 'collect_water'),
    action: (s) => (s.location === 'river' ? 'collect_water:river' : 'travel:river'),
  },
  {
    id: 'gather',
    phase: 'Sống sót ngày đầu',
    title: 'Thu thập vật liệu',
    hint: 'Gỗ, lá cọ, sợi dây leo dùng để dựng lều, nhóm lửa và chế tạo. Rừng rậm có nhiều loại vật liệu nhất.',
    done: (s) => did(s, 'gather'),
    action: () => 'gather',
  },
  {
    id: 'shelter',
    phase: 'Sống sót ngày đầu',
    title: 'Dựng Lều tạm để lập căn cứ',
    hint: 'Lều tạm giúp ngủ ngon, tránh mưa và mở kho chứa đồ. Nơi dựng lều đầu tiên sẽ thành căn cứ — gần Dòng suối là lựa chọn khôn ngoan. Cần 4 gỗ, 5 lá cọ, 2 sợi dây leo.',
    done: (s) => !!s.baseRegion,
    action: (s) => (hasAnyBuildMaterials(s) ? 'build:lean_to' : 'gather'),
  },
  {
    id: 'fire',
    phase: 'Sống sót ngày đầu',
    title: 'Nhóm lửa trại ở căn cứ',
    hint: 'Lửa trại cho phép nấu ăn, đun sôi nước và sưởi ấm. Có đá lửa (nhặt ở suối, núi) thì nhóm lửa dễ hơn nhiều.',
    done: (s) => !!s.baseRegion && hasStructure(s, 'campfire', s.baseRegion),
    action: (s) => (s.location === s.baseRegion ? 'build:campfire' : s.baseRegion ? `travel:${s.baseRegion}` : undefined),
  },
  {
    id: 'cook',
    phase: 'Sống sót ngày đầu',
    title: 'Đun sôi nước hoặc nấu ăn',
    hint: 'Đun sôi nước (cần nồi hoặc lon thiếc) biến nước suối thành nước sạch. Nấu chín đồ sống giúp no gấp đôi và an toàn.',
    done: (s) => did(s, 'boil_water', 'cook'),
    action: () => 'boil_water',
  },
  {
    id: 'night',
    phase: 'Sống sót ngày đầu',
    title: 'Sống sót qua đêm đầu tiên',
    hint: 'Sau buổi Tối, nhân vật ngủ qua đêm: hồi năng lượng (tốt hơn nếu có lều và lửa), đói khát tăng thêm. Hãy ăn uống đủ trước khi trời tối.',
    done: (s) => s.day >= 2,
  },
  {
    id: 'explore',
    phase: 'Hướng tới thoát đảo',
    title: 'Khám phá để tìm đường mới',
    hint: 'Khám phá khu vực để phát hiện địa điểm, tuyến đường và manh mối. Hãy tìm đường lên Núi đá — từ đỉnh núi nhìn được cả hòn đảo và vùng biển.',
    done: (s) => did(s, 'explore'),
    action: () => 'explore',
  },
  {
    id: 'lookout',
    phase: 'Hướng tới thoát đảo',
    title: 'Leo lên đỉnh núi quan sát',
    hint: 'Từ đỉnh núi bạn sẽ biết lịch tàu đi qua, dự báo thời tiết và tìm ra Mũi Hải Đăng — nơi phát tín hiệu tốt nhất.',
    done: (s) => !!s.flags.lookoutDone,
    action: (s) => (s.location === 'mountain' ? 'climb_lookout' : undefined),
  },
  {
    id: 'escape_plan',
    phase: 'Hướng tới thoát đảo',
    title: 'Chuẩn bị thoát đảo: đóng bè hoặc dựng đống lửa tín hiệu',
    hint: 'Đóng bè ở Bãi biển (3 giai đoạn, cần nhiều gỗ và dây thừng) rồi ra khơi; hoặc dựng đống lửa tín hiệu ở nơi nhìn ra biển và chờ tàu theo lịch. Hiểu hải lưu và mang đủ nước giúp chuyến đi an toàn hơn.',
    done: (s) => s.projects.some((p) => p.id === 'raft') || s.structures.some((x) => x.id === 'signal_pyre'),
    action: (s) => (s.location === 'coast' ? 'build_raft:main' : undefined),
  },
];
