import { NextResponse } from 'next/server';
import { buildLessonPlanPipeline, runLessonPlanPipeline } from '@/lib/ai-providers';
import { z } from 'zod';

const SlideSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  bullets: z.array(z.string().min(1)).min(1),
  speakerNotes: z.string().optional(),
});

const SlideDeckSchema = z.object({
  deckTitle: z.string().min(1),
  subtitle: z.string().optional(),
  slides: z.array(SlideSchema).min(3).max(12),
});

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { lessonPlan, snapshotData, formData, geminiModels, groqModels, openRouterModels } = body;

    const geminiApiKey = req.headers.get('x-gemini-api-key') || body.geminiApiKey || '';
    const groqApiKey = req.headers.get('x-groq-api-key') || body.groqApiKey || '';
    const openRouterApiKey = req.headers.get('x-openrouter-api-key') || body.openRouterApiKey || '';

    if (!geminiApiKey && !groqApiKey && !openRouterApiKey) {
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

    const prompt = `
You are an expert instructional designer and presentation architect.
Create a polished slide deck outline for the lesson plan below.
Return ONLY valid JSON that matches the required structure.

Lesson metadata:
${JSON.stringify({
  formData: formData || {},
  snapshotData: snapshotData || {},
  lessonPlan: lessonSummary,
}, null, 2)}

Requirements:
1. Create a deck title that reflects the lesson topic.
2. Create between 5 and 8 slides.
3. Make the first slide an introduction/title slide.
4. Make the remaining slides cover: learning objectives, lesson flow, classroom activities, formative assessment, and closing or extension.
5. Each slide must have a short title, a concise subtitle, and 3-4 bullets that are classroom-ready and easy to present.
6. Include speaker notes for each slide so a teacher could present naturally.
7. Keep the language clear, concise, and professional.
8. Do not include markdown or code fences.
`;

    const pipeline = buildLessonPlanPipeline({
      geminiApiKey,
      groqApiKey,
      openRouterApiKey,
      geminiModels,
      groqModels,
      openRouterModels,
      prompt,
      timeout: 45000,
      maxOutputTokens: 4000,
      systemPrompt: 'You are a presentation design assistant that outputs structured JSON for educational slide decks.',
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

    return NextResponse.json({ slideDeck: parsedDeck.data });
  } catch (error) {
    console.error('Error generating slide deck:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate slide deck.' },
      { status: 500 }
    );
  }
}
