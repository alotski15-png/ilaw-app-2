import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const apiKey = formData.get('apiKey') || '';
    const receiptFile = formData.get('receiptFile');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key provided.' },
        { status: 400 }
      );
    }

    if (!receiptFile) {
      return NextResponse.json(
        { error: 'No receipt image uploaded.' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(receiptFile.type)) {
      return NextResponse.json(
        { error: 'Please upload a valid image file (JPEG, PNG, or WebP).' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const fileBytes = await receiptFile.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    const base64Image = fileBuffer.toString('base64');
    const mimeType = receiptFile.type;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const prompt = `You are a GCash payment receipt verification assistant. Analyze the provided image and determine if it is a legitimate GCash payment receipt.

VERIFICATION CRITERIA:
1. **GCash Branding**: Does the image show clear GCash branding/logo?
2. **Payment Amount**: What amount is shown? Is it exactly or approximately ₱199.00?
3. **Transaction Reference**: Is there a transaction/reference number visible?
4. **Date**: Is there a recent date visible?
5. **Editing Detection**: Look carefully for signs of image manipulation or editing:
   - Inconsistent font rendering or text that doesn't match GCash's standard fonts
   - Pixelation artifacts, especially around text edges
   - Cut-and-paste boundaries or irregular borders
   - Mismatched color profiles or lighting inconsistencies
   - Text that appears to be added/overlaid rather than native to the screenshot
   - Blurry or misaligned elements
   - Shadows or gradients that don't look natural
   - Any signs of Photoshop or image editing software manipulation

OUTPUT FORMAT (JSON only, no markdown or backticks):
{
  "verified": true/false,
  "reason": "A clear, concise explanation of why the receipt was verified or rejected. If rejected, specify exactly what issue was detected (e.g., 'The amount shown is ₱50, not ₱199', 'Image appears to be edited: inconsistent font rendering detected around the amount field', 'No GCash branding visible', etc.).",
  "detectedAmount": "The amount detected in the image, or null if not visible",
  "hasReferenceNumber": true/false,
  "editingDetected": true/false,
  "editingDetails": "If editing was detected, describe what specific signs were found"
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    let parsed;
    try {
      // Clean the response - remove any markdown code block markers if present
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json(
        { error: 'Failed to analyze receipt. Please try again with a clearer image.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      verified: parsed.verified === true,
      reason: parsed.reason || 'Receipt could not be verified.',
      detectedAmount: parsed.detectedAmount || null,
      hasReferenceNumber: parsed.hasReferenceNumber === true,
      editingDetected: parsed.editingDetected === true,
      editingDetails: parsed.editingDetails || '',
      tokensGranted: parsed.verified === true ? 10 : 0,
    });
  } catch (error) {
    console.error('Error in /api/verify-receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify receipt.' },
      { status: 500 }
    );
  }
}