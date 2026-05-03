import { normalizeRecognitionOutput } from '@/lib/recognition/normalization';

describe('normalizeRecognitionOutput', () => {
  it('normalizes provider thyroid values into archive command fields with confidence and missing required markers', () => {
    const result = normalizeRecognitionOutput({
      requestedDiseaseType: 'thyroid',
      providerOutput: {
        disease_type: '甲状腺超声',
        fields: {
          location: { value: ' 左叶中下段 ', confidence: 0.92 },
          tirads: { value: 'TI-RADS 4A类', confidence: 0.81 },
          echo_type: { value: 'hypoechoic', confidence: 0.74 },
          border: { value: '边界欠清', confidence: 0.7 },
          size_x: { value: '8.3mm', confidence: 0.88 },
          calcification: { value: '', confidence: 0.2 },
        },
      },
    });

    expect(result.command).toMatchObject({
      diseaseType: 'thyroid',
      recognized: {
        location: '左叶中下段',
        tirads: '4a',
        echo_type: '低回声',
        border: '模糊',
        size_x: 8.3,
      },
    });
    expect(result.fieldConfidence).toMatchObject({
      location: 0.92,
      tirads: 0.81,
      echo_type: 0.74,
      border: 0.7,
      size_x: 0.88,
      calcification: 0.2,
    });
    expect(result.missingRequiredFields).toEqual(['calcification', 'blood_flow']);
  });

  it('surfaces report-image linkage and validation errors for unsupported or ambiguous provider output', () => {
    const unsupported = normalizeRecognitionOutput({
      requestedDiseaseType: 'thyroid',
      reportImages: [
        { uri: 'file:///report-page-1.png', mimeType: 'image/png' },
        { uri: 'file:///report-page-2.jpg', mimeType: 'image/jpeg' },
      ],
      providerOutput: {
        disease_type: 'pancreas report',
        fields: {
          organ_density: { value: 'solid', confidence: 0.7 },
          size_x: { value: 'bad-number', confidence: 0.65 },
        },
      },
    });

    expect(unsupported.reportImages).toEqual([
      { uri: 'file:///report-page-1.png', mimeType: 'image/png', sourceIndex: 0 },
      { uri: 'file:///report-page-2.jpg', mimeType: 'image/jpeg', sourceIndex: 1 },
    ]);
    expect(unsupported.validationErrors).toEqual([
      { code: 'unsupported_disease_type', field: 'disease_type', message: 'Unsupported disease type: pancreas report' },
      { code: 'unsupported_field', field: 'organ_density', message: 'Unsupported recognition field: organ_density' },
      { code: 'unsupported_field_value', field: 'size_x', message: 'Unsupported value for size_x: bad-number' },
    ]);

    const ambiguous = normalizeRecognitionOutput({
      requestedDiseaseType: 'thyroid',
      providerOutput: {
        disease_type: 'thyroid and breast follow-up',
        fields: {
          location: { value: '左叶' },
          size_x: { value: '8mm' },
        },
      },
    });

    expect(ambiguous.command.diseaseType).toBe('thyroid');
    expect(ambiguous.validationErrors).toContainEqual({
      code: 'ambiguous_disease_type',
      field: 'disease_type',
      message: 'Ambiguous disease type: thyroid and breast follow-up',
    });

    const conflict = normalizeRecognitionOutput({
      requestedDiseaseType: 'lung',
      providerOutput: {
        disease_type: 'breast',
        fields: {
          location: { value: '左肺上叶' },
          size_x: { value: '6mm' },
        },
      },
    });

    expect(conflict.command.diseaseType).toBe('lung');
    expect(conflict.validationErrors).toContainEqual({
      code: 'ambiguous_disease_type',
      field: 'disease_type',
      message: 'Provider disease type breast conflicts with requested disease type lung',
    });

    const duplicate = normalizeRecognitionOutput({
      requestedDiseaseType: 'thyroid',
      providerOutput: {
        fields: {
          size: { value: '6mm' },
          size_x: { value: '8mm' },
          echo_type: { value: 'unmapped echo' },
        },
      },
    });

    expect(duplicate.validationErrors).toEqual([
      { code: 'ambiguous_field', field: 'size_x', message: 'Ambiguous values for size_x' },
      { code: 'unsupported_field_value', field: 'echo_type', message: 'Unsupported value for echo_type: unmapped echo' },
    ]);
  });

  it('normalizes provider breast and lung enum/domain fields to canonical archive fields', () => {
    const breast = normalizeRecognitionOutput({
      requestedDiseaseType: 'breast',
      providerOutput: {
        fields: {
          location: { value: '右乳外上象限', confidence: 0.9 },
          birads: { value: 'BI-RADS 4b', confidence: 0.79 },
          echo_type: { value: 'mixed echo', confidence: 0.66 },
          border: { value: 'circumscribed', confidence: 0.64 },
          shape: { value: 'oval', confidence: 0.82 },
          orientation: { value: 'parallel', confidence: 0.72 },
          size_x: { value: '12×8mm', confidence: 0.9 },
        },
      },
    });

    const lung = normalizeRecognitionOutput({
      requestedDiseaseType: 'lung',
      providerOutput: {
        fields: {
          location: { value: '左肺上叶', confidence: 0.91 },
          lung_rads: { value: 'Lung-RADS 4X', confidence: 0.78 },
          density: { value: 'ground glass', confidence: 0.76 },
          morphology: { value: 'spiculated', confidence: 0.69 },
          pleural_pull: { value: 'yes', confidence: 0.61 },
          size_x: { value: '6 mm', confidence: 0.84 },
        },
      },
    });

    expect(breast.command.recognized).toMatchObject({
      birads: '4b',
      echo_type: '混合回声',
      border: '清晰',
      shape: '椭圆形',
      orientation: '平行',
      size_x: 12,
    });
    expect(breast.missingRequiredFields).toEqual([]);

    expect(lung.command.recognized).toMatchObject({
      lung_rads: '4x',
      density: '磨玻璃',
      morphology: '毛刺',
      pleural_pull: 1,
      size_x: 6,
    });
    expect(lung.missingRequiredFields).toEqual([]);
  });
});
