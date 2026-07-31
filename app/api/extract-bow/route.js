import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse-fork';
import { buildAllProvidersBowPipeline, runConcurrentPipeline } from '@/lib/ai-providers';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const formData = await req.formData();

    // Check headers first, then fall back to form data
    const geminiApiKey = req.headers.get('x-gemini-api-key') || formData.get('apiKey') || '';
    const geminiModels = JSON.parse(formData.get('geminiModels') || '[]');
    const term = formData.get('term') || 'Term 1';
    const week = formData.get('week') || 'Week 5';
    const subject = formData.get('subject') || '';
    const bowFile = formData.get('bowFile');

    if (!bowFile) {
      return NextResponse.json(
        { error: 'No Budget of Work (BOW) file uploaded.' },
        { status: 400 }
      );
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'No valid API keys were provided.' },
        { status: 400 }
      );
    }

    const weekNumMatch = week.toString().match(/\d+$/);
    const targetWeekNum = weekNumMatch ? parseInt(weekNumMatch[0], 10) : 1;

    // Extract PDF Text
    const fileBytes = await bowFile.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. Ensure it is searchable.' },
        { status: 400 }
      );
    }

    const trimmedPdfText = pdfText.slice(0, 30000);

    const prompt = `
You are an expert DepEd Curriculum Specialist and Budget of Work (BOW) Partitioning Engine.
Analyze the provided Budget of Work (BOW) document text and accurately isolate the competencies for ${subject || 'the target subject'}.

TARGET USER INPUT:
- Selected Term / Quarter: ${term}
- Selected Target Week: ${week} (Week Number: ${targetWeekNum})

DOCUMENT TEXT CONTENT:
"""
${trimmedPdfText}
"""

PARTITIONING LOGIC & RULES:
1. **Term Filtering**: Locate the section corresponding ONLY to "${term}" (e.g., First Term, Second Term, etc.). Ignore all other terms.
2. **Multi-Week Range Detection**:
   - Check if the target week (Week ${targetWeekNum}) is part of a grouped multi-week range in the document (e.g., "Weeks 5 to 6", "Weeks 3 to 4", "Weeks 7 to 8").
   - If it is part of a range (e.g. Weeks 5 to 6):
     * List ALL the competencies listed inside that multi-week block sequentially.
     * **Week 5 (First half of range)**: Assign ONLY the foundational concepts, definitions, illustrations, basic representations, and single-variable equations/inequalities.
     * **Week 6 (Latter half of range)**: EXCLUDE all competencies already established in Week 5. Assign ONLY the remaining advanced competencies, such as multi-variable systems, word problems, and applications.
3. **Strict Non-Overlap Guarantee**:
   - If the user selects Week 5, do NOT include problem-solving or multi-variable competencies intended for Week 6.
   - If the user selects Week 6, do NOT include the basic illustration or foundational single-variable items assigned to Week 5.
4. **CRITICAL: Standards Must Match Only the Isolated Competency (NOT the Entire Term)**:
   - Look at the Content Standard and Performance Standard written directly above or adjacent to the specific learning competency/ies isolated for **${week}**.
   - Extract ONLY the Content Standard and Performance Standard that directly governs that specific learning competency.
   - DO NOT list the entire Content Standard or Performance Standard for the whole Term. Only the sentence or phrase that directly applies to the isolated competency.
   - If the document has a single Content Standard for the whole term, extract only the relevant portion/clause that covers the isolated competency, not the full multi-sentence standard.
   - Example: If the Term's Content Standard is "Demonstrates understanding of... quadratic equations, quadratic inequalities, and linear inequalities" but Week 5 only covers "quadratic inequalities", then output only the part about "quadratic inequalities".
5. **CRITICAL BULLET FORMATTING RULE**:
   - If there are MULTIPLE learning competencies, content standards, or performance standards, DO NOT join them with commas or write them as a single continuous sentence.
   - Separate every distinct item into a markdown bullet point starting with a dash (e.g., "- First item\\n- Second item").
   - Single items can remain plain text without a bullet dash.

OUTPUT FORMAT REQUIREMENT:
Output ONLY valid JSON. Do NOT include markdown blocks, text explanation, or backticks.

JSON SCHEMA:
{
  "learningCompetency": "If multiple competencies exist, format strictly as a bulleted list separated by newlines (e.g. \\"- Item 1\\\\n- Item 2\\"). Never use comma concatenation.",
  "contentStandard": "If multiple standards exist, format strictly as a bulleted list separated by newlines (e.g. \\"- Item 1\\\\n- Item 2\\"). Never use comma concatenation.",
  "performanceStandard": "If multiple standards exist, format strictly as a bulleted list separated by newlines (e.g. \\"- Item 1\\\\n- Item 2\\"). Never use comma concatenation."
}
`;

    // Build pipeline using all available Gemini models (latest-first).
    // Only Gemini is used as the sole AI provider.
    const pipeline = buildAllProvidersBowPipeline({
      geminiApiKey,
      geminiModels,
      prompt,
      timeout: 12000,
      maxOutputTokens: 2000,
      systemPrompt: 'You are an expert DepEd curriculum designer. Output valid JSON only.',
    });

    // Validator: ensure the parsed result has at least one of the expected fields.
    const isValid = (parsed) => {
      if (!parsed || typeof parsed !== 'object') return false;
      return (
        typeof parsed.learningCompetency === 'string' ||
        typeof parsed.contentStandard === 'string' ||
        typeof parsed.performanceStandard === 'string'
      );
    };

    const result = await runConcurrentPipeline(pipeline, { isValid, maxRetries: 10 });

    if (!result) {
      return NextResponse.json(
        { error: 'Unable to process request with provided API key(s) and backup models.' },
        { status: 500 }
      );
    }

    console.log(`[Success] Generated using ${result.provider}`);

    return NextResponse.json(result.data);

  } catch (error) {
    console.error('Error in /api/extract-bow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract standards from PDF.' },
      { status: 500 }
    );
  }
}