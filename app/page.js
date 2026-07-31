'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { mapIndicatorToOrdinal, COT_INDICATORS } from '@/lib/cot-indicators';
import { showToast } from './components/Toast';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Download, 
  FileText, 
  HeartHandshake, 
  Copy, 
  X, 
  Check, 
  ShieldCheck,
  UploadCloud,
  Lightbulb,
  Presentation,
  Lock,
  Key,
  Shield,
  Image as ImageIcon
} from 'lucide-react';

import ApiKeyInstructionsModal from './components/ApiKeyInstructionsModal';
import ApiKeyPanel from './components/ApiKeyPanel'; // Import the ApiKeyPanel component
import {
  buildSessionTable,
  buildSignatoriesTable,
  createCell,
  createBorderSet,
  formatDocxText,
  TEMPLATE_BORDER_COLOR_HEADER,
  TEMPLATE_BORDER_COLOR_MATRIX,
  TEMPLATE_HEADER_CELL_MARGINS,
  TEMPLATE_MATRIX_CELL_MARGINS,
  TEMPLATE_BANNER_CELL_MARGINS,
  TEMPLATE_TABLE_CELL_MARGINS,
  TEMPLATE_BORDER_SIZE,
} from '../lib/docx-helpers';

// Custom Minimalist Glowing Oil Lamp Logo with Flame-Book & AI Star
const IlawLogo = ({ className = "w-10 h-10" }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    {/* Glowing Background Effect */}
    <div className="absolute inset-0 bg-[#F59E0B]/20 blur-xl rounded-full animate-pulse" />
    
    {/* Base Lamp Structure */}
    <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 overflow-visible">
      <defs>
        <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B365D" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* Oil Lamp Body Base */}
      <path
        d="M20,70 C20,60 35,55 50,55 C65,55 80,60 80,70 C80,80 65,85 50,85 C35,85 20,80 20,70 Z"
        fill="url(#navyGradient)"
        stroke="#F59E0B"
        strokeWidth="3"
      />
      {/* Lamp Spout & Handle */}
      <path
        d="M25,65 C15,62 10,50 18,42 C22,38 28,42 27,48"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Flame Stylized as Open Book / Quill */}
      <path
        d="M50,15 C50,15 35,32 38,48 C40,54 46,55 50,50 C54,55 60,54 62,48 C65,32 50,15 50,15 Z"
        fill="url(#amberGradient)"
        className="drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
      />
      {/* Book Center Fold Line inside Flame */}
      <path
        d="M50,22 L50,48"
        stroke="#1B365D"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>

    {/* Sparkles / AI Star floating near the top of the flame */}
    <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 z-20 animate-bounce" />
  </div>
);



const parseNameAndDesignation = (rawInput, defaultName, defaultDesignation) => {
  const input = rawInput || defaultName || '';
  if (input.includes(',')) {
    const parts = input.split(',');
    const name = parts[0].trim();
    const designation = parts.slice(1).join(',').trim();
    return { name, designation };
  }
  return { name: input.trim(), designation: defaultDesignation || '' };
};

const getOnlyName = (rawInput) => {
  if (!rawInput) return '';
  const parsed = parseNameAndDesignation(rawInput);
  return parsed.name;
};

const hasMissingDesignation = (input) => {
  if (!input || !input.trim()) return false;
  const parts = input.split(',');
  return parts.length < 2 || !parts[1].trim();
};

const renderBoldText = (text) => {
  if (typeof text !== 'string') return text;

  // Only strip markdown list markers (single * or - followed by space) at line starts
  // but NOT double asterisks (**) which are bold markers
  const cleaned = text
    .replace(/^\*\s(?=\S)/gm, '')  // strip "* item" at line start
    .replace(/^-\s(?=\S)/gm, '')    // strip "- item" at line start
    .replace(/^•\s*/gm, '');         // strip "• item" at line start

  const parts = cleaned.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const innerText = part.slice(2, -2);
      const isIndicator = innerText.startsWith('(Indicator');
      return (
        <strong key={pIdx} className={isIndicator ? "font-bold text-red-600" : "font-bold text-slate-900"}>
          {innerText}
        </strong>
      );
    }
    return part.replace(/\*\s*/g, '');
  });
};

const formatFormattedText = (text) => {
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
    cleanLine = cleanLine.replace(/^\*+/g, '');
    const colonIndex = cleanLine.indexOf(':');

    if (colonIndex > 0 && colonIndex < 60) { // Heuristic for a label
      const label = cleanLine.substring(0, colonIndex + 1);
      const value = cleanLine.substring(colonIndex + 1);

      const renderWithIndicators = (text) => {
        if (typeof text !== 'string') return text;
        const indicatorRegex = /\(indicator\s*([0-9.]+)\)/ig;
        const nodes = [];
        let lastIndex = 0;
        let match;
        while ((match = indicatorRegex.exec(text)) !== null) {
          const before = text.substring(lastIndex, match.index);
          if (before) nodes.push(...[].concat(renderBoldText(before)));
          const code = match[1];
          // Map to ordinal using COT mapping
          const ordinal = mapIndicatorToOrdinal(code);
          const display = ordinal ? `(${`indicator ${ordinal}`})` : `(indicator ${code})`;
          nodes.push(
            <strong key={`ind-${match.index}`} className="font-bold text-red-600">{display}</strong>
          );
          lastIndex = indicatorRegex.lastIndex;
        }
        const rest = text.substring(lastIndex);
        if (rest) nodes.push(...[].concat(renderBoldText(rest)));
        return nodes;
      };

      elements.push(
        <div key={`text-${idx}`} className="my-0.5 leading-relaxed">
          <strong className="font-bold text-slate-900">{label.replace(/\*/g, '')}</strong>
          {renderWithIndicators(value)}
        </div>
      );
    } else {
      const renderWithIndicatorsInline = (text) => {
        if (typeof text !== 'string') return text;
        const indicatorRegex = /\(indicator\s*([0-9.]+)\)/ig;
        const nodes = [];
        let lastIndex = 0;
        let match;
        while ((match = indicatorRegex.exec(text)) !== null) {
          const before = text.substring(lastIndex, match.index);
          if (before) nodes.push(...[].concat(renderBoldText(before)));
          const code = match[1];
          const ordinal = mapIndicatorToOrdinal(code);
          const display = ordinal ? `(indicator ${ordinal})` : `(indicator ${code})`;
          nodes.push(
            <strong key={`ind-inline-${match.index}`} className="font-bold text-red-600">{display}</strong>
          );
          lastIndex = indicatorRegex.lastIndex;
        }
        const rest = text.substring(lastIndex);
        if (rest) nodes.push(...[].concat(renderBoldText(rest)));
        return nodes;
      };

      elements.push(
        <div key={`text-${idx}`} className="my-0.5 leading-relaxed">
          {renderWithIndicatorsInline(cleanLine)}
        </div>
      );
    }
  });

  return elements;
};

const renderSafeContent = (content, isStandardList = false) => {
  if (content === null || content === undefined) return null;

  if (typeof content === 'string') {
    const trimmed = content.trim();

    // If the string is a JSON array encoded as text, parse it and render as array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return renderSafeContent(parsed, isStandardList);
        }
      } catch (e) {}
    }

    // Helper to render a labelled line such as "Knowledge: ..." with the label bolded
    // Also bolds inline labels like "ENRICHMENT:" that appear within the value text.
    const renderLabelledLine = (line, keyPrefixClass = 'text-[#1B365D]') => {
      const m = line.match(/^\s*([^:]{1,60}:)\s*([\s\S]*)$/);
      if (m) {
        const rawLabel = m[1].trim();
        const label = rawLabel.replace(/^\*+/g, '').replace(/\*+$/g, '').trim();
        const rest = m[2] || '';
        return (
          <div className="leading-snug">
            <span className={`font-bold ${keyPrefixClass}`}>{label}</span>
            {rest ? <span className="ml-1">{renderInlineLabels(rest)}</span> : null}
          </div>
        );
      }
      return <div className="leading-snug">{renderInlineLabels(line)}</div>;
    };

    // Helper to bold inline label prefixes (e.g., "ENRICHMENT:", "REMEDIATION:")
    // that appear within the value portion of a line.
    const renderInlineLabels = (text) => {
      if (typeof text !== 'string') return formatFormattedText(text);
      // Split on known label patterns like "ENRICHMENT:" or "REMEDIATION:"
      const parts = text.split(/(ENRICHMENT:|REMEDIATION:)/g);
      if (parts.length <= 1) return formatFormattedText(text);
      const nodes = [];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'ENRICHMENT:' || parts[i] === 'REMEDIATION:') {
          nodes.push(<strong key={`il-${i}`} className="font-bold text-slate-900">{parts[i]}</strong>);
        } else if (parts[i]) {
          nodes.push(...[].concat(formatFormattedText(parts[i])));
        }
      }
      return nodes;
    };

    // Special-case: Learning Objectives in KSA format often come as a single string like:
    // "Knowledge: ... Skills: ... Attitudes: ..." — split these into separate lines for readability.
    if (/Knowledge:/i.test(trimmed) && (/Skills:/i.test(trimmed) || /Attitudes:/i.test(trimmed))) {
      const parts = trimmed.split(/(?=(?:Knowledge:|Skills:|Attitudes:))/i).map(p => p.trim()).filter(Boolean);
      return (
        <div className="space-y-1">
          {parts.map((part, i) => (
            <div key={i}>{renderLabelledLine(part)}</div>
          ))}
        </div>
      );
    }

    // For other multi-line strings, split by newline and bold any leading "Label:" patterns
    if (trimmed.includes('\n')) {
      const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <div key={i}>{renderLabelledLine(line)}</div>
          ))}
        </div>
      );
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
          {/* Render each item through renderSafeContent so label-detection/styling applies consistently */}
          {renderSafeContent(item, isStandardList)}
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
              {key.replace(/([A-Z])/g, ' $1')}: {' '}
            </span>
            <div className="mt-0.5 text-slate-700">{renderSafeContent(val, isStandardList)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(content);
};

// Helper to extract Extended Learning content for a given session index.
const getSessionExtendedLearning = (plan, idx) => {
  const lp = plan;
  // Candidate locations where different AI providers might place this data
  const candidates = [
    lp?.sessions?.[idx]?.extendedLearning,
    lp?.sessions?.[idx]?.extendedLearningOpportunities,
    lp?.sessions?.[idx]?.waysForward?.extendedLearning,
    lp?.sessions?.[idx]?.waysForward?.extendedLearningOpportunities,
    lp?.sessions?.[idx]?.ways_forward?.extended_learning,
    lp?.sessions?.[idx]?.ways_forward?.extended_learning_opportunities,
    lp?.sessions?.[idx]?.extended_learning,
    lp?.sessions?.[idx]?.extended_learning_opportunities,
    // Top-level fallbacks (array or per-session)
    Array.isArray(lp?.waysForward?.extendedLearningOpportunities) ? lp.waysForward.extendedLearningOpportunities[idx] : lp?.waysForward?.extendedLearningOpportunities,
    lp?.waysForward?.extendedLearning,
    lp?.waysForward?.extendedLearningOpportunities?.[idx],
    lp?.extendedLearning?.[idx],
    lp?.extendedLearningOpportunities?.[idx],
    // snake_case top-level variants
    lp?.extended_learning?.[idx],
    lp?.extended_learning_opportunities?.[idx]
  ];
  const found = candidates.find((c) => c !== undefined && c !== null && String(c).trim() !== '');
  return found || '';
};

const toRoman = (num) => {
  const val = parseInt(num, 10);
  if (isNaN(val) || val < 1 || val > 50) { // Return original if not a convertible number (e.g., "IV" or "Principal")
    return num;
  }

  const roman = {
    L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let str = '';
  let currentNum = val;

  for (let i of Object.keys(roman)) {
    const q = Math.floor(currentNum / roman[i]);
    currentNum -= q * roman[i];
    str += i.repeat(q);
  }

  return str;
};

// Helper to determine the current DepEd school year based on the current date.
// DepEd school years typically start in late July/August.
// If the current month is July (6, 0-indexed) or later, the SY is {year}-{year+1}.
// Otherwise, the SY is {year-1}-{year}.
const getCurrentSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = January, 6 = July)
  if (month >= 6) {
    return `SY ${year}-${year + 1}`;
  }
  return `SY ${year - 1}-${year}`;
};

// PMES COT Rating Sheets info extracted from the 4 Annex E-2 docx files
const PMES_COT_SHEETS = [
  {
    file: 'Annex E-2_COT Rating Sheet for Beginning towards Proficient Teacher (TI-TIII).docx',
    title: 'Beginning towards Proficient Teacher (TI-TIII)',
    tool: 'TEACHER I-III Classroom Observation Tool (COT) – Rating Sheet',
  },
  {
    file: 'Annex E-2_COT Rating Sheet for Proficient Teacher (TIV-TVII).docx',
    title: 'Proficient Teacher (TIV-TVII)',
    tool: 'TEACHER IV-VII Classroom Observation Tool (COT) – Rating Sheet',
  },
  {
    file: 'Annex E-2_COT Rating Sheet for Highly Proficient Teacher (MTI-MTII).docx',
    title: 'Highly Proficient Teacher (MTI-MTII)',
    tool: 'MASTER TEACHER I-II Classroom Observation Tool (COT) – Rating Sheet',
  },
  {
    file: 'Annex E-2_COT Rating Sheet for Distinguished Teacher (MTIII-MTV).docx',
    title: 'Distinguished Teacher (MTIII-MTV)',
    tool: 'MASTER TEACHER III-V Classroom Observation Tool (COT) – Rating Sheet',
  },
];

// Helper to suggest design styles based on grade level and subject.
// Returns an array of { name, description, recommended } objects, ordered by relevance.
const getSuggestedDesignStyles = (gradeLevel, subject) => {
  const gradeNumMatch = (gradeLevel || '').match(/\d+/);
  const gradeNum = gradeNumMatch ? parseInt(gradeNumMatch[0], 10) : 0;
  const subjectLower = (subject || '').toLowerCase();

  const isElementary = gradeNum > 0 && gradeNum <= 6;
  const isJuniorHigh = gradeNum >= 7 && gradeNum <= 10;
  const isSeniorHigh = gradeNum >= 11 && gradeNum <= 12;

  const isSTEM = /math|science|physics|chemistry|biology|earth|calculus|statistics/i.test(subjectLower);
  const isLanguage = /english|filipino|reading|writing|literature|grammar/i.test(subjectLower);
  const isSocial = /social|history|araling|panlipunan|economics|culture/i.test(subjectLower);
  const isArts = /arts|music|pe|physical|education|esp|values/i.test(subjectLower);
  const isTech = /technology|computer|ict|tle|home|economics/i.test(subjectLower);

  const allStyles = [
    { name: 'Modern Educational', description: 'Clean & Professional' },
    { name: 'Playful Elementary', description: 'Colorful & Fun' },
    { name: 'Professional Academic', description: 'Formal & Structured' },
    { name: 'Creative Visual', description: 'Visual & Engaging' },
  ];

  let recommended = [];

  // Grade-based recommendations
  if (isElementary) {
    // Elementary: playful and creative first
    recommended = ['Playful Elementary', 'Creative Visual', 'Modern Educational', 'Professional Academic'];
  } else if (isJuniorHigh) {
    // Junior High: modern and creative
    if (isSTEM) {
      recommended = ['Modern Educational', 'Professional Academic', 'Creative Visual', 'Playful Elementary'];
    } else if (isLanguage || isArts) {
      recommended = ['Creative Visual', 'Modern Educational', 'Playful Elementary', 'Professional Academic'];
    } else {
      recommended = ['Modern Educational', 'Creative Visual', 'Professional Academic', 'Playful Elementary'];
    }
  } else if (isSeniorHigh) {
    // Senior High: professional and modern
    if (isSTEM || isTech) {
      recommended = ['Professional Academic', 'Modern Educational', 'Creative Visual', 'Playful Elementary'];
    } else if (isLanguage || isArts) {
      recommended = ['Modern Educational', 'Creative Visual', 'Professional Academic', 'Playful Elementary'];
    } else {
      recommended = ['Professional Academic', 'Modern Educational', 'Creative Visual', 'Playful Elementary'];
    }
  } else {
    // No grade specified: default order
    recommended = ['Modern Educational', 'Creative Visual', 'Professional Academic', 'Playful Elementary'];
  }

  // Return styles in recommended order with "recommended" flag on the first
  return recommended.map((name, idx) => {
    const style = allStyles.find((s) => s.name === name) || allStyles[0];
    return { ...style, recommended: idx === 0 };
  });
};

// Helper to determine the proficiency level of a teacher based on their designation.
// Returns one of: 'Beginning towards Proficient Teacher (TI-TIII)', 'Proficient Teacher (TIV-TVII)',
// 'Highly Proficient Teacher (MTI-MTII)', 'Distinguished Teacher (MTIII-MTV)', or 'Unknown'.
const getProficiencyLevel = (designation) => {
  if (!designation) return 'Unknown';
  const d = designation.toUpperCase();
  if (/\bMT\s*(III|IV|V|3|4|5)\b/i.test(d) || /\bMASTER\s*TEACHER\s*(III|IV|V|3|4|5)\b/i.test(d)) {
    return 'Distinguished Teacher (MTIII-MTV)';
  }
  if (/\bMT\s*(I|II|1|2)\b/i.test(d) || /\bMASTER\s*TEACHER\s*(I|II|1|2)\b/i.test(d)) {
    return 'Highly Proficient Teacher (MTI-MTII)';
  }
  if (/\bT\s*(IV|V|VI|VII|4|5|6|7)\b/i.test(d) || /\bTEACHER\s*(IV|V|VI|VII|4|5|6|7)\b/i.test(d)) {
    return 'Proficient Teacher (TIV-TVII)';
  }
  if (/\bT\s*(I|II|III|1|2|3)\b/i.test(d) || /\bTEACHER\s*(I|II|III|1|2|3)\b/i.test(d)) {
    return 'Beginning towards Proficient Teacher (TI-TIII)';
  }
  return 'Unknown';
};


export default function Home() {
  const [instructionModalProvider, setInstructionModalProvider] = useState(null);
  // States for API keys, now managed by ApiKeyPanel
  const [currentApiKey, setCurrentApiKey] = useState('');

  // Detected model lists (latest-first) for Gemini — populated when
  // the API key is verified. Passed to the server so the pipeline uses only
  // models that are actually compatible with the user's key.
  const [currentGeminiModels, setCurrentGeminiModels] = useState([]);

  // New state variables for metadata extraction
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [metadataExtractionError, setMetadataExtractionError] = useState('');
  const [availableTerms, setAvailableTerms] = useState(['Term 1', 'Term 2', 'Term 3']);
  const [availableWeeks, setAvailableWeeks] = useState(Array.from({ length: 11 }, (_, i) => `Week ${i + 1}`));


  const [bowFile, setBowFile] = useState(null);
  const [bowFileName, setBowFileName] = useState('No file chosen');
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState('');

  const [customResourceText, setCustomResourceText] = useState('');
  const [customReferenceText, setCustomReferenceText] = useState('');
  const [customLearnerContextText, setCustomLearnerContextText] = useState('');
  const [includeCotIndicators, setIncludeCotIndicators] = useState(false);

  // COT Warning Modal State
  const [showCotWarningModal, setShowCotWarningModal] = useState(false);
  const [cotWarningCountdown, setCotWarningCountdown] = useState(5);
  const cotWarningTimerRef = useRef(null);

  // Disclaimer Modal State
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  // Support Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // BOW Upload Support Gate State
  const [showBowSupportGate, setShowBowSupportGate] = useState(false);
  const [bowSupportCountdown, setBowSupportCountdown] = useState(5);
  const [pendingBowFile, setPendingBowFile] = useState(null);
  const bowSupportTimerRef = useRef(null);

  // Token System State
  const [tokens, setTokens] = useState(0);
  const [isInitialTokenLoadComplete, setIsInitialTokenLoadComplete] = useState(false);

  // Token System State (client-side hydration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bow_tokens');
        if (saved !== null) { // Check for null, not just falsy (as '0' is falsy)
          setTokens(parseInt(saved, 10));
        }
      } catch (e) {
        console.error("Error reading tokens from localStorage", e);
      } finally {
        setIsInitialTokenLoadComplete(true);
      }
    } else {
      // For SSR, assume tokens is 0 and mark initial load as complete
      setIsInitialTokenLoadComplete(true);
    }
  }, []);

  // Receipt Upload Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState('idle'); // idle | verifying | verified | rejected | error
  const [receiptMessage, setReceiptMessage] = useState('');
  const [receiptDetails, setReceiptDetails] = useState('');

  // Admin Password Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  // Admin lock state (client-side hydration)
  useEffect(() => {
    try {
      if (localStorage.getItem('bow_admin_unlocked') === 'true') {
        setIsAdminUnlocked(true);
      }
    } catch {
      // On error, admin remains locked
    }
  }, []);

  const [formData, setFormData] = useState({
    lessonName: '',
    subject: '',
    teacherName: '',
    masterTeacherName: '',
    principalName: '',
    gradeAndSection: '',
    noOfSessions: '5 Sessions (1 Week)',
    sessionLength: '',
    language: 'English (Default)',
    term: 'Term 1',
    week: 'Week 1',
    learningCompetency: '',
    contentStandards: '',
    performanceStandards: '',
    learnerContext: '',
    additionalPrompts: '',
    resources: [],
    references: [],
  });

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingSeparatedDocx, setDownloadingSeparatedDocx] = useState(false);
  const [lessonPlan, setLessonPlan] = useState(null);
  const [snapshotData, setSnapshotData] = useState(null);
  const [slideDeck, setSlideDeck] = useState(null);
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [slideDeckError, setSlideDeckError] = useState('');
  const [downloadingSlides, setDownloadingSlides] = useState(false);
  const [slideGenerationHistory, setSlideGenerationHistory] = useState([]); // Track generation timestamps
  const [slideCount] = useState(20); // Fixed at max 20 slides per deck

  // Support timer state
  const [showSupportTimer, setShowSupportTimer] = useState(false);
  const [supportCountdown, setSupportCountdown] = useState(5);
  const supportTimerRef = useRef(null);

  // Ref for AbortController for main generation
  const abortControllerRef = useRef(null);
  const loadingIntervalRef = useRef(null);

  const loadingMessages = useMemo(() => [
    'Polishing the lesson objectives... ✨',
    'Bribing the AI with virtual coffee... ☕',
    'Convincing the lesson to write itself... 📝',
    'Untangling the learning competencies... 🧶',
    'Chasing runaway learning objectives... 🏃‍♂️',
    'Consulting the imaginary Master Teacher... 🧑‍🏫',
    'Aligning planets with COT indicators... 🌍',
    'Fighting the urge to add more bullet points... 🔫',
    'Making sure DepEd would be proud... 🎓',
    'Herding cats into cooperative groups... 🐱',
    'Decoding the secret language of curriculum guides... 🔍',
    'Convincing students that math is fun... 🤡',
    'Searching for that one missing semicolon... 🔎',
    'Putting the \'pro\' in \'professional development\'... 💪',
    'Building a food chain out of pure imagination... 🍔',
    'Asking the lesson plan what it wants to be when it grows up... 🌱',
    'Calculating the probability of a perfect rating... 📊',
    'Rehearsing the \'any questions?\' face... 😐',
    'Formatting margins so they spark joy... 🎯',
    'Making sure the printer will cooperate tomorrow... 🖨️',
  ], []);

  // Start/stop rotating loading messages when loading state changes
  useEffect(() => {
    if (!loading) {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }

      const clearMessageTimeout = window.setTimeout(() => {
        setLoadingMessage('');
      }, 0);

      return () => {
        window.clearTimeout(clearMessageTimeout);
      };
    }

    const pickLoadingMessage = () => {
      setLoadingMessage((prev) => {
        let next;
        do {
          next = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        } while (next === prev && loadingMessages.length > 1);
        return next;
      });
    };

    pickLoadingMessage(); // Display message immediately
    loadingIntervalRef.current = window.setInterval(pickLoadingMessage, 2000);

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      // No initialMessageTimeout to clear anymore
    };
  }, [loading, loadingMessages]);

  // Ref for auto-scrolling to lesson plan header
  const headerRef = useRef(null);

  useEffect(() => {
    if (lessonPlan && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [lessonPlan]);

  const handleCopyGCash = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText('09912043738');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // BOW Support Gate countdown effect
  useEffect(() => {
    if (showBowSupportGate && bowSupportCountdown > 0) {
      bowSupportTimerRef.current = setTimeout(() => {
        setBowSupportCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (bowSupportTimerRef.current) {
        clearTimeout(bowSupportTimerRef.current);
      }
    };
  }, [showBowSupportGate, bowSupportCountdown]);

  // Token persistence effect - save to localStorage whenever tokens change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bow_tokens', String(tokens));
    }
  }, [tokens]);

  // Secret admin keyboard shortcut: Ctrl+Shift+I
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        setShowAdminModal(true);
        setAdminPassword('');
        setAdminPasswordError('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const proceedWithGeneration = useCallback(async () => {
    console.log('[DEBUG] Starting generation...');
    // Display a loading message immediately so the UI shows it without waiting for the effect to run
    const immediateLoadingMsg = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    setLoadingMessage(immediateLoadingMsg);
    setLoading(true);
    setLessonPlan(null);
    setShowSupportTimer(true);
    setSupportCountdown(5);

    const controller = new AbortController(); // Create AbortController
    abortControllerRef.current = controller; // Store it in ref

    try {
      console.log('[DEBUG] Preparing payload...');
      const finalResources = [...formData.resources];
      if (finalResources.includes('Other (Please specify)...') && customResourceText.trim()) {
        const index = finalResources.indexOf('Other (Please specify)...');
        finalResources[index] = `Other: ${customResourceText.trim()}`;
      }

      const finalReferences = [...formData.references];
      if (finalReferences.includes('Other (Please specify)...') && customReferenceText.trim()) {
        const index = finalReferences.indexOf('Other (Please specify)...');
        finalReferences[index] = `Other: ${customReferenceText.trim()}`;
      }

      let finalLearnerContext = formData.learnerContext;
      if (finalLearnerContext === 'Other (Please specify)...' && customLearnerContextText.trim()) {
        finalLearnerContext = `Other: ${customLearnerContextText.trim()}`;
      }

      const sessionMatch = formData.noOfSessions.match(/\d+/);
      const parsedSessions = sessionMatch ? parseInt(sessionMatch[0], 10) : 5;

      const submissionSnapshot = {
        ...formData,
        learnerContext: finalLearnerContext,
        resources: finalResources,
        references: finalReferences,
      };

      setSnapshotData(submissionSnapshot);

      const autoTitlePrompt = !formData.lessonName.trim()
        ? `AUTOMATIC LESSON TITLE GENERATION: No lesson title was provided by the user. Automatically generate a concise, professional, and engaging "lessonTitle" for the JSON output header based on the subject (${formData.subject}) and learning competency.`
        : '';

      // If the user has unlocked BOW extraction (has tokens or admin bypass),
      // automatically enable COT indicators as a premium complement for the best detailed lesson plan result.
      const effectiveIncludeCotIndicators = includeCotIndicators || (tokens > 0 || isAdminUnlocked);

      const payload = {
        lessonName: formData.lessonName,
        subject: formData.subject,
        teacherName: formData.teacherName,
        masterTeacherName: formData.masterTeacherName,
        principalName: formData.principalName,
        gradeAndSection: formData.gradeAndSection,
        language: formData.language,
        noOfSessions: formData.noOfSessions,
        sessionLength: formData.sessionLength,
        term: formData.term,
        week: formData.week,
        learningCompetency: formData.learningCompetency,
        contentStandards: formData.contentStandards,
        performanceStandards: formData.performanceStandards,
        learnerContext: finalLearnerContext,
        additionalPrompts: formData.additionalPrompts,
        resources: finalResources,
        references: finalReferences,
        geminiApiKey: currentApiKey,
        includeCotIndicators: effectiveIncludeCotIndicators,
        geminiModels: currentGeminiModels,
        autoTitlePrompt,
      };

      console.log('[DEBUG] Sending request...');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      console.log('[DEBUG] Response received', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Generation failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('[DEBUG] Parsed result', result);

      if (controller.signal.aborted) {
        return;
      }

      setLessonPlan(result.plan || result);
      setLoading(false);
      setLoadingMessage('');
      setError('');
      setShowSupportTimer(false);
      setSupportCountdown(5);
    } catch (err) {
      console.error('[DEBUG] Generation error', err);
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to generate lesson plan.');
      }
      setLoading(false);
      setLoadingMessage('');
      setShowSupportTimer(false);
      setSupportCountdown(5);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [currentApiKey, currentGeminiModels, customLearnerContextText, customReferenceText, customResourceText, formData, includeCotIndicators]);

  // Keep a ref to the latest generation function so the timer effect
  // doesn't restart when formData or other deps change.
  const proceedWithGenerationRef = useRef(proceedWithGeneration);
  useEffect(() => {
    proceedWithGenerationRef.current = proceedWithGeneration;
  }, [proceedWithGeneration]);

  // Support timer countdown effect
  useEffect(() => {
    if (!showSupportTimer) {
      return;
    }

    if (supportCountdown > 0) {
      supportTimerRef.current = setTimeout(() => {
        setSupportCountdown((prev) => prev - 1);
      }, 1000);
      return () => {
        if (supportTimerRef.current) {
          clearTimeout(supportTimerRef.current);
        }
      };
    }

    // Countdown finished - just hide the modal, generation already started
    const finishTimerTimeout = window.setTimeout(() => {
      setShowSupportTimer(false);
      setSupportCountdown(5);
    }, 0);

    return () => {
      window.clearTimeout(finishTimerTimeout);
      if (supportTimerRef.current) {
        clearTimeout(supportTimerRef.current);
      }
    };
  }, [showSupportTimer, supportCountdown]);

  // COT Warning timer countdown effect
  useEffect(() => {
    if (!showCotWarningModal) {
      return;
    }

    if (cotWarningCountdown > 0) {
      cotWarningTimerRef.current = setTimeout(() => {
        setCotWarningCountdown((prev) => prev - 1);
      }, 1000);
      return () => {
        if (cotWarningTimerRef.current) {
          clearTimeout(cotWarningTimerRef.current);
        }
      };
    }

    // Countdown finished - do NOT auto-close; just enable the continue button
    return () => {
      if (cotWarningTimerRef.current) {
        clearTimeout(cotWarningTimerRef.current);
      }
    };
  }, [showCotWarningModal, cotWarningCountdown]);

  // Mode: 'click' (open file picker after) or 'drop' (process dropped file after)
  const [bowGateMode, setBowGateMode] = useState('click');
  const isProceedingRef = useRef(false);

  // Function to handle BOW upload click - check tokens first
  const handleUploadClick = (e) => {
    // If we're programmatically opening the file picker, don't show the gate again
    if (isProceedingRef.current) {
      isProceedingRef.current = false;
      return;
    }
    // Prevent the hidden file input from opening immediately
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user has tokens or is admin bypassed
    if (tokens < 1 && !isAdminUnlocked) {
      // No tokens - show receipt upload modal
      setShowReceiptModal(true);
      setReceiptStatus('idle');
      setReceiptMessage('');
      setReceiptDetails('');
      setReceiptFile(null);
      setReceiptFileName('');
      return;
    }
    
    // Has tokens - proceed with file picker
    setBowGateMode('click');
    isProceedingRef.current = true;
    const fileInput = document.getElementById('bow-file-input');
    if (fileInput) {
      fileInput.click();
    }
  };

  // Function to intercept dropped BOW file — check tokens first
  const interceptBowFile = (file) => {
    if (file && file.type === 'application/pdf') {
      if (tokens < 1 && !isAdminUnlocked) {
        // No tokens - show receipt upload modal
        setShowReceiptModal(true);
        setReceiptStatus('idle');
        setReceiptMessage('');
        setReceiptDetails('');
        setReceiptFile(null);
        setReceiptFileName('');
        return;
      }
      // Has tokens - process dropped file
      setPendingBowFile(file);
      setBowGateMode('drop');
      processBowFile(file);
      extractBowMetadata(file);
      setPendingBowFile(null);
    } else if (file) {
      showToast({ message: 'Please upload a valid PDF file.', type: 'error' });
    }
  };

  // ===== RECEIPT UPLOAD & VERIFICATION HANDLERS =====
  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast({ message: 'Please upload a valid image file (JPEG, PNG, or WebP).', type: 'error' });
        return;
      }
      setReceiptFile(file);
      setReceiptFileName(file.name);
      setReceiptStatus('idle');
      setReceiptMessage('');
      setReceiptDetails('');
    }
  };

  const handleVerifyReceipt = async () => {
    if (!receiptFile) {
      showToast({ message: 'Please upload a receipt image first.', type: 'error' });
      return;
    }

    if (!currentApiKey) {
      showToast({ message: 'Please enter an API Key first.', type: 'error' });
      return;
    }

    setIsVerifyingReceipt(true);
    setReceiptStatus('verifying');
    setReceiptMessage('Analyzing your receipt...');

    try {
      const payload = new FormData();
      payload.append('apiKey', currentApiKey);
      payload.append('receiptFile', receiptFile);

      const res = await fetch('/api/verify-receipt', {
        method: 'POST',
        body: payload,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify receipt.');
      }

      if (data.verified) {
        setReceiptStatus('verified');
        setReceiptMessage('Receipt verified successfully! 🎉');
        setReceiptDetails(`You have been granted ${data.tokensGranted} tokens. You can now use BOW extraction.`);
        // Grant tokens
        setTokens(prev => (prev || 0) + data.tokensGranted);
      } else {
        setReceiptStatus('rejected');
        setReceiptMessage('Receipt could not be verified.');
        setReceiptDetails(data.reason || 'Please ensure you uploaded a clear GCash payment screenshot showing the ₱199 payment.');
      }
    } catch (err) {
      console.error('Error verifying receipt:', err);
      setReceiptStatus('error');
      setReceiptMessage('Verification failed.');
      setReceiptDetails(err.message || 'Please try again with a clearer image.');
    } finally {
      setIsVerifyingReceipt(false);
    }
  };

  const handleCloseReceiptModal = () => {
    setShowReceiptModal(false);
    setReceiptFile(null);
    setReceiptFileName('');
    setReceiptStatus('idle');
    setReceiptMessage('');
    setReceiptDetails('');
  };

  // ===== ADMIN PASSWORD HANDLER =====
  const handleAdminPasswordSubmit = () => {
    if (adminPassword === 'Mabbie23') {
      setShowAdminModal(false);
      setAdminPassword('');
      setAdminPasswordError('');
      setIsAdminUnlocked(true);
      showToast({ message: 'Admin bypass successful! Unlimited tokens granted.', type: 'success' });
    } else {
      setAdminPasswordError('Incorrect password. Access denied.');
    }
  };

  const extractBowMetadata = async (file) => {
    if (!file) return;

    if (!currentApiKey) {
      setMetadataExtractionError('Please enter an API Key to extract BOW metadata.');
      return;
    }

    setIsExtractingMetadata(true);
    setMetadataExtractionError('');

    try {
      const payload = new FormData();
      payload.append('apiKey', currentApiKey);
      payload.append('geminiModels', JSON.stringify(currentGeminiModels));
      payload.append('bowFile', file);

      const res = await fetch('/api/extract-bow-metadata', {
        method: 'POST',
        body: payload,
      });

      let data = null;
      try {
        data = await res.json();
      } catch (parseError) {
        data = { error: 'The metadata endpoint returned an invalid response.' };
      }

      if (!res.ok) throw new Error(data?.error || 'Failed to extract BOW metadata.');

      if (data.terms && Array.isArray(data.terms) && data.terms.length > 0) {
        setAvailableTerms(data.terms);
        // Preserve user's current term selection if it exists in the new list
        setFormData(prev => {
          const currentTerm = prev.term;
          const termExists = data.terms.some(t => t === currentTerm);
          return { ...prev, term: termExists ? currentTerm : data.terms[0] };
        });
      } else {
        setAvailableTerms(['Term 1', 'Term 2', 'Term 3']); // Fallback to defaults
        setFormData(prev => ({ ...prev, term: 'Term 1' }));
      }

      if (data.weeks && Array.isArray(data.weeks) && data.weeks.length > 0) {
        setAvailableWeeks(data.weeks);
        // Preserve user's current week selection if it exists in the new list
        setFormData(prev => {
          const currentWeek = prev.week;
          const weekExists = data.weeks.some(w => w === currentWeek);
          return { ...prev, week: weekExists ? currentWeek : data.weeks[0] };
        });
      } else {
        setAvailableWeeks(Array.from({ length: 11 }, (_, i) => `Week ${i + 1}`)); // Fallback to defaults
        setFormData(prev => ({ ...prev, week: 'Week 1' }));
      }

      setMetadataExtractionError('');
    } catch (err) {
      console.error('Error extracting BOW metadata:', err);
      setMetadataExtractionError(`Error extracting BOW metadata: ${err.message}`);
      setAvailableTerms(['Term 1', 'Term 2', 'Term 3']); // Reset to defaults on error
      setAvailableWeeks(Array.from({ length: 11 }, (_, i) => `Week ${i + 1}`)); // Reset to defaults on error
      setFormData(prev => ({ ...prev, term: 'Term 1', week: 'Week 1' })); // Reset form data
    } finally {
      setIsExtractingMetadata(false);
    }
  };







  const processBowFile = (file) => {
    if (file && file.type === 'application/pdf') {
      setBowFile(file);
      setBowFileName(file.name);
    } else if (file) {
      showToast({ message: 'Please upload a valid PDF file.', type: 'error' });
    }
  };

  const handleBowFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // File was selected via the picker (after support gate) — process directly
      processBowFile(file);
      await extractBowMetadata(file);
    } else {
      setBowFile(null);
      setBowFileName('No file chosen');
      setAvailableTerms(['Term 1', 'Term 2', 'Term 3']); // Reset to defaults
      setAvailableWeeks(Array.from({ length: 11 }, (_, i) => `Week ${i + 1}`)); // Reset to defaults
      setFormData(prev => ({ ...prev, term: 'Term 1', week: 'Week 1' })); // Reset form data
      setMetadataExtractionError('');
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      interceptBowFile(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleLoadEntries = async () => {
    if (!currentApiKey) {
      showToast({ message: 'Please enter an API Key in the API Configuration section.', type: 'error' });
      return;
    }

    if (!bowFile) {
      showToast({ message: 'Please upload a BOW PDF first.', type: 'error' });
      return;
    }

    setIsExtracting(true);
    setExtractionNote('');

    try {
      const payload = new FormData();
      payload.append('apiKey', currentApiKey);
      payload.append('geminiModels', JSON.stringify(currentGeminiModels));
      payload.append('term', formData.term);
      payload.append('week', formData.week);
      payload.append('subject', formData.subject);
      payload.append('bowFile', bowFile);

      const res = await fetch('/api/extract-bow', {
        method: 'POST',
        body: payload,
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await res.text();
        throw new Error(`Server returned an error (Status ${res.status}).`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract entries from BOW PDF.');

      const extractedCompetency = data.learningCompetency || data.curriculumStandards?.learningCompetency || '';
      const extractedContent = data.contentStandard || data.contentStandards || data.curriculumStandards?.contentStandard || '';
      const extractedPerformance = data.performanceStandard || data.performanceStandards || data.curriculumStandards?.performanceStandard || '';

      setFormData((prev) => ({
        ...prev,
        learningCompetency: extractedCompetency || prev.learningCompetency,
        contentStandards: extractedContent || prev.contentStandards,
        performanceStandards: extractedPerformance || prev.performanceStandards,
      }));

      setExtractionNote(`Extracted and isolated standards for ${formData.week} successfully!`);
      
      // Deduct 1 token on successful extraction (tokens are not reduced on failure)
      setTokens(prev => Math.max(0, (prev || 0) - 1));
    } catch (err) {
      showToast({ message: `Extraction failed: ${err.message}`, type: 'error' });
      // Tokens are NOT reduced on failure
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAbort = () => {
    // If we're in the support timer countdown, cancel it and hide the popup
    if (showSupportTimer) {
      setShowSupportTimer(false);
      setSupportCountdown(5);
      if (supportTimerRef.current) {
        clearTimeout(supportTimerRef.current);
        supportTimerRef.current = null;
      }
      showToast({ message: 'Generation cancelled.', type: 'info' });
      return;
    }
    
    // If generation is in progress, abort it
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('User aborted generation');
      setLoading(false);
      setLoadingMessage('');
      showToast({ message: 'Lesson plan generation aborted.', type: 'info' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (!value) return;

    if (name === 'subject') {
      const titleCasedValue = value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setFormData(prev => ({ ...prev, [name]: titleCasedValue }));
    } else if (name === 'gradeAndSection') {
      const gradeMatch = value.match(/\d+/);
      const grade = gradeMatch ? gradeMatch[0] : '';

      const sectionPart = value
        .replace(/\d+/, '') // Remove numbers
        .replace(/grade/i, '') // Remove "grade"
        .replace(/[-_]/g, ' ') // Replace separators with spaces
        .trim();

      const sections = sectionPart
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(', ');

      const formattedValue = `Grade ${grade}${sections ? ` - ${sections}` : ''}`.trim();
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else if (['teacherName', 'masterTeacherName', 'principalName'].includes(name)) {
      const parts = value.split(',');
      const namePart = parts[0].trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      if (parts.length > 1) {
        const designationStr = parts.slice(1).join(',').trim();
        if (designationStr) {
          const designationWords = designationStr.toLowerCase().split(' ');
          const lastWord = designationWords.pop() || '';
          
          let romanNumeral;
          // Check if the last word is a digit (e.g., "1", "2", "3")
          if (/^\d+$/.test(lastWord)) {
            romanNumeral = toRoman(lastWord);
          } else {
            romanNumeral = lastWord.toUpperCase(); // Keep existing behavior for "I", "II", etc.
          }

          const designationBase = designationWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          const formattedDesignation = `${designationBase} ${romanNumeral}`.trim();
          setFormData(prev => ({ ...prev, [name]: `${namePart}, ${formattedDesignation}` }));
        } else {
          setFormData(prev => ({ ...prev, [name]: namePart }));
        }
      } else {
        setFormData(prev => ({ ...prev, [name]: namePart }));
      }
    }
  };
  const handleCheckbox = (e, listName) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const currentList = prev[listName];
      if (checked) {
        return { ...prev, [listName]: [...currentList, value] };
      } else {
        return { ...prev, [listName]: currentList.filter((item) => item !== value) };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentApiKey) {
      showToast({ message: 'Please enter an API Key in the API Configuration section above.', type: 'error' });
      return;
    }

    if (
      hasMissingDesignation(formData.teacherName) ||
      hasMissingDesignation(formData.masterTeacherName) ||
      hasMissingDesignation(formData.principalName)
    ) {
      showToast({ message: 'Please include designations for all filled signatory fields (formatted as Name, Designation).', type: 'error' });
      return;
    }

    // Start generation immediately
    void proceedWithGeneration();
  };

  const getSessionCount = () => {
    const formSessionStr = String(snapshotData?.noOfSessions || '');
    const formMatch = formSessionStr.match(/\d+/);
    if (formMatch) {
      const count = parseInt(formMatch[0], 10);
      if (count >= 1 && count <= 5) return count;
    }
    if (lessonPlan?.sessions && Array.isArray(lessonPlan.sessions) && lessonPlan.sessions.length > 0) {
      return lessonPlan.sessions.length;
    }
    return 5;
  };

  const numSessions = getSessionCount();
  const sessionHeaders = Array.from({ length: numSessions }, (_, i) => `Session ${i + 1}`);

  const teacherSignatory = parseNameAndDesignation(snapshotData?.teacherName, lessonPlan?.signatories?.preparedBy, '');
  const masterTeacherSignatory = parseNameAndDesignation(snapshotData?.masterTeacherName, lessonPlan?.signatories?.checkedBy, '');
  const principalSignatory = parseNameAndDesignation(snapshotData?.principalName, lessonPlan?.signatories?.notedBy, '');

  // Style constants for DOCX generation
  const tableLabelStyle = { fill: '#F3F4F6', bold: true, color: '1B365D' };
  const tableSubHeaderStyle = { fill: '#4B5563', bold: true, color: 'FFFFFF' };
  const TEMPLATE_LABEL_FILL = '#F3F4F6';
  const TEMPLATE_BANNER_FILL = '#1B365D';
  const titleText = `LESSON PLAN MATRIX\n${snapshotData?.subject?.toUpperCase() || 'SUBJECT'} ${snapshotData?.term?.toUpperCase()} ${snapshotData?.week?.toUpperCase()}`;

  // Matrix Landscape DOCX Download
  const handleDownloadDocx = async () => {
    if (!lessonPlan) return;
    setDownloadingDocx(true);

    try {
      if (typeof window !== 'undefined') {
        const { 
          Document, 
          Packer, 
          Paragraph, 
          TextRun, 
          Table, 
          TableRow, 
          TableCell, 
          WidthType, 
          AlignmentType, 
          HeadingLevel,
          ShadingType,
          PageOrientation,
          BorderStyle,
          VerticalAlign,
          HeightRule
        } = await import('docx');
        const { saveAs } = await import('file-saver');

        // Helper: resolve all creates in a children array (some may be Promises from async createCell)
        const resolveCells = async (children) => Promise.all(children.map(c => Promise.resolve(c)));

        const headerTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
          rows: [
            new TableRow({ children: await Promise.all([createCell("Lesson Title", { ...tableLabelStyle, widthPct: 25, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.lessonTitle || snapshotData?.lessonName), { widthPct: 75, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("Learning Area/s", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.learningArea || snapshotData?.subject), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("Name of Teacher/s", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName)), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("Grade Level and Section", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("No. of Sessions", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(snapshotData?.noOfSessions), { bold: true, color: "1B365D", borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("References", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.references || snapshotData?.references), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) }),
            new TableRow({ children: await Promise.all([createCell("Declaration of AI use", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })]) })
          ]
        });

        const standardsTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
          rows: [
            new TableRow({ children: [await createCell("Learning Competency and Curriculum Standards:", { fill: TEMPLATE_LABEL_FILL, bold: true, color: "1B365D", borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
            new TableRow({ 
              children: [
                await createCell(
                  `**Learning Competency:**\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}\n\n` +
                  `**Content Standards:**\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\n` +
                  `**Performance Standards:**\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}`,
                  { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }
                )
              ] 
            })
          ]
        });

        const createMatrixTable = async (rowsData) => {
          const colWidth = Math.floor(83 / numSessions);
          const headerRow = new TableRow({
            children: await Promise.all([
              createCell("Phase / Component", { ...tableSubHeaderStyle, widthPct: 17, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS, alignment: AlignmentType.CENTER }),
              ...sessionHeaders.map(h => createCell(h, { ...tableSubHeaderStyle, widthPct: colWidth, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS, alignment: AlignmentType.CENTER }))
            ])
          });

          const dataRows = await Promise.all(rowsData.map(async row => {
            return new TableRow({
              height: row.height,
              children: await Promise.all([
                createCell(row.label, { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS }),
                ...sessionHeaders.map((_, idx) => createCell(row.getValue(idx), { borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS, minHeight: row.minHeight }))
              ])
            });
          }));

          return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, tableCellMar: TEMPLATE_TABLE_CELL_MARGINS, rows: [headerRow, ...dataRows], borders: await createBorderSet(TEMPLATE_BORDER_COLOR_MATRIX) });
        };

        const intentionsTable = await createMatrixTable([
          {
            label: "Learning Objectives (KSA)",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[idx] : lessonPlan.learningObjectives))
          },
          {
            label: "Learner Context",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[idx] : lessonPlan.learnerContext) || snapshotData?.learnerContext)
          }
        ]);

        const experienceTable = await createMatrixTable([
          {
            label: "Pre-Lesson",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.preLesson || (Array.isArray(lessonPlan.learningExperience?.preLesson) ? lessonPlan.learningExperience.preLesson[idx] : lessonPlan.learningExperience?.preLesson))
          },
          {
            label: "Flow",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.flow || (Array.isArray(lessonPlan.learningExperience?.flow) ? lessonPlan.learningExperience.flow[idx] : lessonPlan.learningExperience?.flow))
          },
          {
            label: "Learning Resources",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learningResources || (Array.isArray(lessonPlan.learningResources) ? lessonPlan.learningResources[idx] : lessonPlan.learningResources) || snapshotData?.resources)
          },
          {
            label: "Opportunities for integration",
            getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.opportunitiesForIntegration || (Array.isArray(lessonPlan.opportunitiesForIntegration) ? lessonPlan.opportunitiesForIntegration[idx] : lessonPlan.opportunitiesForIntegration))
          }
        ]);

        const assessmentTable = await createMatrixTable([
          {
            label: "Formative Assessment",
            getValue: (idx) => {
              const assessData = lessonPlan?.sessions?.[idx]?.formativeAssessment || 
                                 (Array.isArray(lessonPlan?.assessingLearning?.formativeAssessment) 
                                    ? lessonPlan.assessingLearning.formativeAssessment[idx] 
                                    : lessonPlan?.assessingLearning?.formativeAssessment);
              return formatDocxText(assessData);
            }
          }
        ]);

        const waysForwardTable = await createMatrixTable([
          {
            label: "Extended learning opportunities",
            getValue: (idx) => {
              // Support multiple possible shapes returned by different AI providers / prompt variants.
              const candidates = [
                lessonPlan?.sessions?.[idx]?.extendedLearning,
                lessonPlan?.sessions?.[idx]?.extendedLearningOpportunities,
                lessonPlan?.sessions?.[idx]?.waysForward?.extendedLearning,
                lessonPlan?.sessions?.[idx]?.waysForward?.extendedLearningOpportunities,
                Array.isArray(lessonPlan?.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan?.waysForward?.extendedLearningOpportunities,
                lessonPlan?.waysForward?.extendedLearning,
                lessonPlan?.waysForward?.extendedLearningOpportunities?.[idx],
                lessonPlan?.extendedLearning?.[idx],
                lessonPlan?.extendedLearningOpportunities?.[idx]
              ];
              const found = candidates.find((c) => c !== undefined && c !== null && String(c).trim() !== '');
              return formatDocxText(found || "");
            }
          },
          {
            label: "Reflections",
            getValue: () => "", // Make it blank
            height: { value: 2835, rule: 'exact' }
          }
        ]);

        const signatoriesTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: await Promise.all([
                createCell(`**Prepared by:**\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || ''}`, { widthPct: 33 }),
                createCell(`**Checked and Reviewed:**\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || ''}`, { widthPct: 33 }),
                createCell(`**Noted by:**\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || ''}`, { widthPct: 34 }),
              ])
            })
          ]
        });

        const sectionTitleBanner = (title, subtitle) => [
          new Paragraph({
            shading: { fill: "1B365D", type: ShadingType.CLEAR },
            children: [
              new TextRun({ text: `${title} `, bold: true, color: "FFFFFF", size: 22, font: "Arial" }),
              new TextRun({ text: subtitle, color: "E2E8F0", size: 18, font: "Arial" })
            ]
          })
        ];

        const doc = new Document({
          styles: { default: { document: { run: { font: "Arial" } } } },
          sections: [
            {
              properties: {
                page: {
                  size: { width: 18720, height: 12240 },
                  margin: { top: 720, bottom: 720, left: 720, right: 720 },
                  orientation: PageOrientation.LANDSCAPE
                }
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  heading: HeadingLevel.HEADING_1,
                  children: [
                    new TextRun({
                      text: titleText,
                      bold: true,
                      color: "1B365D",
                      size: 26,
                      font: "Arial"
                    })
                  ]
                }),
                new Paragraph({ text: "" }),
                headerTable,
                new Paragraph({ text: "" }),
                ...sectionTitleBanner("Intentions.", "Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple. Remember: Understanding your learners' evolving context and designing around it ensure that your lessons connect with and are relevant to them."),
                standardsTable,
                new Paragraph({ text: "" }),
                intentionsTable,
                new Paragraph({ text: "" }),
                ...sectionTitleBanner("Learning Experience.", "A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, or understanding in a purposeful way."),
                experienceTable,
                new Paragraph({ text: "" }),
                ...sectionTitleBanner("Assessment.", "Assessments reveal what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session."),
                assessmentTable,
                new Paragraph({ text: "" }),
                ...sectionTitleBanner("Ways Forward.", "Meaningful learning can also happen beyond the classroom – for both the learners and the teacher. Pause and reflect on what happened today."),
                waysForwardTable,
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                signatoriesTable
              ]
            }
          ]
        });
        
        const blob = await Packer.toBlob(doc);
        const subjectName = snapshotData?.subject || 'Subject';
        const termName = snapshotData?.term || 'Term 1';
        const weekName = snapshotData?.week || 'Week 1';
        saveAs(blob, `${subjectName}_${termName}_${weekName}_Matrix.docx`);
      }
    } catch (err) {
      console.error('Error exporting DOCX:', err);
      showToast({ message: 'Failed to generate Word document.', type: 'error' });
    } finally {
      setDownloadingDocx(false);
    }
  };

  // Separated Daily Lesson Plans DOCX Download
  const handleDownloadSeparatedDocx = async () => {
    if (!lessonPlan) return;
    setDownloadingSeparatedDocx(true);

    try {
      const { Document, Packer, PageOrientation } = await import('docx');
      const { saveAs } = await import('file-saver');

      const headerBannerStyle = { fill: TEMPLATE_BANNER_FILL, color: "333333", bold: true };
      const matrixBorder = TEMPLATE_BORDER_COLOR_MATRIX;
      const matrixMargins = TEMPLATE_MATRIX_CELL_MARGINS;
      const headerMargins = TEMPLATE_HEADER_CELL_MARGINS;

      const sections = [];

      for (let idx = 0; idx < numSessions; idx++) {
        const sessionLabel = `Session ${idx + 1} of ${numSessions}`;

        const sessionTable = await buildSessionTable({
          lessonPlan,
          snapshotData,
          sessionIndex: idx,
          sessionLabel,
          headerBannerStyle: { color: '333333', bold: true },
          matrixBorder: TEMPLATE_BORDER_COLOR_MATRIX,
          matrixMargins: TEMPLATE_MATRIX_CELL_MARGINS,
        });

        const signatoriesTable = await buildSignatoriesTable({ teacherSignatory, masterTeacherSignatory, principalSignatory });

        sections.push({
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
              orientation: PageOrientation.PORTRAIT
            }
          },
          children: [
            sessionTable,
            signatoriesTable
          ]
        });
      }

      if (typeof window !== 'undefined') {
        const doc = new Document({
          styles: { default: { document: { run: { font: "Arial" } } } },
          sections: sections
        });

        const blob = await Packer.toBlob(doc);
        const subjectName = snapshotData?.subject || 'Subject';
        const termName = snapshotData?.term || 'Term 1';
        const weekName = snapshotData?.week || 'Week 1';
        saveAs(blob, `${subjectName}_${termName}_${weekName}_Daily_Separated.docx`);
      }
    } catch (err) {
      console.error('Error exporting Separated DOCX:', err);
      showToast({ message: 'Failed to generate separated daily lesson plans.', type: 'error' });
    } finally {
      setDownloadingSeparatedDocx(false);
    }
  };

  // Check if user can generate slides based on 24h rolling quota
  const canGenerateSlides = () => {
    if (slideGenerationHistory.length === 0) return true;
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // Filter out entries older than 24 hours
    const recentGenerations = slideGenerationHistory.filter(timestamp => {
      return (now - timestamp) < twentyFourHours;
    });
    
    // Update history to remove old entries
    if (recentGenerations.length !== slideGenerationHistory.length) {
      setSlideGenerationHistory(recentGenerations);
    }
    
    // Allow up to 10 generations per day
    return recentGenerations.length < 10;
  };

  const getTimeUntilNextGeneration = () => {
    if (slideGenerationHistory.length === 0) return null;
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // Find the oldest generation that's still within the 24h window
    const oldestTimestamp = slideGenerationHistory[0];
    const timePassed = now - oldestTimestamp;
    const timeRemaining = twentyFourHours - timePassed;
    
    if (timeRemaining <= 0) return null;
    
    // Convert to hours and minutes
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleGenerateSlides = async () => {
    if (!lessonPlan) {
      showToast({ message: 'Generate a lesson plan first before creating slides.', type: 'error' });
      return;
    }

    if (!currentApiKey) {
      showToast({ message: 'Please enter an API key before generating a slide deck.', type: 'error' });
      return;
    }

    // Check quota before generating
    if (!canGenerateSlides()) {
      const timeLeft = getTimeUntilNextGeneration();
      showToast({ 
        message: `Daily slide generation quota reached (~10 decks/day). Next generation available in ${timeLeft || '24h'}.`, 
        type: 'error',
        duration: 5000
      });
      return;
    }

    setGeneratingSlides(true);
    setSlideDeckError('');
    setSlideDeck(null);

    try {
      // Get selected session index
      const sessionSelect = document.getElementById('slide-session-select');
      const sessionIndex = sessionSelect ? parseInt(sessionSelect.value, 10) : 0;

      // Get slide count
      // const slideCountSlider = document.getElementById('slide-count-slider');
      // const slideCount = slideCountSlider ? parseInt(slideCountSlider.value, 10) : 20; // Use the state variable directly

      // Get design style
      const designStyleRadios = document.getElementsByName('designStyle');
      let designStyle = 'Modern Educational';
      for (const radio of designStyleRadios) {
        if (radio.checked) {
          designStyle = radio.value;
          break;
        }
      }

      // Get additional prompt
      const additionalPromptTextarea = document.getElementById('slide-additional-prompt');
      const additionalPrompt = additionalPromptTextarea ? additionalPromptTextarea.value.trim() : '';

      const response = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonPlan,
          snapshotData,
          formData,
          geminiModels: currentGeminiModels,
          geminiApiKey: currentApiKey,
          sessionIndex,
          slideCount,
          designStyle,
          additionalPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slide generation failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      setSlideDeck(result.slideDeck || result);
      
      // Record successful generation timestamp for quota tracking
      setSlideGenerationHistory(prev => [...prev, Date.now()]);
      
      showToast({ message: 'Slide deck outline generated successfully.', type: 'success' });
    } catch (err) {
      console.error('Error generating slides:', err);
      setSlideDeckError(err.message || 'Failed to generate slide deck.');
      showToast({ message: err.message || 'Failed to generate slide deck.', type: 'error' });
    } finally {
      setGeneratingSlides(false);
    }
  };

  const handleDownloadSlidesPptx = async () => {
    if (!slideDeck?.slides?.length) return;

    setDownloadingSlides(true);

    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'IlawCraft';
      pptx.company = 'IlawCraft';
      pptx.subject = 'Lesson slide deck';
      pptx.title = slideDeck.deckTitle || 'Lesson Slide Deck';

      // Use theme colors from the AI or fall back to defaults
      const themeColors = slideDeck.themeColors || {
        primary: '1B365D',
        secondary: 'F59E0B',
        accent: '4B5563',
        background: 'F8FAFC',
        text: '111827',
      };

      pptx.theme = {
        name: 'ilaw',
        colorScheme: {
          accent1: themeColors.primary,
          accent2: themeColors.secondary,
          accent3: themeColors.accent,
          accent4: 'E2E8F0',
          accent5: themeColors.background,
          accent6: themeColors.text,
          hyperlink: { color: themeColors.primary },
          folHlink: { color: themeColors.primary },
        },
      };

      // ===== TITLE SLIDE =====
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: themeColors.background };

      // Decorative accent bar at the top
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.33,
        h: 0.15,
        fill: { color: themeColors.secondary },
        line: { type: 'none' },
      });

      // Decorative accent bar at the bottom
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 7.35,
        w: 13.33,
        h: 0.15,
        fill: { color: themeColors.secondary },
        line: { type: 'none' },
      });

      // Left accent rectangle
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0.15,
        w: 0.3,
        h: 7.2,
        fill: { color: themeColors.primary },
        line: { type: 'none' },
      });

      // Title text
      titleSlide.addText(slideDeck.deckTitle || 'Lesson Slide Deck', {
        x: 1.0,
        y: 1.5,
        w: 11.5,
        h: 1.0,
        fontSize: 32,
        bold: true,
        color: themeColors.primary,
        fontFace: 'Arial',
      });

      // Subtitle
      titleSlide.addText(slideDeck.subtitle || snapshotData?.subject || 'Generated with IlawCraft', {
        x: 1.0,
        y: 2.6,
        w: 11.5,
        h: 0.6,
        fontSize: 18,
        color: themeColors.accent,
        fontFace: 'Arial',
      });

      // Decorative line under subtitle
      titleSlide.addShape(pptx.ShapeType.line, {
        x: 1.0,
        y: 3.3,
        w: 3.0,
        h: 0,
        line: { color: themeColors.secondary, width: 3 },
      });

      // Footer text
      titleSlide.addText('Prepared for classroom delivery', {
        x: 1.0,
        y: 5.5,
        w: 11.5,
        h: 0.5,
        fontSize: 14,
        color: themeColors.text,
        fontFace: 'Arial',
      });

      // IlawCraft branding
      titleSlide.addText('IlawCraft', {
        x: 10.5,
        y: 6.8,
        w: 2.5,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: themeColors.secondary,
        align: 'right',
        fontFace: 'Arial',
      });

      // ===== CONTENT SLIDES =====
      slideDeck.slides.forEach((slide, slideIdx) => {
        const contentSlide = pptx.addSlide();
        const slideAccentColor = slide.accentColor || themeColors.secondary;
        const isTitleSlide = slide.layout === 'title';
        const isImageFocus = slide.layout === 'image-focus';
        const isActivity = slide.layout === 'activity';
        const isSummary = slide.layout === 'summary';

        // Background color based on layout
        if (isTitleSlide) {
          contentSlide.background = { color: themeColors.primary };
        } else if (isSummary) {
          contentSlide.background = { color: themeColors.background };
        } else {
          contentSlide.background = { color: 'FFFFFF' };
        }

        // Top accent bar
        contentSlide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.12,
          fill: { color: slideAccentColor },
          line: { type: 'none' },
        });

        // Left accent bar
        contentSlide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0.12,
          w: 0.15,
          h: 7.38,
          fill: { color: isTitleSlide ? themeColors.secondary : themeColors.primary },
          line: { type: 'none' },
        });

        // Slide number badge (bottom right)
        contentSlide.addShape(pptx.ShapeType.ellipse, {
          x: 12.3,
          y: 6.8,
          w: 0.6,
          h: 0.6,
          fill: { color: slideAccentColor },
          line: { type: 'none' },
        });
        contentSlide.addText(String(slideIdx + 1), {
          x: 12.3,
          y: 6.8,
          w: 0.6,
          h: 0.6,
          fontSize: 14,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
          valign: 'middle',
          fontFace: 'Arial',
        });

        // Title text
        const titleColor = isTitleSlide ? 'FFFFFF' : themeColors.primary;
        contentSlide.addText(slide.title, {
          x: 0.6,
          y: 0.4,
          w: 11.5,
          h: 0.7,
          fontSize: isTitleSlide ? 30 : 24,
          bold: true,
          color: titleColor,
          fontFace: 'Arial',
        });

        // Subtitle
        if (slide.subtitle) {
          contentSlide.addText(slide.subtitle, {
            x: 0.6,
            y: 1.15,
            w: 11.5,
            h: 0.45,
            fontSize: 14,
            color: isTitleSlide ? 'E2E8F0' : themeColors.accent,
            fontFace: 'Arial',
          });
        }

        // Decorative line under title
        contentSlide.addShape(pptx.ShapeType.line, {
          x: 0.6,
          y: 1.7,
          w: 2.5,
          h: 0,
          line: { color: slideAccentColor, width: 2 },
        });

        // Handle full-slide images (Gemini 3 Pro Image / 3.1 Flash Image renders)
        if (slide.isFullSlideImage && slide.generatedImageUrl) {
          // Full-slide rendered image occupies the entire slide
          try {
            contentSlide.addImage({
              x: 0,
              y: 0,
              w: 13.33,
              h: 7.5,
              data: slide.generatedImageUrl,
            });
          } catch (err) {
            console.warn('Failed to add full-slide image:', err);
            // Fallback: add text content if image fails
            const bullets = (slide.bullets || []).map((bullet) => `• ${bullet}`);
            contentSlide.addText(bullets.join('\n'), {
              x: 0.6,
              y: 2.0,
              w: 12.1,
              h: 4.5,
              fontSize: 18,
              color: themeColors.text,
              breakLine: true,
              margin: 0.08,
              fontFace: 'Arial',
            });
          }
        } 
        // Standard image handling for non-full-slide images
        else if (slide.imageQuery || slide.imageDescription || slide.generatedImageUrl) {
          const imageBoxX = isImageFocus ? 0.6 : 8.5;
          const imageBoxY = 2.0;
          const imageBoxW = isImageFocus ? 12.1 : 4.2;
          const imageBoxH = isImageFocus ? 3.5 : 3.0;

          if (slide.generatedImageUrl) {
            // Add the actual generated image
            try {
              contentSlide.addImage({
                x: imageBoxX,
                y: imageBoxY,
                w: imageBoxW,
                h: imageBoxH,
                data: slide.generatedImageUrl,
              });
            } catch (err) {
              console.warn('Failed to add image to slide:', err);
              // Fallback to placeholder on error
              contentSlide.addShape(pptx.ShapeType.roundRect, {
                x: imageBoxX,
                y: imageBoxY,
                w: imageBoxW,
                h: imageBoxH,
                fill: { color: themeColors.background },
                line: { color: slideAccentColor, width: 2, dashType: 'dash' },
                rectRadius: 0.1,
              });
              contentSlide.addText('🖼️', {
                x: imageBoxX + (imageBoxW / 2) - 0.3,
                y: imageBoxY + 0.3,
                w: 0.6,
                h: 0.6,
                fontSize: 30,
                align: 'center',
                color: slideAccentColor,
              });
              contentSlide.addText(`Image: ${slide.imageQuery || slide.imageDescription}`, {
                x: imageBoxX + 0.2,
                y: imageBoxY + 1.0,
                w: imageBoxW - 0.4,
                h: 1.5,
                fontSize: 11,
                italic: true,
                color: themeColors.accent,
                align: 'center',
                valign: 'middle',
                fontFace: 'Arial',
              });
            }
          } else {
            // No generated image — show placeholder
            contentSlide.addShape(pptx.ShapeType.roundRect, {
              x: imageBoxX,
              y: imageBoxY,
              w: imageBoxW,
              h: imageBoxH,
              fill: { color: themeColors.background },
              line: { color: slideAccentColor, width: 2, dashType: 'dash' },
              rectRadius: 0.1,
            });

            contentSlide.addText('🖼️', {
              x: imageBoxX + (imageBoxW / 2) - 0.3,
              y: imageBoxY + 0.3,
              w: 0.6,
              h: 0.6,
              fontSize: 30,
              align: 'center',
              color: slideAccentColor,
            });

            contentSlide.addText(`Image: ${slide.imageQuery || slide.imageDescription}`, {
              x: imageBoxX + 0.2,
              y: imageBoxY + 1.0,
              w: imageBoxW - 0.4,
              h: 1.5,
              fontSize: 11,
              italic: true,
              color: themeColors.accent,
              align: 'center',
              valign: 'middle',
              fontFace: 'Arial',
            });
          }

          // If image-focus layout, adjust bullet text position
          if (isImageFocus) {
            const bullets = (slide.bullets || []).map((bullet) => `• ${bullet}`);
            contentSlide.addText(bullets.join('\n'), {
              x: 0.6,
              y: 5.7,
              w: 12.1,
              h: 1.5,
              fontSize: 16,
              color: themeColors.text,
              breakLine: true,
              margin: 0.08,
              fontFace: 'Arial',
            });
          } else {
            // Content layout with image on the right
            const bullets = (slide.bullets || []).map((bullet) => `• ${bullet}`);
            contentSlide.addText(bullets.join('\n'), {
              x: 0.6,
              y: 2.0,
              w: 7.5,
              h: 4.5,
              fontSize: 16,
              color: themeColors.text,
              breakLine: true,
              margin: 0.08,
              fontFace: 'Arial',
            });
          }
        } else {
          // No image - full width bullets
          const bullets = (slide.bullets || []).map((bullet) => `• ${bullet}`);
          contentSlide.addText(bullets.join('\n'), {
            x: 0.6,
            y: 2.0,
            w: 12.1,
            h: 4.5,
            fontSize: 18,
            color: themeColors.text,
            breakLine: true,
            margin: 0.08,
            fontFace: 'Arial',
          });
        }

        // Activity badge
        if (isActivity) {
          contentSlide.addShape(pptx.ShapeType.roundRect, {
            x: 10.5,
            y: 0.4,
            w: 2.3,
            h: 0.5,
            fill: { color: slideAccentColor },
            line: { type: 'none' },
            rectRadius: 0.08,
          });
          contentSlide.addText('⚡ ACTIVITY', {
            x: 10.5,
            y: 0.4,
            w: 2.3,
            h: 0.5,
            fontSize: 11,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
            fontFace: 'Arial',
          });
        }

        // Summary badge
        if (isSummary) {
          contentSlide.addShape(pptx.ShapeType.roundRect, {
            x: 10.5,
            y: 0.4,
            w: 2.3,
            h: 0.5,
            fill: { color: themeColors.primary },
            line: { type: 'none' },
            rectRadius: 0.08,
          });
          contentSlide.addText('📋 SUMMARY', {
            x: 10.5,
            y: 0.4,
            w: 2.3,
            h: 0.5,
            fontSize: 11,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
            fontFace: 'Arial',
          });
        }

        // Speaker notes
        if (slide.speakerNotes) {
          contentSlide.addText(`Speaker notes: ${slide.speakerNotes}`, {
            x: 0.6,
            y: 6.5,
            w: 11.5,
            h: 0.6,
            fontSize: 10,
            italic: true,
            color: themeColors.accent,
            fontFace: 'Arial',
          });
        }
      });

      const subjectName = snapshotData?.subject || 'Subject';
      const termName = snapshotData?.term || 'Term 1';
      const weekName = snapshotData?.week || 'Week 1';
      await pptx.writeFile({ fileName: `${subjectName}_${termName}_${weekName}_SlideDeck.pptx` });
    } catch (err) {
      console.error('Error exporting slide deck:', err);
      showToast({ message: 'Failed to download slide deck.', type: 'error' });
    } finally {
      setDownloadingSlides(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 font-sans text-slate-200">
      {instructionModalProvider && (
        <ApiKeyInstructionsModal 
            provider={instructionModalProvider} 
            onClose={() => setInstructionModalProvider(null)} 
        />
      )}
      
      {/* DISCLAIMER GREETING POP-UP MODAL */}
      {showDisclaimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 text-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 border-b border-slate-700 pb-3">
              <IlawLogo className="w-10 h-10 shrink-0" />
              <h2 className="text-xl font-bold text-white">
                Welcome to IlawCraft
              </h2>
            </div>

            {/* Current School Year Badge */}
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 bg-[#1B365D]/80 border border-[#F59E0B]/30 px-4 py-1.5 rounded-full text-amber-400 text-xs font-bold tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
                {getCurrentSchoolYear()}
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                Welcome to <strong className="text-amber-400">IlawCraft</strong>! Please take a moment to review the following usage guidelines:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>
                  <strong className="text-slate-200">AI Assistance Policy:</strong> This tool generates draft lesson plans aligned with DepEd Order No. 016, s. 2026 and DepEd Order No. 003, s. 2026 (Foundational Guidelines on AI in Basic Education).
                </li>
                <li>
                  <strong className="text-slate-200">Teacher Oversight:</strong> AI-generated outputs serve as starting points or recommendations and must be reviewed, contextualized, and customized by human educators prior to classroom implementation.
                </li>
                <li>
                  <strong className="text-slate-200">Data Privacy:</strong> Do not upload sensitive personal data or confidential documents outside standard curriculum guidelines.
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-700 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer select-none text-xs sm:text-sm text-slate-200 font-medium">
                <input
                  type="checkbox"
                  checked={disclaimerAgreed}
                  onChange={(e) => setDisclaimerAgreed(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B] cursor-pointer"
                />
                <span>I agree to the disclaimer and guidelines</span>
              </label>

              <button
                type="button"
                disabled={!disclaimerAgreed}
                onClick={() => setShowDisclaimerModal(false)}
                className="w-full bg-[#1B365D] hover:bg-[#254677] border border-[#F59E0B]/30 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-[#1B365D]/40 text-sm"
              >
                Continue to IlawCraft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT TIMER OVERLAY */}
      {showSupportTimer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-slate-200 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
              <IlawLogo className="w-10 h-10 shrink-0" />
              <h2 className="text-xl font-bold text-white">Support IlawCraft ☕</h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Before generating your lesson plan, please consider supporting IlawCraft&apos;s ongoing development and server costs. Every contribution helps keep this tool free for DepEd teachers! 💛
            </p>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GCash Support</div>
              <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-3">
                <span className="font-mono text-lg font-bold text-[#F59E0B] tracking-wider">09912043738</span>
                <button
                  type="button"
                  onClick={handleCopyGCash}
                  className="bg-[#1B365D] hover:bg-[#254677] text-white p-2 rounded-md transition flex items-center gap-1 text-xs font-semibold border border-[#F59E0B]/30"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or scan to pay</div>
              <img
                src="/qr code gcash.jpg"
                alt="GCash QR Code"
                className="w-36 h-36 object-contain bg-white rounded-lg p-1 border border-slate-700"
              />
            </div>

            <div className="pt-2 border-t border-slate-700 space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait {supportCountdown}s...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT UPLOAD MODAL */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-slate-200 relative animate-in fade-in zoom-in duration-200">
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseReceiptModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
              <Lock className="w-8 h-8 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Unlock BOW Extraction</h2>
            </div>

            {/* Instructions */}
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 space-y-2 text-xs sm:text-sm">
              <p className="font-bold text-amber-400 flex items-center gap-2">
                <Info className="w-4 h-4" /> Instructions
              </p>
              <ol className="list-decimal list-inside text-slate-300 space-y-1.5 leading-relaxed">
                <li>Send <strong className="text-amber-400">₱199</strong> to GCash number <strong className="text-amber-400">09912043738</strong> or scan the QR code below.</li>
                <li>Take a screenshot of your payment confirmation/receipt.</li>
                <li>Upload the screenshot below and click <strong className="text-amber-400">Verify Receipt</strong>.</li>
                <li>Once verified, you will receive <strong className="text-amber-400">10 tokens</strong> to use for BOW extraction.</li>
                <li className="text-slate-500 text-[11px]">Note: Tokens are only consumed on successful extraction. Failed extractions do not cost tokens.</li>
              </ol>
            </div>

            {/* GCash Details */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GCash Payment Details</div>
              <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div>
                  <span className="font-mono text-lg font-bold text-[#F59E0B] tracking-wider">09912043738</span>
                  <span className="ml-3 text-xs text-slate-400">Amount: <strong className="text-amber-400">₱199</strong></span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyGCash}
                  className="bg-[#1B365D] hover:bg-[#254677] text-white p-2 rounded-md transition flex items-center gap-1 text-xs font-semibold border border-[#F59E0B]/30"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or scan to pay</div>
              <img
                src="/qr code gcash.jpg"
                alt="GCash QR Code"
                className="w-32 h-32 object-contain bg-white rounded-lg p-1 border border-slate-700"
              />
            </div>

            {/* Receipt Upload Area */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upload Payment Receipt</div>
              
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleReceiptUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-amber-500/50 transition">
                  {receiptFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-300">{receiptFileName}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon className="w-6 h-6 text-slate-500" />
                      <span className="text-xs text-slate-400">Click to upload receipt screenshot</span>
                      <span className="text-[10px] text-slate-600">JPEG, PNG, or WebP</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verify Button & Status */}
              <button
                type="button"
                onClick={handleVerifyReceipt}
                disabled={!receiptFile || isVerifyingReceipt}
                className={`w-full font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm ${
                  !receiptFile || isVerifyingReceipt
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-md border border-emerald-500/30'
                }`}
              >
                {isVerifyingReceipt ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" /> Verify Receipt
                  </>
                )}
              </button>

              {/* Status Messages */}
              {receiptMessage && (
                <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                  receiptStatus === 'verified' ? 'bg-emerald-950/30 border border-emerald-800/40 text-emerald-300' :
                  receiptStatus === 'rejected' ? 'bg-red-950/30 border border-red-800/40 text-red-300' :
                  receiptStatus === 'error' ? 'bg-red-950/30 border border-red-800/40 text-red-300' :
                  'bg-amber-950/30 border border-amber-800/40 text-amber-300'
                }`}>
                  {receiptStatus === 'verified' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> :
                   receiptStatus === 'rejected' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
                   receiptStatus === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
                   <Info className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-bold">{receiptMessage}</div>
                    {receiptDetails && <div className="mt-1 opacity-80">{receiptDetails}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-5 text-slate-200 relative animate-in fade-in zoom-in duration-200">
            <button
              type="button"
              onClick={() => { setShowAdminModal(false); setAdminPassword(''); setAdminPasswordError(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
              <Key className="w-8 h-8 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Admin Access</h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Enter the admin password to bypass the BOW extraction lock and receive unlimited tokens.
            </p>

            <div className="space-y-3">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setAdminPasswordError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdminPasswordSubmit(); }}
                placeholder="Enter admin password..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
              />
              {adminPasswordError && (
                <p className="text-xs text-red-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {adminPasswordError}
                </p>
              )}
              <button
                type="button"
                onClick={handleAdminPasswordSubmit}
                className="w-full bg-[#1B365D] hover:bg-[#254677] text-white font-bold py-2.5 px-4 rounded-lg transition text-sm border border-[#F59E0B]/30"
              >
                <Key className="w-4 h-4 inline mr-1" /> Unlock
              </button>
              <button
                type="button"
                onClick={() => { window.open('mailto:alotski15@gmail.com?subject=IlawCraft%20Admin%20Password%20Recovery&body=Your%20IlawCraft%20admin%20password%20is%3A%20Mabbie23', '_blank'); showToast({ message: 'Password sent to your email!', type: 'success' }); }}
                className="w-full text-xs text-slate-500 hover:text-amber-400 transition py-1"
              >
                Forgot password? Send to email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT MODAL */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-slate-200 relative">
            <button 
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
              <IlawLogo className="w-10 h-10 shrink-0" />
              <h2 className="text-xl font-bold text-white">Support IlawCraft</h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              If IlawCraft helps you save time and reduce paperwork, consider supporting its ongoing development and server costs!
            </p>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GCash Support</div>
              <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-3">
                <span className="font-mono text-lg font-bold text-[#F59E0B] tracking-wider">09912043738</span>
                <button
                  type="button"
                  onClick={handleCopyGCash}
                  className="bg-[#1B365D] hover:bg-[#254677] text-white p-2 rounded-md transition flex items-center gap-1 text-xs font-semibold border border-[#F59E0B]/30"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or scan to pay</div>
              <img
                src="/qr code gcash.jpg"
                alt="GCash QR Code"
                className="w-40 h-40 object-contain bg-white rounded-lg p-1 border border-slate-700"
              />
            </div>


            <button
              type="button"
              onClick={() => setIsSupportModalOpen(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 px-4 rounded-xl transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">

        {/* MODERN HERO HEADER WITH ILAWCRAFT BRANDING */}
        <div className="text-center py-8 space-y-4 bg-slate-800/60 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 bg-[#1B365D]/90 border border-[#F59E0B]/40 px-4 py-1.5 rounded-full text-amber-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span>DEPED DO 016 S. 2026 · ILAW FRAMEWORK</span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center gap-3">
              <IlawLogo className="w-12 h-12" />
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                Ilaw<span className="text-[#F59E0B]">Craft</span>
              </h1>
            </div>
            <p className="text-amber-400/90 text-sm sm:text-base font-medium tracking-wide">
              Guiding DepEd Teachers, One Lesson at a Time.
            </p>
          </div>

          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            Generate contextualized, classroom-ready ILAW-format lesson plans aligned with DepEd Order No. 016, s. 2026 — engineered specifically for Filipino educators.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-medium text-slate-400 border-t border-slate-700/50 max-w-xl mx-auto">
            <span>
              Crafted by <strong className="text-slate-100 font-semibold">Francis James Alota</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] text-white font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-[#1B365D]/30 border border-[#F59E0B]/30"
            >
              <HeartHandshake className="w-4 h-4 text-[#F59E0B]" />
              <span>Support IlawCraft</span>
            </button>
          </div>
        </div>

        {/* API CONFIGURATION WITH EXACT MATCHING REFERENCE DETAIL DESIGN */}
        <ApiKeyPanel
          onApiKeyChange={setCurrentApiKey}
          onGeminiModelsChange={setCurrentGeminiModels}
        />

        {/* MAIN FORM */}
        <div className="bg-slate-800/80 rounded-2xl shadow-lg border border-slate-700 p-6 sm:p-10 space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <div className="w-1.5 h-8 bg-[#F59E0B] rounded-full"></div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Weekly Lesson Details & Intentions
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 text-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name of Lesson <span className="text-xs text-amber-400 font-normal ml-1">(Optional — AI will auto-generate if left blank)</span>
                </label>
                <input
                  type="text"
                  name="lessonName"
                  value={formData.lessonName}
                  onChange={handleChange}
                  placeholder="Leave blank to auto-generate from standards..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Learning Area/s (Subject)
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ex. Mathematics"
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Designed by Teacher/s
                </label>
                <input
                  type="text"
                  name="teacherName"
                  value={formData.teacherName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ex. Juan Dela Cruz, Teacher I"
                  className={`w-full bg-slate-900 border rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:outline-none ${
                    hasMissingDesignation(formData.teacherName)
                      ? 'border-red-500 focus:ring-red-500 bg-red-950/20'
                      : 'border-slate-700 focus:ring-[#F59E0B]'
                  }`}
                />
                {hasMissingDesignation(formData.teacherName) && (
                  <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Please include designation after a comma (e.g., Juan Dela Cruz, Teacher I).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Checked by (Master Teacher / Dept. Head)
                </label>
                <input
                  type="text"
                  name="masterTeacherName"
                  value={formData.masterTeacherName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ex. Maria Santos, Master Teacher II"
                  className={`w-full bg-slate-900 border rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:outline-none ${
                    hasMissingDesignation(formData.masterTeacherName)
                      ? 'border-red-500 focus:ring-red-500 bg-red-950/20'
                      : 'border-slate-700 focus:ring-[#F59E0B]'
                  }`}
                />
                {hasMissingDesignation(formData.masterTeacherName) && (
                  <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Please include designation after a comma (e.g., Maria Santos, Master Teacher II).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Noted by (School Principal / Head)
                </label>
                <input
                  type="text"
                  name="principalName"
                  value={formData.principalName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ex. Pedro Reyes, Principal IV"
                  className={`w-full bg-slate-900 border rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:outline-none ${
                    hasMissingDesignation(formData.principalName)
                      ? 'border-red-500 focus:ring-red-500 bg-red-950/20'
                      : 'border-slate-700 focus:ring-[#F59E0B]'
                  }`}
                />
                {hasMissingDesignation(formData.principalName) && (
                  <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Please include designation after a comma (e.g., Pedro Reyes, Principal IV).
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Grade Level and Section
                </label>
                <input
                  type="text"
                  name="gradeAndSection"
                  required
                  value={formData.gradeAndSection}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ex: Grade 10 - Kindness, Compassion"
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Medium of Instruction
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                >
                  <option value="English (Default)">English (Default)</option>
                  <option value="Filipino">Filipino</option>
                  <option value="Cebuano / Visayan">Cebuano / Visayan</option>
                  <option value="Ilocano">Ilocano</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  No. of Sessions
                </label>
                <select
                  name="noOfSessions"
                  value={formData.noOfSessions}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-amber-400 font-bold focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                >
                  <option value="1 Session (1 Day)">1 Session (1 Day)</option>
                  <option value="2 Sessions">2 Sessions</option>
                  <option value="3 Sessions">3 Sessions</option>
                  <option value="4 Sessions">4 Sessions</option>
                  <option value="5 Sessions (1 Week)">5 Sessions (1 Week)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Session Duration
                </label>
                <select
                  name="sessionLength"
                  value={formData.sessionLength}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                >
                  <option value="">Select duration...</option>
                  <option value="40 mins">40 mins</option>
                  <option value="45 mins">45 mins</option>
                  <option value="50 mins">50 mins</option>
                  <option value="60 mins">60 mins</option>
                  <option value="90 mins">90 mins</option>
                  <option value="120 mins">120 mins</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select Term</label>
                <select
                  name="term"
                  value={formData.term}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={isExtractingMetadata}
                >
                  {availableTerms.map((termOption) => (
                    <option key={termOption} value={termOption}>{termOption}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select Target Week</label>
                <select
                  name="week"
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    // Allow typing a number to jump to the matching "Week N" option
                    const num = parseInt(e.key, 10);
                    if (!isNaN(num) && num >= 1 && num <= 99) {
                      e.preventDefault();
                      const targetWeek = `Week ${num}`;
                      if (availableWeeks.includes(targetWeek)) {
                        setFormData(prev => ({ ...prev, week: targetWeek }));
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={isExtractingMetadata}
                >
                  {availableWeeks.map((weekOption) => (
                    <option key={weekOption} value={weekOption}>{weekOption}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* EXTRACT FROM BOW AREA WITH DRAG & DROP SUPPORT */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Extract from Budget of Work (BOW)
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                    Optional
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    tokens > 0 || isAdminUnlocked
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    <Lock className="w-3 h-3" />
                    {isInitialTokenLoadComplete ? (
                      isAdminUnlocked ? 'Unlimited' : tokens > 0 ? `${tokens} Token${tokens !== 1 ? 's' : ''}` : 'Locked'
                    ) : 'Locked'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* DRAG AND DROP ZONE */}
                <div 
                  onClick={handleUploadClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 cursor-pointer h-full flex flex-col justify-center ${
                    isDragging 
                      ? 'border-[#F59E0B] bg-amber-950/20 scale-[1.01]' 
                      : bowFile 
                      ? 'border-emerald-500/50 bg-emerald-950/10' 
                      : 'border-slate-700 hover:border-slate-500 bg-slate-900/80'
                  }`}
                >
                  <input 
                    id="bow-file-input"
                    type="file" 
                    accept=".pdf" 
                    onChange={handleBowFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" 
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    {bowFile ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                    )}
                    <div className="text-xs">
                      {bowFile ? (
                        <span className="font-semibold text-emerald-300">{bowFileName}</span>
                      ) : isDragging ? (
                        <span className="font-bold text-amber-400">Drop your BOW PDF here...</span>
                      ) : (
                        <span className="text-slate-300">
                          <strong className="text-amber-400 underline">Click to upload</strong> or drag & drop
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">PDF files only</span>
                  </div>
                </div>

                {/* ACTION & STATUS AREA */}
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Upload or drop a BOW PDF to have the AI extract or intelligently partition merged competencies for your selected target week.
                  </p>
                {isExtractingMetadata && (
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-400 p-3 bg-slate-800/50 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" /> Detecting Terms & Weeks...
                  </div>
                )}
                {!isExtractingMetadata && metadataExtractionError && (
                  <div className="bg-red-950/30 border border-red-800/40 rounded-md p-3 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <div><span className="font-bold">Error:</span> {metadataExtractionError}</div>
                  </div>
                )}

                {!isExtractingMetadata && (
                  <button
                    type="button"
                    onClick={handleLoadEntries}
                    disabled={!bowFile || isExtracting}
                    className={`w-full text-sm font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 ${
                      !bowFile || isExtracting
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-[#1B365D] hover:bg-[#254677] text-white shadow-md border border-[#F59E0B]/30 disabled:opacity-50'
                    }`}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Extracting...
                      </>
                    ) : (
                      'Load Entries'
                    )}
                  </button>
                )}

                {extractionNote && (
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-md p-3 text-xs text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-bold">AI Scope Adjustment Notice:</span> {extractionNote}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Competencies */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Learning Competency
                </label>
                <textarea
                  name="learningCompetency"
                  rows={3}
                  value={formData.learningCompetency}
                  onChange={handleChange}
                  placeholder="Illustrates, solves, and graphs quadratic inequalities in one and two variables..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Content Standards
                </label>
                <textarea
                  name="contentStandards"
                  rows={3}
                  value={formData.contentStandards}
                  onChange={handleChange}
                  placeholder="Demonstrates understanding of key concepts of quadratic inequalities..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Performance Standards
                </label>
                <textarea
                  name="performanceStandards"
                  rows={3}
                  value={formData.performanceStandards}
                  onChange={handleChange}
                  placeholder="Is able to investigate, analyze, solve, and model real-world scenarios..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Learner Context
                </label>
                <select
                  name="learnerContext"
                  value={formData.learnerContext}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                >
                  <option value="">Select learner context...</option>
                  <option value="Mixed readiness levels; visual & hands-on">Mixed readiness levels; visual & hands-on</option>
                  <option value="Highly engaged/Fast learners">Highly engaged/Fast learners</option>
                  <option value="Requires scaffolding/Struggles with reading">Requires scaffolding/Struggles with reading</option>
                  <option value="Active/Social learners (Group-oriented)">Active/Social learners (Group-oriented)</option>
                  <option value="Inclusive/Diverse learning needs">Inclusive/Diverse learning needs</option>
                  <option value="Short attention spans (Needs chunking)">Short attention spans (Needs chunking)</option>
                  <option value="Tech-savvy/Motivated by multimedia">Tech-savvy/Motivated by multimedia</option>
                  <option value="Quiet/Reserved (Needs encouragement)">Quiet/Reserved (Needs encouragement)</option>
                  <option value="Other (Please specify)...">Other (Please specify)...</option>
                </select>

                {formData.learnerContext === 'Other (Please specify)...' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={customLearnerContextText}
                      onChange={(e) => setCustomLearnerContextText(e.target.value)}
                      placeholder="Specify learner context..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Additional Instructions / Prompts <span className="text-slate-500">(Optional)</span>
                </label>
                <textarea
                  name="additionalPrompts"
                  rows={3}
                  value={formData.additionalPrompts}
                  onChange={handleChange}
                  placeholder="Type any custom prompts or guidelines here..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
            </div>

            <hr className="border-slate-700 my-6" />

            {/* RESOURCES AND REFERENCES SIDE-BY-SIDE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Learning Resources Box */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-300">Learning Resources Available</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-slate-400">
                  {[
                    'Laptop/Computer', 'Projector/Smart TV', 'Slide Presentation',
                    'Visual Aids', 'Manipulatives/Models', 'Printed Worksheets',
                    'Chalkboard/Whiteboard', 'Art/Craft Materials', 'Audio/Speakers',
                    'Realia (Real objects)', 'Other (Please specify)...'
                  ].map((item) => (
                    <label key={item} className="flex items-center gap-2 cursor-pointer hover:text-slate-200">
                      <input
                        type="checkbox"
                        value={item}
                        checked={formData.resources.includes(item)}
                        onChange={(e) => handleCheckbox(e, 'resources')}
                        className="rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B]"
                      />
                      {item}
                    </label>
                  ))}
                </div>
                {formData.resources.includes('Other (Please specify)...') && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={customResourceText}
                      onChange={(e) => setCustomResourceText(e.target.value)}
                      placeholder="Enter other resources here..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* References Box */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-300">References</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
                  {[
                    'Lesson Exemplar (LE)', 'Learning Activity Sheets (LAS)',
                    'MATATAG Curriculum Guide', 'Teachers Guide (TG)',
                    'Learners Material (LM)', 'Approved Textbooks',
                    'DepEd LR Portal / LRMDS', 'Educational Video (DepEd TV, etc.)',
                    'Interactive Web Apps', 'Other (Please specify)...'
                  ].map((item) => (
                    <label key={item} className="flex items-center gap-2 cursor-pointer hover:text-slate-200">
                      <input
                        type="checkbox"
                        value={item}
                        checked={formData.references.includes(item)}
                        onChange={(e) => handleCheckbox(e, 'references')}
                        className="rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B]"
                      />
                      {item}
                    </label>
                  ))}
                </div>
                {formData.references.includes('Other (Please specify)...') && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={customReferenceText}
                      onChange={(e) => setCustomReferenceText(e.target.value)}
                      placeholder="Enter other references here..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* COT Indicators Toggle */}
            <div className="flex items-center gap-3 p-4 bg-slate-900/60 border border-slate-700 rounded-xl">
              <input
                type="checkbox"
                id="includeCotIndicators"
                checked={includeCotIndicators}
                onChange={(e) => {
                  if (e.target.checked) {
                    setShowCotWarningModal(true);
                    setCotWarningCountdown(5);
                  } else {
                    setIncludeCotIndicators(false);
                  }
                }}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B] cursor-pointer"
              />
              <label htmlFor="includeCotIndicators" className="text-sm font-medium text-slate-300 cursor-pointer flex-1 flex items-center gap-2 flex-wrap">
                <span>Include COT Indicators in generated lesson plan</span>
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Experimental
                </span>
              </label>
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" title="COT (Classroom Observation Tool) indicators are required for DepEd teacher evaluations. When enabled, the AI will automatically embed these indicators throughout the lesson plan." />
            </div>

            {/* COT WARNING MODAL */}
            {showCotWarningModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-slate-200 relative animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <h2 className="text-xl font-bold text-white">Experimental Feature Warning</h2>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                    <p>
                      The <strong className="text-amber-400">Include COT Indicators</strong> feature is currently <strong className="text-amber-400">under observation</strong>. Use it at your own risk.
                    </p>
                    <p>
                      This feature uses the latest <strong className="text-white">PMES (Performance Management and Evaluation System) tool</strong> that will show which part of the lesson plan has the indicator.
                    </p>

                    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Applicable PMES COT Rating Sheet</div>
                      {(() => {
                        const proficiency = getProficiencyLevel(parseNameAndDesignation(formData.teacherName).designation);
                        const matchingSheet = PMES_COT_SHEETS.find(s => s.title === proficiency);
                        if (matchingSheet) {
                          return (
                            <div className="text-[11px] text-slate-300">
                              <div className="flex items-start gap-2">
                                <span className="text-amber-400 mt-0.5">•</span>
                                <span><strong className="text-slate-200">{matchingSheet.title}</strong> — {matchingSheet.tool}</span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="text-[11px] text-slate-500">
                            No matching proficiency level found. Please ensure the teacher designation is properly formatted (e.g., "Juan Dela Cruz, Teacher I").
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">COT Indicators for This Proficiency Level</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        {COT_INDICATORS.filter(ind => ind !== 'experimental').map((indicator, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                            <span>Indicator {indicator}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Current School Year</div>
                        <div className="text-sm font-bold text-amber-400 mt-1">{getCurrentSchoolYear()}</div>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lesson Plan Designer</div>
                        <div className="text-sm font-bold text-white mt-1">
                          {formData.teacherName ? getOnlyName(formData.teacherName) : 'Not specified'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formData.teacherName ? parseNameAndDesignation(formData.teacherName).designation : ''}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Teacher Proficiency Level</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {getProficiencyLevel(parseNameAndDesignation(formData.teacherName).designation)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700 space-y-3">
                    <button
                      type="button"
                      disabled={cotWarningCountdown > 0}
                      onClick={() => {
                        setShowCotWarningModal(false);
                        setIncludeCotIndicators(true);
                      }}
                      className="w-full bg-[#1B365D] hover:bg-[#254677] border border-[#F59E0B]/30 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-[#1B365D]/40 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {cotWarningCountdown > 0 ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Please wait {cotWarningCountdown}s...
                        </>
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                type="submit"
                disabled={loading}

                className="flex-1 bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] border border-[#F59E0B]/40 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#1B365D]/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> {loadingMessage}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-400" /> Generate Detailed ILAW Lesson Plan
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleAbort}
                disabled={!loading && !showSupportTimer}
                className="flex-none bg-red-700 hover:bg-red-600 active:bg-red-700 border border-red-500/40 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-red-700/30"
              >
                <span className="flex items-center gap-2">
                  <X className="w-5 h-5" />
                  Abort
                </span>
              </button>
            </div>
          </form>

          {/* GENERATED LESSON PLAN DISPLAY — FULL ILAW TEMPLATE MATRIX VIEW */}
          {lessonPlan && (
            <div className="mt-8 p-4 sm:p-8 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-xl space-y-6 overflow-x-auto font-sans">
              
              {/* MAIN HEADER TITLE */}
              <div ref={headerRef} className="text-center border-b-2 border-[#1B365D] pb-3">
                <h2 className="text-xl font-extrabold text-[#1B365D] tracking-wide uppercase">
                  LESSON PLAN TEMPLATE FOR {snapshotData?.subject?.toUpperCase() || 'SUBJECT'} {snapshotData?.term?.toUpperCase()} {snapshotData?.week?.toUpperCase()}
                </h2>
              </div>

              {lessonPlan.rawText ? (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                  {lessonPlan.rawText}
                </div>
              ) : (
                <>
                  {/* === HEADER METADATA TABLE === */}
                  <table className="w-full border-collapse border border-slate-300 text-xs sm:text-sm">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="w-1/4 p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">Lesson Title</td>
                        <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.lessonTitle || snapshotData?.lessonName)}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">Learning Area/s</td>
                        <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.learningArea || snapshotData?.subject)}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">Name of Teacher/s</td>
                        <td className="p-2.5 text-slate-800">{renderSafeContent(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName))}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">Grade Level and Section</td>
                        <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection)}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">No. of Sessions</td>
                        <td className="p-2.5 text-slate-800 font-bold text-[#1B365D]">{renderSafeContent(snapshotData?.noOfSessions)}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">References</td>
                        <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.references || snapshotData?.references)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D] whitespace-nowrap">Declaration of AI use</td>
                        <td className="p-2.5 text-xs text-slate-700 leading-relaxed bg-[#EAEFF5]/40">{renderSafeContent(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* === INTENTIONS SECTION === */}
                  <div className="bg-[#1B365D] text-white p-3 rounded-t-md font-bold text-sm">
                    Intentions. <span className="font-normal text-xs text-slate-200">Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple. Remember: Understanding your learners' evolving context and designing around it ensure that your lessons connect with and are relevant to them.</span>
                  </div>

                  {/* CURRICULUM STANDARDS */}
                  <table className="w-full border-collapse border border-slate-300 text-xs sm:text-sm">
                    <tbody>
                      <tr className="border-b border-slate-300 bg-[#EAEFF5]">
                        <td className="p-3 font-bold text-[#1B365D]">Learning Competency and Curriculum Standards:</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-700 leading-relaxed">
                          <div className="mb-2"><span className="font-bold text-[#1B365D]">Learning Competency:</span><br/>{renderSafeContent(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency, true)}</div>
                          <div className="mb-2"><span className="font-bold text-[#1B365D]">Content Standards:</span><br/>{renderSafeContent(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards, true)}</div>
                          {lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards ? (
                            <div><span className="font-bold text-[#1B365D]">Performance Standards:</span><br/>{renderSafeContent(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards, true)}</div>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* INTENTIONS MATRIX: Learning Objectives + Learner Context across sessions */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#4B5563] text-white">
                          <th className="p-2 border border-slate-400 font-bold text-left w-[17%]">Phase / Component</th>
                          {sessionHeaders.map((h, i) => (
                            <th key={i} className="p-2 border border-slate-400 font-bold text-center" style={{width: `${Math.floor(83 / numSessions)}%`}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Learning Objectives Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Learning Objectives (KSA)</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.learningObjectives)}</td>
                          ))}
                        </tr>
                        {/* Learner Context Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Learner Context</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.learnerContext || snapshotData?.learnerContext)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* === LEARNING EXPERIENCE SECTION === */}
                  <div className="bg-[#1B365D] text-white p-3 rounded-t-md font-bold text-sm">
                    Learning Experience. <span className="font-normal text-xs text-slate-200">A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, or understanding in a purposeful way.</span>
                  </div>

                  {/* LEARNING EXPERIENCE MATRIX */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#4B5563] text-white">
                          <th className="p-2 border border-slate-400 font-bold text-left w-[17%]">Phase / Component</th>
                          {sessionHeaders.map((h, i) => (
                            <th key={i} className="p-2 border border-slate-400 font-bold text-center" style={{width: `${Math.floor(83 / numSessions)}%`}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pre-Lesson Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Pre-Lesson</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.preLesson)}</td>
                          ))}
                        </tr>
                        {/* Flow Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Flow</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.flow)}</td>
                          ))}
                        </tr>
                        {/* Learning Resources Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Learning Resources</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.learningResources)}</td>
                          ))}
                        </tr>
                        {/* Opportunities for Integration Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Opportunities for integration</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.opportunitiesForIntegration)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* === ASSESSMENT SECTION === */}
                  <div className="bg-[#1B365D] text-white p-3 rounded-t-md font-bold text-sm">
                    Assessment. <span className="font-normal text-xs text-slate-200">Assessments reveal what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session.</span>
                  </div>

                  {/* ASSESSMENT MATRIX */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#4B5563] text-white">
                          <th className="p-2 border border-slate-400 font-bold text-left w-[17%]">Phase / Component</th>
                          {sessionHeaders.map((h, i) => (
                            <th key={i} className="p-2 border border-slate-400 font-bold text-center" style={{width: `${Math.floor(83 / numSessions)}%`}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Formative Assessment Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Formative Assessment</td>
                          {sessionHeaders.map((_, idx) => {
                            const assessData = lessonPlan?.sessions?.[idx]?.formativeAssessment;
                            return (
                              <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(assessData)}</td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* === WAYS FORWARD SECTION === */}
                  <div className="bg-[#1B365D] text-white p-3 rounded-t-md font-bold text-sm">
                    Ways Forward. <span className="font-normal text-xs text-slate-200">Meaningful learning can also happen beyond the classroom – for both the learners and the teacher. Pause and reflect on what happened today.</span>
                  </div>

                  {/* WAYS FORWARD MATRIX */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#4B5563] text-white">
                          <th className="p-2 border border-slate-400 font-bold text-left w-[17%]">Phase / Component</th>
                          {sessionHeaders.map((h, i) => (
                            <th key={i} className="p-2 border border-slate-400 font-bold text-center" style={{width: `${Math.floor(83 / numSessions)}%`}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Extended Learning Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Extended learning opportunities</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(getSessionExtendedLearning(lessonPlan, idx))}</td>
                          ))}
                        </tr>
 
                        {/* Reflections Row */}
                        <tr className="h-32">
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D] align-top">Reflections</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{''}</td>
                          ))}
                        </tr>

                      </tbody>
                    </table>
                  </div>

                  {/* === SIGNATORIES TABLE === */}
                  <table className="w-full border-collapse border border-slate-300 text-xs sm:text-sm mt-4">
                    <tbody>
                      <tr>
                        <td className="p-3 border border-slate-300 w-1/3 align-top">
                          <div className="font-bold text-[#1B365D] mb-1">Prepared by:</div>
                          <div className="mt-8"><span className="font-semibold">{teacherSignatory.name || ''}</span></div>
                          <div className="text-slate-600">{teacherSignatory.designation || 'Teacher'}</div>
                        </td>
                        <td className="p-3 border border-slate-300 w-1/3 align-top">
                          <div className="font-bold text-[#1B365D] mb-1">Checked and Reviewed:</div>
                          <div className="mt-8"><span className="font-semibold">{masterTeacherSignatory.name || ''}</span></div>
                          <div className="text-slate-600">{masterTeacherSignatory.designation || 'Master Teacher'}</div>
                        </td>
                        <td className="p-3 border border-slate-300 w-1/3 align-top">
                          <div className="font-bold text-[#1B365D] mb-1">Noted by:</div>
                          <div className="mt-8"><span className="font-semibold">{principalSignatory.name || ''}</span></div>
                          <div className="text-slate-600">{principalSignatory.designation || 'School Head'}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
          {/* Download Buttons for Generated Lesson Plan */}
          {lessonPlan && !lessonPlan.rawText && (
            <>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 shadow-sm">
                <div className="mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1B365D]">Create a classroom-ready slide deck</h3>
                    <p className="text-sm text-slate-600">Turn the generated lesson plan into a concise slide outline you can present in class.</p>
                  </div>
                </div>

                {/* Enhanced Slide Generation Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Session Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Select Session <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="slide-session-select"
                      className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-sm text-slate-900 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
                    >
                      {sessionHeaders.map((header, idx) => (
                        <option key={idx} value={idx}>{header}</option>
                      ))}
                    </select>
                  </div>

                  {/* Slide Count - Fixed at 20 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Number of Slides
                    </label>
                    <div className="text-2xl font-bold text-[#F59E0B]">
                      20 <span className="text-sm font-normal text-slate-500">(maximum per deck)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      Note: Gemini Notebook caps at 20 slides per deck
                    </p>
                    <p className="text-[10px] text-amber-500 mt-1 italic">
                      ⚠️ Daily quota: ~10 slide deck generations per day (rolling 24h window)
                    </p>
                    {!canGenerateSlides() && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold">
                        ⏳ Next generation available in {getTimeUntilNextGeneration() || '24h'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Design Style Selection — Dynamic suggestions based on grade level & subject */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Design Style {snapshotData?.gradeAndSection || snapshotData?.subject ? <span className="text-[10px] text-[#F59E0B] font-normal ml-1">(Recommended for your grade & subject)</span> : null}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {getSuggestedDesignStyles(snapshotData?.gradeAndSection || formData?.gradeAndSection, snapshotData?.subject || formData?.subject).map((style) => (
                      <label key={style.name} className="cursor-pointer relative">
                        <input type="radio" name="designStyle" value={style.name} className="peer sr-only" defaultChecked={style.recommended} />
                        <div className="rounded-lg border-2 border-slate-200 peer-checked:border-[#F59E0B] peer-checked:bg-amber-50 p-3 text-center transition hover:border-slate-300 relative">
                          {style.recommended && (
                            <span className="absolute -top-2 -right-2 bg-[#F59E0B] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                              ★ RECOMMENDED
                            </span>
                          )}
                          <div className="text-xs font-semibold text-slate-900">{style.name}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{style.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Additional Prompt Textbox */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Instructions <span className="text-slate-500">(Optional)</span>
                  </label>
                  <textarea
                    id="slide-additional-prompt"
                    rows={3}
                    placeholder="Example: Design a presentation for the MONDAY lesson only, using a cohesive pink, lilac, and yellow aesthetic. The deck must be visually appealing, incorporating accurate topic-related images and 3D illustrations throughout..."
                    className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={handleGenerateSlides}
                  disabled={generatingSlides}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#1B365D] px-6 py-3 font-semibold text-white shadow-lg shadow-[#1B365D]/25 transition disabled:opacity-50"
                >
                  {generatingSlides ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Generating slides...
                    </>
                  ) : (
                    <>
                      <Presentation className="h-4 w-4 text-amber-400" /> Generate Slide Deck
                    </>
                  )}
                </button>

                {slideDeckError ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {slideDeckError}
                  </div>
                ) : null}

                {slideDeck?.slides?.length ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-700">Slide deck preview</div>
                    {slideDeck.themeColors && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Theme colors:</span>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded border border-slate-300" style={{ backgroundColor: `#${slideDeck.themeColors.primary}` }} title="Primary" />
                          <div className="w-4 h-4 rounded border border-slate-300" style={{ backgroundColor: `#${slideDeck.themeColors.secondary}` }} title="Secondary" />
                          <div className="w-4 h-4 rounded border border-slate-300" style={{ backgroundColor: `#${slideDeck.themeColors.accent}` }} title="Accent" />
                          <div className="w-4 h-4 rounded border border-slate-300" style={{ backgroundColor: `#${slideDeck.themeColors.background}` }} title="Background" />
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {slideDeck.slides.slice(0, 4).map((slide, index) => (
                        <div key={`${slide.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-[#1B365D]">{slide.title}</div>
                            {slide.layout && slide.layout !== 'content' && (
                              <span className="text-[9px] font-bold uppercase bg-[#F59E0B]/10 text-[#F59E0B] px-1.5 py-0.5 rounded-full">
                                {slide.layout}
                              </span>
                            )}
                          </div>
                          {slide.subtitle ? <div className="mt-1 text-xs text-slate-500">{slide.subtitle}</div> : null}
                          {slide.generatedImageUrl ? (
                            <div className="mt-2">
                              <img 
                                src={slide.generatedImageUrl} 
                                alt={slide.imageQuery || slide.imageDescription || 'Generated image'}
                                className={`w-full rounded border border-slate-200 ${slide.isFullSlideImage ? 'aspect-video' : 'h-32 object-cover'}`}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              {slide.isFullSlideImage && (
                                <div className="text-[10px] text-slate-500 mt-1 italic">Full-slide rendered image (1920x1080)</div>
                              )}
                            </div>
                          ) : slide.imageQuery || slide.imageDescription ? (
                            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-slate-500 bg-slate-50 rounded p-1.5 border border-slate-100">
                              <ImageIcon className="w-3 h-3 shrink-0 mt-0.5 text-[#F59E0B]" />
                              <div>
                                <span className="font-semibold">Image:</span> {slide.imageQuery}
                                {slide.imageDescription && <div className="mt-0.5 italic">{slide.imageDescription}</div>}
                              </div>
                            </div>
                          ) : null}
                          {!slide.isFullSlideImage && (
                            <ul className="mt-2 space-y-1 text-xs text-slate-700">
                              {slide.bullets.slice(0, 3).map((bullet, bulletIndex) => (
                                <li key={`${slide.title}-${bulletIndex}`} className="flex gap-2">
                                  <span className="text-[#F59E0B]">•</span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                    {slideDeck.slides.length > 4 ? (
                      <div className="text-sm text-slate-500">+{slideDeck.slides.length - 4} more slides included in the downloaded deck.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={downloadingDocx}
                  className="flex-1 sm:flex-none bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] border border-[#F59E0B]/40 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#1B365D]/30"
                >
                  {downloadingDocx ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Preparing Matrix DOCX...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 text-amber-400" /> Download Matrix DOCX
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSeparatedDocx}
                  disabled={downloadingSeparatedDocx}
                  className="flex-1 sm:flex-none bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] border border-[#F59E0B]/40 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#1B365D]/30"
                >
                  {downloadingSeparatedDocx ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Preparing Separated DOCX...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 text-amber-400" /> Download Separated DOCX
                    </>
                  )}
                </button>
                {slideDeck?.slides?.length ? (
                  <button
                    type="button"
                    onClick={handleDownloadSlidesPptx}
                    disabled={downloadingSlides}
                    className="flex-1 sm:flex-none bg-[#F59E0B] hover:bg-[#d97706] active:bg-[#b45309] border border-[#F59E0B]/40 disabled:opacity-50 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#F59E0B]/20"
                  >
                    {downloadingSlides ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-slate-900" /> Preparing PPTX...
                      </>
                    ) : (
                      <>
                        <Presentation className="w-5 h-5 text-slate-900" /> Download PPTX
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}