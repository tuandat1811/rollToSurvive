// Write docs/content-pack.xlsx from the current pack (with fresh README and
// reference sheets). Usage: npm run content:template [-- path/to/file.xlsx]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACK } from '../src/content/data/pack.js';
import { writeWorkbook } from './lib/workbook.js';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(process.argv[2] ?? resolve(here, '../../docs/content-pack.xlsx'));
await writeWorkbook(PACK, file);
console.log(`✅ Đã ghi ${file} (${PACK.actions.length} hành động, ${PACK.events.length} sự kiện từ pack hiện tại).`);
