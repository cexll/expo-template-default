import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/lib/db';
import type { Lesion, Reminder } from '@/lib/db/types';
import type { ReportImageAsset } from '@/lib/report-images';
import { cleanupPersistedReportImages, persistReportImages, type PersistedReportImage } from '@/lib/report-image-storage';
import { deriveAutoReminder } from '@/lib/reminder-calculator';

type DiseaseType = Lesion['disease_type'];

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function formatExamDate(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  }

  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function deriveNextExamDate(args: {
  diseaseType: DiseaseType;
  examDate: string;
  recognized: Record<string, unknown>;
}) {
  const tirads = typeof args.recognized.tirads === 'string' ? args.recognized.tirads : null;
  const birads = typeof args.recognized.birads === 'string' ? args.recognized.birads : null;
  const lungRads = typeof args.recognized.lung_rads === 'string' ? args.recognized.lung_rads : null;
  return deriveAutoReminder({
    diseaseType: args.diseaseType,
    examDate: args.examDate,
    tirads,
    birads,
    lungRads,
  });
}

async function upsertAutoReminderWithDb(args: {
  db: SQLiteDatabase;
  lesionId: string;
  diseaseType: DiseaseType;
  examDate: string;
  recognized: Record<string, unknown>;
}) {
  const derivation = deriveNextExamDate({
    diseaseType: args.diseaseType,
    examDate: args.examDate,
    recognized: args.recognized,
  });

  const reminders = await listRemindersByLesionWithDb(args.db, args.lesionId);
  const activeReminder = reminders.find((reminder) => reminder.is_active === 1);

  // Respect manual overrides: a user-set follow-up date should not be overwritten by auto derivation.
  if (activeReminder && activeReminder.source === 'manual') {
    return;
  }

  if (derivation.kind === 'no_auto') {
    // High-risk grades: avoid routine auto reminders. If an auto reminder exists, deactivate it.
    if (activeReminder && activeReminder.source === 'auto') {
      await args.db.runAsync(
        "UPDATE reminders SET is_active = 0, updated_at = datetime('now') WHERE id = ?;",
        activeReminder.id
      );
    }
    return;
  }

  const nextExamDate = derivation.nextExamDate;
  if (activeReminder) {
    await args.db.runAsync(
      "UPDATE reminders SET next_exam_date = ?, source = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?;",
      nextExamDate,
      'auto',
      1,
      activeReminder.id
    );
    return;
  }

  await args.db.runAsync(
    `
      INSERT INTO reminders (
        id, lesion_id, next_exam_date, source, is_active
      ) VALUES (?, ?, ?, ?, ?);
    `,
    makeId('reminder'),
    args.lesionId,
    nextExamDate,
    'auto',
    1
  );
}

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺部',
};

async function withTransaction<T>(db: SQLiteDatabase, fn: () => Promise<T>): Promise<T> {
  await db.execAsync('BEGIN;');
  try {
    const result = await fn();
    await db.execAsync('COMMIT;');
    return result;
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

async function listRemindersByLesionWithDb(db: SQLiteDatabase, lesionId: string) {
  return db.getAllAsync<Reminder>(
    `
      SELECT *
      FROM reminders
      WHERE lesion_id = ?
      ORDER BY next_exam_date ASC, created_at DESC;
    `,
    lesionId
  );
}

export async function saveMatchRecordAtomic(
  args: {
    activeProfileId: string;
    createNew: boolean;
    diseaseType: DiseaseType | null;
    recognized: Record<string, unknown>;
    rawRecognizedJson: string | undefined;
    reportImages: ReportImageAsset[];
    selectedLesionId?: string | null;
    debugFailStep?: 'report_images' | 'reminder';
  },
  deps?: {
    db?: SQLiteDatabase;
    persistReportImages?: (source: ReportImageAsset[], examinationId: string) => Promise<PersistedReportImage[]>;
  }
): Promise<{ lesionId: string; examinationId: string }> {
  if (!args.activeProfileId) {
    throw new Error('请先创建档案');
  }

  const shouldCreateReminder = typeof args.recognized.exam_date === 'string' && args.recognized.exam_date.trim() !== '';

  let lesionId = args.selectedLesionId ?? '';

  if (args.createNew) {
    const nextDiseaseType = args.diseaseType ?? 'thyroid';
    const lesionLocation =
      typeof args.recognized.location === 'string' && args.recognized.location.trim()
        ? args.recognized.location.trim()
        : '未知部位';
    const lesionLabel = `${DISEASE_LABELS[nextDiseaseType]}${lesionLocation}结节`;
    lesionId = makeId('lesion');

    // Persist any report-image payload first; failures here must not leave partial DB writes behind.
    // We use the examinationId for deterministic filenames/data URLs.
    const examinationId = makeId('exam');
    const persist = deps?.persistReportImages ?? persistReportImages;

    if (__DEV__ && args.debugFailStep === 'report_images') {
      throw new Error('入库失败');
    }

    const persisted = args.reportImages.length > 0 ? await persist(args.reportImages, examinationId) : [];

    try {
      const db = deps?.db ?? (await getDatabase());
      return await withTransaction(db, async () => {
        await db.runAsync(
          `
            INSERT INTO lesions (
              id, profile_id, disease_type, label, location, is_archived
            ) VALUES (?, ?, ?, ?, ?, ?);
          `,
          lesionId,
          args.activeProfileId,
          nextDiseaseType,
          lesionLabel,
          lesionLocation,
          0
        );

        const examDate = formatExamDate(args.recognized.exam_date);

        await db.runAsync(
          `
            INSERT INTO examinations (
              id, lesion_id, exam_date, hospital, size_x, size_y, size_z, tirads, echo_type,
              border, calcification, blood_flow, birads, shape, orientation, lung_rads, density,
              morphology, pleural_pull, ai_raw_json, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          examinationId,
          lesionId,
          examDate,
          typeof args.recognized.hospital === 'string' && args.recognized.hospital.trim()
            ? args.recognized.hospital.trim()
            : null,
          parseNumber(args.recognized.size_x),
          parseNumber(args.recognized.size_y),
          parseNumber(args.recognized.size_z),
          typeof args.recognized.tirads === 'string' && args.recognized.tirads.trim()
            ? args.recognized.tirads.trim()
            : null,
          typeof args.recognized.echo_type === 'string' && args.recognized.echo_type.trim()
            ? args.recognized.echo_type.trim()
            : null,
          typeof args.recognized.border === 'string' && args.recognized.border.trim()
            ? args.recognized.border.trim()
            : null,
          typeof args.recognized.calcification === 'string' && args.recognized.calcification.trim()
            ? args.recognized.calcification.trim()
            : null,
          typeof args.recognized.blood_flow === 'string' && args.recognized.blood_flow.trim()
            ? args.recognized.blood_flow.trim()
            : null,
          typeof args.recognized.birads === 'string' && args.recognized.birads.trim()
            ? args.recognized.birads.trim()
            : null,
          typeof args.recognized.shape === 'string' && args.recognized.shape.trim()
            ? args.recognized.shape.trim()
            : null,
          typeof args.recognized.orientation === 'string' && args.recognized.orientation.trim()
            ? args.recognized.orientation.trim()
            : null,
          typeof args.recognized.lung_rads === 'string' && args.recognized.lung_rads.trim()
            ? args.recognized.lung_rads.trim()
            : null,
          typeof args.recognized.density === 'string' && args.recognized.density.trim()
            ? args.recognized.density.trim()
            : null,
          typeof args.recognized.morphology === 'string' && args.recognized.morphology.trim()
            ? args.recognized.morphology.trim()
            : null,
          parseNumber(args.recognized.pleural_pull),
          args.rawRecognizedJson ?? null,
          typeof args.recognized.notes === 'string' && args.recognized.notes.trim() ? args.recognized.notes.trim() : null
        );

        for (let i = 0; i < persisted.length; i += 1) {
          await db.runAsync(
            `
              INSERT INTO report_images (
                id, examination_id, uri, sort_order, mime_type
              ) VALUES (?, ?, ?, ?, ?);
            `,
            makeId('report'),
            examinationId,
            persisted[i]!.uri,
            i,
            persisted[i]!.mimeType
          );
        }

        if (shouldCreateReminder) {
          if (__DEV__ && args.debugFailStep === 'reminder') {
            throw new Error('入库失败');
          }
          await upsertAutoReminderWithDb({
            db,
            lesionId,
            diseaseType: nextDiseaseType,
            examDate,
            recognized: args.recognized,
          });
        }

        return { lesionId, examinationId };
      });
    } catch (err) {
      // If we already copied native files but fail to acquire the DB or the transaction fails, clean up so we don't orphan them.
      await cleanupPersistedReportImages(persisted);
      throw err;
    }
  }

  if (!lesionId) {
    throw new Error('请选择病灶');
  }

  const examinationId = makeId('exam');
  const persist = deps?.persistReportImages ?? persistReportImages;

  if (__DEV__ && args.debugFailStep === 'report_images') {
    throw new Error('入库失败');
  }

  const persisted = args.reportImages.length > 0 ? await persist(args.reportImages, examinationId) : [];

  try {
    const db = deps?.db ?? (await getDatabase());
    return await withTransaction(db, async () => {
      const examDate = formatExamDate(args.recognized.exam_date);

      await db.runAsync(
        `
          INSERT INTO examinations (
            id, lesion_id, exam_date, hospital, size_x, size_y, size_z, tirads, echo_type,
            border, calcification, blood_flow, birads, shape, orientation, lung_rads, density,
            morphology, pleural_pull, ai_raw_json, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        examinationId,
        lesionId,
        examDate,
        typeof args.recognized.hospital === 'string' && args.recognized.hospital.trim()
          ? args.recognized.hospital.trim()
          : null,
        parseNumber(args.recognized.size_x),
        parseNumber(args.recognized.size_y),
        parseNumber(args.recognized.size_z),
        typeof args.recognized.tirads === 'string' && args.recognized.tirads.trim()
          ? args.recognized.tirads.trim()
          : null,
        typeof args.recognized.echo_type === 'string' && args.recognized.echo_type.trim()
          ? args.recognized.echo_type.trim()
          : null,
        typeof args.recognized.border === 'string' && args.recognized.border.trim()
          ? args.recognized.border.trim()
          : null,
        typeof args.recognized.calcification === 'string' && args.recognized.calcification.trim()
          ? args.recognized.calcification.trim()
          : null,
        typeof args.recognized.blood_flow === 'string' && args.recognized.blood_flow.trim()
          ? args.recognized.blood_flow.trim()
          : null,
        typeof args.recognized.birads === 'string' && args.recognized.birads.trim()
          ? args.recognized.birads.trim()
          : null,
        typeof args.recognized.shape === 'string' && args.recognized.shape.trim()
          ? args.recognized.shape.trim()
          : null,
        typeof args.recognized.orientation === 'string' && args.recognized.orientation.trim()
          ? args.recognized.orientation.trim()
          : null,
        typeof args.recognized.lung_rads === 'string' && args.recognized.lung_rads.trim()
          ? args.recognized.lung_rads.trim()
          : null,
        typeof args.recognized.density === 'string' && args.recognized.density.trim()
          ? args.recognized.density.trim()
          : null,
        typeof args.recognized.morphology === 'string' && args.recognized.morphology.trim()
          ? args.recognized.morphology.trim()
          : null,
        parseNumber(args.recognized.pleural_pull),
        args.rawRecognizedJson ?? null,
        typeof args.recognized.notes === 'string' && args.recognized.notes.trim() ? args.recognized.notes.trim() : null
      );

      for (let i = 0; i < persisted.length; i += 1) {
        await db.runAsync(
          `
            INSERT INTO report_images (
              id, examination_id, uri, sort_order, mime_type
            ) VALUES (?, ?, ?, ?, ?);
          `,
          makeId('report'),
          examinationId,
          persisted[i]!.uri,
          i,
          persisted[i]!.mimeType
        );
      }

      if (shouldCreateReminder) {
        if (__DEV__ && args.debugFailStep === 'reminder') {
          throw new Error('入库失败');
        }
        await upsertAutoReminderWithDb({
          db,
          lesionId,
          diseaseType: args.diseaseType ?? 'thyroid',
          examDate,
          recognized: args.recognized,
        });
      }

      return { lesionId, examinationId };
    });
  } catch (err) {
    await cleanupPersistedReportImages(persisted);
    throw err;
  }
}
