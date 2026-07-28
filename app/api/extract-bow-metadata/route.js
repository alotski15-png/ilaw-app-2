import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse-fork';
import { buildBowPipeline, runConcurrentPipeline } from '@/lib/ai-providers';
import { z } from 'zod';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const bowFile = formData.get('bowFile');

    if (!bowFile) {
      return NextResponse.json(
        { error: 'No Budget of Work (BOW) file uploaded.' },
        { status: 400 }
      );
    }

    // API keys are needed for AI processing
    const apiKey = formData.get('apiKey');
    const groqApiKey = formData.get('groqApiKey');
    const openRouterApiKey = formData.get('openRouterApiKey');
    if (!apiKey && !groqApiKey && !openRouterApiKey) {
      return NextResponse.json({ error: 'No valid API keys were provided.' }, { status: 400 });
    }

    const fileBytes = await bowFile.arrayBuffer();
    const pdfData = await pdfParse(Buffer.from(fileBytes));
    const pdfText = pdfData?.text || '';

    if (!pdfText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from PDF.' }, { status: 400 });
    }

    const trimmedPdfText = pdfText.slice(0, 30000);

    const prompt = `
You are an expert DepEd Curriculum Specialist.
Analyze the provided Budget of Work (BOW) document text and identify all unique "Term" (e.g., "Term 1", "First Term", "Quarter 1") and "Week" (e.g., "Week 1", "Week 2-3", "Week 5") entries mentioned.

Prioritize standard "Term X" and "Week Y" formats. If "Quarter X" is found, convert it to "Term X".
If week ranges like "Week 2-3" or "Weeks 4 and 5" are found, expand them into individual weeks: "Week 2", "Week 3".
Ensure the lists are ordered numerically and contain only unique entries.

DOCUMENT TEXT CONTENT:
"""
${trimmedPdfText}
"""

OUTPUT FORMAT REQUIREMENT:
Output ONLY valid JSON. Do NOT include markdown blocks, text explanation, or backticks.

JSON SCHEMA:
{
  "terms": ["Term 1", "Term 2", "Term 3", "Term 4"],
  "weeks": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10"]
}
`;

    // Build pipeline using all Gemini models except 3.6 and 3.5.
    // The recent model (gemini-3.1-pro-preview) gets a dedicated 10-loop retry.
    // While the recent model is generating/retrying, other models run concurrently.
    const pipeline = buildBowPipeline({
      geminiApiKey: apiKey,
      prompt,
      timeout: 15000,
      maxOutputTokens: 500,
      systemPrompt: 'You are an expert DepEd curriculum designer. Output valid JSON only.',
    });

    // Validator: ensure the parsed result has terms and/or weeks arrays.
    const isValid = (parsed) => {
      if (!parsed || typeof parsed !== 'object') return false;
      const hasTerms = Array.isArray(parsed.terms);
      const hasWeeks = Array.isArray(parsed.weeks);
      return hasTerms || hasWeeks;
    };

    const result = await runConcurrentPipeline(pipeline, { isValid, maxRetries: 10 });

    if (!result) {
      return NextResponse.json({ error: 'AI failed to process the document after multiple attempts with different models.' }, { status: 500 });
    }

    console.log(`[Success] Generated using ${result.provider}`);

    let metadataCandidate = result.data;
    if (typeof metadataCandidate === 'string') {
      try {
        metadataCandidate = JSON.parse(metadataCandidate.match(/\{[\s\S]*\}/)?.[0] || '{}');
      } catch (e) {
        return NextResponse.json({ error: 'AI returned invalid JSON.' }, { status: 502 });
      }
    }

    const BowMetadataSchema = z.object({
      terms: z.array(z.string()).optional().default([]),
      weeks: z.array(z.string()).optional().default([]),
    });

    const parsed = BowMetadataSchema.safeParse(metadataCandidate);
    if (!parsed.success) {
      return NextResponse.json({ error: 'AI metadata validation failed', details: parsed.error.format() }, { status: 502 });
    }

    const processedTerms = Array.from(new Set(parsed.data.terms.map(t => t.replace(/Quarter/i, 'Term'))))
      .sort((a, b) => (a.match(/\d+$/)?.[0] || 0) - (b.match(/\d+$/)?.[0] || 0));

    const processedWeeks = parsed.data.weeks;

    return NextResponse.json({ terms: processedTerms, weeks: processedWeeks });

  } catch (error) {
    console.error('Error in /api/extract-bow-metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract BOW metadata.' },
      { status: 500 }
    );
  }
}
