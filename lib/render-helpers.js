'use client';

// lib/render-helpers.js
// JSX helpers used to display AI-generated content safely, whatever shape it comes in.

export function renderBoldText(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function formatFormattedText(text) {
  if (typeof text !== 'string') return text;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const elements = [];

  lines.forEach((line, idx) => {
    let cleanLine = line;

    if (cleanLine.startsWith('###')) {
      cleanLine = cleanLine.replace(/^###\s*/, '');
      elements.push(
        <h4 key={`head-${idx}`} className="font-bold text-slate-800 text-sm mt-2 mb-1">
          {renderBoldText(cleanLine)}
        </h4>
      );
      return;
    }

    cleanLine = cleanLine.replace(/^[-*•]\s*/, '');

    elements.push(
      <div key={`text-${idx}`} className="my-0.5 leading-relaxed">
        {renderBoldText(cleanLine)}
      </div>
    );
  });

  return elements;
}

export function renderSafeContent(content, isStandardList = false) {
  if (content === null || content === undefined) return null;

  if (typeof content === 'string') {
    const trimmed = content.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return renderSafeContent(parsed, isStandardList);
        }
      } catch (e) {}
    }

    return <div className="space-y-1">{formatFormattedText(content)}</div>;
  }

  if (typeof content === 'number') {
    return <div className="whitespace-pre-wrap leading-relaxed">{content}</div>;
  }

  if (Array.isArray(content)) {
    return (
      <div className="space-y-1 text-xs sm:text-sm text-slate-700">
        {content.map((item, idx) => (
          <div key={idx} className="leading-snug">
            {typeof item === 'object'
              ? renderSafeContent(item, isStandardList)
              : renderBoldText(String(item).replace(/^•\s*/, ''))}
          </div>
        ))}
      </div>
    );
  }

  if (typeof content === 'object') {
    return (
      <div className="space-y-2 text-xs sm:text-sm">
        {Object.entries(content).map(([key, val]) => (
          <div key={key} className="border-b border-slate-100 pb-1 last:border-none">
            <span className="font-bold text-slate-800 capitalize">
              {key.replace(/([A-Z])/g, ' $1')}:{' '}
            </span>
            <div className="mt-0.5 text-slate-700">{renderSafeContent(val, isStandardList)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(content);
}
