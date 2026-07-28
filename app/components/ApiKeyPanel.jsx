 'use client';
import React, { useEffect, useCallback, useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { showToast } from './Toast';

export default function ApiKeyPanel({
  apiKey,
  groqApiKey,
  openRouterApiKey,
  availableModels,
  selectedModel,
  handleGeminiKeyChange,
  handleGroqKeyChange,
  handleOpenRouterKeyChange,
  setSelectedModel,
}) {
  // The parent component `page.js` is now solely responsible for loading
  // API keys from sessionStorage on initial load. This child component
  // now only reads the selected model.
  useEffect(() => {
    try {
      const model = sessionStorage.getItem('selectedModel');
      if (model && setSelectedModel) setSelectedModel(model);
    } catch (e) {
      console.warn('Could not read selectedModel from sessionStorage', e);
    }
  }, []);
  const onGeminiChange = useCallback(
    (e) => {
      try {
        sessionStorage.setItem('gemini_api_key', e.target.value || '');
      } catch (e) {}
      handleGeminiKeyChange && handleGeminiKeyChange(e);
    },
    [handleGeminiKeyChange]
  );

  const onGroqChange = useCallback(
    (e) => {
      try {
        sessionStorage.setItem('groq_api_key', e.target.value || '');
      } catch (e) {}
      handleGroqKeyChange && handleGroqKeyChange(e);
    },
    [handleGroqKeyChange]
  );

  const onOpenRouterChange = useCallback(
    (e) => {
      try {
        sessionStorage.setItem('openrouter_api_key', e.target.value || '');
      } catch (e) {}
      handleOpenRouterKeyChange && handleOpenRouterKeyChange(e);
    },
    [handleOpenRouterKeyChange]
  );

  const onModelChange = useCallback(
    (val) => {
      try {
        sessionStorage.setItem('selectedModel', val);
      } catch (e) {}
      setSelectedModel && setSelectedModel(val);
    },
    [setSelectedModel]
  );

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 shadow-lg">
      
      <div className="bg-[#1C142D] border border-[#6B46C1]/50 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-purple-300 flex items-center gap-2">
            <span>✨</span> Google Gemini API Key <span className="text-purple-400 font-normal">* (required)</span>
          </label>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="password"
            value={apiKey}
            onChange={onGeminiChange}
            placeholder="Paste your Gemini API key (from aistudio.google.com)"
            className="w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono"
          />
        </form>

        <p className="text-xs text-purple-300/80 leading-relaxed">
          Required — free, takes ~2 minutes at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold underline text-purple-300 hover:text-purple-100">
            aistudio.google.com/apikey
          </a>
          . Use your existing Gmail account, no separate signup. Keys are stored for this browser session only and are not shared.
        </p>
      </div>

      <div className="bg-[#26150B] border border-[#C05621]/50 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-amber-400 flex items-center gap-2">
            <span>⚡</span> Groq API Key <span className="text-amber-500 font-normal">(strongly recommended)</span>
          </label>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="password"
            value={groqApiKey}
            onChange={onGroqChange}
            placeholder="Paste your Groq API key"
            className="w-full bg-slate-900 border border-amber-900/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
          />
        </form>
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Not required, but without it, generation falls back to Gemini alone — if Gemini is busy, you'll wait longer or hit an error.
        </p>
      </div>

      <div className="bg-[#131B32] border border-[#3B82F6]/40 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-indigo-300 flex items-center gap-2">
            <span>🔑</span> OpenRouter API Key <span className="text-indigo-400 font-normal">(Optional — final fallback)</span>
          </label>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="password"
            value={openRouterApiKey}
            onChange={onOpenRouterChange}
            placeholder="sk-or-... (Used only if Gemini and Groq both fail)"
            className="w-full bg-slate-900 border border-indigo-800/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
          />
        </form>
        <p className="text-xs text-indigo-300/80 leading-relaxed">
          Last-resort fallback. Get a free key at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="font-bold underline text-indigo-300 hover:text-indigo-100">
            openrouter.ai/keys
          </a>
          .
        </p>
      </div>

      <div className="border border-dashed border-indigo-500/40 bg-indigo-950/20 rounded-2xl p-4 sm:p-5 text-indigo-200 text-xs sm:text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          <span>How it works</span>
        </div>
        <p className="text-indigo-300/90 leading-relaxed pl-6">
          Gemini is tried first, Groq is used if Gemini fails or is busy, and OpenRouter is the final fallback if both fail.
        </p>
      </div>

      <div className="pt-2">
        <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">Primary Gemini Model</label>
        <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-200 focus:ring-2 focus:ring-[#F59E0B] focus:outline-none">
          {availableModels.map((model) => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
