import { NextResponse } from 'next/server';
import { getAllMetrics } from '@/lib/metrics';

export const runtime = 'nodejs';

function metricsToPrometheus(metrics) {
  const lines = [];
  // primary validation failure metric
  lines.push('# HELP ilaw_validation_failures_total Number of AI response validation failures');
  lines.push('# TYPE ilaw_validation_failures_total counter');
  const base = metrics['validation_failures'] || 0;
  lines.push(`ilaw_validation_failures_total ${base}`);

  // provider-specific breakdowns
  for (const key of Object.keys(metrics)) {
    if (key.startsWith('validation_failures:provider:')) {
      const provider = key.split(':').slice(2).join(':');
      const value = metrics[key] || 0;
      const esc = String(provider).replace(/"/g, '\\"');
      lines.push(`ilaw_validation_failures_total{provider="${esc}"} ${value}`);
    }
  }

  // expose any other metrics under ilaw_ prefix as gauges
  for (const key of Object.keys(metrics)) {
    if (key === 'validation_failures') continue;
    if (key.startsWith('validation_failures:provider:')) continue;
    if (key.startsWith('validation_failures')) continue;
    const safeName = ('ilaw_' + key.replace(/[:\\/\s]+/g, '_')).replace(/[^a-zA-Z0-9_]/g, '');
    lines.push(`# TYPE ${safeName} gauge`);
    lines.push(`${safeName} ${metrics[key]}`);
  }

  return lines.join('\n') + '\n';
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || '';
    const metrics = await getAllMetrics();

    if (format === 'prometheus') {
      const text = metricsToPrometheus(metrics);
      return new NextResponse(text, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
      });
    }

    return NextResponse.json({ metrics });
  } catch (e) {
    console.error('Metrics route error', e);
    return NextResponse.json({ error: 'Failed to read metrics' }, { status: 500 });
  }
}
