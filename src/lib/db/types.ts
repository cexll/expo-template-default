export interface Profile {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  birth_year: number;
  avatar_uri: string | null;
  sort_order: number;
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
  created_at: string;
  updated_at: string;
}

export interface ReportImage {
  id: string;
  examination_id: string;
  uri: string;
  sort_order: number;
  mime_type: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  lesion_id: string;
  next_exam_date: string;
  source: 'auto' | 'manual';
  is_active: number;
  created_at: string;
  updated_at: string;
}
