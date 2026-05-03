export type DiseaseType = 'thyroid' | 'breast' | 'lung';

export type LocalArchiveField = 'location' | keyof Examination;

export type DiseaseFieldDefinition = {
  diseaseType: DiseaseType;
  requiredFields: LocalArchiveField[];
};

export const DISEASE_FIELD_DEFINITIONS: DiseaseFieldDefinition[] = [
  {
    diseaseType: 'thyroid',
    requiredFields: ['location', 'size_x', 'tirads', 'echo_type', 'border', 'calcification', 'blood_flow'],
  },
  {
    diseaseType: 'breast',
    requiredFields: ['location', 'size_x', 'birads', 'echo_type', 'border', 'shape', 'orientation'],
  },
  {
    diseaseType: 'lung',
    requiredFields: ['location', 'size_x', 'density', 'lung_rads', 'morphology', 'pleural_pull'],
  },
];

export interface Profile {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  birth_year: number;
  avatar_uri: string | null;
  sort_order: number;
  sync_version?: number;
  created_at: string;
  updated_at: string;
}

export interface Lesion {
  id: string;
  profile_id: string;
  disease_type: 'thyroid' | 'breast' | 'lung';
  label: string;
  location: string;
  is_archived: number;
  sync_version?: number;
  created_at: string;
  updated_at: string;
}

export interface Examination {
  id: string;
  lesion_id: string;
  exam_date: string;
  hospital: string | null;
  size_x: number | null;
  size_y: number | null;
  size_z: number | null;
  tirads: string | null;
  echo_type: string | null;
  border: string | null;
  calcification: string | null;
  blood_flow: string | null;
  birads: string | null;
  shape: string | null;
  orientation: string | null;
  lung_rads: string | null;
  density: string | null;
  morphology: string | null;
  pleural_pull: number | null;
  ai_raw_json: string | null;
  notes: string | null;
  sync_version?: number;
  created_at: string;
  updated_at: string;
}

export interface ReportImage {
  id: string;
  examination_id: string;
  uri: string;
  sort_order: number;
  mime_type: string | null;
  object_key?: string | null;
  size_bytes?: number;
  sha256?: string | null;
  sync_version?: number;
  created_at: string;
  updated_at?: string;
}

export interface Reminder {
  id: string;
  lesion_id: string;
  next_exam_date: string;
  source: 'auto' | 'manual';
  is_active: number;
  remind1m_sent?: number | null;
  remind1w_sent?: number | null;
  remind3d_sent?: number | null;
  remind0d_sent?: number | null;
  sync_version?: number;
  created_at: string;
  updated_at: string;
}

export interface ArchiveTombstone {
  entity_type: string;
  local_id: string;
  deleted_at: string;
  sync_version?: number;
  created_at: string;
}
