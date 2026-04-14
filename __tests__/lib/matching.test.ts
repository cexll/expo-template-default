import { scoreLesionMatch } from '../../src/lib/db/matching';

describe('scoreLesionMatch', () => {
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
});
