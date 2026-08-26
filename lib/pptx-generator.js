import PptxGenJS from 'pptxgenjs';
import { DEFAULT_THEME_COLORS, normalizeHexColor } from './slide-deck';

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
const HEADING_FONT = 'Aptos Display';
const BODY_FONT = 'Aptos';

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '000000');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function channelLuminance(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground, background) {
  const foregroundRgb = hexToRgb(foreground);
  const backgroundRgb = hexToRgb(background);
  const foregroundLuminance =
    0.2126 * channelLuminance(foregroundRgb.r) +
    0.7152 * channelLuminance(foregroundRgb.g) +
    0.0722 * channelLuminance(foregroundRgb.b);
  const backgroundLuminance =
    0.2126 * channelLuminance(backgroundRgb.r) +
    0.7152 * channelLuminance(backgroundRgb.g) +
    0.0722 * channelLuminance(backgroundRgb.b);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickReadableTextColor(background, preferred = '17212B') {
  const normalizedPreferred = normalizeHexColor(preferred, '17212B');
  if (contrastRatio(normalizedPreferred, background) >= 4.5) return normalizedPreferred;
  return contrastRatio('FFFFFF', background) >= contrastRatio('111827', background)
    ? 'FFFFFF'
    : '111827';
}

function normalizeTheme(themeColors = {}) {
  const theme = {
    primary: normalizeHexColor(themeColors.primary, DEFAULT_THEME_COLORS.primary),
    secondary: normalizeHexColor(themeColors.secondary, DEFAULT_THEME_COLORS.secondary),
    accent: normalizeHexColor(themeColors.accent, DEFAULT_THEME_COLORS.accent),
    background: normalizeHexColor(themeColors.background, DEFAULT_THEME_COLORS.background),
    text: normalizeHexColor(themeColors.text, DEFAULT_THEME_COLORS.text),
  };
  theme.text = pickReadableTextColor(theme.background, theme.text);
  return theme;
}

function addImage(slide, imageData, box, altText) {
  if (!imageData) return false;
  try {
    slide.addImage({
      data: imageData,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      sizing: {
        type: 'cover',
        w: box.w,
        h: box.h,
      },
      altText: altText || 'Lesson visual',
    });
    return true;
  } catch (error) {
    console.warn('[PPTX Export] Could not add generated visual:', error.message);
    return false;
  }
}

function addSlideNumber(slide, index, total, color) {
  slide.addText(String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), {
    x: 11.75,
    y: 7.05,
    w: 1.0,
    h: 0.2,
    fontFace: BODY_FONT,
    fontSize: 9,
    color,
    align: 'right',
    margin: 0,
    transparency: 8,
  });
}

function addKicker(slide, value, x, y, w, color) {
  if (!value) return;
  slide.addText(value.toUpperCase(), {
    x,
    y,
    w,
    h: 0.25,
    fontFace: BODY_FONT,
    fontSize: 11,
    bold: true,
    charSpacing: 1.5,
    color,
    margin: 0,
  });
}

function addTitle(slide, value, options = {}) {
  slide.addText(value || '', {
    x: options.x ?? 0.72,
    y: options.y ?? 0.55,
    w: options.w ?? 11.9,
    h: options.h ?? 0.8,
    fontFace: HEADING_FONT,
    fontSize: options.fontSize ?? 36,
    bold: true,
    color: options.color ?? '17212B',
    margin: 0,
    breakLine: false,
    valign: 'mid',
    fit: 'shrink',
  });
}

function addBody(slide, value, options = {}) {
  if (!value) return;
  slide.addText(value, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fontFace: BODY_FONT,
    fontSize: options.fontSize ?? 20,
    color: options.color,
    bold: options.bold ?? false,
    margin: options.margin ?? 0,
    breakLine: false,
    valign: options.valign ?? 'top',
    fit: 'shrink',
  });
}

function addBullets(slide, bullets, options = {}) {
  const cleanBullets = (bullets || []).filter(Boolean).slice(0, 5);
  if (cleanBullets.length === 0) return;
  const runs = cleanBullets.map((bullet, index) => ({
    text: bullet,
    options: {
      bullet: { indent: options.indent ?? 18 },
      breakLine: index < cleanBullets.length - 1,
    },
  }));
  slide.addText(runs, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fontFace: BODY_FONT,
    fontSize: options.fontSize ?? 20,
    color: options.color,
    breakLine: true,
    breakLineOnTextOverflow: false,
    paraSpaceAfterPt: options.paraSpaceAfterPt ?? 13,
    margin: 0,
    valign: 'top',
    fit: 'shrink',
  });
}

function addNotes(slide, slideSpec) {
  const notes = [
    slideSpec.speakerNotes || 'Use this slide to support the lesson flow.',
    '',
    '[Sources]',
    '- ILAWCraft lesson plan supplied for this generated classroom deck.',
    slideSpec.visualGenerated
      ? '- Visual asset generated from the deck art direction and this slide visual prompt.'
      : '',
  ].filter((value, index, values) => value || values[index - 1]).join('\n');
  slide.addNotes(notes);
}

function addBaseCanvas(slide, background) {
  slide.background = { color: background };
}

function renderCover(pptx, slide, spec, theme) {
  const hasImage = addImage(
    slide,
    spec.generatedImageUrl,
    { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT },
    spec.visualPrompt
  );
  addBaseCanvas(slide, hasImage ? '111827' : theme.primary);

  if (hasImage) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH,
      h: SLIDE_HEIGHT,
      fill: { color: '0B1622', transparency: 25 },
      line: { type: 'none' },
    });
  } else {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 9.05,
      y: 0.15,
      w: 4.15,
      h: 4.15,
      fill: { color: theme.secondary, transparency: 15 },
      line: { type: 'none' },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 10.55,
      y: 5.0,
      w: 2.55,
      h: 2.35,
      fill: { color: theme.accent, transparency: 22 },
      line: { type: 'none' },
    });
  }

  addKicker(slide, spec.kicker || 'ILAWCRAFT CLASSROOM DECK', 0.82, 0.72, 5.8, theme.secondary);
  addTitle(slide, spec.title, {
    x: 0.82,
    y: 1.45,
    w: 8.7,
    h: 2.1,
    fontSize: 54,
    color: 'FFFFFF',
  });
  addBody(slide, spec.subtitle || spec.body, {
    x: 0.86,
    y: 3.92,
    w: 7.7,
    h: 0.9,
    fontSize: 24,
    color: 'F4F0E8',
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.84,
    y: 5.35,
    w: 2.1,
    h: 0,
    line: { color: theme.secondary, width: 3.5 },
  });
}

function renderStatement(pptx, slide, spec, theme) {
  addBaseCanvas(slide, theme.primary);
  const hasImage = addImage(
    slide,
    spec.generatedImageUrl,
    { x: 7.7, y: 0, w: 5.633, h: SLIDE_HEIGHT },
    spec.visualPrompt
  );
  if (hasImage) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.9,
      y: 0,
      w: 1.4,
      h: SLIDE_HEIGHT,
      fill: { color: theme.primary, transparency: 35 },
      line: { type: 'none' },
    });
  }
  addKicker(slide, spec.kicker || spec.section, 0.8, 0.78, 5.8, theme.secondary);
  addTitle(slide, spec.title, {
    x: 0.8,
    y: 1.6,
    w: hasImage ? 6.4 : 10.8,
    h: 2.25,
    fontSize: 48,
    color: 'FFFFFF',
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.84,
    y: 4.35,
    w: hasImage ? 5.9 : 8.8,
    h: 1.3,
    fontSize: 23,
    color: 'E9EEF4',
  });
}

function renderSplit(pptx, slide, spec, theme) {
  addBaseCanvas(slide, 'FFFFFF');
  const visualLeft = spec.visualPosition === 'left';
  const imageBox = visualLeft
    ? { x: 0, y: 0, w: 5.35, h: SLIDE_HEIGHT }
    : { x: 7.95, y: 0, w: 5.383, h: SLIDE_HEIGHT };
  const textX = visualLeft ? 5.95 : 0.78;
  const textW = visualLeft ? 6.55 : 6.55;
  const hasImage = addImage(slide, spec.generatedImageUrl, imageBox, spec.visualPrompt);

  if (!hasImage) {
    slide.addShape(pptx.ShapeType.rect, {
      ...imageBox,
      fill: { color: theme.background },
      line: { type: 'none' },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: imageBox.x + imageBox.w / 2 - 1.2,
      y: 2.45,
      w: 2.4,
      h: 2.4,
      fill: { color: theme.accent, transparency: 35 },
      line: { type: 'none' },
    });
  }

  addKicker(slide, spec.kicker || spec.section, textX, 0.6, textW, theme.accent);
  addTitle(slide, spec.title, {
    x: textX,
    y: 1.05,
    w: textW,
    h: 1.25,
    fontSize: 37,
    color: theme.primary,
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: textX,
    y: 2.5,
    w: textW,
    h: 1.05,
    fontSize: 21,
    color: theme.text,
  });
  addBullets(slide, spec.bullets, {
    x: textX + 0.03,
    y: spec.body || spec.subtitle ? 3.8 : 2.65,
    w: textW - 0.05,
    h: spec.body || spec.subtitle ? 2.5 : 3.6,
    fontSize: 19,
    color: theme.text,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: textX,
    y: 6.65,
    w: 1.7,
    h: 0,
    line: { color: theme.secondary, width: 3 },
  });
}

function renderVisual(pptx, slide, spec, theme) {
  addBaseCanvas(slide, '111827');
  const hasImage = addImage(
    slide,
    spec.generatedImageUrl,
    { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT },
    spec.visualPrompt
  );
  if (!hasImage) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH,
      h: SLIDE_HEIGHT,
      fill: { color: theme.accent },
      line: { type: 'none' },
    });
  }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 4.75,
    w: SLIDE_WIDTH,
    h: 2.75,
    fill: { color: '0A111A', transparency: 15 },
    line: { type: 'none' },
  });
  addKicker(slide, spec.kicker || spec.section, 0.8, 5.0, 5.6, theme.secondary);
  addTitle(slide, spec.title, {
    x: 0.8,
    y: 5.4,
    w: 11.7,
    h: 0.75,
    fontSize: 36,
    color: 'FFFFFF',
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.82,
    y: 6.26,
    w: 10.7,
    h: 0.62,
    fontSize: 18,
    color: 'F3F4F6',
  });
}

function renderSteps(pptx, slide, spec, theme) {
  addBaseCanvas(slide, theme.background);
  addKicker(slide, spec.kicker || spec.section, 0.75, 0.48, 6.2, theme.accent);
  addTitle(slide, spec.title, {
    x: 0.75,
    y: 0.85,
    w: 11.9,
    h: 0.85,
    fontSize: 36,
    color: theme.primary,
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.78,
    y: 1.8,
    w: 11.5,
    h: 0.65,
    fontSize: 19,
    color: theme.text,
  });

  const steps = (spec.bullets || []).slice(0, 5);
  const gap = 0.22;
  const itemWidth = (11.85 - gap * Math.max(0, steps.length - 1)) / Math.max(1, steps.length);
  steps.forEach((step, index) => {
    const x = 0.75 + index * (itemWidth + gap);
    slide.addText(String(index + 1).padStart(2, '0'), {
      x,
      y: 3.0,
      w: itemWidth,
      h: 0.7,
      fontFace: HEADING_FONT,
      fontSize: 34,
      bold: true,
      color: theme.secondary,
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.line, {
      x,
      y: 3.86,
      w: itemWidth - 0.08,
      h: 0,
      line: { color: index % 2 === 0 ? theme.primary : theme.accent, width: 2 },
    });
    addBody(slide, step, {
      x,
      y: 4.2,
      w: itemWidth - 0.05,
      h: 1.55,
      fontSize: 17,
      color: theme.text,
    });
  });
}

function renderComparison(pptx, slide, spec, theme) {
  addBaseCanvas(slide, 'FFFFFF');
  addKicker(slide, spec.kicker || spec.section, 0.75, 0.48, 6.2, theme.accent);
  addTitle(slide, spec.title, {
    x: 0.75,
    y: 0.85,
    w: 11.8,
    h: 0.85,
    fontSize: 36,
    color: theme.primary,
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.78,
    y: 1.82,
    w: 11.5,
    h: 0.65,
    fontSize: 19,
    color: theme.text,
  });
  const bullets = (spec.bullets || []).slice(0, 6);
  const midpoint = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, midpoint);
  const right = bullets.slice(midpoint);
  slide.addShape(pptx.ShapeType.line, {
    x: 6.65,
    y: 2.75,
    w: 0,
    h: 3.45,
    line: { color: theme.secondary, width: 2 },
  });
  addBullets(slide, left, {
    x: 0.9,
    y: 2.9,
    w: 5.25,
    h: 3.15,
    fontSize: 19,
    color: theme.text,
  });
  addBullets(slide, right, {
    x: 7.15,
    y: 2.9,
    w: 5.25,
    h: 3.15,
    fontSize: 19,
    color: theme.text,
  });
}

function renderActivity(pptx, slide, spec, theme) {
  addBaseCanvas(slide, theme.primary);
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.24,
    h: SLIDE_HEIGHT,
    fill: { color: theme.secondary },
    line: { type: 'none' },
  });
  addKicker(slide, spec.kicker || 'TRY IT', 0.82, 0.62, 5.8, theme.secondary);
  addTitle(slide, spec.title, {
    x: 0.82,
    y: 1.08,
    w: 11.55,
    h: 1.0,
    fontSize: 40,
    color: 'FFFFFF',
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.86,
    y: 2.34,
    w: 10.8,
    h: 1.05,
    fontSize: 23,
    color: 'EEF3F8',
  });
  addBullets(slide, spec.bullets, {
    x: 0.93,
    y: 3.75,
    w: 10.7,
    h: 2.25,
    fontSize: 20,
    color: 'FFFFFF',
    paraSpaceAfterPt: 16,
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 11.45,
    y: 5.65,
    w: 1.15,
    h: 1.15,
    fill: { color: theme.secondary },
    line: { type: 'none' },
  });
}

function renderQuiz(pptx, slide, spec, theme) {
  addBaseCanvas(slide, theme.background);
  addKicker(slide, spec.kicker || 'CHECK YOUR THINKING', 0.78, 0.55, 6.5, theme.accent);
  addTitle(slide, spec.title, {
    x: 0.78,
    y: 1.0,
    w: 11.7,
    h: 1.0,
    fontSize: 38,
    color: theme.primary,
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.82,
    y: 2.15,
    w: 11.0,
    h: 0.95,
    fontSize: 24,
    bold: true,
    color: theme.text,
  });
  const options = (spec.bullets || []).slice(0, 5);
  options.forEach((option, index) => {
    const y = 3.35 + index * 0.67;
    slide.addText(String.fromCharCode(65 + index) + '  ' + option, {
      x: 1.0,
      y,
      w: 10.9,
      h: 0.42,
      fontFace: BODY_FONT,
      fontSize: 19,
      color: theme.text,
      margin: 0,
      fit: 'shrink',
    });
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8,
    y: 6.72,
    w: 4.2,
    h: 0,
    line: { color: theme.secondary, width: 3 },
  });
}

function renderAnswer(pptx, slide, spec, theme) {
  addBaseCanvas(slide, 'FFFFFF');
  addKicker(slide, spec.kicker || 'REVEAL', 0.78, 0.55, 5.8, theme.accent);
  addTitle(slide, spec.title, {
    x: 0.78,
    y: 1.0,
    w: 11.7,
    h: 0.9,
    fontSize: 36,
    color: theme.primary,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8,
    y: 2.15,
    w: 1.7,
    h: 0,
    line: { color: theme.secondary, width: 4 },
  });
  addBody(slide, spec.body || spec.subtitle || spec.bullets?.[0], {
    x: 0.82,
    y: 2.65,
    w: 11.0,
    h: 1.35,
    fontSize: 34,
    bold: true,
    color: theme.accent,
  });
  addBullets(slide, spec.body || spec.subtitle ? spec.bullets : spec.bullets?.slice(1), {
    x: 0.9,
    y: 4.45,
    w: 10.9,
    h: 1.75,
    fontSize: 19,
    color: theme.text,
  });
}

function renderSummary(pptx, slide, spec, theme) {
  addBaseCanvas(slide, theme.background);
  addKicker(slide, spec.kicker || 'TAKE IT WITH YOU', 0.78, 0.55, 6.2, theme.accent);
  addTitle(slide, spec.title, {
    x: 0.78,
    y: 1.0,
    w: 11.7,
    h: 0.9,
    fontSize: 38,
    color: theme.primary,
  });
  addBody(slide, spec.body || spec.subtitle, {
    x: 0.82,
    y: 2.05,
    w: 11.2,
    h: 0.72,
    fontSize: 20,
    color: theme.text,
  });
  const takeaways = (spec.bullets || []).slice(0, 4);
  takeaways.forEach((takeaway, index) => {
    const y = 3.05 + index * 0.86;
    slide.addText(String(index + 1).padStart(2, '0'), {
      x: 0.85,
      y,
      w: 0.72,
      h: 0.45,
      fontFace: HEADING_FONT,
      fontSize: 22,
      bold: true,
      color: theme.secondary,
      margin: 0,
    });
    addBody(slide, takeaway, {
      x: 1.7,
      y,
      w: 10.35,
      h: 0.52,
      fontSize: 19,
      color: theme.text,
      valign: 'mid',
    });
  });
}

function renderContentSlide(pptx, slide, spec, theme) {
  switch (spec.layout) {
    case 'cover':
      renderCover(pptx, slide, spec, theme);
      break;
    case 'statement':
      renderStatement(pptx, slide, spec, theme);
      break;
    case 'visual':
      renderVisual(pptx, slide, spec, theme);
      break;
    case 'steps':
      renderSteps(pptx, slide, spec, theme);
      break;
    case 'comparison':
      renderComparison(pptx, slide, spec, theme);
      break;
    case 'activity':
      renderActivity(pptx, slide, spec, theme);
      break;
    case 'quiz':
      renderQuiz(pptx, slide, spec, theme);
      break;
    case 'answer':
      renderAnswer(pptx, slide, spec, theme);
      break;
    case 'summary':
      renderSummary(pptx, slide, spec, theme);
      break;
    case 'split':
    default:
      renderSplit(pptx, slide, spec, theme);
      break;
  }
}

function sanitizeFilenamePart(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return cleaned || fallback;
}

export function buildSlideDeckPptx({ slideDeck }) {
  const pptx = new PptxGenJS();
  const theme = normalizeTheme(slideDeck.themeColors);
  const slides = Array.isArray(slideDeck.slides) ? slideDeck.slides : [];

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'ILAWCraft';
  pptx.company = 'ILAWCraft';
  pptx.subject = 'Editable classroom lesson deck';
  pptx.title = slideDeck.deckTitle || 'Lesson Slide Deck';
  pptx.lang = 'en-PH';
  pptx.theme = {
    name: 'ILAWCraft Classroom',
    headFontFace: HEADING_FONT,
    bodyFontFace: BODY_FONT,
    lang: 'en-PH',
    colorScheme: {
      accent1: theme.primary,
      accent2: theme.secondary,
      accent3: theme.accent,
      accent4: 'D8E0E7',
      accent5: theme.background,
      accent6: theme.text,
      hyperlink: { color: theme.accent },
      folHlink: { color: theme.primary },
    },
  };

  slides.forEach((slideSpec, index) => {
    const slide = pptx.addSlide();
    renderContentSlide(pptx, slide, slideSpec, theme);
    addSlideNumber(
      slide,
      index,
      slides.length,
      ['cover', 'statement', 'visual', 'activity'].includes(slideSpec.layout)
        ? 'FFFFFF'
        : theme.accent
    );
    addNotes(slide, slideSpec);
  });

  return pptx;
}

export async function downloadSlideDeckPptx({ slideDeck, snapshotData = {} }) {
  const pptx = buildSlideDeckPptx({ slideDeck, snapshotData });
  const subject = sanitizeFilenamePart(snapshotData.subject, 'Subject');
  const term = sanitizeFilenamePart(snapshotData.term, 'Term');
  const week = sanitizeFilenamePart(snapshotData.week, 'Week');
  await pptx.writeFile({
    fileName: subject + '_' + term + '_' + week + '_Editable_Classroom_Deck.pptx',
  });
}
