type SummaryExportChange = {
  label: string;
  value: string;
};

type SummaryExportCard = {
  label: string;
  diseaseLabel: string;
  location?: string | null;
  latestSize: string;
  radsGrade: string;
  examCount: number;
  vsPrevious?: SummaryExportChange | null;
  vsBaseline?: SummaryExportChange | null;
  qualitativeRows: string[];
  reminderText?: string | null;
};

type SummaryExportSection = {
  title: string;
  cards: SummaryExportCard[];
};

export type SummaryExportPayload = {
  profileId: string;
  nickname: string;
  genderLabel: string;
  ageLabel: string;
  lesionCount: number;
  totalExamCount: number;
  needsAttention: number;
  sections: SummaryExportSection[];
};

const WIDTH = 1080;
const PADDING = 56;
const CARD_PADDING = 28;
const SECTION_GAP = 24;
const CARD_GAP = 18;

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split('');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current + word;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = wrapText(context, text, maxWidth);
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
  return lines.length * lineHeight;
}

function measureCardHeight(card: SummaryExportCard) {
  const changeRows = [card.vsPrevious, card.vsBaseline].filter(Boolean).length;
  const qualitativeRows = card.qualitativeRows.length;
  const reminderRows = card.reminderText ? 1 : 0;

  return 176 + changeRows * 34 + qualitativeRows * 28 + reminderRows * 40;
}

function buildCanvas(height: number) {
  if (!globalThis.document?.createElement) {
    throw new Error('当前浏览器不支持导出');
  }

  const canvas = globalThis.document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = WIDTH;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持导出');
  }

  return { canvas, context };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string
) {
  context.save();
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
  context.restore();
}

function drawStatCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  value: string,
  label: string,
  tone: 'default' | 'attention' = 'default'
) {
  drawRoundedRect(context, x, y, width, 110, 24, tone === 'attention' ? '#fff3ef' : '#ffffff');
  context.fillStyle = tone === 'attention' ? '#c74b2b' : '#2f2417';
  context.font = '600 42px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(value, x + 28, y + 52);
  context.fillStyle = '#8a7d6e';
  context.font = '400 22px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(label, x + 28, y + 84);
}

function drawCard(context: CanvasRenderingContext2D, x: number, y: number, width: number, card: SummaryExportCard) {
  const height = measureCardHeight(card);
  drawRoundedRect(context, x, y, width, height, 28, '#ffffff');

  context.fillStyle = '#2f2417';
  context.font = '600 30px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(card.label, x + CARD_PADDING, y + 42);

  context.fillStyle = '#8a7d6e';
  context.font = '400 22px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  const subtitle = card.location ? `${card.diseaseLabel} · ${card.location}` : card.diseaseLabel;
  context.fillText(subtitle, x + CARD_PADDING, y + 76);

  context.fillStyle = '#2f2417';
  context.font = '700 44px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(card.latestSize, x + CARD_PADDING, y + 134);

  context.fillStyle = '#8a7d6e';
  context.font = '400 20px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(`最新大小 · ${card.radsGrade}`, x + CARD_PADDING, y + 164);

  let cursorY = y + 208;
  context.font = '500 20px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillStyle = '#2f2417';

  for (const change of [card.vsPrevious, card.vsBaseline]) {
    if (!change) continue;
    context.fillText(`${change.label} ${change.value}`, x + CARD_PADDING, cursorY);
    cursorY += 34;
  }

  context.fillStyle = '#8a7d6e';
  context.font = '400 18px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  for (const row of card.qualitativeRows) {
    cursorY += drawTextBlock(context, row, x + CARD_PADDING, cursorY, width - CARD_PADDING * 2, 26);
    cursorY += 2;
  }

  context.fillStyle = '#8a7d6e';
  context.font = '400 18px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(`共${card.examCount}次检查记录`, x + CARD_PADDING, y + height - 26);

  if (card.reminderText) {
    drawRoundedRect(context, x + CARD_PADDING, y + height - 84, width - CARD_PADDING * 2, 40, 16, '#f3f0eb');
    context.fillStyle = '#2f2417';
    context.font = '500 18px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.fillText(card.reminderText, x + CARD_PADDING + 16, y + height - 57);
  }

  return height;
}

export function renderSummaryExportImage(payload: SummaryExportPayload) {
  const statCardWidth = (WIDTH - PADDING * 2 - 24 * 2) / 3;
  const sectionHeight = payload.sections.reduce((sum, section) => {
    const cardsHeight =
      section.cards.reduce((cardSum, card) => cardSum + measureCardHeight(card), 0) +
      Math.max(section.cards.length - 1, 0) * CARD_GAP;
    return sum + 48 + cardsHeight + SECTION_GAP;
  }, 0);

  const emptyStateHeight = payload.sections.length === 0 ? 160 : 0;
  const totalHeight = Math.max(1200, 320 + 110 + 32 + sectionHeight + emptyStateHeight + 120);

  const { canvas, context } = buildCanvas(totalHeight);

  context.fillStyle = '#f7f3ec';
  context.fillRect(0, 0, WIDTH, totalHeight);

  context.fillStyle = '#2f2417';
  context.font = '700 54px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(`${payload.nickname}的就诊摘要`, PADDING, 92);

  context.fillStyle = '#8a7d6e';
  context.font = '400 26px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(
    `${payload.genderLabel} · ${payload.ageLabel} · 在档病灶 ${payload.lesionCount}个`,
    PADDING,
    136
  );
  context.fillText(`档案编号 ${payload.profileId}`, PADDING, 174);

  const statsY = 216;
  drawStatCard(context, PADDING, statsY, statCardWidth, `${payload.lesionCount}`, '在档病灶');
  drawStatCard(context, PADDING + statCardWidth + 24, statsY, statCardWidth, `${payload.totalExamCount}`, '检查记录');
  drawStatCard(
    context,
    PADDING + (statCardWidth + 24) * 2,
    statsY,
    statCardWidth,
    `${payload.needsAttention}`,
    '需关注',
    'attention'
  );

  let cursorY = statsY + 148;

  if (payload.sections.length === 0) {
    drawRoundedRect(context, PADDING, cursorY, WIDTH - PADDING * 2, 140, 28, '#ffffff');
    context.fillStyle = '#2f2417';
    context.font = '600 30px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.fillText('暂无在档病灶', PADDING + CARD_PADDING, cursorY + 54);
    context.fillStyle = '#8a7d6e';
    context.font = '400 22px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.fillText('当前档案尚未写入病灶记录，导出仍会保留档案头部信息。', PADDING + CARD_PADDING, cursorY + 92);
    cursorY += 164;
  }

  for (const section of payload.sections) {
    context.fillStyle = '#8a7d6e';
    context.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.fillText(section.title, PADDING, cursorY + 20);
    cursorY += 48;

    for (const card of section.cards) {
      const height = drawCard(context, PADDING, cursorY, WIDTH - PADDING * 2, card);
      cursorY += height + CARD_GAP;
    }

    cursorY += SECTION_GAP;
  }

  drawRoundedRect(context, PADDING, totalHeight - 92, WIDTH - PADDING * 2, 52, 22, '#f1ede6');
  context.fillStyle = '#8a7d6e';
  context.font = '400 18px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText('本摘要由「结节档案」生成，仅供医生参考，不构成诊断意见。', PADDING + 26, totalHeight - 58);

  return canvas.toDataURL('image/png');
}
