'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Lightbulb, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ApiKeyInstructionsModal from './ApiKeyInstructionsModal';
import { getCookie, setCookie } from '@/lib/cookie';
import {
  parseGeminiModels,
} from '@/lib/model-sorter';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function ApiKeyPanel({
  onApiKeyChange,
  onGeminiModelsChange,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState('');

  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === 'undefined') return getCookie('apikey') || '';
    return localStorage.getItem('gemini_api_key') || getCookie('apikey') || '';
  });

  const [autoDetectStatus, setAutoDetectStatus] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [keyIsValid, setKeyIsValid] = useState(false);

  // Track detected model lists (latest-first) for each provider.
  const [geminiModelIds, setGeminiModelIds] = useState([]);

  const openModal = (provider) => {
    setModalProvider(provider);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProvider('');
  };

  // Helper: apply a sorted (latest-first) model list and propagate to parent.
  const applyGeminiModels = useCallback(
    (sortedIds) => {
      if (!Array.isArray(sortedIds) || sortedIds.length === 0) return;
      setGeminiModelIds(sortedIds);
      if (onGeminiModelsChange) onGeminiModelsChange(sortedIds);
    },
    [onGeminiModelsChange]
  );

  // -------------------------------------------------------------------------
  // Gemini: verify key + fetch compatible models
  // -------------------------------------------------------------------------
  const handleAutoDetectModels = useCallback(async (keyToTest) => {
    const targetKey = keyToTest;
    if (!targetKey || targetKey.trim() === '') {
      setAutoDetectStatus('');
      setKeyIsValid(false);
      setGeminiModelIds([]);
      if (onGeminiModelsChange) onGeminiModelsChange([]);
      return;
    }

    setIsDetecting(true);
    setAutoDetectStatus('');

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        const sortedIds = parseGeminiModels(data.models);

        if (sortedIds.length > 0) {
          applyGeminiModels(sortedIds);
          setKeyIsValid(true);
          setAutoDetectStatus(`Success! Key verified & auto-detected ${sortedIds.length} compatible models (latest first).`);
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
  }, [applyGeminiModels, onGeminiModelsChange]);

  const debouncedAutoDetect = useMemo(
    () => debounce((key) => {
      handleAutoDetectModels(key);
    }, 600),
    [handleAutoDetectModels]
  );

  const hasHydratedInitialValues = useRef(false);

  useEffect(() => {
    if (hasHydratedInitialValues.current) return;
    hasHydratedInitialValues.current = true;

    const savedGemini = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

    if (savedGemini) {
      onApiKeyChange(savedGemini);
      setTimeout(() => handleAutoDetectModels(savedGemini), 0);
    }
  }, [onApiKeyChange, handleAutoDetectModels]);

  const onGeminiChange = useCallback(
    (e) => {
      const val = e.target.value;
      setApiKey(val);
      setCookie('apikey', val);
      localStorage.setItem('gemini_api_key', val);
      onApiKeyChange(val);
      debouncedAutoDetect(val);
    },
    [onApiKeyChange, debouncedAutoDetect]
  );

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 shadow-lg">
      
      {/* 1. GEMINI CARD */}
      <div className="bg-[#1C142D] border border-[#6B46C1]/50 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-purple-300 flex items-center gap-2">
            <span>✨</span> Google Gemini API Key <span className="text-purple-400 font-normal">* (required)</span>
          </label>
          <button
            onClick={() => openModal('gemini')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-200 underline"
          >
            How to get a key?
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
            <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} />
            <input
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={onGeminiChange}
                placeholder="Paste your Gemini API key (from aistudio.google.com)"
                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono ${
                  autoDetectStatus.startsWith('Error')
                    ? 'border-red-500/60 focus:ring-red-500'
                    : keyIsValid
                    ? 'border-emerald-500/60 focus:ring-emerald-500'
                    : 'border-purple-800/60 focus:ring-purple-500'
                }`}
            />
        </form>

        {isDetecting && (
          <span className="text-xs text-purple-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying & detecting models...
          </span>
        )}
        {keyIsValid && !isDetecting && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        {autoDetectStatus.startsWith('Error') && (
            <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {autoDetectStatus}
            </p>
        )}
        {keyIsValid && !autoDetectStatus.startsWith('Error') && autoDetectStatus && (
            <p className="text-xs text-emerald-300/80 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {autoDetectStatus}
            </p>
        )}
        
        <p className="text-xs text-purple-300/80 leading-relaxed">
          Required — free, takes ~2 minutes at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold underline text-purple-300 hover:text-purple-100">
            aistudio.google.com/apikey
          </a>
          . Use your existing Gmail account, no separate signup. Keys are stored for this browser session only and are not shared.
        </p>
        {geminiModelIds.length > 0 && (
          <details className="text-xs text-purple-300/70">
            <summary className="cursor-pointer font-semibold text-purple-400 hover:text-purple-200">
              Detected Gemini models ({geminiModelIds.length}, latest first)
            </summary>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 max-h-32 overflow-y-auto">
              {geminiModelIds.map((m) => <li key={m} className="font-mono text-[11px]">{m}</li>)}
            </ol>
          </details>
        )}
      </div>

      <div className="border border-dashed border-purple-500/40 bg-purple-950/20 rounded-2xl p-4 sm:p-5 text-purple-200 text-xs sm:text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-purple-300">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          <span>How it works</span>
        </div>
        <p className="text-purple-300/90 leading-relaxed pl-6">
          Gemini is the only AI provider used. Enter your free Gemini API key above to get started. All generation and extraction tasks run through Gemini models.
        </p>
      </div>

      {isModalOpen && (
        <ApiKeyInstructionsModal
            provider={modalProvider}
            onClose={closeModal}
        />
    )}
    </div>
  );
}