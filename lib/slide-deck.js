import { z } from 'zod';

export const SLIDE_COUNT_OPTIONS = Object.freeze([12, 16, 20]);

export const SLIDE_LAYOUTS = Object.freeze([
  'cover',
  'statement',
  'split',
  'visual',
  'steps',
  'comparison',
  'activity',
  'quiz',
  'answer',
  'summary',
]);

export const DEFAULT_THEME_COLORS = Object.freeze({
  primary: '17324D',
  secondary: 'E9A23B',
  accent: '2F6F7E',
  background: 'F7F3EA',
  text: '17212B',
});

const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9A-Fa-f]{6}$/)
  .transform((value) => value.replace('#', '').toUpperCase());

const SlideSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kicker: z.string().trim().max(60).optional(),
  subtitle: z.string().trim().max(180).optional(),
  body: z.string().trim().max(360).optional(),
  bullets: z.array(z.string().trim().min(1).max(180)).max(5).default([]),
  speakerNotes: z.string().trim().max(1800).optional(),
  visualPrompt: z.string().trim().max(700).optional(),
  visualPosition: z.enum(['left', 'right', 'full']).default('right'),
  layout: z.enum(SLIDE_LAYOUTS).default('split'),
  section: z.enum([
    'opening',
    'objectives',
    'recall',
    'concept',
    'example',
    'guided-practice',
    'activity',
    'check',
    'synthesis',
    'next-steps',
  ]),
  accentColor: HexColorSchema.optional(),
});

export const SlideDeckSchema = z.object({
  deckTitle: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
  communicationGoal: z.string().trim().max(320).optional(),
  artDirection: z.string().trim().min(1).max(500),
  themeColors: z.object({
    primary: HexColorSchema,
    secondary: HexColorSchema,
    accent: HexColorSchema,
    background: HexColorSchema,
    text: HexColorSchema,
  }).default(DEFAULT_THEME_COLORS),
  slides: z.array(SlideSchema).min(10).max(24),
});

export function clampSlideCount(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return 16;
  return Math.min(24, Math.max(10, parsed));
}

export function normalizeHexColor(value, fallback) {
  const candidate = String(value || '').replace('#', '').trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
}

export function getGradeBand(gradeLevel) {
  const match = String(gradeLevel || '').match(/\d+/);
  const grade = match ? Number.parseInt(match[0], 10) : 0;
  if (grade >= 1 && grade <= 6) return 'elementary';
  if (grade >= 7 && grade <= 10) return 'junior high school';
  if (grade >= 11 && grade <= 12) return 'senior high school';
  return 'general education';
}

export function getSubjectCategory(subject) {
  const value = String(subject || '').toLowerCase();
  if (/math|science|physics|chemistry|biology|earth|calculus|statistics/.test(value)) return 'STEM';
  if (/english|filipino|reading|writing|literature|grammar/.test(value)) return 'language and literacy';
  if (/social|history|araling|panlipunan|economics|culture/.test(value)) return 'social studies';
  if (/arts|music|physical education|mapeh|values|esp|gmrc/.test(value)) return 'arts, movement, and values';
  if (/technology|computer|ict|tle|home economics/.test(value)) return 'technology and livelihood education';
  return 'general education';
}

function visibleWordCount(slide) {
  return [
    slide.title,
    slide.kicker,
    slide.subtitle,
    slide.body,
    ...(slide.bullets || []),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

export function getSlideDeckQualityIssues(deck, expectedCount) {
  const parsed = SlideDeckSchema.safeParse(deck);
  if (!parsed.success) return ['The response does not match the slide-deck schema.'];

  const slides = parsed.data.slides;
  const issues = [];
  if (slides.length !== expectedCount) {
    issues.push('The deck must contain exactly ' + expectedCount + ' slides.');
  }
  if (slides[0]?.layout !== 'cover') {
    issues.push('The first slide must use the cover layout.');
  }
  if (!['synthesis', 'next-steps'].includes(slides.at(-1)?.section)) {
    issues.push('The final slide must synthesize learning or give the next step.');
  }
  if (!slides.some((slide) => slide.layout === 'activity')) {
    issues.push('The deck needs at least one classroom activity slide.');
  }
  if (!slides.some((slide) => ['quiz', 'answer'].includes(slide.layout))) {
    issues.push('The deck needs at least one check-for-understanding or answer slide.');
  }

  const uniqueLayouts = new Set(slides.map((slide) => slide.layout));
  if (uniqueLayouts.size < Math.min(5, slides.length)) {
    issues.push('Use at least five distinct layout types.');
  }

  const normalizedTitles = slides.map((slide) => slide.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  if (new Set(normalizedTitles).size !== normalizedTitles.length) {
    issues.push('Every slide title must be unique.');
  }

  slides.forEach((slide, index) => {
    if (visibleWordCount(slide) > 70) {
      issues.push('Slide ' + (index + 1) + ' exceeds the on-slide word budget.');
    }
    if (index >= 2 && slides[index - 1].layout === slide.layout && slides[index - 2].layout === slide.layout) {
      issues.push('Do not repeat one layout more than twice in succession.');
    }
  });

  return issues;
}

export function slideNeedsVisual(slide) {
  return Boolean(
    slide?.visualPrompt &&
    ['cover', 'statement', 'split', 'visual'].includes(slide.layout)
  );
}

export function buildVisualAssetPrompt({ slide, deck, gradeLevel, subject }) {
  const positionGuidance = {
    left: 'Place the main subject in the left half and keep the right half visually calm for editable slide text.',
    right: 'Place the main subject in the right half and keep the left half visually calm for editable slide text.',
    full: 'Use a balanced, edge-to-edge 16:9 composition with one clear focal point.',
  };

  return [
    'Create one polished, text-free 16:9 educational visual asset.',
    'Audience: ' + getGradeBand(gradeLevel) + ' students studying ' + subject + '.',
    'Deck art direction: ' + deck.artDirection,
    'Visual concept: ' + slide.visualPrompt,
    positionGuidance[slide.visualPosition] || positionGuidance.right,
    'Use a coherent visual metaphor, accurate subject matter, strong depth, and classroom-appropriate imagery.',
    'Do not render a slide, interface, frame, title, caption, written word, letter, number, equation, label, logo, or watermark.',
    'The asset will sit behind native editable PowerPoint text, so preserve clean negative space and avoid busy details.',
  ].join('\n');
}

export function buildSlideDeckPrompt({
  selectedSession,
  gradeLevel,
  subject,
  term,
  week,
  slideCount,
  designStyle,
  additionalPrompt,
}) {
  const count = clampSlideCount(slideCount);
  const lessonJson = JSON.stringify(selectedSession || {}, null, 2);

  return [
    'You are a senior instructional designer, classroom teacher, and visual-storytelling director.',
    'Create a source-grounded, classroom-ready slide deck specification. Return only valid JSON.',
    '',
    'COMMUNICATION JOB',
    'By the end, ' + getGradeBand(gradeLevel) + ' students should understand and apply the selected lesson because the deck builds one clear idea at a time.',
    '',
    'LESSON CONTEXT',
    'Subject: ' + subject,
    'Grade level: ' + gradeLevel,
    'Term: ' + term,
    'Week: ' + week,
    'Subject category: ' + getSubjectCategory(subject),
    'Requested visual style: ' + (designStyle || 'Modern Educational'),
    '',
    'SELECTED SESSION SOURCE',
    lessonJson,
    additionalPrompt ? '\nADDITIONAL USER DIRECTION\n' + additionalPrompt : '',
    '',
    'NON-NEGOTIABLE CONTENT RULES',
    '1. Create exactly ' + count + ' slides.',
    '2. Ground every fact, example, direction, answer, and assessment in the supplied lesson. Do not invent unsupported competencies or claims.',
    '3. Build a cumulative learning arc: hook, objective, recall, concept, worked example, guided practice, activity, check for understanding, synthesis, and next step.',
    '4. Give each slide one narrative job and a takeaway-style title that states the point. Avoid generic titles such as Topic, Discussion, or Learning Experience.',
    '5. Keep visible text concise: no more than 70 total words per slide, no more than five bullets, and preferably zero to four bullets.',
    '6. Write student-facing directions directly. Put teacher talk tracks, timing, facilitation cues, misconceptions, differentiation, and answer keys only in speakerNotes.',
    '7. Put a fixed answer on a separate answer slide immediately after the related quiz or guided-practice slide when disclosure will not undermine the activity.',
    '8. Match the language of the lesson source. Preserve Filipino when the lesson is in Filipino.',
    '',
    'VISUAL STORYTELLING RULES',
    '1. Use at least five layout types and never repeat one layout more than twice in succession.',
    '2. Select layouts from: cover, statement, split, visual, steps, comparison, activity, quiz, answer, summary.',
    '3. The first slide must be cover. The final slide must synthesize learning or give a concrete next step.',
    '4. Include at least one activity and one check-for-understanding or answer slide.',
    '5. For cover, statement, split, and visual slides, provide visualPrompt for a single meaningful illustration, metaphor, scene, or unlabeled diagram.',
    '6. visualPrompt must describe imagery only. Never ask the image model to draw titles, captions, labels, letters, numbers, formulas, logos, or watermarks.',
    '7. Choose visualPosition left, right, or full so editable PowerPoint text has intentional negative space.',
    '8. Use one coherent art direction across the entire deck while varying composition.',
    '',
    'POWERPOINT RULES',
    '1. All titles, body copy, bullets, questions, answers, and directions will be editable native PowerPoint text.',
    '2. Do not embed citations, production notes, or speaker instructions in visible text.',
    '3. speakerNotes should be useful in Presenter View and may include a short teacher script, questions to ask, expected responses, and timing.',
    '',
    'JSON SHAPE',
    JSON.stringify({
      deckTitle: 'string',
      subtitle: 'string',
      communicationGoal: 'string',
      artDirection: 'one cohesive visual system for the full deck',
      themeColors: {
        primary: 'six-digit hex without #',
        secondary: 'six-digit hex without #',
        accent: 'six-digit hex without #',
        background: 'six-digit hex without #',
        text: 'six-digit hex without #',
      },
      slides: [{
        title: 'takeaway-style title',
        kicker: 'optional short section cue',
        subtitle: 'optional',
        body: 'optional concise explanation or direction',
        bullets: ['zero to five concise items'],
        speakerNotes: 'teacher-facing talk track, timing, questions, answers, and misconceptions',
        visualPrompt: 'optional text-free visual concept',
        visualPosition: 'left | right | full',
        layout: SLIDE_LAYOUTS.join(' | '),
        section: 'opening | objectives | recall | concept | example | guided-practice | activity | check | synthesis | next-steps',
        accentColor: 'optional six-digit hex without #',
      }],
    }, null, 2),
    '',
    'Return only the JSON object. Do not use markdown or code fences.',
  ].filter(Boolean).join('\n');
}

export async function mapWithConcurrency(items, limit, mapper) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
}
