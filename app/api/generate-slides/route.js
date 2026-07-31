import { NextResponse } from 'next/server';
import { buildLessonPlanPipeline, runLessonPlanPipeline, generateImage } from '@/lib/ai-providers';
import { filterImageGenerationModels, NANO_BANANA_PRO_MODEL } from '@/lib/model-sorter';
import { z } from 'zod';

const SlideSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  bullets: z.array(z.string().min(1)).min(1),
  speakerNotes: z.string().optional(),
  imageQuery: z.string().optional(),
  imageDescription: z.string().optional(),
  layout: z.enum(['title', 'content', 'activity', 'image-focus', 'summary']).default('content'),
  accentColor: z.string().optional(),
});

const SlideDeckSchema = z.object({
  deckTitle: z.string().min(1),
  subtitle: z.string().optional(),
  slides: z.array(SlideSchema).min(15).max(30),
  themeColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }).optional(),
});

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { lessonPlan, snapshotData, formData, geminiModels, sessionIndex, slideCount, designStyle, additionalPrompt } = body;

    const geminiApiKey = req.headers.get('x-gemini-api-key') || body.geminiApiKey || '';

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'No valid API keys were provided.' },
        { status: 400 }
      );
    }

    const lessonSummary = {
      header: lessonPlan?.header || {},
      curriculumStandards: lessonPlan?.curriculumStandards || {},
      sessions: (lessonPlan?.sessions || []).map((session) => ({
        sessionTitle: session?.sessionTitle || '',
        learningObjectives: session?.learningObjectives || '',
        learnerContext: session?.learnerContext || '',
        preLesson: session?.preLesson || '',
        flow: session?.flow || '',
        learningResources: session?.learningResources || '',
        opportunitiesForIntegration: session?.opportunitiesForIntegration || '',
        formativeAssessment: session?.formativeAssessment || '',
        extendedLearning: session?.extendedLearning || '',
      })),
    };

    const selectedSession = lessonSummary.sessions?.[sessionIndex] || lessonSummary.sessions?.[0] || {};
    const gradeLevel = snapshotData?.gradeAndSection || formData?.gradeAndSection || '';
    const subject = snapshotData?.subject || formData?.subject || '';
    const term = snapshotData?.term || formData?.term || '';
    const week = snapshotData?.week || formData?.week || '';

    // Extract grade number for age-appropriate content
    const gradeNumMatch = gradeLevel.match(/\d+/);
    const gradeNum = gradeNumMatch ? parseInt(gradeNumMatch[0], 10) : 0;
    const isElementary = gradeNum > 0 && gradeNum <= 6;
    const isJuniorHigh = gradeNum >= 7 && gradeNum <= 10;
    const isSeniorHigh = gradeNum >= 11 && gradeNum <= 12;

    // Determine subject category for visual suggestions
    const subjectLower = subject.toLowerCase();
    const isSTEM = /math|science|physics|chemistry|biology|earth|calculus|statistics/i.test(subjectLower);
    const isLanguage = /english|filipino|reading|writing|literature|grammar/i.test(subjectLower);
    const isSocial = /social|history|araling|panlipunan|economics|culture/i.test(subjectLower);
    const isArts = /arts|music|pe|physical|education|esp|values/i.test(subjectLower);
    const isTech = /technology|computer|ict|tle|home|economics/i.test(subjectLower);

    const prompt = `
You are an expert instructional designer and presentation architect specializing in educational slide decks for DepEd teachers.
Create a visually engaging, classroom-ready slide deck outline for the lesson below.
Return ONLY valid JSON that matches the required structure.

LESSON CONTEXT:
Subject: ${subject}
Grade Level: ${gradeLevel}
Term: ${term}
Week: ${week}
Design Style: ${designStyle || 'Modern Educational'}

SELECTED SESSION CONTENT:
${JSON.stringify({
  sessionTitle: selectedSession.sessionTitle || '',
  learningObjectives: selectedSession.learningObjectives || '',
  learnerContext: selectedSession.learnerContext || '',
  preLesson: selectedSession.preLesson || '',
  flow: selectedSession.flow || '',
  learningResources: selectedSession.learningResources || '',
  opportunitiesForIntegration: selectedSession.opportunitiesForIntegration || '',
  formativeAssessment: selectedSession.formativeAssessment || '',
  extendedLearning: selectedSession.extendedLearning || '',
}, null, 2)}

${additionalPrompt ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${additionalPrompt}\n` : ''}

REQUIREMENTS:
1. Create a deck title that reflects the lesson topic and grade level.
2. Create exactly ${slideCount || 20} slides (minimum 15, maximum 30).
3. Make the first slide an introduction/title slide with the lesson title and a brief overview.
4. Structure the remaining slides using ONLY these sections:
   - Topic Title
   - Objective of the Day
   - Learning Experience
   - Ways Forward
5. EXCLUDE: Learning Resources, unnecessary titles, codes, or headers beyond the specified sections.
6. Each slide must have:
   - A short, clear title
   - A concise subtitle (optional)
   - 3-5 bullets that are classroom-ready and easy to present
   - Speaker notes for the teacher
   - An imageQuery: a specific search query for a high-quality image that directly relates to the slide content (e.g., "students doing group activity", "quadratic equation graph", "Filipino flag")
   - An imageDescription: a brief description of what the image should show
   - A layout type: one of "title", "content", "activity", "image-focus", "summary"
   - An accentColor: a hex color code (without #) that matches the slide's theme (e.g., "1B365D" for navy, "F59E0B" for amber)
7. CONTENT RULES:
   - Use the exact words from the provided lesson content.
   - Do NOT mention "the teacher" or "the learner".
   - Frame all actions as simple instruction/direction statements (e.g., "Instruction: Read the passage." or "Direction: Complete the table.").
   - Use Filipino Language if the lesson plan is in Filipino, otherwise use English.
   - Include every specific part of the lesson with full details.
   - For every activity within the Learning Experience, place the correct answers on the slide immediately following that activity.
8. VISUAL DESIGN RULES:
   - Suggest images that are age-appropriate for ${gradeLevel} (${isElementary ? 'Elementary' : isJuniorHigh ? 'Junior High' : isSeniorHigh ? 'Senior High' : 'General'} level).
   - For ${isSTEM ? 'STEM subjects' : isLanguage ? 'Language subjects' : isSocial ? 'Social Studies' : 'this subject'}, suggest diagrams, charts, or visual aids that help explain concepts.
   - Use "image-focus" layout for slides where a visual is the primary learning tool (e.g., diagrams, illustrations, charts).
   - Use "activity" layout for slides with hands-on tasks or group work.
   - Use "summary" layout for review or wrap-up slides.
   - Maintain the ${designStyle || 'Modern Educational'} aesthetic throughout.
   - Make the final result polished, engaging, and age-appropriate for ${gradeLevel}.
9. THEME COLORS:
   - Provide a themeColors object with primary, secondary, accent, background, and text colors.
   - Choose colors that match the ${designStyle || 'Modern Educational'} style and are appropriate for ${gradeLevel}.
   - For elementary grades, use brighter, more playful colors.
   - For high school, use more professional, muted colors.
10. Do not include markdown or code fences in the output.
11. Return ONLY valid JSON matching the schema.

JSON SCHEMA:
{
  "deckTitle": "string",
  "subtitle": "string (optional)",
  "themeColors": {
    "primary": "hex color without #",
    "secondary": "hex color without #",
    "accent": "hex color without #",
    "background": "hex color without #",
    "text": "hex color without #"
  },
  "slides": [
    {
      "title": "string",
      "subtitle": "string (optional)",
      "bullets": ["string", "string", ...],
      "speakerNotes": "string (optional)",
      "imageQuery": "specific image search query",
      "imageDescription": "brief description of the image",
      "layout": "title" | "content" | "activity" | "image-focus" | "summary",
      "accentColor": "hex color without #"
    }
  ]
}
`;

    // Prioritize Gemini 3 as the "creative agent" for slide structure and content
    // Gemini 3 acts as the creative agent that analyzes and synthesizes the lesson plan
    // to draft the presentation structure, write slide copy, and determine visual metaphors
    const { filterNotebookLMCompatible, getPrimaryModel } = await import('@/lib/model-sorter');
    
    // First try Gemini 3 models, then fall back to other compatible models
    const gemini3Models = filterNotebookLMCompatible(geminiModels).filter(m => m.startsWith('gemini-3'));
    const fallbackModels = filterNotebookLMCompatible(geminiModels).filter(m => !m.startsWith('gemini-3'));
    const prioritizedModels = [...gemini3Models, ...fallbackModels];
    
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey,
      geminiModels: prioritizedModels.length > 0 ? prioritizedModels : geminiModels,
      prompt,
      timeout: 45000,
      maxOutputTokens: 4000,
    });

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => SlideDeckSchema.safeParse(parsed).success,
      maxRetries: 5,
    });

    if (!result?.data) {
      throw new Error('The AI service did not return a valid slide deck response.');
    }

    const parsedDeck = SlideDeckSchema.safeParse(result.data);
    if (!parsedDeck.success) {
      throw new Error('The AI service returned an invalid slide deck structure.');
    }

    // Use only Gemini 3 Pro Image and 3.1 Flash Image for visual rendering
    // These models create rendered, visually rich slides with full-slide images
    const gemini3ImageModels = geminiModels.filter(m => {
      const lower = m.toLowerCase();
      return lower.includes('gemini-3') && (lower.includes('image') || lower.includes('flash'));
    });
    
    // Fallback to any image generation model if Gemini 3 image models not available
    const imageModels = gemini3ImageModels.length > 0 
      ? gemini3ImageModels 
      : filterImageGenerationModels(geminiModels);
    const imageModel = imageModels.length > 0 ? imageModels[0] : NANO_BANANA_PRO_MODEL;
    
    // Generate full-slide images in Full HD (1920x1080) to reduce token input
    const slidesWithImages = await Promise.all(
      parsedDeck.data.slides.map(async (slide) => {
        // Generate a full-slide image prompt that encompasses the entire slide content
        const fullSlidePrompt = `Create a complete, polished educational slide in Full HD (1920x1080) for ${gradeLevel} ${subject} class.
        
Slide Title: ${slide.title}
${slide.subtitle ? `Subtitle: ${slide.subtitle}` : ''}

Content:
${slide.bullets.map((bullet, i) => `${i + 1}. ${bullet}`).join('\n')}

${slide.speakerNotes ? `Teacher Notes: ${slide.speakerNotes}` : ''}

Style: ${designStyle || 'Modern Educational'}
${slide.layout === 'activity' ? 'Layout: Activity/Hands-on learning' : ''}
${slide.layout === 'summary' ? 'Layout: Summary/Review' : ''}
${slide.layout === 'image-focus' ? 'Layout: Visual/Diagram focused' : ''}

Requirements:
- Design a complete, professional educational slide
- Include all text content clearly visible and well-formatted
- Use appropriate colors and visual hierarchy
- Make it classroom-ready and engaging for students
- Full HD resolution (1920x1080)
- No watermarks or external branding`;

        try {
          console.log(`[Slide Generation] Generating full-slide image for: "${slide.title}" using model: ${imageModel}`);
          
          // Generate the full slide as a single rendered image
          const imageUrl = await generateImage(geminiApiKey, imageModel, fullSlidePrompt, {
            timeout: 45000, // Longer timeout for full slide generation
          });

          if (imageUrl) {
            console.log(`[Slide Generation] Successfully generated full-slide image for: "${slide.title}"`);
          } else {
            console.warn(`[Slide Generation] No image returned for slide: "${slide.title}"`);
          }

          // Return slide with full-slide image - the image will occupy the entire slide
          return {
            ...slide,
            generatedImageUrl: imageUrl,
            isFullSlideImage: true, // Flag to indicate this is a full-slide render
          };
        } catch (err) {
          console.warn(`[Slide Generation] Failed to generate full-slide image for "${slide.title}":`, err.message);
          // Return slide without image on failure - will use text-based layout
          return slide;
        }
      })
    );

    return NextResponse.json({ 
      slideDeck: {
        ...parsedDeck.data,
        slides: slidesWithImages,
      } 
    });
  } catch (error) {
    console.error('Error generating slide deck:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate slide deck.' },
      { status: 500 }
    );
  }
}