import { buildLesionMatchSelection, scoreLesionMatch, scoreStoredLesionMatches } from '../../src/lib/db/matching';

describe('scoreLesionMatch', () => {
  it('preselects only >=80% confidence while keeping manual alternatives', () => {
    const result = buildLesionMatchSelection([
      { lesionId: 'l1', lesionLabel: '甲状腺左叶结节', score: 70, confidence: 100 },
      { lesionId: 'l2', lesionLabel: '甲状腺右叶结节', score: 30, confidence: 43 },
    ]);

    expect(result).toEqual({
      autoSelectedLesionId: 'l1',
      alternatives: ['l1', 'l2'],
      requiresManualSelection: false,
    });
  });

  it('does not auto-select candidates below 80% confidence', () => {
    const result = buildLesionMatchSelection([
      { lesionId: 'l1', lesionLabel: '甲状腺左叶结节', score: 55, confidence: 79 },
      { lesionId: 'l2', lesionLabel: '甲状腺右叶结节', score: 30, confidence: 43 },
    ]);

    expect(result).toEqual({
      autoSelectedLesionId: null,
      alternatives: ['l1', 'l2'],
      requiresManualSelection: true,
    });
  });

  const lesions = [
    { id: 'l1', label: '甲状腺左叶结节', location: '左叶中下段', latestSizeX: 7.5 },
    { id: 'l2', label: '甲状腺右叶结节', location: '右叶', latestSizeX: 5.0 },
  ];

  it('should return exact location match with high confidence', () => {
    const result = scoreLesionMatch('左叶中下段', 8.0, lesions);
    expect(result[0].lesionId).toBe('l1');
    expect(result[0].confidence).toBeGreaterThanOrEqual(80);
  });

  it('should return partial side match with moderate confidence', () => {
    const result = scoreLesionMatch('左叶上段', 8.0, lesions);
    const l1 = result.find((r) => r.lesionId === 'l1');
    expect(l1).toBeDefined();
    expect(l1!.confidence).toBeGreaterThan(0);
    expect(l1!.confidence).toBeLessThan(80);
  });

  it('should return 0 confidence for no match', () => {
    const result = scoreLesionMatch('峡部', 20, lesions);
    expect(result.every((r) => r.confidence === 0 || r.score < 50)).toBe(true);
  });

  it('should handle empty lesions', () => {
    const result = scoreLesionMatch('左叶', 8.0, []);
    expect(result).toHaveLength(0);
  });

  it('should handle null size gracefully', () => {
    const result = scoreLesionMatch('左叶中下段', null, lesions);
    expect(result[0].lesionId).toBe('l1');
    expect(result[0].confidence).toBeGreaterThan(0);
  });

  it('scores real stored lesion history by disease, latest exam, location, size, and RADS grade', () => {
    const matches = scoreStoredLesionMatches(
      {
        diseaseType: 'thyroid',
        location: '左叶中下段',
        sizeX: 8.2,
        rads: '3',
      },
      [
        { id: 'l1', profile_id: 'p1', disease_type: 'thyroid', label: '甲状腺左叶结节', location: '左叶中下段', is_archived: 0, created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 'l2', profile_id: 'p1', disease_type: 'thyroid', label: '甲状腺右叶结节', location: '右叶', is_archived: 0, created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 'l3', profile_id: 'p1', disease_type: 'lung', label: '肺左上叶结节', location: '左肺上叶', is_archived: 0, created_at: '2023-01-01', updated_at: '2023-01-01' },
      ],
      [
        { id: 'e-old', lesion_id: 'l1', exam_date: '2023-01-01', hospital: null, size_x: 6.5, size_y: null, size_z: null, tirads: '2', echo_type: null, border: null, calcification: null, blood_flow: null, birads: null, shape: null, orientation: null, lung_rads: null, density: null, morphology: null, pleural_pull: null, ai_raw_json: null, notes: null, created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 'e-latest', lesion_id: 'l1', exam_date: '2024-01-01', hospital: null, size_x: 7.9, size_y: null, size_z: null, tirads: '3', echo_type: null, border: null, calcification: null, blood_flow: null, birads: null, shape: null, orientation: null, lung_rads: null, density: null, morphology: null, pleural_pull: null, ai_raw_json: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'e-r', lesion_id: 'l2', exam_date: '2024-01-01', hospital: null, size_x: 8.1, size_y: null, size_z: null, tirads: '3', echo_type: null, border: null, calcification: null, blood_flow: null, birads: null, shape: null, orientation: null, lung_rads: null, density: null, morphology: null, pleural_pull: null, ai_raw_json: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'e-lung', lesion_id: 'l3', exam_date: '2024-01-01', hospital: null, size_x: 8.2, size_y: null, size_z: null, tirads: null, echo_type: null, border: null, calcification: null, blood_flow: null, birads: null, shape: null, orientation: null, lung_rads: '3', density: null, morphology: null, pleural_pull: null, ai_raw_json: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]
    );

    expect(matches.map((match) => match.lesionId)).toEqual(['l1', 'l2']);
    expect(matches[0]).toMatchObject({ lesionId: 'l1', latestExamId: 'e-latest', latestExamDate: '2024-01-01' });
    expect(matches[0].confidence).toBeGreaterThanOrEqual(80);
    expect(matches[1].confidence).toBeLessThan(80);
  });
});
