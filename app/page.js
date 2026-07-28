'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Lightbulb
} from 'lucide-react';
import { 
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
  BorderStyle
} from 'docx';
import { saveAs } from 'file-saver';

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

    {/* Sparkle / AI Star floating near the top of the flame */}
    <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 z-20 animate-bounce" />
  </div>
);

// Updated & Sorted: Latest to Oldest (Obsolete models removed)
const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (gemini-3.6-flash)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (gemini-3.5-flash)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (gemini-3.1-pro-preview)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (gemini-3.1-flash-lite)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (gemini-2.5-pro)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (gemini-2.5-flash)' },
];

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

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

const formatDocxText = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.join('\n');
      } catch (e) {}
    }
    return trimmed
      .replace(/###\s*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^[\s-]*\*\*/gm, '')
      .replace(/^- /gm, '');
  }
  if (Array.isArray(content)) {
    return content.map(item => typeof item === 'object' ? formatDocxText(item) : String(item).replace(/^•\s*/, '')).join('\n');
  }
  if (typeof content === 'object') {
    return Object.entries(content)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${formatDocxText(v)}`)
      .join('\n');
  }
  return String(content);
};

const renderBoldText = (text) => {
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

    elements.push(
      <div key={`text-${idx}`} className="my-0.5 leading-relaxed">
        {renderBoldText(cleanLine)}
      </div>
    );
  });

  return elements;
};

const renderSafeContent = (content, isStandardList = false) => {
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


export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');

  // Default to gemini-3.6-flash
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const [availableModels, setAvailableModels] = useState(DEFAULT_GEMINI_MODELS);
  const [autoDetectStatus, setAutoDetectStatus] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [keyIsValid, setKeyIsValid] = useState(false);

  const [groqKeyIsValid, setGroqKeyIsValid] = useState(false);
  const [isDetectingGroq, setIsDetectingGroq] = useState(false);

  const [availableTerms, setAvailableTerms] = useState(['Term 1', 'Term 2', 'Term 3']); // Default options
  const [availableWeeks, setAvailableWeeks] = useState(Array.from({ length: 11 }, (_, i) => `Week ${i + 1}`)); // Default options
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [metadataExtractionError, setMetadataExtractionError] = useState('');
  const [openRouterKeyIsValid, setOpenRouterKeyIsValid] = useState(false);
  const [isDetectingOpenRouter, setIsDetectingOpenRouter] = useState(false);


  const [bowFile, setBowFile] = useState(null);
  const [bowFileName, setBowFileName] = useState('No file chosen');
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState('');

  const [customResourceText, setCustomResourceText] = useState('');
  const [customReferenceText, setCustomReferenceText] = useState('');
  const [customLearnerContextText, setCustomLearnerContextText] = useState('');

  // Disclaimer Modal State
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  // Support Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
    generalObjectives: '',
    learnerContext: '',
    additionalPrompts: '',
    resources: [],
    references: [],
  });

  const [loading, setLoading] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingSeparatedDocx, setDownloadingSeparatedDocx] = useState(false);
  const [lessonPlan, setLessonPlan] = useState(null);
  const [snapshotData, setSnapshotData] = useState(null);

  // Ref for AbortController for main generation
  const abortControllerRef = useRef(null);

  // Ref for auto-scrolling to lesson plan header
  const headerRef = useRef(null);

  useEffect(() => {
    if (lessonPlan && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [lessonPlan]);

  const handleCopyGCash = () => {
    navigator.clipboard.writeText('09912043738');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoDetectModels = async (keyToTest) => {
    const targetKey = keyToTest || apiKey;
    if (!targetKey || targetKey.trim() === '') {
      setAutoDetectStatus('');
      setKeyIsValid(false);
      return;
    }

    setIsDetecting(true);
    setAutoDetectStatus('');

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        const contentModels = data.models.filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent')
        );

        const formattedModels = contentModels.map((m) => {
          const cleanId = m.name.replace('models/', '');
          return {
            id: cleanId,
            name: `${m.displayName || cleanId} (${cleanId})`,
          };
        });

        if (formattedModels.length > 0) {
          setAvailableModels(formattedModels);
          setKeyIsValid(true);

          // Find a preferred model, excluding 3.6-flash and 3.5-flash initially
          let preferredModel = formattedModels.find(
            (m) => m.id.includes('flash') && !m.id.includes('3.6-flash') && !m.id.includes('3.5-flash')
          );

          // If no other flash model is found, fall back to 3.6 or 3.5 flash
          if (!preferredModel) {
            preferredModel = formattedModels.find(m => m.id.includes('flash'));
          }

          if (formattedModels.some((m) => m.id === selectedModel)) {
            setSelectedModel(selectedModel);
          } else if (preferredModel) {
            setSelectedModel(preferredModel.id);
          } else {
            setSelectedModel(formattedModels[0].id);
          }

          setAutoDetectStatus(`Success! Key verified & auto-detected ${formattedModels.length} compatible models.`);
        } else {
          setKeyIsValid(false);
          setAutoDetectStatus('Error: No content generation models detected for this key.');
        }
      } else if (data.error) {
        setKeyIsValid(false);
        setAutoDetectStatus(`Error: ${data.error.message}`);
      }
    } catch (err) {
      setKeyIsValid(false);
      setAutoDetectStatus(`Error fetching models: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const debouncedAutoDetect = useCallback(
    debounce((key) => handleAutoDetectModels(key), 600),
    []
  );

  const extractBowMetadata = async (file) => {
    if (!file) return;

    if (!apiKey && !groqApiKey && !openRouterApiKey) {
      setMetadataExtractionError('Please enter an API Key to extract BOW metadata.');
      return;
    }

    setIsExtractingMetadata(true);
    setMetadataExtractionError('');

    try {
      const payload = new FormData();
      payload.append('apiKey', apiKey);
      payload.append('groqApiKey', groqApiKey);
      payload.append('openRouterApiKey', openRouterApiKey);
      payload.append('selectedModel', selectedModel);
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

  const handleVerifyProviderKey = async (provider, key) => {
    if (!key || key.trim() === '') {
      if (provider === 'groq') setGroqKeyIsValid(false);
      if (provider === 'openrouter') setOpenRouterKeyIsValid(false);
      return;
    }

    let url, options, setDetecting, setValid;

    if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingGroq;
      setValid = setGroqKeyIsValid;
    } else if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingOpenRouter;
      setValid = setOpenRouterKeyIsValid;
    } else {
      return;
    }

    setDetecting(true);
    setValid(false);

    try {
      const res = await fetch(url, options);
      setValid(res.ok);
    } catch (err) {
      setValid(false);
    } finally {
      setDetecting(false);
    }
  };

  const debouncedVerifyGroq = useCallback(
    debounce((key) => handleVerifyProviderKey('groq', key), 600),
    []
  );
  const debouncedVerifyOpenRouter = useCallback(
    debounce((key) => handleVerifyProviderKey('openrouter', key), 600),
    []
  );

  useEffect(() => {
    const savedGemini = localStorage.getItem('gemini_api_key');
    const savedGroq = localStorage.getItem('groq_api_key');
    const savedOpenRouter = localStorage.getItem('openrouter_api_key');

    if (savedGroq) {
      setGroqApiKey(savedGroq);
      handleVerifyProviderKey('groq', savedGroq);
    }
    if (savedOpenRouter) {
      setOpenRouterApiKey(savedOpenRouter);
      handleVerifyProviderKey('openrouter', savedOpenRouter);
    }

    if (savedGemini) {
      setApiKey(savedGemini);
      handleAutoDetectModels(savedGemini);
    }
  }, []);

  const handleGeminiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
    debouncedAutoDetect(val);
  };

  const handleGroqKeyChange = (e) => {
    const val = e.target.value;
    setGroqApiKey(val);
    localStorage.setItem('groq_api_key', val);
    debouncedVerifyGroq(val);
  };

  const handleOpenRouterKeyChange = (e) => {
    const val = e.target.value;
    setOpenRouterApiKey(val);
    localStorage.setItem('openrouter_api_key', val);
    debouncedVerifyOpenRouter(val);
  };

  const processBowFile = (file) => {
    if (file && file.type === 'application/pdf') {
      setBowFile(file);
      setBowFileName(file.name);
    } else if (file) {
      alert('Please upload a valid PDF file.');
    }
  };

  const handleBowFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      processBowFile(file);
      await extractBowMetadata(file); // Call new function to extract terms and weeks
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
      processBowFile(droppedFile);
      await extractBowMetadata(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleLoadEntries = async () => {
    if (!apiKey && !groqApiKey && !openRouterApiKey) {
      alert('Please enter an API Key in the API Configuration section.');
      return;
    }

    setIsExtracting(true);
    setExtractionNote('');

    try {
      const payload = new FormData();
      payload.append('apiKey', apiKey);
      payload.append('groqApiKey', groqApiKey);
      payload.append('openRouterApiKey', openRouterApiKey);
      payload.append('selectedModel', selectedModel);
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
    } catch (err) {
      alert(`Extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false); // Manually set loading to false on abort
      alert('Lesson plan generation aborted.');
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
    if (!apiKey && !groqApiKey && !openRouterApiKey) {
      alert('Please enter an API Key in the API Configuration section above.');
      return;
    }

    if (
      hasMissingDesignation(formData.teacherName) ||
      hasMissingDesignation(formData.masterTeacherName) ||
      hasMissingDesignation(formData.principalName)
    ) {
      alert('Please include designations for all filled signatory fields (formatted as Name, Designation).');
      return;
    }

    setLoading(true);
    setLessonPlan(null);

    const controller = new AbortController(); // Create AbortController
    abortControllerRef.current = controller; // Store it in ref

    try {
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

      const referenceMatrixPrompt = `
        ${autoTitlePrompt}

        MANDATORY CURRICULUM FLOW & MATRIX ALIGNMENT:
        Base the 5 sessions structure precisely on this plan:
        Session 1:
          - Pre-Lesson: Review of quadratic equations and inequalities basics.
          - Flow: Introduction to quadratic inequalities, guided practice, and group discussion.
          - Learning Resources: Laptop/Computer, Slide Presentation, Chalkboard/Whiteboard.
          - Opportunities for Integration: Connecting quadratic inequalities to real-world problems and other math concepts.
        Session 2:
          - Pre-Lesson: Review of session 1 and introduction to algebraic methods.
          - Flow: Direct instruction, guided practice, and independent work.
          - Learning Resources: Slide Presentation, Audio/Speakers, Chalkboard/Whiteboard.
          - Opportunities for Integration: Integrate technology to visualize and solve quadratic inequalities.
        Session 3:
          - Pre-Lesson: Introduction to quadratic inequalities in two variables.
          - Flow: Group work, presentations, and class discussion.
          - Learning Resources: Laptop/Computer, Projector/Smart TV, Chalkboard/Whiteboard.
          - Opportunities for Integration: Connecting quadratic inequalities in two variables to real-world applications.
        Session 4:
          - Pre-Lesson: Review of session 3 and introduction to graphical methods.
          - Flow: Direct instruction, guided practice, and independent work.
          - Learning Resources: Slide Presentation, Audio/Speakers, Projector/Smart TV.
          - Opportunities for Integration: Integrate technology to visualize and solve quadratic inequalities in two variables.
        Session 5:
          - Pre-Lesson: Review of previous sessions and introduction to complex problems.
          - Flow: Independent work, group discussion, and presentations.
          - Learning Resources: Laptop/Computer, Projector/Smart TV, Chalkboard/Whiteboard.
          - Opportunities for Integration: Connecting quadratic inequalities to other math concepts and real-world applications.

        STRICT REQUIREMENT FOR OBJECTIVES:
        Formulate Learning Objectives for each session explicitly formatted as KSA:
        - Knowledge: [Concept recall/understanding]
        - Skills: [Action/problem solving]
        - Attitudes: [Value/disposition]
      `;

      const payload = {
        ...submissionSnapshot,
        additionalPrompts: `${formData.additionalPrompts || ''}\n\n${referenceMatrixPrompt}`.trim(),
        numSessions: parsedSessions,
        topic: formData.lessonName || `${formData.term} ${formData.week} (${formData.subject})`,
        gradeLevel: formData.gradeAndSection,
        teacherName: formData.teacherName,
        checkerName: formData.masterTeacherName,
        geminiApiKey: apiKey,
        groqApiKey: groqApiKey,
        openRouterApiKey: openRouterApiKey,
        selectedModel: selectedModel,
      };

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan');

      if (data.plan) {
        setLessonPlan({ ...data.plan, provider: data.provider });
      } else if (data.lessonPlan) {
        if (typeof data.lessonPlan === 'string') {
          try {
            const parsed = JSON.parse(data.lessonPlan);
            setLessonPlan({ ...parsed, provider: data.provider });
          } catch (e) {
            setLessonPlan({ rawText: data.lessonPlan, provider: data.provider, ...submissionSnapshot });
          }
        } else {
          setLessonPlan(data.lessonPlan);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted by user.');
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null; // Clear the ref
    }
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

  // ILAW Template Formatting Constants (extracted from ILAW clumnar blank.docx)
  const TEMPLATE_BORDER_COLOR_HEADER = 'D1D5DB';
  const TEMPLATE_BORDER_COLOR_MATRIX = '4B5563';
  const TEMPLATE_LABEL_FILL = 'F3F4F6';
  const TEMPLATE_BANNER_FILL = 'D1D5DB';
  const TEMPLATE_HEADER_CELL_MARGINS = { top: 100, left: 100, bottom: 100, right: 100 };
  const TEMPLATE_MATRIX_CELL_MARGINS = { top: 120, left: 120, bottom: 120, right: 120 };
  const TEMPLATE_BANNER_CELL_MARGINS = { top: 200, left: 120, bottom: 200, right: 120 };
  const TEMPLATE_TABLE_CELL_MARGINS = { top: 15, left: 15, bottom: 15, right: 15 };
  const TEMPLATE_BORDER_SIZE = 8;

  const createBorderSet = (color) => ({
    top: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    left: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    bottom: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
    right: { val: BorderStyle.SINGLE, size: TEMPLATE_BORDER_SIZE, space: 0, color: color },
  });

  // Helper for Cell Generation in DOCX — matches ILAW clumnar blank.docx template
  const createCell = useCallback((text, options = {}) => {
    const {
      fill,
      bold,
      color = '333333',
      widthPct = null,
      colSpan = 1,
      italic = false,
      borderColor = TEMPLATE_BORDER_COLOR_HEADER,
      cellMargins = TEMPLATE_HEADER_CELL_MARGINS,
      alignment = AlignmentType.LEFT,
      fontSize = 20,
    } = options;

    const paragraphs = String(text || '').split('\n').map(line =>
      new Paragraph({
        alignment,
        spacing: { line: 276, after: 0, before: 0 },
        children: [
          new TextRun({
            text: line,
            bold: !!bold,
            italic: !!italic,
            color: color,
            size: fontSize,
            font: 'Arial',
          }),
        ],
      })
    );

    return new TableCell({
      columnSpan: colSpan > 1 ? colSpan : undefined,
      width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
      shading: fill ? { fill: fill, type: ShadingType.CLEAR } : undefined,
      margins: cellMargins,
      borders: createBorderSet(borderColor),
      children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '', font: 'Arial', size: 20 })] })],
    });
  }, []);

  // Matrix Landscape DOCX Download
  const handleDownloadDocx = useCallback(async () => {
    if (!lessonPlan) return;
    setDownloadingDocx(true);

    try {
      const titleText = `LESSON PLAN TEMPLATE FOR ${(snapshotData?.subject || 'SUBJECT').toUpperCase()} ${(snapshotData?.term || '').toUpperCase()} ${(snapshotData?.week || '').toUpperCase()}`;
      
      const tableSubHeaderStyle = { fill: "4B5563", color: "FFFFFF", bold: true };
      const tableLabelStyle = { fill: TEMPLATE_LABEL_FILL, color: "1B365D", bold: true };

      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
        rows: [
          new TableRow({ children: [createCell("Lesson Title", { ...tableLabelStyle, widthPct: 25, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.lessonTitle || snapshotData?.lessonName), { widthPct: 75, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("Learning Area/s", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.learningArea || snapshotData?.subject), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("Name of Teacher/s", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName)), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("Grade Level and Section", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("No. of Sessions", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(snapshotData?.noOfSessions), { bold: true, color: "1B365D", borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("References", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.references || snapshotData?.references), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ children: [createCell("Declaration of AI use", { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }), createCell(formatDocxText(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`), { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] })
        ]
      });

      const standardsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
        rows: [
          new TableRow({ children: [createCell("Learning Competency and Curriculum Standards:", { fill: TEMPLATE_LABEL_FILL, bold: true, color: "1B365D", borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS })] }),
          new TableRow({ 
            children: [
              createCell(
                `Learning Competency:\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}\n\n` +
                `Content Standards:\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\n` +
                `Performance Standards:\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}`,
                { borderColor: TEMPLATE_BORDER_COLOR_HEADER, cellMargins: TEMPLATE_HEADER_CELL_MARGINS }
              )
            ] 
          })
        ]
      });

      const createMatrixTable = (rowsData) => {
        const colWidth = Math.floor(83 / numSessions);
        const headerRow = new TableRow({
          children: [
            createCell("Phase / Component", { ...tableSubHeaderStyle, widthPct: 17, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS }),
            ...sessionHeaders.map(h => createCell(h, { ...tableSubHeaderStyle, widthPct: colWidth, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS }))
          ]
        });

        const dataRows = rowsData.map(row => {
          return new TableRow({
            children: [
              createCell(row.label, { ...tableLabelStyle, borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS }),
              ...sessionHeaders.map((_, idx) => createCell(row.getValue(idx), { borderColor: TEMPLATE_BORDER_COLOR_MATRIX, cellMargins: TEMPLATE_MATRIX_CELL_MARGINS }))
            ]
          });
        });

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, tableCellMar: TEMPLATE_TABLE_CELL_MARGINS, rows: [headerRow, ...dataRows] });
      };

      const intentionsTable = createMatrixTable([
        {
          label: "Learning Objectives (KSA)",
          getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[idx] : lessonPlan.learningObjectives))
        },
        {
          label: "Learner Context",
          getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[idx] : lessonPlan.learnerContext) || snapshotData?.learnerContext)
        }
      ]);

      const experienceTable = createMatrixTable([
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

      const assessmentTable = createMatrixTable([
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

      const waysForwardTable = createMatrixTable([
        {
          label: "Extended learning opportunities",
          getValue: (idx) => formatDocxText(lessonPlan.sessions?.[idx]?.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan.waysForward?.extendedLearningOpportunities))
        },
        {
          label: "Reflections",
          getValue: () => "\n\n\n\n\n\n"
        }
      ]);

      const signatoriesTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createCell(`Prepared by:\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || ''}`, { widthPct: 33 }),
              createCell(`Checked and Reviewed:\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || ''}`, { widthPct: 33 }),
              createCell(`Noted by:\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || ''}`, { widthPct: 34 }),
            ]
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
    } catch (err) {
      console.error('Error exporting DOCX:', err);
      alert('Failed to generate Word document.');
    } finally {
      setDownloadingDocx(false);
    }
  }, [lessonPlan, snapshotData, numSessions, sessionHeaders, teacherSignatory, masterTeacherSignatory, principalSignatory, createCell]);

  // Separated Daily Lesson Plans DOCX Download
  const handleDownloadSeparatedDocx = useCallback(async () => {
    if (!lessonPlan) return;
    setDownloadingSeparatedDocx(true);

    try {
      const headerBannerStyle = { fill: TEMPLATE_BANNER_FILL, color: "333333", bold: true };
      const matrixBorder = TEMPLATE_BORDER_COLOR_MATRIX;
      const matrixMargins = TEMPLATE_MATRIX_CELL_MARGINS;
      const headerMargins = TEMPLATE_HEADER_CELL_MARGINS;

      const sections = [];

      for (let idx = 0; idx < numSessions; idx++) {
        const sessionLabel = `Session ${idx + 1} of ${numSessions}`;
        
        const sessionObj = lessonPlan.sessions?.[idx] || {};
        const objectives = formatDocxText(sessionObj.learningObjectives || (Array.isArray(lessonPlan.learningObjectives) ? lessonPlan.learningObjectives[idx] : lessonPlan.learningObjectives));
        const context = formatDocxText(sessionObj.learnerContext || (Array.isArray(lessonPlan.learnerContext) ? lessonPlan.learnerContext[idx] : lessonPlan.learnerContext) || snapshotData?.learnerContext);
        const preLesson = formatDocxText(sessionObj.preLesson || (Array.isArray(lessonPlan.learningExperience?.preLesson) ? lessonPlan.learningExperience.preLesson[idx] : lessonPlan.learningExperience?.preLesson));
        const flow = formatDocxText(sessionObj.flow || (Array.isArray(lessonPlan.learningExperience?.flow) ? lessonPlan.learningExperience.flow[idx] : lessonPlan.learningExperience?.flow));
        const resources = formatDocxText(sessionObj.learningResources || (Array.isArray(lessonPlan.learningResources) ? lessonPlan.learningResources[idx] : lessonPlan.learningResources) || snapshotData?.resources);
        const integration = formatDocxText(sessionObj.opportunitiesForIntegration || (Array.isArray(lessonPlan.opportunitiesForIntegration) ? lessonPlan.opportunitiesForIntegration[idx] : lessonPlan.opportunitiesForIntegration));
        
        const assessData = sessionObj.formativeAssessment || 
          (Array.isArray(lessonPlan?.assessingLearning?.formativeAssessment) 
             ? lessonPlan.assessingLearning.formativeAssessment[idx] 
             : lessonPlan?.assessingLearning?.formativeAssessment);
        const assessment = formatDocxText(assessData);

        const extended = formatDocxText(sessionObj.extendedLearning || (Array.isArray(lessonPlan.waysForward?.extendedLearningOpportunities) ? lessonPlan.waysForward.extendedLearningOpportunities[idx] : lessonPlan.waysForward?.extendedLearningOpportunities));

        const sessionTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          tableCellMar: TEMPLATE_TABLE_CELL_MARGINS,
          rows: [
            new TableRow({
              children: [
                createCell(`LESSON PLAN (${sessionLabel.toUpperCase()})\n(based on the ILAW FRAMEWORK)`, { ...headerBannerStyle, fill: headerBannerStyle.fill, colSpan: 4, widthPct: 100, borderColor: matrixBorder, cellMargins: TEMPLATE_BANNER_CELL_MARGINS })
              ]
            }),
            new TableRow({
              children: [
                createCell("Learning Area:", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(formatDocxText(lessonPlan.header?.learningArea || snapshotData?.subject), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Name of Teachers:", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(formatDocxText(getOnlyName(lessonPlan.header?.teacherName || snapshotData?.teacherName)), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Grade level & Section:", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(formatDocxText(lessonPlan.header?.gradeLevelSection || snapshotData?.gradeAndSection), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("No. of Sessions:", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(`${snapshotData?.noOfSessions || ''} (${sessionLabel})`, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("References:\nbooks, websites, toolkits, etc.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(formatDocxText(lessonPlan.header?.references || snapshotData?.references), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Declaration of AI Use:\nCite how AI was used in the formulation of the lesson plan.\nSee DO no. 3 s. 2026", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(formatDocxText(lessonPlan.header?.declarationOfAiUse || `Consistent with policy guidelines on AI in basic education...`), { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Intentions:", { ...headerBannerStyle, fill: headerBannerStyle.fill, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell("Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple.\nRemember: Understanding your learner’s evolving context and designing around that your lessons connect with and are relevant to them.", { colSpan: 3, widthPct: 75, fill: "F8FAFC", borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Learning Competency &\nCurriculum Standards:\nWrite the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(
                  `Content Standard:\n${formatDocxText(lessonPlan.curriculumStandards?.contentStandard || snapshotData?.contentStandards)}\n\n` +
                  `Performance Standard:\n${formatDocxText(lessonPlan.curriculumStandards?.performanceStandard || snapshotData?.performanceStandards)}\n\n` +
                  `Learning Competency:\n${formatDocxText(lessonPlan.curriculumStandards?.learningCompetency || snapshotData?.learningCompetency)}`,
                  { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins }
                )
              ]
            }),
            new TableRow({
              children: [
                createCell("Learning Objectives:\nWrite the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(objectives, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Learner Context:\nWrite your observation of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(context, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Learning Experience", { ...headerBannerStyle, fill: headerBannerStyle.fill, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell("A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, and understanding in a purposeful and coherent way.", { colSpan: 3, widthPct: 75, fill: "F8FAFC", borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Pre-Lesson:\nDescribe how you will help the learners get ready with the lesson", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(preLesson, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell(
                  "Flow:\nDescribe the activities that you can implement in 1 or more sessions to meet your intentions.\nApply the Learning Design Principles, use the prompts below as a guide. Note, not all principles are expected in every lesson.\n" +
                  "• make the objectives clear\n• guide learners before letting them try the task on their own\n• check the state of the learner’s well-being, understanding, and mastery over the lesson\n" +
                  "• connect today’s new concepts to past competencies\n• encourage collaboration among learners\n• invite learners to reflect on why this matters to them\n" +
                  "• ensure inclusion for learner’s varied abilities, learning styles, and contexts",
                  { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }
                ),
                createCell(flow, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Learning Resources:\nList down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\nInclude options and alternatives in case of emergencies", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(resources, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Opportunities for Integration and Contextualization:\nWrite down any possibilities to meaningfully connect to another learning area, special topic, local context, or technology. Write N/A if none.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(integration, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Assessing Learning", { ...headerBannerStyle, fill: headerBannerStyle.fill, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell("Assessment reveals what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session.", { colSpan: 3, widthPct: 75, fill: "F8FAFC", borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell(
                  "Formative Assessment:\nCreate a task, activity, or questions to assess learning and provide feedback every now and then. Include ways for learners to ask for guidance or support throughout each session.\n" +
                  "Remember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)",
                  { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }
                ),
                createCell(assessment, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Ways Forward", { ...headerBannerStyle, fill: headerBannerStyle.fill, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell("Meaningful learning can also happen beyond the classroom – for both the learners and the teacher.\nPause and reflect on what happened today.", { colSpan: 3, widthPct: 75, fill: "F8FAFC", borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell("Extended Learning Opportunities:\nSuggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.", { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(extended, { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell(
                  "Reflections:\nThink about what you need to change for the next session based on what happened today. Is there something the learners are interested in exploring?\n" +
                  "Are there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?\n" +
                  "Reflections may be written in brief notes, bullets, or annotations.",
                  { bold: true, widthPct: 25, borderColor: matrixBorder, cellMargins: matrixMargins }
                ),
                createCell("\n\n\n\n\n\n", { colSpan: 3, widthPct: 75, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            }),
            new TableRow({
              children: [
                createCell(`Prepared by:\n\n\n${teacherSignatory.name || ''}\n${teacherSignatory.designation || 'Teacher'}`, { widthPct: 33, colSpan: 1, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(`Checked and Reviewed:\n\n\n${masterTeacherSignatory.name || ''}\n${masterTeacherSignatory.designation || 'Master Teacher'}`, { widthPct: 33, colSpan: 1, borderColor: matrixBorder, cellMargins: matrixMargins }),
                createCell(`Noted by:\n\n\n${principalSignatory.name || ''}\n${principalSignatory.designation || 'School Head'}`, { widthPct: 34, colSpan: 2, borderColor: matrixBorder, cellMargins: matrixMargins })
              ]
            })
          ]
        });

        sections.push({
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
              orientation: PageOrientation.PORTRAIT
            }
          },
          children: [
            sessionTable
          ]
        });
      }

      const doc = new Document({
        styles: { default: { document: { run: { font: "Arial" } } } },
        sections: sections
      });

      const blob = await Packer.toBlob(doc);
      const subjectName = snapshotData?.subject || 'Subject';
      const termName = snapshotData?.term || 'Term 1';
      const weekName = snapshotData?.week || 'Week 1';

      saveAs(blob, `${subjectName}_${termName}_${weekName}_Daily_Separated.docx`);
    } catch (err) {
      console.error('Error exporting Separated DOCX:', err);
      alert('Failed to generate separated daily lesson plans.');
    } finally {
      setDownloadingSeparatedDocx(false);
    }
  }, [lessonPlan, snapshotData, numSessions, teacherSignatory, masterTeacherSignatory, principalSignatory, createCell]);

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 font-sans text-slate-200">
      
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
              <HeartHandshake className="w-6 h-6 text-[#F59E0B] shrink-0" />
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
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 shadow-lg">
          
          {/* 1. GEMINI CARD */}
          <div className="bg-[#1C142D] border border-[#6B46C1]/50 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <label className="block text-sm sm:text-base font-bold text-purple-300 flex items-center gap-2">
                <span>✨</span> Google Gemini API Key <span className="text-purple-400 font-normal">* (required)</span>
              </label>
              {isDetecting && (
                <span className="text-xs text-purple-400 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                </span>
              )}
              {keyIsValid && !isDetecting && (
                <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
                </span>
              )}
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={handleGeminiKeyChange}
              placeholder="Paste your Gemini API key (from aistudio.google.com)"
              className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono ${
                autoDetectStatus.startsWith('Error')
                  ? 'border-red-500/60 focus:ring-red-500'
                  : keyIsValid
                  ? 'border-emerald-500/60 focus:ring-emerald-500'
                  : 'border-purple-800/60 focus:ring-purple-500'
              }`}
            />

            <p className="text-xs text-purple-300/80 leading-relaxed">
              Required — free, takes ~2 minutes at{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-purple-300 hover:text-purple-100"
              >
                aistudio.google.com/apikey
              </a>
              . Use your existing Gmail account, no separate signup. Your key stays in your browser and is never shared.
            </p>
          </div>

          {/* 2. GROQ CARD */}
          <div className="bg-[#26150B] border border-[#C05621]/50 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <label className="block text-sm sm:text-base font-bold text-amber-400 flex items-center gap-2">
                <span>⚡</span> Groq API Key <span className="text-amber-500 font-normal">(strongly recommended)</span>
              </label>
              {isDetectingGroq && (
                <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                </span>
              )}
              {groqKeyIsValid && !isDetectingGroq && (
                <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
                </span>
              )}
            </div>
            <input
              type="password"
              value={groqApiKey}
              onChange={handleGroqKeyChange}
              placeholder="Paste your Groq API key"
              className="w-full bg-slate-900 border border-amber-900/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Not required, but without it, generation falls back to Gemini alone — if Gemini is busy, you'll wait longer or hit an error. Adding a free key from{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-amber-300 hover:text-amber-100"
              >
                console.groq.com
              </a>{' '}
              (~1 minute) gives you an instant backup.
            </p>
          </div>

          {/* 3. OPENROUTER CARD */}
          <div className="bg-[#131B32] border border-[#3B82F6]/40 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <label className="block text-sm sm:text-base font-bold text-indigo-300 flex items-center gap-2">
                <span>🔑</span> OpenRouter API Key <span className="text-indigo-400 font-normal">(Optional — final fallback)</span>
              </label>
              {isDetectingOpenRouter && (
                <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                </span>
              )}
              {openRouterKeyIsValid && !isDetectingOpenRouter && (
                <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
                </span>
              )}
            </div>
            <input
              type="password"
              value={openRouterApiKey}
              onChange={handleOpenRouterKeyChange}
              placeholder="sk-or-... (Used only if Gemini and Groq both fail)"
              className="w-full bg-slate-900 border border-indigo-800/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-indigo-300/80 leading-relaxed">
              Last-resort fallback. Get a free key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-indigo-300 hover:text-indigo-100"
              >
                openrouter.ai/keys
              </a>
              .
            </p>
          </div>

          {/* 4. HOW IT WORKS INFO BOX */}
          <div className="border border-dashed border-indigo-500/40 bg-indigo-950/20 rounded-2xl p-4 sm:p-5 text-indigo-200 text-xs sm:text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
              <span>How it works</span>
            </div>
            <p className="text-indigo-300/90 leading-relaxed pl-6">
              Gemini is tried first, Groq is used if Gemini fails or is busy, and OpenRouter is the final fallback if both fail. Adding all three keys gives you the most reliable, fastest generations — but only Gemini is required.
            </p>
          </div>

          {/* MODEL SELECTION */}
          <div className="pt-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Primary Gemini Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-200 focus:ring-2 focus:ring-[#F59E0B] focus:outline-none"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            {autoDetectStatus && (
              <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${autoDetectStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`} style={{ display: autoDetectStatus.startsWith('Error') ? 'flex' : 'none' }}>
                {autoDetectStatus.startsWith('Error') && <AlertCircle className="w-4 h-4 shrink-0" />}
                {autoDetectStatus}
              </p>
            )}
          </div>
        </div>

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
                  value={formData.week}
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
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                  Optional
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* DRAG AND DROP ZONE */}
                <div 
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
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
                </div>
              </div>

              {extractionNote && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-md p-3 text-xs text-amber-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">AI Scope Adjustment Notice:</span> {extractionNote}
                  </div>
                </div>
              )}
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

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] border border-[#F59E0B]/40 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#1B365D]/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Generating Detailed IlawCraft Plan...
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
                disabled={!loading}
                className="flex-none bg-red-700 hover:bg-red-600 active:bg-red-700 border border-red-500/40 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-red-700/30"
              >
                <X className="w-5 h-5" /> Abort
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
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Learning Objectives (KSA)</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.learningObjectives)}</td>
                          ))}
                        </tr>
                        {/* Learner Context Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Learner Context</td>
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
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Pre-Lesson</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.preLesson)}</td>
                          ))}
                        </tr>
                        {/* Flow Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Flow</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.flow)}</td>
                          ))}
                        </tr>
                        {/* Learning Resources Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Learning Resources</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.learningResources)}</td>
                          ))}
                        </tr>
                        {/* Opportunities for Integration Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Opportunities for integration</td>
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
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Formative Assessment</td>
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
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Extended learning opportunities</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.extendedLearning)}</td>
                          ))}
                        </tr>
                        {/* Reflections Row */}
                        <tr>
                          <td className="p-2 border border-slate-400 font-bold bg-[#F3F4F6] text-[#1B365D]">Reflections</td>
                          {sessionHeaders.map((_, idx) => (
                            <td key={idx} className="p-2 border border-slate-400 align-top">{renderSafeContent(lessonPlan.sessions?.[idx]?.reflections || '\n\n\n\n\n\n')}</td>
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
        </div>
      </div>
    </div>
  );
}