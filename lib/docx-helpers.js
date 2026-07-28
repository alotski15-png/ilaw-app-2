import { Paragraph, TextRun, TableCell, WidthType, ShadingType, Table, TableRow, BorderStyle, AlignmentType } from 'docx';

// Template formatting constants extracted from ILAW clumnar blank.docx
const TEMPLATE_BORDER_COLOR_HEADER = 'D1D5DB';
const TEMPLATE_BORDER_COLOR_MATRIX = '4B5563';
const TEMPLATE_LABEL_FILL = 'F3F4F6';
const TEMPLATE_BANNER_FILL = 'D1D5DB';
const TEMPLATE_HEADER_CELL_MARGINS = { top: 100, left: 100, bottom: 100, right: 100 };
const TEMPLATE_MATRIX_CELL_MARGINS = { top: 120, left: 120, bottom: 120, right: 120 };
const TEMPLATE_BANNER_CELL_MARGINS = { top: 200, left: 120, bottom: 200, right: 120 };
const TEMPLATE_TABLE_CELL_MARGINS = { top: 15, left: 15, bottom: 15, right: 15 };
const TEMPLATE_BORDER_SIZE = 8;

const createBorderSet = (color) => ({
  top: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
  left: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
  bottom: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
  right: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
});

export const formatDocxText = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.join('\n');
      } catch (e) {}
    }
    return trimmed
      .replace(/###\s*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^[\s-]*\*\*/gm, '')
      .replace(/^- /gm, '');
  }
  if (Array.isArray(content)) {
    return content.map(item => typeof item === 'object' ? formatDocxText(item) : String(item).replace(/^•\s*/, '')).join('\n');
  }
  if (typeof content === 'object') {
    return Object.entries(content)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${formatDocxText(v)}`)
      .join('\n');
  }
  return String(content);
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
export const createCell = (text, options = {}) => {
  const {
    fill,
    bold,
    color = '333333',
    widthPct = null,
    colSpan = 1,
    italic = false,
    borderColor = TEMPLATE_BORDER_COLOR_HEADER,
    cellMargins = TEMPLATE_HEADER_CELL_MARGINS,
    alignment = AlignmentType.LEFT,
    fontSize = 20,
  } = options;

  const paragraphs = String(text || '').split('\n').map(line =>
    new Paragraph({
      alignment,
      spacing: { line: 276, after: 0, before: 0 },
      children: [
        new TextRun({
          text: line,
          bold: !!bold,
          italic: !!italic,
          color: color,
          size: fontSize,
          font: 'Arial',
        }),
      ],
    })
  );

  return new TableCell({
    columnSpan: colSpan > 1 ? colSpan : undefined,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { fill: fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    borders: createBorderSet(borderColor),
    children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '', font: 'Arial', size: 20 })] })],
  });
};

export const createMatrixTable = ({ rowsData, sessionHeaders, numSessions, subHeaderStyle = {}, labelStyle = {}, borderColor = TEMPLATE_BORDER_COLOR_MATRIX, cellMargins = TEMPLATE_MATRIX_CELL_MARGINS }) => {
  const colWidth = Math.floor(83 / Math.max(1, numSessions));

  const headerRow = new TableRow({
    children: [
      createCell('Phase / Component', { ...subHeaderStyle, widthPct: 17, borderColor, cellMargins }),
      ...sessionHeaders.map(h => createCell(h, { ...subHeaderStyle, widthPct: colWidth, borderColor, cellMargins }))
    ]
  });

  const dataRows = rowsData.map(row => new TableRow({
    children: [
      createCell(row.label, { ...labelStyle, borderColor, cellMargins }),
      ...sessionHeaders.map((_, idx) => createCell(row.getValue(idx), { borderColor, cellMargins }))
    ]
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    rows: [headerRow, ...dataRows],
  });
};

export const buildHeaderTable = ({ lessonPlan, snapshotData, tableLabelStyle = {}, tableValueWidth = 75 }) => {
  const labelStyle = { ...tableLabelStyle, fill: tableLabelStyle.fill || TEMPLATE_LABEL_FILL, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS, bold: true };
  const valueStyle = { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS };

  const formatPlaceholder = (a, b) => {
    if (a === undefined || a === null || a === '') return b || '';
    return a;
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    rows: [
      new TableRow({ children: [createCell('Lesson Title', { ...labelStyle, widthPct: 25 }), createCell(formatPlaceholder(lessonPlan?.header?.lessonTitle, snapshotData?.lessonName), { ...valueStyle, widthPct: tableValueWidth })] }),
      new TableRow({ children: [createCell('Learning Area/s', labelStyle), createCell(formatPlaceholder(lessonPlan?.header?.learningArea, snapshotData?.subject), valueStyle)] }),
      new TableRow({ children: [createCell('Name of Teacher/s', labelStyle), createCell(formatPlaceholder(lessonPlan?.header?.teacherName, snapshotData?.teacherName), valueStyle)] }),
      new TableRow({ children: [createCell('Grade Level and Section', labelStyle), createCell(formatPlaceholder(lessonPlan?.header?.gradeLevelSection, snapshotData?.gradeAndSection), valueStyle)] }),
      new TableRow({ children: [createCell('No. of Sessions', labelStyle), createCell(formatPlaceholder(snapshotData?.noOfSessions, ''), valueStyle)] }),
      new TableRow({ children: [createCell('References', labelStyle), createCell(formatPlaceholder(lessonPlan?.header?.references, snapshotData?.references), valueStyle)] }),
      new TableRow({ children: [createCell('Declaration of AI use', labelStyle), createCell(formatPlaceholder(lessonPlan?.header?.declarationOfAiUse, `Consistent with policy guidelines on AI in basic education...`), valueStyle)] })
    ]
  });
};

export const createSectionTitleBanner = (title, subtitle) => {
  return [
    new Paragraph({
      shading: { fill: '1B365D', type: ShadingType.CLEAR },
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: `${title} `, bold: true, color: 'FFFFFF', size: 22, font: 'Arial' }),
        new TextRun({ text: subtitle, color: 'E2E8F0', size: 18, font: 'Arial' })
      ]
    })
  ];
};

export const buildStandardsTable = ({ lessonPlan, snapshotData }) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    rows: [
      new TableRow({ children: [createCell('Learning Competency and Curriculum Standards:', { fill: TEMPLATE_LABEL_FILL, bold: true, color: '1B365D', borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
      new TableRow({ children: [createCell(`Learning Competency:\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}\n\nContent Standards:\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\nPerformance Standards:\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}`, { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] })
    ]
  });
};

export const buildIntentionsMatrix = ({ lessonPlan, snapshotData, sessionHeaders, numSessions, tableSubHeaderStyle = {}, tableLabelStyle = {} }) => {
  return createMatrixTable({
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

export const buildExperienceMatrix = ({ lessonPlan, sessionHeaders, numSessions, tableSubHeaderStyle = {}, tableLabelStyle = {} }) => {
  return createMatrixTable({
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

export const buildAssessmentMatrix = ({ lessonPlan, sessionHeaders, numSessions, tableLabelStyle = {} }) => {
  return createMatrixTable({
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

export const buildWaysForwardMatrix = ({ lessonPlan, sessionHeaders, numSessions, tableLabelStyle = {} }) => {
  return createMatrixTable({
    rowsData: [
      { label: 'Extended learning opportunities', getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan.waysForward?.extendedLearningOpportunities)) },
      { label: 'Reflections', getValue: () => '\n\n\n\n\n\n' }
    ],
    sessionHeaders,
    numSessions,
    labelStyle: tableLabelStyle
  });
};

export const buildSignatoriesTable = ({ teacherSignatory, masterTeacherSignatory, principalSignatory }) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    rows: [
      new TableRow({
        children: [
          createCell(`Prepared by:\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || ''}`, { widthPct: 33, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }),
          createCell(`Checked and Reviewed:\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || ''}`, { widthPct: 33, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }),
          createCell(`Noted by:\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || ''}`, { widthPct: 34, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })
        ]
      })
    ]
  });
};

export const buildSessionTable = ({ idx, sessionObj, lessonPlan, snapshotData, teacherSignatory, masterTeacherSignatory, principalSignatory, headerBannerStyle = {} }) => {
  const sessionLabel = `Session ${idx + 1} of ${lessonPlan.sessions?.length || 1}`;

  const objectives = formatDocxText(sessionObj.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[idx] : lessonPlan.learningObjectives));
  const context = formatDocxText(sessionObj.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[idx] : lessonPlan.learnerContext) || snapshotData?.learnerContext);
  const preLesson = formatDocxText(sessionObj.preLesson || (Array.isArray(lessonPlan.learningExperience?.preLesson) ? lessonPlan.learningExperience.preLesson[idx] : lessonPlan.learningExperience?.preLesson));
  const flow = formatDocxText(sessionObj.flow || (Array.isArray(lessonPlan.learningExperience?.flow) ? lessonPlan.learningExperience.flow[idx] : lessonPlan.learningExperience?.flow));
  const resources = formatDocxText(sessionObj.learningResources || (Array.isArray(lessonPlan.learningResources) ? lessonPlan.learningResources[idx] : lessonPlan.learningResources) || snapshotData?.resources);
  const integration = formatDocxText(sessionObj.opportunitiesForIntegration || (Array.isArray(lessonPlan.opportunitiesForIntegration) ? lessonPlan.opportunitiesForIntegration[idx] : lessonPlan.opportunitiesForIntegration));
  const assessData = sessionObj.formativeAssessment || (Array.isArray(lessonPlan?.assessingLearning?.formativeAssessment) ? lessonPlan.assessingLearning.formativeAssessment[idx] : lessonPlan?.assessingLearning?.formativeAssessment);
  const assessment = formatDocxText(assessData);
  const extended = formatDocxText(sessionObj.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan.waysForward?.extendedLearningOpportunities));

  const matrixBorder = TEMPLATE_BORDER_COLOR_MATRIX;
  const matrixMargins = TEMPLATE_MATRIX_CELL_MARGINS;

  const sessionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
    rows: [
      new TableRow({ children: [createCell(`LESSON PLAN (${sessionLabel.toUpperCase()})\n(based on the ILAW FRAMEWORK)`, { ...headerBannerStyle, fill: headerBannerStyle.fill || TEMPLATE_BANNER_FILL, colSpan: 4, widthPct: 100, borderColor: matrixBorder, cellMargins: TEMPLATE_BANNER_CELL_MARGINS })] }),
      new TableRow({ children: [createCell('Learning Area:', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(formatDocxText(lessonPlan.header?.learningArea || snapshotData?.subject), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Name of Teachers:', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(formatDocxText(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName)), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Grade level & Section:', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(formatDocxText(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('No. of Sessions:', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(`${snapshotData?.noOfSessions || ''} (${sessionLabel})`, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('References:\nbooks, websites, toolkits, etc.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(formatDocxText(lessonPlan.header?.references || snapshotData?.references), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Declaration of AI Use:\nCite how AI was used in the formulation of the lesson plan.\nSee DO no. 3 s. 2026', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(formatDocxText(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Intentions:', { ...headerBannerStyle, fill: headerBannerStyle.fill || TEMPLATE_BANNER_FILL, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell('Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson \u2013 keep it clear and simple.\nRemember: Understanding your learner\u2019s evolving context and designing around that your lessons connect with and are relevant to them.', { colSpan: 3, widthPct: 75, fill: 'F8FAFC', borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Learning Competency &\nCurriculum Standards:\nWrite the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(`Content Standard:\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\nPerformance Standard:\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}\n\nLearning Competency:\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}`, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Learning Objectives:\nWrite the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(objectives, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Learner Context:\nWrite your observation of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(context, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Learning Experience', { ...headerBannerStyle, fill: headerBannerStyle.fill || TEMPLATE_BANNER_FILL, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell('A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, and understanding in a purposeful and coherent way.', { colSpan: 3, widthPct: 75, fill: 'F8FAFC', borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Pre-Lesson:\nDescribe how you will help the learners get ready with the lesson', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(preLesson, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Flow:\nDescribe the activities that you can implement in 1 or more sessions to meet your intentions.\nApply the Learning Design Principles, use the prompts below as a guide. Note, not all principles are expected in every lesson.\n\u2022 make the objectives clear\n\u2022 guide learners before letting them try the task on their own\n\u2022 check the state of the learner\u2019s well-being, understanding, and mastery over the lesson\n\u2022 connect today\u2019s new concepts to past competencies\n\u2022 encourage collaboration among learners\n\u2022 invite learners to reflect on why this matters to them\n\u2022 ensure inclusion for learner\u2019s varied abilities, learning styles, and contexts', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(flow, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Learning Resources:\nList down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\nInclude options and alternatives in case of emergencies', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(resources, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Opportunities for Integration and Contextualization:\nWrite down any possibilities to meaningfully connect to another learning area, special topic, local context, or technology. Write N/A if none.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(integration, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Assessing Learning', { ...headerBannerStyle, fill: headerBannerStyle.fill || TEMPLATE_BANNER_FILL, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell('Assessment reveals what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session.', { colSpan: 3, widthPct: 75, fill: 'F8FAFC', borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Formative Assessment:\nCreate a task, activity, or questions to assess learning and provide feedback every now and then. Include ways for learners to ask for guidance or support throughout each session.\nRemember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(assessment, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Ways Forward', { ...headerBannerStyle, fill: headerBannerStyle.fill || TEMPLATE_BANNER_FILL, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell('Meaningful learning can also happen beyond the classroom \u2013 for both the learners and the teacher.\nPause and reflect on what happened today.', { colSpan: 3, widthPct: 75, fill: 'F8FAFC', borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Extended Learning Opportunities:\nSuggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(extended, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [createCell('Reflections:\nThink about what you need to change for the next session based on what happened today. Is there something the learners are interested in exploring?\nAre there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?\nReflections may be written in brief notes, bullets, or annotations.', { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell('\n\n\n\n\n\n', { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })] }),
      new TableRow({ children: [ createCell(`Prepared by:\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || 'Teacher'}`, { widthPct: 33, colSpan: 1, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(`Checked and Reviewed:\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || 'Master Teacher'}`, { widthPct: 33, colSpan: 1, borderColor: matrixBorder, cellMargins: matrixMargins }), createCell(`Noted by:\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || 'School Head'}`, { widthPct: 34, colSpan: 2, borderColor: matrixBorder, cellMargins: matrixMargins }) ] })
    ]
  });

  return sessionTable;
};

export {
  TEMPLATE_BORDER_COLOR_HEADER,
  TEMPLATE_BORDER_COLOR_MATRIX,
  TEMPLATE_LABEL_FILL,
  TEMPLATE_BANNER_FILL,
  TEMPLATE_HEADER_CELL_MARGINS,
  TEMPLATE_MATRIX_CELL_MARGINS,
  TEMPLATE_BANNER_CELL_MARGINS,
  TEMPLATE_TABLE_CELL_MARGINS,
  TEMPLATE_BORDER_SIZE,
  createBorderSet,
};
