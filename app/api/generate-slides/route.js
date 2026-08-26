import { NextResponse } from 'next/server';
import {
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  generateImage,
} from '@/lib/ai-providers';
import {
  filterImageGenerationModels,
  filterNotebookLMCompatible,
  NANO_BANANA_PRO_MODEL,
} from '@/lib/model-sorter';
import {
  SlideDeckSchema,
  buildSlideDeckPrompt,
  buildVisualAssetPrompt,
  clampSlideCount,
  getSlideDeckQualityIssues,
  mapWithConcurrency,
  slideNeedsVisual,
} from '@/lib/slide-deck';

export const runtime = 'nodejs';

function prioritizeCreativeModels(models) {
  const compatible = filterNotebookLMCompatible(models);
  return [...compatible].sort((left, right) => {
    const leftScore = /gemini-3(\.|-|$)/i.test(left) ? 2 : 0;
    const rightScore = /gemini-3(\.|-|$)/i.test(right) ? 2 : 0;
    return rightScore - leftScore;
  });
}

function selectImageModel(models) {
  const imageModels = filterImageGenerationModels(models);
  const preferred = imageModels.find((model) => /gemini-3|nano-banana/i.test(model));
  return preferred || imageModels[0] || NANO_BANANA_PRO_MODEL;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      lessonPlan,
      snapshotData = {},
      formData = {},
      geminiModels = [],
      sessionIndex = 0,
      designStyle = 'Modern Educational',
      additionalPrompt = '',
    } = body;

    const geminiApiKey = req.headers.get('x-gemini-api-key') || body.geminiApiKey || '';
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'No valid Gemini API key was provided.' },
        { status: 400 }
      );
    }

    if (!lessonPlan || !Array.isArray(lessonPlan.sessions) || lessonPlan.sessions.length === 0) {
      return NextResponse.json(
        { error: 'Generate a structured lesson plan before creating a slide deck.' },
        { status: 400 }
      );
    }

    const requestedSlideCount = clampSlideCount(body.slideCount);
    const safeSessionIndex = Math.min(
      lessonPlan.sessions.length - 1,
      Math.max(0, Number.parseInt(String(sessionIndex), 10) || 0)
    );
    const selectedSession = lessonPlan.sessions[safeSessionIndex] || lessonPlan.sessions[0];
    const gradeLevel = snapshotData.gradeAndSection || formData.gradeAndSection || 'General';
    const subject = snapshotData.subject || formData.subject || 'Subject';
    const term = snapshotData.term || formData.term || '';
    const week = snapshotData.week || formData.week || '';
    const availableModels = Array.isArray(geminiModels) ? geminiModels : [];
    const prioritizedModels = prioritizeCreativeModels(availableModels);

    if (prioritizedModels.length === 0) {
      return NextResponse.json(
        { error: 'No compatible Gemini text model is available for slide planning.' },
        { status: 400 }
      );
    }

    const prompt = buildSlideDeckPrompt({
      selectedSession,
      gradeLevel,
      subject,
      term,
      week,
      slideCount: requestedSlideCount,
      designStyle,
      additionalPrompt,
    });

    const pipeline = buildLessonPlanPipeline({
      geminiApiKey,
      geminiModels: prioritizedModels,
      prompt,
      timeout: 60000,
      maxOutputTokens: Math.max(6500, requestedSlideCount * 450),
    });

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (candidate) => (
        SlideDeckSchema.safeParse(candidate).success &&
        getSlideDeckQualityIssues(candidate, requestedSlideCount).length === 0
      ),
      maxRetries: 5,
    });

    if (!result?.data) {
      throw new Error(
        'The AI could not produce a valid narrative slide deck. Try a shorter deck or simplify the additional instructions.'
      );
    }

    const parsedDeck = SlideDeckSchema.safeParse(result.data);
    if (!parsedDeck.success) {
      throw new Error('The AI returned an invalid slide-deck structure.');
    }

    const imageModel = selectImageModel(availableModels);
    let generatedVisualCount = 0;
    const requestedVisualCount = parsedDeck.data.slides.filter(slideNeedsVisual).length;

    const slidesWithVisuals = await mapWithConcurrency(
      parsedDeck.data.slides,
      3,
      async (slide) => {
        if (!slideNeedsVisual(slide)) return slide;

        try {
          const imageUrl = await generateImage(
            geminiApiKey,
            imageModel,
            buildVisualAssetPrompt({
              slide,
              deck: parsedDeck.data,
              gradeLevel,
              subject,
            }),
            { timeout: 60000 }
          );

          if (!imageUrl) return slide;
          generatedVisualCount += 1;
          return {
            ...slide,
            generatedImageUrl: imageUrl,
            visualGenerated: true,
          };
        } catch (error) {
          console.warn(
            '[Slide Generation] Visual generation failed for "' + slide.title + '":',
            error.message
          );
          return {
            ...slide,
            visualGenerated: false,
          };
        }
      }
    );

    return NextResponse.json({
      slideDeck: {
        ...parsedDeck.data,
        slides: slidesWithVisuals,
        generation: {
          planner: result.provider,
          imageModel,
          requestedVisualCount,
          generatedVisualCount,
          editablePowerPoint: true,
        },
      },
    });
  } catch (error) {
    console.error('Error generating slide deck:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate slide deck.' },
      { status: 500 }
    );
  }
}
