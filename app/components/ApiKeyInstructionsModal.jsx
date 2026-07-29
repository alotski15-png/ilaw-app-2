import { X } from 'lucide-react';

const INSTRUCTIONS = {
  gemini: {
    title: 'How to get a Google Gemini API Key',
    steps: [
      'Go to aistudio.google.com/apikey.',
      'Log in with your Google account.',
      'Click the "Create API key" button in a new project.',
      'Copy the generated key and paste it into the input field on the IlawCraft page.',
    ],
    url: 'https://aistudio.google.com/apikey',
  },
  groq: {
    title: 'How to get a Groq API Key',
    steps: [
      'Go to console.groq.com.',
      'Sign up for a new account or log in if you have one.',
      'Navigate to the "API Keys" section from the left-hand menu.',
      'Click the "Create API Key" button.',
      'Give your key a name, then click "Create".',
      'Copy the displayed key and paste it into the Groq input field on the IlawCraft page.',
    ],
    url: 'https://console.groq.com/keys',
  },
  openrouter: {
    title: 'How to get an OpenRouter API Key',
    steps: [
      'Go to openrouter.ai/keys.',
      'Sign up for a new account or log in.',
      'Click the "Create Key" button.',
      'Give your key a name, then click "Create".',
      'Copy the key (it starts with "sk-or-...") and paste it into the OpenRouter input field on the IlawCraft page.',
    ],
    url: 'https://openrouter.ai/keys',
  },
};

export default function ApiKeyInstructionsModal({ provider, onClose }) {
  const providerInfo = INSTRUCTIONS[provider];

  if (!providerInfo) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-slate-200 relative animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          aria-label="Close instructions"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl sm:text-2xl font-bold text-white pr-8">{providerInfo.title}</h2>

        <ol className="list-decimal list-inside space-y-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          {providerInfo.steps.map((step, index) => (
            <li key={index} className="pl-2">{step}</li>
          ))}
        </ol>

        <div className="border-t border-slate-700 pt-4">
          <a
            href={providerInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full sm:w-auto bg-[#1B365D] hover:bg-[#254677] text-white font-bold py-3 px-6 rounded-xl transition shadow-lg text-sm"
          >
            Go to {new URL(providerInfo.url).hostname} &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
