// Import docs/content-pack.xlsx → validate → write src/content/data/pack.ts.
// Usage: npm run content:import [-- path/to/file.xlsx] [--check]
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existingCodes, validatePack } from '../src/content/data/validate.js';
import { packModule, readWorkbook } from './lib/workbook.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const file = resolve(args.find((a) => !a.startsWith('--')) ?? resolve(here, '../../docs/content-pack.xlsx'));

const pack = await readWorkbook(file);
const { errors, warnings } = validatePack(pack, existingCodes(pack));
console.log(`Đọc ${file}: ${pack.actions.length} hành động, ${pack.events.length} sự kiện, ${pack.choices.length} lựa chọn, ${pack.outcomes.length} dòng kết quả.`);
for (const w of warnings) console.log(`  ⚠️  ${w}`);
for (const e of errors) console.log(`  ❌ ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} lỗi — chưa ghi gì. Sửa file Excel rồi chạy lại.`);
  process.exit(1);
}
if (checkOnly) {
  console.log('Hợp lệ (chế độ --check, không ghi file).');
} else {
  const out = resolve(here, '../src/content/data/pack.ts');
  writeFileSync(out, packModule(pack));
  console.log(`✅ Hợp lệ. Đã ghi ${out}. Chạy npm test / npm run dev để chơi thử.`);
}
