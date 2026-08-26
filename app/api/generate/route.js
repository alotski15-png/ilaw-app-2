import { NextResponse } from 'next/server';
import { buildLessonPlanPipeline, runLessonPlanPipeline } from '@/lib/ai-providers';
import {
  buildCotAlignmentTemplate,
  buildCotRubricGuidance,
  COT_PRIORITY_INDICATOR_CODES,
  validateCotAlignment,
} from '@/lib/cot-rubric';

import { z } from 'zod';

// Zod schema for validating AI-generated lesson plans
const SessionSchema = z.object({
  sessionNumber: z.number().int().positive().optional(),
  sessionTitle: z.string().min(3),
  learningObjectives: z.union([z.string().min(3), z.array(z.string().min(3))]),
  learnerContext: z.any().optional(),
  preLesson: z.string().optional(),
  flow: z.string().min(20),
  learningResources: z.any().optional(),
  opportunitiesForIntegration: z.any().optional(),
  formativeAssessment: z.any().optional(),
  extendedLearning: z.any().optional(),
  extendedLearningOpportunities: z.any().optional(),
  waysForward: z.object({
    extendedLearning: z.any().optional(),
    extendedLearningOpportunities: z.any().optional(),
  }).optional(),
  ways_forward: z.any().optional(),
  reflections: z.any().optional(),
});

const CotEvidenceSchema = z.object({
  indicatorCode: z.string().min(5),
  rubricIndicator: z.number().int().min(1).max(21),
  targetLevel: z.number().int().min(1).max(9),
  evidenceLocations: z.array(z.string().min(8)).min(2),
  plannedEvidence: z.array(z.string().min(12)).min(2),
  learnerAgency: z.string().min(20),
});

const CotAlignmentSchema = z.object({
  careerStage: z.string().min(3),
  rubricRange: z.array(z.number().int().min(1).max(9)).length(2),
  targetRubricLevel: z.number().int().min(1).max(9),
  evidenceMatrix: z.array(CotEvidenceSchema).min(1),
  disclaimer: z.string().min(20),
});

const PlanSchema = z.object({
  header: z.object({
    lessonTitle: z.string().optional(),
    learningArea: z.string().optional(),
    teacherName: z.string().optional(),
    gradeLevelSection: z.string().optional(),
    noOfSessions: z.string().optional(),
    references: z.array(z.string()).optional(),
    declarationOfAiUse: z.string().optional(),
  }).optional(),
  curriculumStandards: z.object({
    learningCompetency: z.string().optional(),
    contentStandard: z.string().optional(),
    performanceStandard: z.string().optional(),
  }).optional(),
  sessions: z.array(SessionSchema).min(1).max(10),
  cotAlignment: CotAlignmentSchema.optional(),
});

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { geminiModels, ...formData } = body;
    // The determined and sorted model lists (latest-first) are the default
    // models. The first entry in each list is the primary model.
    // The `selectedModel` field is no longer used — only the *Models arrays.
    const abortController = new AbortController();
    const handleAbort = () => abortController.abort('Request aborted by client');

    if (req.signal.aborted) {
      abortController.abort('Request already aborted');
    } else {
      req.signal.addEventListener('abort', handleAbort, { once: true });
    }

    const signal = abortController.signal;

    // Check headers first, then fall back to JSON body fields
    const geminiApiKey = req.headers.get('x-gemini-api-key') || body.geminiApiKey || '';

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'No valid API keys were provided.' },
        { status: 400 }
      );
    }

    // Determine target session count accurately
    let targetSessions = 5;
    if (typeof body.numSessions === 'number' && body.numSessions > 0) {
      targetSessions = body.numSessions;
    } else if (formData.noOfSessions) {
      const match = String(formData.noOfSessions).match(/\d+/);
      if (match) targetSessions = parseInt(match[0], 10);
    }
    targetSessions = Math.min(Math.max(targetSessions, 1), 5);

    const cotEnabled = body.includeCotIndicators === true;
    const cotRubric = buildCotRubricGuidance({ teacherName: formData.teacherName });
    const cotAlignmentTemplate = buildCotAlignmentTemplate({ teacherName: formData.teacherName });
    const cotAnnotationInstruction = (code) => (
      cotEnabled ? `Add **(Indicator ${code})** immediately after the observable practice.` : ''
    );

    // ============================================================
    // DepEd ILAW DETAILED LESSON PLAN PROMPT
    // This prompt is model-agnostic and forces detailed output
    // regardless of which AI model is used.
    // ============================================================
    const systemInstruction = `
You are a DepEd Master Teacher and Instructional Design Specialist.
Your task is to generate a COMPLETE, FULLY DETAILED DepEd ILAW Lesson Plan in JSON format, spread across EXACTLY ${targetSessions} session(s).

████████████████████████████████████████████████████████████
MODEL-AGNOSTIC DETAILED OUTPUT REQUIREMENT
████████████████████████████████████████████████████████████

This instruction applies REGARDLESS OF THE AI MODEL YOU ARE. You MUST produce a DETAILED lesson plan, NOT a summary or outline. Every section in every session MUST be filled with rich, substantive, classroom-ready content. No session field should contain a placeholder, an ellipsis ("..."), "TBD", "N/A" (unless truly not applicable), or a brief note.

████████████████████████████████████████████████████████████
ILAW TEMPLATE STRUCTURE (MANDATORY)
████████████████████████████████████████████████████████████

The lesson plan follows this exact DepEd ILAW framework structure:

HEADER (fill from formData):
  - Lesson Title
  - Learning Area/s
  - Name of Teacher/s
  - Grade Level and Section
  - No. of Sessions
  - References
  - Declaration of AI use

CURRICULUM STANDARDS:
  - Learning Competency
  - Content Standards
  - Performance Standards

SESSIONS MATRIX (${targetSessions} columns):
  For EACH session, fill ALL of the following fields with DETAILED content:

  LEARNING OBJECTIVES (KSA format mandatory):
    - Knowledge: [Specific concept recall/understanding objective - MUST include actual content vocabulary]
    - Skills: [Specific observable student action objective]
    - Attitudes: [Specific value/disposition objective]

  LEARNER CONTEXT:
    Write a FULL paragraph (3-5 sentences) describing learners' readiness, prior knowledge, interests, language and accessibility needs, preferred ways to participate, and specific barriers relevant to this session's topic.

  PRE-LESSON:
    Write 2-3 FULL paragraphs describing:
    1. Drill/Review activity with actual content questions and expected answers
    2. Motivation/Hook activity with specific materials and teacher script
    3. Clear statement of session objectives (what learners will achieve today)

  FLOW (CRITICAL - MUST BE EXTREMELY DETAILED):
    Write a FULL instructional script with the following sections. Each section must be a full paragraph with actual dialogue, not bullet points.

    --- 1. Activity / Exploration ---
    **Teacher Says:** [Exact words teacher says to introduce the activity, including guiding questions, instructions, and timing. Write 3-5 sentences.]
    **Learners Do:** [Expected student responses, actions they perform, discussions they have. Write 2-4 sentences.]

    --- 2. Analysis / Direct Instruction ---
    **Teacher Says/Does:** [Step-by-step breakdown: (a) Board work or demonstration with actual numbers/examples, (b) Explicit modeling with think-aloud script, (c) Higher-order thinking questions with expected correct answers. Write 5-8 sentences.]
    **Learners Do:** [Expected note-taking, answering questions, asking clarifying questions. Write 2-4 sentences.]

    --- 3. Guided Practice / Collaboration ---
    **Teacher Says/Does:** [Instructions for group work or partner activity, specific task descriptions, time allocations (e.g., "You have 10 minutes to complete this"), success criteria, rubrics. Write 4-6 sentences.]
    **Learners Do:** [How students work together, what they produce/discuss, presentation expectations. Write 2-4 sentences.]

    --- 4. Independent Practice / Application ---
    **Teacher Says/Does:** [Individual practice task with real-world connection, explicit directions, deadline, and expected output format. Write 3-5 sentences.]
    **Learners Do:** [How students complete independent work, sample answers, self-check process. Write 2-4 sentences.]

  LEARNING RESOURCES:
    List 4-6 specific, concrete instructional materials needed (e.g., "Slide deck with 15 quadratic inequality graphs, printed worksheets with 10 practice items, graphing calculators (1 per pair), whiteboard markers (4 colors), chalk"). Be specific.

  OPPORTUNITIES FOR INTEGRATION:
    Write a FULL paragraph describing at least ONE concrete connection to:
    (a) Another learning area/subject (e.g., Science for graphing projectile motion), AND/OR
    (b) Local community context/cultural relevance, AND/OR
    (c) Technology/digital tools
    Provide a specific example with real numbers/scenarios.

  FORMATIVE ASSESSMENT:
    The output must be a JSON object with these EXACT keys:

    "method": "Name the specific assessment task (e.g., '5-Item Quick Quiz on Quadratic Inequalities')"
    "evidence": "Describe the concrete output to collect from students (e.g., 'Completed quiz worksheet with all solutions shown')"
    "sampleItems": "Write 3-5 actual test items WITH complete answer keys. Format exactly like this example:
    1. Solve: x² + 5x + 6 > 0
       Answer: x < -3 or x > -2 (Explanation: Factor as (x+3)(x+2) > 0, test intervals)

    2. Question 2 here
       Answer: Correct answer with explanation

    3. Question 3 here
       Answer: Correct answer with explanation

    4. Question 4 here
       Answer: Correct answer with explanation

    5. Question 5 here
       Answer: Correct answer with explanation"
    "evidenceOfSuccess": "State target mastery level (e.g., '80% of learners score 4/5 or above; those below receive targeted remediation during extended learning time')"

  EXTENDED LEARNING:
    Write BOTH (a) and (b) below in paragraph form:
    (a) REMEDIATION: A SPECIFIC activity for learners who need additional support (describe exactly what the activity is, what materials they use, and how long it takes)
    (b) ENRICHMENT: A SPECIFIC challenging extension task for advanced learners (describe the task, the problem or prompt, and expected output)

  REFLECTIONS:
    Write 2-3 paragraphs of substantive reflection notes on: anticipated pedagogical effectiveness, learner engagement strategies used, possible challenges anticipated, and planned adjustments for future sessions.

████████████████████████████████████████████████████████████
PEDAGOGICAL REQUIREMENTS
████████████████████████████████████████████████████████████

Integrate the following pedagogical principles THROUGHOUT the entire lesson plan, especially in the 'flow', 'formativeAssessment', and 'learningObjectives' sections:

1.  **Higher-Order Thinking Skills (HOTS):**
    - Move beyond simple recall. All questions, activities, and assessments must target HOTS.
    - Focus on Analyzing (e.g., comparing/contrasting, deconstructing), Evaluating (e.g., critiquing, justifying decisions), and Creating (e.g., designing, producing new work).
    - In the 'flow' section, label higher-order questions clearly (e.g., "Teacher asks (Analysis): 'How does this character's motivation compare to...?'").
    - ${cotAnnotationInstruction('1.5.2')}

2.  **21st-Century Skills:**
    - Explicitly embed the "4Cs" (Critical Thinking, Creativity, Communication, Collaboration) into the activities.
    - In the 'flow' section, briefly note which of the 4Cs is being targeted by a specific activity (e.g., "Learners Do (Collaboration & Communication): Students discuss their findings in groups...").

3.  **DepEd Core Values:**
    - Deliberately integrate the DepEd Core Values: Maka-Diyos, Maka-tao, Makakalikasan, and Makabansa.
    - The "Attitudes" learning objective for each session MUST explicitly name one of these core values.
    - The 'flow' and 'reflections' sections should connect activities and outcomes back to these values where appropriate. For example, a science lesson on ecosystems should connect to 'Makakalikasan'.

4.  **Literacy and Numeracy Integration:**
    - Include at least one reading/writing/vocabulary activity per session. ${cotAnnotationInstruction('1.4.2')}
    - Include at least one numerical/data/mathematical reasoning activity per session. ${cotAnnotationInstruction('1.4.2')}

5.  **Differentiated Instruction:**
    - Include at least one differentiated activity per session based on readiness evidence, accessibility needs, interests, or meaningful choices in representation, participation, and expression. Do not assign learners fixed "learning style" labels. ${cotAnnotationInstruction('3.1.2')}

6.  **Classroom Management:**
    - Include positive, non-violent discipline strategies and learner self-regulation in preLesson and flow. ${cotAnnotationInstruction('2.6.2')}
    - Describe classroom structure and group arrangements for hands-on activities. ${cotAnnotationInstruction('2.3.2')}

████████████████████████████████████████████████████████████
PEDAGOGICAL PROGRESSION ACROSS SESSIONS
████████████████████████████████████████████████████████████

Stretch and sequence the Learning Competency ("${formData.learningCompetency || 'Topic Competency'}") across ${targetSessions} session(s) logically:
${
  targetSessions === 1
    ? '- Session 1: Complete topic coverage from concept introduction to application and evaluation.'
    : targetSessions === 2
    ? '- Session 1: Concept introduction, definitions, foundational skills, and basic examples.\n- Session 2: Deepening, problem-solving, real-world application, and formative evaluation.'
    : targetSessions === 3
    ? '- Session 1: Concept introduction, definitions, and foundational skills with guided practice.\n- Session 2: Procedural fluency, complex problem-solving, and collaborative activities.\n- Session 3: Real-world application, consolidation, and summative evaluation.'
    : targetSessions === 4
    ? '- Session 1: Concept introduction, definitions, and foundational skills.\n- Session 2: Procedural fluency and guided practice with increasing complexity.\n- Session 3: Collaborative problem-solving and real-world application tasks.\n- Session 4: Consolidation, integration, and comprehensive evaluation.'
    : '- Session 1: Concept introduction, definitions, and foundational skills with concrete examples.\n- Session 2: Procedural fluency development with guided and independent practice.\n- Session 3: Complex problem-solving and collaborative activities.\n- Session 4: Real-world applications and cross-curricular integration.\n- Session 5: Consolidation, integration, review, and summative/formative evaluation.'
}

████████████████████████████████████████████████████████████
STRICT OUTPUT RULES
████████████████████████████████████████████████████████████

1. Return ONLY valid raw JSON. Do NOT wrap output in markdown code blocks (\`\`\`json ... \`\`\`).
2. Ensure "sessions" array contains EXACTLY ${targetSessions} items.
3. EVERY field in EVERY session must contain substantive, specific content. No placeholders, no "TBD", no empty strings, no "..." ellipsis marks.
4. The "flow" field must be the MOST DETAILED field - it is the instructional script that teachers will follow step-by-step.
5. The "formativeAssessment" field must be a JSON object with method, evidence, sampleItems, and evidenceOfSuccess.
${cotEnabled
  ? '6. COT annotations must use **(Indicator X.X.X)** and sit immediately after the observable practice they label. Annotations without concrete evidence do not count.'
  : '6. Do not add COT annotations because rubric alignment was not requested.'}
7. Match the language specified: ${formData.language || 'English (Default)'}.

████████████████████████████████████████████████████████████
REQUIRED JSON STRUCTURE
████████████████████████████████████████████████████████████

{
  "header": {
    "lessonTitle": "${formData.lessonName || 'Detailed ILAW Lesson Plan'}",
    "learningArea": "${formData.subject || 'Subject'}",
    "teacherName": "${formData.teacherName || ''}",
    "gradeLevelSection": "${formData.gradeAndSection || ''}",
    "noOfSessions": "${formData.noOfSessions || targetSessions + ' Sessions'}",
    "references": ${JSON.stringify(formData.references || ["DepEd Curriculum Guide", "Learner's Material"])},
    "declarationOfAiUse": "This lesson plan was developed with the assistance of an AI instructional design tool to format, structure, and generate pedagogical content aligned with the DepEd ILAW framework, pursuant to DepEd Order No. 003, s. 2026 (Foundational Guidelines on AI in Basic Education). All AI-generated content was reviewed, contextualized, and approved by the subject teacher prior to implementation."
  },
  "curriculumStandards": {
    "learningCompetency": "${formData.learningCompetency || ''}",
    "contentStandard": "${formData.contentStandards || ''}",
    "performanceStandard": "${formData.performanceStandards || ''}"
  },
  "sessions": [${Array.from({ length: targetSessions }, (_, i) => `
    {
      "sessionNumber": ${i + 1},
      "sessionTitle": "[Descriptive title for Session ${i + 1} based on the learning progression]",
      "learningObjectives": "Knowledge: [Specific knowledge objective with content vocabulary]\\nSkills: [Specific skill objective describing observable student actions]\\nAttitudes: [Specific value objective naming the disposition to develop]",
      "learnerContext": "[Full paragraph: 3-5 sentences describing students' readiness, prior knowledge from previous sessions, interests, language and accessibility needs, preferred ways to participate, and specific barriers relevant to this session. Be specific, not generic.]",
      "preLesson": "[2-3 paragraphs: Warm-up routine with (1) specific drill/review activity including actual questions, (2) motivation activity with materials and teacher script, (3) clear statement of session objectives.]",
      "flow": "### 1. Activity / Exploration\\n**Teacher Says:** [3-5 sentence script with guiding questions, instructions, and timing]\\n**Learners Do:** [2-4 sentences on expected student responses and actions]\\n\\n### 2. Analysis / Direct Instruction\\n**Teacher Says/Does:** [5-8 sentences: board work with actual examples, modeling with think-aloud, higher-order questions with expected answers]\\n**Learners Do:** [2-4 sentences on note-taking, answering questions, participation]\\n\\n### 3. Guided Practice / Collaboration\\n**Teacher Says/Does:** [4-6 sentences: group/partner instructions, task description, time allocations, success criteria]\\n**Learners Do:** [2-4 sentences on collaboration, output produced, presentations]\\n\\n### 4. Independent Practice / Application\\n**Teacher Says/Does:** [3-5 sentences: individual task with real-world connection, directions, expected output]\\n**Learners Do:** [2-4 sentences on independent work, sample answers, self-check]",
      "learningResources": "[List 4-6 specific materials: e.g., 'Slide deck with 15 graphs, printed worksheets (10 items), graphing calculators, whiteboard markers, rulers']",
      "opportunitiesForIntegration": "[Full paragraph: at least one concrete connection to another subject, local context, or technology with specific example]",
      "formativeAssessment": {
        "method": "[Specific assessment task name, e.g., '5-Item Quick Quiz on Solving Quadratic Inequalities']",
        "evidence": "[Concrete output to collect from students, e.g., 'Completed quiz worksheet with all solutions shown']",
        "sampleItems": "1. [Question 1]\\n   Answer: [Correct answer with explanation]\\n\\n2. [Question 2]\\n   Answer: [Correct answer with explanation]\\n\\n3. [Question 3]\\n   Answer: [Correct answer with explanation]\\n\\n4. [Question 4]\\n   Answer: [Correct answer with explanation]\\n\\n5. [Question 5]\\n   Answer: [Correct answer with explanation]",
        "evidenceOfSuccess": "[Target mastery level, e.g., '80% of learners score 4/5 or above; those below receive targeted remediation']"
      },
      "extendedLearning": "REMEDIATION: [Specific activity for struggling learners with materials and instructions]\\n\\nENRICHMENT: [Specific challenging extension task for advanced learners with problem description]",
      "reflections": "[2-3 paragraphs: pedagogical effectiveness, learner engagement, possible challenges, and planned adjustments for future sessions]"
    }`).join(',')}
  ]
}
`;

    const cotInstruction = cotEnabled ? `
████████████████████████████████████████████████████████████
COT FULL-RUBRIC EVIDENCE ALIGNMENT (ANNEX E-1, LEVELS 1-9)
████████████████████████████████████████████████████████████

${cotRubric.guidance}

TRACEABILITY RULES
- Address all nine priority codes: ${COT_PRIORITY_INDICATOR_CODES.join(', ')}.
- Place **(Indicator X.X.X)** immediately after the exact sentence or activity that provides evidence.
- Place 1.1.2 in content explanation or transfer; 1.4.2 in literacy/numeracy strategy use; 1.5.2 in higher-order questioning and creation; 2.3.2 in structure, roles, and exploration; 2.6.2 in positive discipline and self-regulation; 3.1.2 in evidence-based differentiation; 4.1.2 in sequencing and adaptive pathways; 4.5.2 in purposeful resources and ICT; and 5.1.2 in aligned assessment and feedback-driven adjustment.
- Never attach several indicator labels to a generic paragraph. Each label must have its own observable evidence.

REQUIRED COT ALIGNMENT OUTPUT
Add a top-level "cotAlignment" object after "sessions". Use this exact shape and replace every placeholder with lesson-specific evidence:
${JSON.stringify(cotAlignmentTemplate, null, 2)}

Every evidenceMatrix entry must name at least two precise session/field locations, at least two observable teacher-learner practices or products, and a substantive learner-agency action. This report is an evidence map, not a predicted score.
` : '';

    const prompt = `${systemInstruction}${cotInstruction}\nUser Input Data: ${JSON.stringify(formData)}`;

    const pipeline = buildLessonPlanPipeline({
      geminiApiKey,
      geminiModels,
      prompt,
      timeout: 25000,
      maxOutputTokens: 16384,
      signal,
    });

    // Validate both the lesson structure and the rubric evidence map before
    // accepting a model response. Annotation-only output is deliberately rejected.
    const isValid = (parsed) => {
      if (!parsed || !Array.isArray(parsed.sessions) || parsed.sessions.length !== targetSessions) {
        return false;
      }
      if (cotEnabled) {
        const audit = validateCotAlignment(parsed, { teacherName: formData.teacherName });
        if (!audit.valid) {
          console.warn(`[Validation] COT evidence issues: ${audit.issues.join(' | ')}`);
          return false;
        }
      }
      return true;
    };

    const result = await runLessonPlanPipeline(pipeline, {
      isValid,
      maxRetries: 10,
      signal,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'All available API keys and fallback models failed to generate valid content.' },
        { status: 500 }
      );
    }

    console.log(`[Success] Generated Lesson Plan using ${result.provider}`);

    // Validate AI response using Zod with recovery attempts
    let planCandidate = result.data || result.plan || result.lessonPlan;

    // If AI returned a string, try common recovery strategies
    if (typeof planCandidate === 'string') {
      // 1) direct JSON parse
      try {
        planCandidate = JSON.parse(planCandidate);
      } catch {
        // 2) extract first JSON object/array block from string
        const match = planCandidate.match(/([\[{][\s\S]*[\]}])/);
        if (match) {
          try {
            planCandidate = JSON.parse(match[1]);
          } catch {
            // leave as string for validation to fail
          }
        }
      }
    }

    const parsed = PlanSchema.safeParse(planCandidate);
    if (!parsed.success) {
      console.error('Validation failed for AI response:', parsed.error.format());

      return NextResponse.json(
        {
          error: 'AI response validation failed',
          details: parsed.error.errors,
          raw: planCandidate,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ plan: parsed.data, provider: result.provider });

  } catch (error) {
    if (error?.name === 'AbortError' || error?.message === 'Aborted') {
      return NextResponse.json(
        { error: 'Generation aborted.' },
        { status: 499 }
      );
    }

    console.error('Final Route Exception:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while generating the plan.' },
      { status: 500 }
    );
  }
}
