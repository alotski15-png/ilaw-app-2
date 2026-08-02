// Template formatting constants extracted from ILAW clumnar blank.docx
export const TEMPLATE_BORDER_COLOR_HEADER = '000000';
export const TEMPLATE_BORDER_COLOR_MATRIX = '000000';
export const TEMPLATE_HEADER_CELL_MARGINS = { top: 100, left: 100, bottom: 100, right: 100 };
export const TEMPLATE_MATRIX_CELL_MARGINS = { top: 120, left: 120, bottom: 120, right: 120 };
export const TEMPLATE_BANNER_CELL_MARGINS = { top: 200, left: 120, bottom: 200, right: 120 };
export const TEMPLATE_TABLE_CELL_MARGINS = { top: 15, left: 15, bottom: 15, right: 15 };
export const TEMPLATE_BORDER_SIZE = 4;

import { mapIndicatorToOrdinal } from './cot-indicators';

export const createBorderSet = async (color) => {
  const { BorderStyle } = await import('docx');
  return {
    top: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    left: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    bottom: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    right: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    insideHorizontal: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, color: color },
    insideVertical: { style: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, color: color },
  };
};

export const formatDocxText = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    trimmed = replaceIndicatorAnnotationsForDocx(trimmed);
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.join('\n');
      } catch (e) {}
    }
    return trimmed
      .replace(/###\s*/g, '')
      .replace(/^- /gm, '')
      .replace(/^\* /gm, '');
  }
  if (Array.isArray(content)) {
    return content.map(item => typeof item === 'object' ? formatDocxText(item) : String(item).replace(/^â€¢\s*/, '')).join('\n');
  }
  if (typeof content === 'object') {
    return Object.entries(content)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${formatDocxText(v)}`)
      .join('\n');
  }
  return String(content);
};

// Helper used by createCell to map indicator annotations inside strings to ordinal numbers
export const replaceIndicatorAnnotationsForDocx = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/(\*\*)?\(?Indicator\s*([0-9.]+)\)?(\*\*)?/ig, (m, p1, p2) => {
    const ordinal = mapIndicatorToOrdinal(p2);
    if (ordinal) return `**(indicator ${ordinal})**`;
    return `**(indicator ${p2})**`;
  });
};


export const getOnlyName = (rawInput) => {
  if (!rawInput) return '';
  const input = rawInput || '';
  if (input.includes(',')) {
    const parts = input.split(',');
    return parts[0].trim();
  }
  return input.trim();
};

/**
 * Creates a DOCX table cell matching the ILAW clumnar blank.docx template.
 *
 * Template formatting:
 * - Font: Arial, 10pt (size=20 in half-points)
 * - Cell borders: single, 0.5pt (size=8), color D1D5DB (header) or 4B5563 (matrix)
 * - Cell margins: 100dxa (header) or 120dxa (matrix) on all sides
 * - Label fill: F3F4F6 (light gray)
 * - Text alignment: left (default)
 */
export const createCell = async (text, options = {}) => {
  const { Paragraph, TextRun, TableCell, WidthType, ShadingType, Table, TableRow, BorderStyle, AlignmentType, VerticalAlign, HeightRule } = await import('docx');

  const {
    fill,
    bold,
    color = '333333',
    widthPct = null,
    widthMm = null,
    colSpan = 1,
    italic = false,
    borderColor = TEMPLATE_BORDER_COLOR_HEADER,
    cellMargins = TEMPLATE_HEADER_CELL_MARGINS,
    alignment = AlignmentType.LEFT,
    fontSize = 20,
    labelSize = null,
    minHeight = 0,
  } = options;

  let paragraphs;

  if (Array.isArray(text)) {
    // It's an array of TextRun-like objects
    paragraphs = [new Paragraph({
      alignment,
      spacing: { line: 240, after: 0, before: 0 },
      children: text.map(run => new TextRun({
        text: run.text,
        bold: !!run.bold,
        italic: !!run.italic,
        color: run.color || color,
        size: run.size || fontSize,
        font: 'Aptos',
      })),
    })];
  } else {
    // It's a string, split by newlines and parse **bold** markers and label prefixes
    const sourceText = String(text || '');
    const hasLeadingLabel = /^\s*[^:]{1,60}:\s*/.test(sourceText.trimStart().split(/\r?\n/)[0] || '');
    paragraphs = sourceText.split('\n').map(line => {
      const trimmedLine = line.trimEnd();
      const labelMatch = trimmedLine.match(/^(\s*[^:]{1,60}:\s*)([\s\S]*)$/);
      let children = [];

      const createTextRuns = (value) => {
        // First split on **bold** markers, then further split each non-bold
        // segment on inline label prefixes like "ENRICHMENT:" or "REMEDIATION:"
        // so those labels are rendered bold in the DOCX output.
        const boldParts = value.split(/(\*\*.*?\*\*)/g);
        const defaultTextBold = hasLeadingLabel ? false : !!bold;
        const runs = [];
        for (const part of boldParts) {
          if (part === '') continue;
          if (part.startsWith('**') && part.endsWith('**')) {
            const innerText = part.slice(2, -2);
            const indicatorMatch = innerText.match(/\(?Indicator\s*([0-9.]+)\)?/i);
            if (indicatorMatch) {
              const code = indicatorMatch[1];
              const ordinal = mapIndicatorToOrdinal(code);
              const displayText = ordinal ? `(Indicator ${ordinal})` : innerText;
              runs.push(new TextRun({
                text: displayText,
                bold: true,
                italic: !!italic,
                color: 'FF0000',
                size: fontSize,
                font: 'Aptos',
              }));
            } else {
              runs.push(new TextRun({
                text: innerText,
                bold: true,
                italic: !!italic,
                color: color,
                size: fontSize,
                font: 'Aptos',
              }));
            }
          } else {
            // Split non-bold text on inline labels (ENRICHMENT:, REMEDIATION:)
            const inlineParts = part.split(/(ENRICHMENT:|REMEDIATION:)/g);
            for (const inlinePart of inlineParts) {
              if (inlinePart === '') continue;
              if (inlinePart === 'ENRICHMENT:' || inlinePart === 'REMEDIATION:') {
                runs.push(new TextRun({
                  text: inlinePart,
                  bold: true,
                  italic: !!italic,
                  color: color,
                  size: fontSize,
                  font: 'Aptos',
                }));
              } else {
                runs.push(new TextRun({
                  text: inlinePart,
                  bold: defaultTextBold,
                  italic: !!italic,
                  color: color,
                  size: fontSize,
                  font: 'Aptos',
                }));
              }
            }
          }
        }
        return runs;
      };

      if (labelMatch && !labelMatch[1].trim().startsWith('**')) {
        const labelText = labelMatch[1];
        const restText = labelMatch[2] || '';
        children.push(new TextRun({ text: labelText, bold: true, color, size: labelSize || fontSize, font: 'Aptos' }));
        if (restText) {
          children = children.concat(createTextRuns(restText));
        }
      } else {
        children = createTextRuns(trimmedLine);
      }

      return new Paragraph({
        alignment,
        spacing: { line: 240, after: 0, before: 0 },
        children: children.length > 0 ? children : [new TextRun({ text: '', font: 'Aptos', size: fontSize })],
      });
    });
  }

  const cellProperties = {};
  if (minHeight > 0) {
    cellProperties.verticalAlign = VerticalAlign.CENTER; // Center content vertically
    cellProperties.height = { value: minHeight, rule: HeightRule.AT_LEAST };
  }

  const width = widthMm != null
    ? { size: Math.round(widthMm * 56.692913), type: WidthType.DXA }
    : (widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined);

  return new TableCell({
    columnSpan: colSpan > 1 ? colSpan : undefined,
    width,
    shading: fill ? { fill: fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    borders: await createBorderSet(borderColor),
    children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '', font: 'Aptos', size: 20 })] })],
    properties: minHeight > 0 ? cellProperties : undefined,
  });
};

export const createMatrixTable = async ({ rowsData, sessionHeaders, numSessions, subHeaderStyle = {}, labelStyle = {}, borderColor = TEMPLATE_BORDER_COLOR_MATRIX, cellMargins = TEMPLATE_MATRIX_CELL_MARGINS }) => {
  const { Table, TableRow, WidthType } = await import('docx');

  const colWidth = Math.floor(83 / Math.max(1, numSessions));

  const headerRow = new TableRow({
    children: [
      await createCell('Phase / Component', { ...subHeaderStyle, widthPct: 17, borderColor, cellMargins }),
      ...(await Promise.all(sessionHeaders.map(async h => await createCell(h, { ...subHeaderStyle, widthPct: colWidth, borderColor, cellMargins }))))
    ]
  });

  const dataRows = await Promise.all(rowsData.map(async row => new TableRow({
    height: row.height,
    children: [
      await createCell(row.label, { ...labelStyle, borderColor, cellMargins, fontSize: 24 }),
      ...(await Promise.all(sessionHeaders.map(async (_, idx) => await createCell(row.getValue(idx), { borderColor, cellMargins, fontSize: 24 }))))
    ]
  })));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    borders: await createBorderSet(borderColor),
    rows: [headerRow, ...dataRows],
  });
};

export const buildHeaderTable = async ({ lessonPlan, snapshotData, tableLabelStyle = {}, tableValueWidth = 75 }) => {
  const { Table, TableRow, WidthType } = await import('docx');

  const labelStyle = { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, bold: true, fontSize: 24 };
  const valueStyle = { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, fontSize: 24 };

  const formatPlaceholder = (a, b) => {
    if (a === undefined || a === null || a === '') return b || '';
    return a;
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    borders: await createBorderSet(TEMPLATE_BORDER_COLOR_HEADER),
    rows: [
      new TableRow({ children: [await createCell('Lesson Title', { ...labelStyle, widthPct: 25 }), await createCell(formatPlaceholder(lessonPlan?.header?.lessonTitle, snapshotData?.lessonName), { ...valueStyle, widthPct: tableValueWidth })] }),
      new TableRow({ children: [await createCell('Learning Area/s', labelStyle), await createCell(formatPlaceholder(lessonPlan?.header?.learningArea, snapshotData?.subject), valueStyle)] }),
      new TableRow({ children: [await createCell('Name of Teacher/s', labelStyle), await createCell(formatPlaceholder(lessonPlan?.header?.teacherName, snapshotData?.teacherName), valueStyle)] }),
      new TableRow({ children: [await createCell('Grade Level and Section', labelStyle), await createCell(formatPlaceholder(lessonPlan?.header?.gradeLevelSection, snapshotData?.gradeAndSection), valueStyle)] }),
      new TableRow({ children: [await createCell('No. of Sessions', labelStyle), await createCell(formatPlaceholder(snapshotData?.noOfSessions, ''), valueStyle)] }),
      new TableRow({ children: [await createCell('References', labelStyle), await createCell(formatPlaceholder(lessonPlan?.header?.references, snapshotData?.references), valueStyle)] }),
      new TableRow({ children: [await createCell('Declaration of AI use', labelStyle), await createCell(formatPlaceholder(lessonPlan?.header?.declarationOfAiUse, `Consistent with policy guidelines on AI in AI use...`), valueStyle)] })
    ]
  });
};

export const createSectionTitleBanner = async (title, subtitle) => {
  const { Paragraph, TextRun } = await import('docx');
  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: `${title} `, bold: true, color: 'FFFFFF', size: 22, font: 'Aptos' }),
        new TextRun({ text: subtitle, color: 'E2E8F0', size: 18, font: 'Aptos' })
      ]
    })
  ];
};

export const buildStandardsTable = async ({ lessonPlan, snapshotData }) => {
  const { Table, TableRow, WidthType } = await import('docx');
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    borders: await createBorderSet(TEMPLATE_BORDER_COLOR_HEADER),
    rows: [
      new TableRow({ children: [await createCell('Learning Competency and Curriculum Standards:', { bold: true, color: '1B365D', borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
      new TableRow({ children: [await createCell(`**Learning Competency:**\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}\n\n**Content Standards:**\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\n**Performance Standards:**\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}`, { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] })
    ]
  });
};

export const buildIntentionsMatrix = async ({ lessonPlan, snapshotData, sessionHeaders, numSessions, tableSubHeaderStyle = {}, tableLabelStyle = {} }) => {
  return await createMatrixTable({
    rowsData: [
      {
        label: 'Learning Objectives (KSA)',
        getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[idx] : lessonPlan.learningObjectives))
      },
      {
        label: 'Learner Context',
        getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[idx] : lessonPlan.learnerContext) || snapshotData?.learnerContext)
      }
    ],
    sessionHeaders,
    numSessions,
    subHeaderStyle: tableSubHeaderStyle,
    labelStyle: tableLabelStyle
  });
};

export const buildExperienceMatrix = async ({ lessonPlan, sessionHeaders, numSessions, tableSubHeaderStyle = {}, tableLabelStyle = {} }) => {
  return await createMatrixTable({
    rowsData: [
      { label: 'Pre-Lesson', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.preLesson || (Array.isArray(lessonPlan.learningExperience?.preLesson) ? lessonPlan.learningExperience.preLesson[idx] : lessonPlan.learningExperience?.preLesson)) },
      { label: 'Flow', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.flow || (Array.isArray(lessonPlan.learningExperience?.flow) ? lessonPlan.learningExperience.flow[idx] : lessonPlan.learningExperience?.flow)) },
      { label: 'Learning Resources', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learningResources || (Array.isArray(lessonPlan.learningResources) ? lessonPlan.learningResources[idx] : lessonPlan.learningResources)) },
      { label: 'Opportunities for integration', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.opportunitiesForIntegration || (Array.isArray(lessonPlan.opportunitiesForIntegration) ? lessonPlan.opportunitiesForIntegration[idx] : lessonPlan.opportunitiesForIntegration)) }
    ],
    sessionHeaders,
    numSessions,
    subHeaderStyle: tableSubHeaderStyle,
    labelStyle: tableLabelStyle
  });
};

export const buildAssessmentMatrix = async ({ lessonPlan, sessionHeaders, numSessions, tableLabelStyle = {} }) => {
  return await createMatrixTable({
    rowsData: [
      { label: 'Formative Assessment', getValue: (idx) => {
        const assessData = lessonPlan?.sessions?.[idx]?.formativeAssessment || (Array.isArray(lessonPlan?.assessingLearning?.formativeAssessment) ? lessonPlan.assessingLearning.formativeAssessment[idx] : lessonPlan?.assessingLearning?.formativeAssessment);
        return formatDocxText(assessData);
      } }
    ],
    sessionHeaders,
    numSessions,
    labelStyle: tableLabelStyle
  });
};

export const buildWaysForwardMatrix = async ({ lessonPlan, sessionHeaders, numSessions, tableLabelStyle = {} }) => {
  return await createMatrixTable({
    rowsData: [
      { label: 'Extended learning opportunities', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan.waysForward?.extendedLearningOpportunities)) },
      { label: 'Reflections', getValue: () => '', height: { value: 2835, rule: 'exact' } }
    ],
    sessionHeaders,
    numSessions,
    labelStyle: tableLabelStyle
  });
};

export const buildSignatoriesTable = async ({ teacherSignatory, masterTeacherSignatory, principalSignatory }) => {
  const { Table, TableRow, WidthType } = await import('docx');
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    borders: await createBorderSet(TEMPLATE_BORDER_COLOR_HEADER),
    rows: [
      new TableRow({
        children: [
          await createCell(`**Prepared by:**\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || ''}`, { widthPct: 33, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, fontSize: 20 }),
          await createCell(`**Checked and Reviewed:**\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || ''}`, { widthPct: 33, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, fontSize: 20 }),
          await createCell(`**Noted by:**\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || ''}`, { widthPct: 34, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, fontSize: 20 })
        ]
      })
    ]
  });
};

export const buildSessionTable = async ({ lessonPlan, snapshotData, sessionIndex, sessionLabel, headerBannerStyle = {} }) => {
  const { Table, TableRow, WidthType, AlignmentType } = await import('docx');

  const sessionObj = lessonPlan.sessions?.[sessionIndex] || {};

  const objectives = formatDocxText(sessionObj.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[sessionIndex] : lessonPlan.learningObjectives));
  const context = formatDocxText(sessionObj.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[sessionIndex] : lessonPlan.learnerContext) || snapshotData?.learnerContext);
  const preLesson = formatDocxText(sessionObj.preLesson || (Array.isArray(lessonPlan.learningExperience?.preLesson) ? lessonPlan.learningExperience.preLesson[sessionIndex] : lessonPlan.learningExperience?.preLesson));
  const flow = formatDocxText(sessionObj.flow || (Array.isArray(lessonPlan.learningExperience?.flow) ? lessonPlan.learningExperience.flow[sessionIndex] : lessonPlan.learningExperience?.flow));
  const resources = formatDocxText(sessionObj.learningResources || (Array.isArray(lessonPlan.learningResources) ? lessonPlan.learningResources[sessionIndex] : lessonPlan.learningResources) || snapshotData?.resources);
  const integration = formatDocxText(sessionObj.opportunitiesForIntegration || (Array.isArray(lessonPlan.opportunitiesForIntegration) ? lessonPlan.opportunitiesForIntegration[sessionIndex] : lessonPlan.opportunitiesForIntegration));
  const assessData = sessionObj.formativeAssessment || (Array.isArray(lessonPlan?.assessingLearning?.formativeAssessment) ? lessonPlan.assessingLearning.formativeAssessment[sessionIndex] : lessonPlan?.assessingLearning?.formativeAssessment);
  const assessment = formatDocxText(assessData);
  const extended = formatDocxText(sessionObj.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[sessionIndex] : lessonPlan.waysForward?.extendedLearningOpportunities));

  const matrixBorder = TEMPLATE_BORDER_COLOR_MATRIX;
  const matrixMargins = TEMPLATE_MATRIX_CELL_MARGINS;

  const sessionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    borders: await createBorderSet(matrixBorder),
    rows: [
      new TableRow({ children: [await createCell(`LESSON PLAN (${sessionLabel.toUpperCase()})\n(based on the ILAW FRAMEWORK)`, { ...headerBannerStyle, colSpan: 4, widthPct: 100, borderColor: matrixBorder, cellMargins: TEMPLATE_BANNER_CELL_MARGINS, alignment: AlignmentType.CENTER })] }),
      new TableRow({ children: [await createCell('Learning Area:', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell(formatDocxText(lessonPlan.header?.learningArea || snapshotData?.subject), { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({ children: [await createCell('Name of Teachers:', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell(formatDocxText(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName)), { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({ children: [await createCell('Grade level & Section:', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell(formatDocxText(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection), { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({ children: [await createCell('No. of Sessions:', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell(`${snapshotData?.noOfSessions || ''} (${sessionLabel})`, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({
        children: [
          await createCell('References:\nbooks, websites, toolkits, etc.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(formatDocxText(lessonPlan.header?.references || snapshotData?.references), { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Declaration of AI Use:\nCite how AI was used in the formulation of the lesson plan.\nSee DO no. 3 s. 2026', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(formatDocxText(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`), { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({ children: [await createCell('Intentions:', { ...headerBannerStyle, bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell('Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson \u2013 keep it clear and simple.\nRemember: Understanding your learner\u2019s evolving context and designing around that your lessons connect with and are relevant to them.', { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({
        children: [
          await createCell('Learning Competency &\nCurriculum Standards:\nWrite the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(`**Content Standard:**\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\n**Performance Standard:**\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}\n\n**Learning Competency:**\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}`, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Learning Objectives:\nWrite the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(objectives, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Learner Context:\nWrite your observation of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(context, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({ children: [await createCell('Learning Experience', { ...headerBannerStyle, bold: true, widthMm: 45.2, labelSize: 28, fontSize: 28, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell('A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, and understanding in a purposeful and coherent way.', { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({
        children: [
          await createCell('Pre-Lesson:\nDescribe how you will help the learners get ready with the lesson', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(preLesson, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Flow:\nDescribe the activities that you can implement in 1 or more sessions to meet your intentions.\nApply the Learning Design Principles, use the prompts below as a guide. Note, not all principles are expected in every lesson.\n• make the objectives clear\n• guide learners before letting them try the task on their own\n• check the state of the learner’s well-being, understanding, and mastery over the lesson\n• connect today’s new concepts to past competencies\n• encourage collaboration among learners\n• invite learners to reflect on why this matters to them\n• ensure inclusion for learner’s varied abilities, learning styles, and contexts', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(flow, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Learning Resources:\nList down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\nInclude options and alternatives in case of emergencies', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(resources, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({
        children: [
          await createCell('Opportunities for Integration and Contextualization:\nWrite down any possibilities to meaningfully connect to another learning area, special topic, local context, or technology. Write N/A if none.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 28, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(integration, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({ children: [await createCell('Assessing Learning', { ...headerBannerStyle, bold: true, widthMm: 45.2, labelSize: 28, fontSize: 28, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell('Assessment reveals what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session.', { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({
        children: [
          await createCell('Formative Assessment:\nCreate a task, activity, or questions to assess learning and provide feedback every now and then. Include ways for learners to ask for guidance or support throughout each session.\nRemember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(assessment, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
      new TableRow({ children: [await createCell('Ways Forward', { ...headerBannerStyle, bold: true, widthMm: 45.2, labelSize: 28, fontSize: 28, borderColor: matrixBorder, cellMargins: matrixMargins }), await createCell('Meaningful learning can also happen beyond the classroom — for both the learners and the teacher.\nPause and reflect on what happened today.', { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })] }),
      new TableRow({
        children: [
          await createCell('Extended Learning Opportunities:\nSuggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 20, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell(extended, { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
            new TableRow({
        height: { value: 2835, rule: 'exact' },
        children: [
          await createCell('Reflections', { bold: true, widthMm: 45.2, labelSize: 28, fontSize: 28, borderColor: matrixBorder, cellMargins: matrixMargins }),
          await createCell('', { colSpan: 3, widthMm: 144.8, borderColor: matrixBorder, cellMargins: matrixMargins, fontSize: 24 })
        ]
      }),
    ]
  });

  return sessionTable;
};