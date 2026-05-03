import fs from 'node:fs';
import path from 'node:path';

const CLOSING_ROUTE_FILES = [
  'src/app/summary/[profileId].tsx',
  'src/app/(main)/reminders.tsx',
  'src/app/(main)/settings.tsx',
  'src/app/subscription/index.tsx',
  'src/app/subscription/success.tsx',
  'src/app/paywall.tsx',
  'src/components/PaywallSheet.tsx',
];

const FORBIDDEN_CLOSING_FLOW_PATTERNS = [
  /PROTOTYPE_/,
  /Demo[A-Za-z]+Page/,
  /prototypeUi005Seed/,
  /prototypePremiumSeed/,
  /prototype-order-399/,
  /重庆市第一人民医院/,
  /张女士/,
  /左叶中下段结节/,
  /右乳10点钟结节/,
  /右上叶前段结节/,
  /已用 12MB/,
  /zhang@example\.com/,
  /本月免费额度已用尽（5次\/月）<br \/>升级会员，享受无限次AI识别/,
];

describe('closing flow production routes dead-data guard', () => {
  it.each(CLOSING_ROUTE_FILES)('%s does not embed prototype/demo archive data', (relativePath) => {
    const filePath = path.join(__dirname, '..', '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8');

    for (const pattern of FORBIDDEN_CLOSING_FLOW_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
