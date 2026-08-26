const CAREER_STAGE_DEFINITIONS = {
  beginning: {
    id: 'beginning',
    label: 'Beginning Teacher',
    designationLabel: 'Teacher I-III',
    rubricRange: [1, 5],
    targetRubricLevel: 5,
  },
  proficient: {
    id: 'proficient',
    label: 'Proficient Teacher',
    designationLabel: 'Teacher IV-VII',
    rubricRange: [3, 7],
    targetRubricLevel: 7,
  },
  highlyProficient: {
    id: 'highlyProficient',
    label: 'Highly Proficient Teacher',
    designationLabel: 'Master Teacher I-II',
    rubricRange: [4, 8],
    targetRubricLevel: 8,
  },
  distinguished: {
    id: 'distinguished',
    label: 'Distinguished Teacher',
    designationLabel: 'Master Teacher III-V',
    rubricRange: [5, 9],
    targetRubricLevel: 9,
  },
};

export const COT_CAREER_STAGES = Object.freeze(CAREER_STAGE_DEFINITIONS);

export const COT_RUBRIC_LEVELS = Object.freeze([
  { level: 1, name: 'Not Evident', summary: 'The indicator is not demonstrated.' },
  { level: 2, name: 'Building', summary: 'A limited range of separate aspects is demonstrated.' },
  { level: 3, name: 'Organizing', summary: 'A limited range of loosely associated aspects is demonstrated.' },
  { level: 4, name: 'Developing', summary: 'Associated practices are sometimes aligned with developmental needs.' },
  { level: 5, name: 'Applying', summary: 'Associated practices are usually aligned with developmental needs.' },
  { level: 6, name: 'Consolidating', summary: 'Well-connected practices consistently support learner success.' },
  { level: 7, name: 'Integrating', summary: 'Connected practices address individual and group learning goals.' },
  { level: 8, name: 'Discriminating', summary: 'Deep understanding is applied selectively to contextualize learning.' },
  { level: 9, name: 'Synthesizing', summary: 'Exceptional practice fosters informed feedback, critical thinking, and lifelong learning.' },
]);

const INDICATORS = [
  {
    ordinal: 1,
    code: '1.1.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.1',
    title: 'Apply knowledge of content within and across curriculum teaching areas',
    level9Focus: 'Use exceptional content and pedagogical knowledge across curriculum areas to develop lifelong learning skills.',
  },
  {
    ordinal: 2,
    code: '1.3.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.3',
    title: 'Ensure the positive use of ICT to facilitate teaching and learning',
    level9Focus: 'Build an exemplary technology-rich environment where learners consistently use ICT responsibly, ethically, and appropriately.',
  },
  {
    ordinal: 3,
    code: '1.4.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.4',
    title: 'Use strategies that enhance learner achievement in literacy and numeracy',
    level9Focus: 'Negotiate with and support learners as they develop and continually review their own critical literacy or numeracy strategies.',
  },
  {
    ordinal: 4,
    code: '1.5.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.5',
    title: 'Develop critical, creative, and other higher-order thinking skills',
    level9Focus: 'Create a learning environment where learners discuss, justify, apply, analyze, evaluate, and create useful ideas in real-life situations.',
  },
  {
    ordinal: 5,
    code: '1.6.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.6',
    title: 'Use Mother Tongue, Filipino, and English proficiently to facilitate learning',
    level9Focus: 'Use language with distinguished, culturally appropriate global competence and sophisticated communication strategies.',
  },
  {
    ordinal: 6,
    code: '1.7.2',
    domain: 'Content Knowledge and Pedagogy',
    strand: '1.7',
    title: 'Use verbal and non-verbal communication to support understanding, participation, engagement, and achievement',
    level9Focus: 'Use highly strategic communication to create varied opportunities for learner inquiry, involvement, and motivation.',
  },
  {
    ordinal: 7,
    code: '2.1.2',
    domain: 'Learning Environment',
    strand: '2.1',
    title: 'Establish safe and secure learning environments through consistent policies, guidelines, and procedures',
    level9Focus: 'Create an environment in which learners follow and advocate classroom safety practices and connect them to real life.',
  },
  {
    ordinal: 8,
    code: '2.2.2',
    domain: 'Learning Environment',
    strand: '2.2',
    title: 'Maintain learning environments that promote fairness, respect, and care',
    level9Focus: 'Model consistently civil teacher-learner interactions that learners can carry into the classroom community.',
  },
  {
    ordinal: 9,
    code: '2.3.2',
    domain: 'Learning Environment',
    strand: '2.3',
    title: 'Manage classroom structure for meaningful exploration, discovery, and hands-on learning',
    level9Focus: 'Co-maintain a learning-focused structure with constructive interactions that advance learning.',
  },
  {
    ordinal: 10,
    code: '2.4.2',
    domain: 'Learning Environment',
    strand: '2.4',
    title: 'Maintain supportive environments for participation, cooperation, and collaboration',
    level9Focus: 'Connect classroom learning to real life and enable learners to support one another independently.',
  },
  {
    ordinal: 11,
    code: '2.5.2',
    domain: 'Learning Environment',
    strand: '2.5',
    title: 'Motivate learners to work productively and assume responsibility for learning',
    level9Focus: 'Sustain an environment where learners show passion, initiative, high expectations, and authentic application.',
  },
  {
    ordinal: 12,
    code: '2.6.2',
    domain: 'Learning Environment',
    strand: '2.6',
    title: 'Manage behavior through positive and non-violent discipline',
    level9Focus: 'Support learners in monitoring their own and others’ behavior with sensitivity to individual needs and dignity.',
  },
  {
    ordinal: 13,
    code: '3.1.2',
    domain: 'Diversity of Learners',
    strand: '3.1',
    title: 'Differentiate learning experiences for learners’ needs, strengths, interests, and experiences',
    level9Focus: 'Foster a culture where learners help create experiences that support diverse learning needs.',
  },
  {
    ordinal: 14,
    code: '3.2.2',
    domain: 'Diversity of Learners',
    strand: '3.2',
    title: 'Respond to linguistic, cultural, socio-economic, and religious backgrounds',
    level9Focus: 'Adapt experiences for individual and group backgrounds so learners can engage and succeed.',
  },
  {
    ordinal: 15,
    code: '3.3.2',
    domain: 'Diversity of Learners',
    strand: '3.3',
    title: 'Respond to learners with disabilities, giftedness, and talents',
    level9Focus: 'Adapt experiences for individual and group special educational needs to promote success.',
  },
  {
    ordinal: 16,
    code: '3.4.2',
    domain: 'Diversity of Learners',
    strand: '3.4',
    title: 'Respond to learners in difficult circumstances',
    level9Focus: 'Adapt experiences for learners’ individual and group needs in difficult circumstances.',
  },
  {
    ordinal: 17,
    code: '3.5.2',
    domain: 'Diversity of Learners',
    strand: '3.5',
    title: 'Use culturally appropriate strategies for learners from indigenous groups',
    level9Focus: 'Contextualize experiences with indigenous learners to develop holistic learning.',
  },
  {
    ordinal: 18,
    code: '4.1.2',
    domain: 'Curriculum and Planning',
    strand: '4.1',
    title: 'Plan and implement developmentally sequenced teaching and learning processes',
    level9Focus: 'Design coherent instruction collaboratively and intentionally engage every learner in application-based experiences.',
  },
  {
    ordinal: 19,
    code: '4.5.2',
    domain: 'Curriculum and Planning',
    strand: '4.5',
    title: 'Use appropriate learning resources, including ICT, to address learning goals',
    level9Focus: 'Use multidisciplinary, interactive resources collaboratively and let learners evaluate productive and unproductive ICT use.',
  },
  {
    ordinal: 20,
    code: '5.1.2',
    domain: 'Assessment and Reporting',
    strand: '5.1',
    title: 'Use diagnostic, formative, and summative assessment consistent with curriculum requirements',
    level9Focus: 'Set and attain learning goals collaboratively with learners through curriculum-aligned assessment.',
  },
  {
    ordinal: 21,
    code: '5.3.2',
    domain: 'Assessment and Reporting',
    strand: '5.3',
    title: 'Provide timely, accurate, and constructive feedback to improve performance',
    level9Focus: 'Maintain a culture of teacher-learner and learner-learner feedback that supports lifelong learning.',
  },
];

export const COT_FULL_RUBRIC = Object.freeze(INDICATORS.map((indicator) => Object.freeze(indicator)));

export const COT_PRIORITY_INDICATOR_CODES = Object.freeze([
  '1.1.2',
  '1.4.2',
  '1.5.2',
  '2.3.2',
  '2.6.2',
  '3.1.2',
  '4.1.2',
  '4.5.2',
  '5.1.2',
]);

const TARGETS_BY_CODE = {
  '1.1.2': {
    5: 'Present accurate, in-depth knowledge of most concepts, respond to learner questions, and connect curriculum areas where appropriate.',
    7: 'Use accurate, broad, in-depth content and pedagogy to meet individual and group needs within and across curriculum areas.',
    8: 'Use high-level content and pedagogy to help learners acquire and apply strategies as independent learners.',
    9: 'Use exceptional content and pedagogy within and across curriculum areas to build lifelong-learning skills.',
    evidence: [
      'Anticipate misconceptions and script accurate explanations, examples, and responses.',
      'Make a meaningful cross-curricular or real-life connection that learners use in a task.',
      'Require learners to transfer, explain, or independently apply a learning strategy.',
    ],
  },
  '1.4.2': {
    5: 'Frequently apply relevant strategies that strengthen literacy or numeracy.',
    7: 'Integrate connected strategies that develop individual and group critical literacy or numeracy.',
    8: 'Adjust strategies to improve critical literacy or numeracy for individuals and groups.',
    9: 'Support learners as they select, develop, and continually review their own critical literacy or numeracy strategies.',
    evidence: [
      'Embed an explicit literacy or numeracy strategy in the subject content, not as an unrelated add-on.',
      'Give learners a purposeful choice of strategy and require them to explain why it fits.',
      'Include individual and collaborative review of how well the selected strategy worked.',
    ],
  },
  '1.5.2': {
    5: 'Use targeted follow-up questions and activities that make learners explain, demonstrate, and use ideas.',
    7: 'Use a broad range of higher-order questions and activities that deepen analysis.',
    8: 'Enable learners to evaluate their thinking and seek constructive peer and teacher feedback.',
    9: 'Enable learners to discuss, justify, apply, analyze, evaluate, and create useful ideas in real-life situations.',
    evidence: [
      'Sequence questions from analysis to evaluation and creation, with expected evidence-based responses.',
      'Have learners justify, challenge, and refine ideas using criteria or evidence.',
      'End with a useful real-life creation or application shaped by peer or teacher feedback.',
    ],
  },
  '2.3.2': {
    5: 'Manage classroom structure so most learners engage in meaningful exploration, discovery, and hands-on activity.',
    7: 'Organize and maintain structures that engage learners individually and in groups across physical learning environments.',
    8: 'Adapt classroom structures to learner needs and invite further exploration aligned with goals.',
    9: 'Co-maintain a seamless, learning-focused structure with constructive interactions that advance learning.',
    evidence: [
      'Specify grouping, roles, materials, movement, timing, transitions, and accessibility arrangements.',
      'Use exploration or hands-on work in which every learner has an accountable role.',
      'Give learners responsibility for managing space, resources, roles, or transitions.',
    ],
  },
  '2.6.2': {
    5: 'Use established conduct rules to manage behavior frequently and keep most learners on task.',
    7: 'Use positive, constructive, and non-violent discipline to maintain a learning-focused environment.',
    8: 'Enable learners to regulate their behavior and recognize its impact.',
    9: 'Support learners in monitoring their own and others’ behavior with respect for individual needs and dignity.',
    evidence: [
      'State positively framed, teachable norms and a non-violent redirection or restorative response.',
      'Include a learner self-monitoring routine tied to productive participation.',
      'Protect dignity and account for individual needs when peers or the teacher respond to behavior.',
    ],
  },
  '3.1.2': {
    5: 'Provide differentiated, developmentally appropriate experiences that address learner needs.',
    7: 'Differentiate for diverse individual learning needs.',
    8: 'Adjust experiences for individual and group learning needs.',
    9: 'Let learners help create or modify experiences that support their diverse learning needs.',
    evidence: [
      'Use readiness evidence to provide scaffolds, core pathways, and meaningful extensions.',
      'Offer accessible choices in representation, participation, or expression without labeling fixed learning styles.',
      'Invite learners to request, select, or propose adaptations and explain what supports their learning.',
    ],
  },
  '4.1.2': {
    5: 'Implement appropriate elements of a developmentally sequenced process aligned with curriculum and context.',
    7: 'Use a well-structured lesson with explicit connections between prior learning and new concepts or skills.',
    8: 'Use prerequisite relationships and multiple pathways based on learner needs.',
    9: 'Design coherent instruction collaboratively and intentionally engage all learners in application-based experiences.',
    evidence: [
      'Begin with prerequisite evidence and explicitly connect it to the new learning.',
      'Show time allocations, transitions, gradual release, and an adaptive decision point.',
      'Provide multiple supported pathways that converge on a meaningful application task.',
    ],
  },
  '4.5.2': {
    5: 'Use resources, including ICT, that are generally aligned with learning goals.',
    7: 'Integrate extensive multidisciplinary resources, including ICT, aligned with the goals.',
    8: 'Contextualize multidisciplinary, interactive resources to deepen understanding.',
    9: 'Use resources collaboratively and have learners assess ICT impact and reduce unproductive use.',
    evidence: [
      'Explain how each major resource advances a specific learning goal and provide an accessible fallback.',
      'Use localized, contextualized, multidisciplinary, or interactive resources where they deepen learning.',
      'Let learners select or evaluate resources, including the benefits, risks, and productive use of ICT.',
    ],
  },
  '5.1.2': {
    5: 'Use a range of assessment strategies that addresses most learning goals.',
    7: 'Integrate assessment that engages learners in self- and peer-assessment.',
    8: 'Fully integrate assessment for different cognitive levels and particular learning needs.',
    9: 'Set and attain learning goals collaboratively with learners through curriculum-aligned assessment.',
    evidence: [
      'Align diagnostic, formative, and culminating evidence with objectives, criteria, and answer guidance.',
      'Include self- and peer-assessment using learner-accessible success criteria or a rubric.',
      'Use results for a named instructional adjustment and let learners set or revise a learning goal.',
    ],
  },
};

export function normalizeCotIndicatorCode(value) {
  const normalized = String(value || '').replace(/[^0-9.]/g, '');
  return /^\d\.\d\.\d$/.test(normalized) ? normalized : '';
}

export function getCotIndicatorByCode(code) {
  const normalized = normalizeCotIndicatorCode(code);
  return COT_FULL_RUBRIC.find((indicator) => indicator.code === normalized) || null;
}

export function resolveCotCareerStage(teacherNameOrDesignation) {
  const designation = String(teacherNameOrDesignation || '').toUpperCase();

  if (/\b(?:MASTER\s*TEACHER|MT)\s*(?:III|IV|V|3|4|5)\b/.test(designation)) {
    return COT_CAREER_STAGES.distinguished;
  }
  if (/\b(?:MASTER\s*TEACHER|MT)\s*(?:II|I|2|1)\b/.test(designation)) {
    return COT_CAREER_STAGES.highlyProficient;
  }
  if (/\b(?:TEACHER|T)\s*(?:VII|VI|IV|V|7|6|5|4)\b/.test(designation)) {
    return COT_CAREER_STAGES.proficient;
  }
  if (/\b(?:TEACHER|T)\s*(?:III|II|I|3|2|1)\b/.test(designation)) {
    return COT_CAREER_STAGES.beginning;
  }

  return {
    ...COT_CAREER_STAGES.proficient,
    id: 'unresolved',
    label: 'Unresolved designation — Proficient target used',
    designationLabel: 'Confirm the teacher designation',
  };
}

export function getCotTargetForCode(code, targetRubricLevel) {
  const normalized = normalizeCotIndicatorCode(code);
  const target = TARGETS_BY_CODE[normalized];
  if (!target) return null;

  return {
    descriptor: target[targetRubricLevel] || target[9],
    evidence: [...target.evidence],
  };
}

export function buildCotRubricGuidance({
  teacherName,
  indicatorCodes = COT_PRIORITY_INDICATOR_CODES,
} = {}) {
  const stage = resolveCotCareerStage(teacherName);
  const targetLevel = stage.targetRubricLevel;
  const levelName = COT_RUBRIC_LEVELS.find((item) => item.level === targetLevel)?.name || '';
  const indicatorGuidance = indicatorCodes
    .map((code) => {
      const indicator = getCotIndicatorByCode(code);
      const target = getCotTargetForCode(code, targetLevel);
      if (!indicator || !target) return '';
      return [
        `${indicator.code} — Full Rubric Indicator ${indicator.ordinal}: ${indicator.title}`,
        `Career-stage target: Level ${targetLevel} (${levelName}) — ${target.descriptor}`,
        `Observable evidence required:\n- ${target.evidence.join('\n- ')}`,
        `Level 9 stretch: ${indicator.level9Focus}`,
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

  return {
    stage,
    guidance: `
ANNEX E-1 COT FULL-RUBRIC ALIGNMENT

Use the PPST-based Classroom Observation Tool rubric as an evidence standard. The nine rubric levels are developmental: Beginning uses Levels 1-5, Proficient uses Levels 3-7, Highly Proficient uses Levels 4-8, and Distinguished uses Levels 5-9.

Resolved career stage: ${stage.label} (${stage.designationLabel})
Target rubric level: ${targetLevel} (${levelName}), the highest level in this career-stage band.

An annotation is only a traceability label; it is NOT evidence by itself. Each tagged indicator must be demonstrated through specific teacher moves, observable learner actions, assessment evidence, and a named location in the lesson. Favor connected practices and learner agency. Do not promise or state that the plan guarantees a COT rating; actual classroom implementation and the observer's evidence determine the rating.

${indicatorGuidance}
`.trim(),
  };
}

export function buildCotAlignmentTemplate({
  teacherName,
  indicatorCodes = COT_PRIORITY_INDICATOR_CODES,
} = {}) {
  const stage = resolveCotCareerStage(teacherName);
  return {
    careerStage: stage.label,
    rubricRange: stage.rubricRange,
    targetRubricLevel: stage.targetRubricLevel,
    evidenceMatrix: indicatorCodes.map((code) => {
      const indicator = getCotIndicatorByCode(code);
      return {
        indicatorCode: code,
        rubricIndicator: indicator?.ordinal,
        targetLevel: stage.targetRubricLevel,
        evidenceLocations: ['Session N — exact field and phase', 'Session N — exact field and phase'],
        plannedEvidence: ['Specific observable teacher move and learner action', 'Specific product, response, or behavior an observer can see'],
        learnerAgency: 'How learners choose, monitor, assess, adapt, explain, or lead their learning',
      };
    }),
    disclaimer: 'This is a planning alignment, not a guaranteed rating; observed classroom practice and evidence determine the score.',
  };
}

export function validateCotAlignment(
  plan,
  {
    teacherName,
    indicatorCodes = COT_PRIORITY_INDICATOR_CODES,
  } = {},
) {
  const stage = resolveCotCareerStage(teacherName);
  const matrix = plan?.cotAlignment?.evidenceMatrix;
  const issues = [];

  if (!Array.isArray(matrix)) {
    return { valid: false, issues: ['Missing cotAlignment.evidenceMatrix.'] };
  }

  const fullText = JSON.stringify(plan);
  for (const code of indicatorCodes) {
    const entry = matrix.find((item) => normalizeCotIndicatorCode(item?.indicatorCode) === code);
    if (!entry) {
      issues.push(`Missing evidence matrix entry for ${code}.`);
      continue;
    }
    if (entry.targetLevel !== stage.targetRubricLevel) {
      issues.push(`${code} does not target rubric Level ${stage.targetRubricLevel}.`);
    }
    if (!Array.isArray(entry.evidenceLocations) || entry.evidenceLocations.length < 2) {
      issues.push(`${code} needs at least two evidence locations.`);
    }
    if (!Array.isArray(entry.plannedEvidence) || entry.plannedEvidence.length < 2) {
      issues.push(`${code} needs at least two observable evidence statements.`);
    }
    if (typeof entry.learnerAgency !== 'string' || entry.learnerAgency.trim().length < 20) {
      issues.push(`${code} needs a substantive learner-agency statement.`);
    }
    if (!fullText.includes(`(Indicator ${code})`)) {
      issues.push(`Missing lesson annotation for ${code}.`);
    }
  }

  return { valid: issues.length === 0, issues };
}
