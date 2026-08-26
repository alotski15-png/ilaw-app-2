import { describe, expect, it } from 'vitest';
import { mapIndicatorToOrdinal } from '../lib/cot-indicators';
import {
  buildCotAlignmentTemplate,
  buildCotRubricGuidance,
  COT_FULL_RUBRIC,
  COT_PRIORITY_INDICATOR_CODES,
  resolveCotCareerStage,
  validateCotAlignment,
} from '../lib/cot-rubric';

describe('Annex E-1 COT rubric model', () => {
  it('maps all 21 PPST codes to their full-rubric ordinals', () => {
    expect(COT_FULL_RUBRIC).toHaveLength(21);
    expect(mapIndicatorToOrdinal('1.1.2')).toBe(1);
    expect(mapIndicatorToOrdinal('(Indicator 1.4.2)')).toBe(3);
    expect(mapIndicatorToOrdinal('5.1.2')).toBe(20);
    expect(mapIndicatorToOrdinal('5.3.2')).toBe(21);
  });

  it.each([
    ['Ana Cruz, Teacher I', 'beginning', 5],
    ['Ana Cruz, Teacher VII', 'proficient', 7],
    ['Ana Cruz, Master Teacher II', 'highlyProficient', 8],
    ['Ana Cruz, Master Teacher V', 'distinguished', 9],
  ])('resolves %s to the correct career-stage ceiling', (designation, stageId, level) => {
    const stage = resolveCotCareerStage(designation);
    expect(stage.id).toBe(stageId);
    expect(stage.targetRubricLevel).toBe(level);
  });

  it('uses a transparent Proficient fallback when designation is unresolved', () => {
    const stage = resolveCotCareerStage('Ana Cruz');
    expect(stage.id).toBe('unresolved');
    expect(stage.targetRubricLevel).toBe(7);
    expect(stage.label).toContain('Unresolved');
  });

  it('builds guidance that distinguishes labels from observable evidence', () => {
    const result = buildCotRubricGuidance({ teacherName: 'Ana Cruz, Master Teacher III' });
    expect(result.stage.targetRubricLevel).toBe(9);
    expect(result.guidance).toContain('An annotation is only a traceability label');
    expect(result.guidance).toContain('Full Rubric Indicator 20');
    expect(result.guidance).toContain('learner agency');
  });

  it('validates a complete evidence matrix and rejects annotation-only plans', () => {
    const teacherName = 'Ana Cruz, Teacher V';
    const alignment = buildCotAlignmentTemplate({ teacherName });
    alignment.evidenceMatrix = alignment.evidenceMatrix.map((entry, index) => ({
      ...entry,
      evidenceLocations: [`Session 1 — flow phase ${index + 1}`, `Session 1 — assessment item ${index + 1}`],
      plannedEvidence: [
        `Teacher move ${index + 1} produces observable learner reasoning.`,
        `Learner product ${index + 1} demonstrates the intended practice.`,
      ],
      learnerAgency: `Learners select, explain, monitor, and refine strategy ${index + 1}.`,
    }));

    const annotations = COT_PRIORITY_INDICATOR_CODES
      .map((code) => `Evidence **(Indicator ${code})**`)
      .join(' ');
    const validPlan = {
      sessions: [{ flow: annotations }],
      cotAlignment: alignment,
    };

    expect(validateCotAlignment(validPlan, { teacherName })).toEqual({ valid: true, issues: [] });

    const annotationOnly = { sessions: [{ flow: annotations }] };
    expect(validateCotAlignment(annotationOnly, { teacherName }).valid).toBe(false);
  });
});
