import fs from 'node:fs';
import path from 'node:path';

const ROUTE_FILES = [
  'src/app/(main)/index.tsx',
  'src/app/record/upload.tsx',
  'src/app/record/recognize.tsx',
  'src/app/record/match.tsx',
  'src/app/lesion/[id].tsx',
  'src/app/lesion/[id]/compare.tsx',
];

const FORBIDDEN_ROUTE_PATTERNS = [
  /PROTOTYPE_/,
  /DEMO_[A-Z_]+/,
  /prototype[A-Za-z]+Seed/,
  /prototype-[a-z0-9-]+/,
  /重庆市第一人民医院/,
  /2024-03-15/,
  /2024-09-15/,
  /2023-09-10/,
  /2023-03-05/,
  /左叶中下段结节/,
];

describe('core flow production routes dead-data guard', () => {
  it.each(ROUTE_FILES)('%s does not embed prototype fixtures or seed switches', (relativePath) => {
    const filePath = path.join(__dirname, '..', '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8');

    for (const pattern of FORBIDDEN_ROUTE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
