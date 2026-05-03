import { DISEASE_FIELD_DEFINITIONS, type DiseaseType, type Examination } from '@/lib/db/types';

export type RecognitionProviderField = {
  value?: unknown;
  confidence?: unknown;
};

export type RecognitionProviderOutput = {
  disease_type?: unknown;
  fields?: Record<string, RecognitionProviderField>;
};

export type RecognitionArchiveCommand = {
  diseaseType: DiseaseType;
  recognized: Partial<Record<'location' | keyof Examination, string | number | null>>;
};

export type RecognitionValidationError = {
  code: 'unsupported_disease_type' | 'ambiguous_disease_type' | 'unsupported_field' | 'ambiguous_field' | 'unsupported_field_value';
  field: RecognitionFieldKey | string;
  message: string;
};

export type RecognitionReportImageLink = {
  uri: string;
  mimeType: string | null;
  sourceIndex: number;
};

export type NormalizedRecognitionOutput = {
  command: RecognitionArchiveCommand;
  fieldConfidence: Partial<Record<RecognitionFieldKey, number>>;
  missingRequiredFields: ('location' | keyof Examination)[];
  reportImages: RecognitionReportImageLink[];
  validationErrors: RecognitionValidationError[];
};

type ArchiveRecognitionFieldKey = 'location' | keyof Examination;
type RecognitionFieldKey = ArchiveRecognitionFieldKey | 'disease_type';

type NormalizeRecognitionInput = {
  requestedDiseaseType?: unknown;
  providerOutput?: RecognitionProviderOutput | null;
  reportImages?: { uri: string; mimeType?: string | null }[];
};

const RADS_GRADE_BY_DISEASE: Record<DiseaseType, Extract<ArchiveRecognitionFieldKey, 'tirads' | 'birads' | 'lung_rads'>> = {
  thyroid: 'tirads',
  breast: 'birads',
  lung: 'lung_rads',
};

const FIELD_KEY_ALIASES: Record<string, RecognitionFieldKey> = {
  diseaseType: 'disease_type',
  disease_type: 'disease_type',
  type: 'disease_type',
  location: 'location',
  loc: 'location',
  examDate: 'exam_date',
  exam_date: 'exam_date',
  hospital: 'hospital',
  size: 'size_x',
  sizeX: 'size_x',
  size_x: 'size_x',
  sizeY: 'size_y',
  size_y: 'size_y',
  sizeZ: 'size_z',
  size_z: 'size_z',
  rads_grade: 'tirads',
  radsGrade: 'tirads',
  tirads: 'tirads',
  ti_rads: 'tirads',
  'ti-rads': 'tirads',
  birads: 'birads',
  bi_rads: 'birads',
  'bi-rads': 'birads',
  lungRads: 'lung_rads',
  lung_rads: 'lung_rads',
  'lung-rads': 'lung_rads',
  echoType: 'echo_type',
  echo_type: 'echo_type',
  border: 'border',
  calcification: 'calcification',
  bloodFlow: 'blood_flow',
  blood_flow: 'blood_flow',
  shape: 'shape',
  orientation: 'orientation',
  density: 'density',
  morphology: 'morphology',
  pleuralPull: 'pleural_pull',
  pleural_pull: 'pleural_pull',
  notes: 'notes',
};

const TEXT_ENUMS: Partial<Record<RecognitionFieldKey, Record<string, string>>> = {
  echo_type: {
    hypoechoic: '低回声',
    lowecho: '低回声',
    '低回声': '低回声',
    isoechoic: '等回声',
    '等回声': '等回声',
    hyperechoic: '高回声',
    '高回声': '高回声',
    mixedecho: '混合回声',
    mixed: '混合回声',
    '混合回声': '混合回声',
  },
  border: {
    circumscribed: '清晰',
    clear: '清晰',
    '清晰': '清晰',
    '边界清晰': '清晰',
    fuzzy: '模糊',
    indistinct: '模糊',
    '模糊': '模糊',
    '边界欠清': '模糊',
    irregular: '不规则',
    '不规则': '不规则',
  },
  shape: {
    oval: '椭圆形',
    '椭圆': '椭圆形',
    '椭圆形': '椭圆形',
    round: '圆形',
    '圆形': '圆形',
    irregular: '不规则',
    '不规则': '不规则',
  },
  orientation: {
    parallel: '平行',
    '平行': '平行',
    nonparallel: '非平行',
    antiparallel: '非平行',
    '非平行': '非平行',
  },
  density: {
    groundglass: '磨玻璃',
    ggo: '磨玻璃',
    '磨玻璃': '磨玻璃',
    solid: '实性',
    '实性': '实性',
    mixed: '混合',
    partsolid: '混合',
    '混合': '混合',
    calcified: '钙化',
    '钙化': '钙化',
  },
  morphology: {
    spiculated: '毛刺',
    spiculation: '毛刺',
    '毛刺': '毛刺',
    smooth: '光滑',
    '光滑': '光滑',
    lobulated: '分叶',
    '分叶': '分叶',
  },
};

const NUMBER_FIELDS = new Set<RecognitionFieldKey>(['size_x', 'size_y', 'size_z']);
const RADS_FIELDS = new Set<RecognitionFieldKey>(['tirads', 'birads', 'lung_rads']);
const SUPPORTED_FIELD_KEYS = new Set<RecognitionFieldKey>(Object.values(FIELD_KEY_ALIASES));

function detectDiseaseTypes(value: unknown): DiseaseType[] {
  if (value === 'thyroid' || value === 'breast' || value === 'lung') return [value];
  if (typeof value !== 'string') return [];
  const normalized = value.trim().toLowerCase();
  const matches: DiseaseType[] = [];
  if (/thyroid|甲状腺/.test(normalized)) matches.push('thyroid');
  if (/breast|乳腺|乳房/.test(normalized)) matches.push('breast');
  if (/lung|肺/.test(normalized)) matches.push('lung');
  return matches;
}

function parseDiseaseType(value: unknown): DiseaseType | null {
  return detectDiseaseTypes(value)[0] ?? null;
}

function describeRawValue(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function isNonEmptyProviderValue(value: unknown) {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

function normalizeReportImages(images: NormalizeRecognitionInput['reportImages']): RecognitionReportImageLink[] {
  return (images ?? [])
    .filter((image) => typeof image?.uri === 'string' && image.uri.trim())
    .map((image, sourceIndex) => ({ uri: image.uri.trim(), mimeType: image.mimeType ?? null, sourceIndex }));
}

function normalizeAlias(key: string, diseaseType: DiseaseType): RecognitionFieldKey | string {
  const alias = FIELD_KEY_ALIASES[key] ?? FIELD_KEY_ALIASES[key.trim().toLowerCase()];
  if (key === 'rads_grade' || key === 'radsGrade') {
    return RADS_GRADE_BY_DISEASE[diseaseType];
  }
  return alias ?? key;
}

function compactText(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-]+/g, '');
}

function normalizeRads(value: string) {
  const match = value.trim().toLowerCase().match(/(?:rads)?\s*(4[a-cx]|[1-6](?:\.[0-9])?)/i);
  return match?.[1]?.replace(/\.0$/, '') ?? value.trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePleuralPull(value: unknown) {
  if (typeof value === 'number') return value > 0 ? 1 : 0;
  if (typeof value !== 'string') return null;
  const normalized = compactText(value);
  if (['yes', 'y', 'true', '有', '存在', '阳性'].includes(normalized)) return 1;
  if (['no', 'n', 'false', '无', '未见', '阴性'].includes(normalized)) return 0;
  return null;
}

function normalizeFieldValue(key: RecognitionFieldKey, value: unknown): string | number | null {
  if (key === 'pleural_pull') return normalizePleuralPull(value);
  if (NUMBER_FIELDS.has(key)) return normalizeNumber(value);
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (RADS_FIELDS.has(key)) return normalizeRads(raw);
  const aliases = TEXT_ENUMS[key];
  if (aliases) {
    const normalized = compactText(raw);
    return aliases[normalized] ?? aliases[raw] ?? null;
  }
  return raw;
}

function isPresent(value: string | number | null | undefined) {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

export function normalizeRecognitionOutput(input: NormalizeRecognitionInput): NormalizedRecognitionOutput {
  const providerOutput = input.providerOutput ?? {};
  const requestedDiseaseType = parseDiseaseType(input.requestedDiseaseType);
  const providerDiseaseMatches = detectDiseaseTypes(providerOutput.disease_type);
  const providerDiseaseType = providerDiseaseMatches.length === 1 ? providerDiseaseMatches[0] : null;
  const diseaseType = requestedDiseaseType ?? providerDiseaseType ?? 'thyroid';
  const recognized: NormalizedRecognitionOutput['command']['recognized'] = {};
  const fieldConfidence: NormalizedRecognitionOutput['fieldConfidence'] = {};
  const validationErrors: RecognitionValidationError[] = [];

  if (providerOutput.disease_type !== undefined && providerDiseaseMatches.length === 0) {
    validationErrors.push({
      code: 'unsupported_disease_type',
      field: 'disease_type',
      message: `Unsupported disease type: ${describeRawValue(providerOutput.disease_type)}`,
    });
  } else if (providerDiseaseMatches.length > 1) {
    validationErrors.push({
      code: 'ambiguous_disease_type',
      field: 'disease_type',
      message: `Ambiguous disease type: ${describeRawValue(providerOutput.disease_type)}`,
    });
  } else if (requestedDiseaseType && providerDiseaseType && requestedDiseaseType !== providerDiseaseType) {
    validationErrors.push({
      code: 'ambiguous_disease_type',
      field: 'disease_type',
      message: `Provider disease type ${providerDiseaseType} conflicts with requested disease type ${requestedDiseaseType}`,
    });
  }

  for (const [rawKey, field] of Object.entries(providerOutput.fields ?? {})) {
    const key = normalizeAlias(rawKey, diseaseType);
    if (!SUPPORTED_FIELD_KEYS.has(key as RecognitionFieldKey)) {
      validationErrors.push({
        code: 'unsupported_field',
        field: rawKey,
        message: `Unsupported recognition field: ${rawKey}`,
      });
      continue;
    }
    const recognitionKey = key as RecognitionFieldKey;
    if (recognitionKey === 'disease_type') {
      if (typeof field.confidence === 'number' && Number.isFinite(field.confidence)) {
        fieldConfidence[recognitionKey] = Math.max(0, Math.min(1, field.confidence));
      }
      continue;
    }
    const archiveKey: ArchiveRecognitionFieldKey = recognitionKey;
    const normalized = normalizeFieldValue(archiveKey, field.value);
    if (isPresent(normalized)) {
      if (isPresent(recognized[archiveKey]) && recognized[archiveKey] !== normalized) {
        validationErrors.push({
          code: 'ambiguous_field',
          field: archiveKey,
          message: `Ambiguous values for ${archiveKey}`,
        });
      } else {
        recognized[archiveKey] = normalized;
      }
    } else if (isNonEmptyProviderValue(field.value)) {
      validationErrors.push({
        code: 'unsupported_field_value',
        field: archiveKey,
        message: `Unsupported value for ${archiveKey}: ${describeRawValue(field.value)}`,
      });
    }
    if (typeof field.confidence === 'number' && Number.isFinite(field.confidence)) {
      fieldConfidence[archiveKey] = Math.max(0, Math.min(1, field.confidence));
    }
  }

  const requiredFields = DISEASE_FIELD_DEFINITIONS.find((definition) => definition.diseaseType === diseaseType)?.requiredFields ?? [];
  const missingRequiredFields = requiredFields.filter((field) => !isPresent(recognized[field]));

  return {
    command: { diseaseType, recognized },
    fieldConfidence,
    missingRequiredFields,
    reportImages: normalizeReportImages(input.reportImages),
    validationErrors,
  };
}
