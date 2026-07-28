import { NextResponse } from 'next/server';
import { setEphemeralKeys } from '@/lib/ephemeral-keys';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { geminiApiKey, groqApiKey, openRouterApiKey, ttl } = body;

    if (!geminiApiKey && !groqApiKey && !openRouterApiKey) {
      return NextResponse.json({ error: 'No API keys provided.' }, { status: 400 });
    }

    const { token, expiresAt } = await setEphemeralKeys({ geminiApiKey, groqApiKey, openRouterApiKey }, ttl || 600);

    return NextResponse.json({ token, expiresAt });
  } catch (err) {
    console.error('session-keys error', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
