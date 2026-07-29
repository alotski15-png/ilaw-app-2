'use client';

import React, { useEffect, useState } from 'react';

export function showToast({ message = '', type = 'info', duration = 4000 } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ilaw-toast', { detail: { message, type, duration } }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      const t = { id, ...e.detail };
      setToasts((s) => [...s, t]);
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
      }, e.detail.duration || 4000);
    };

    window.addEventListener('ilaw-toast', handler);
    return () => window.removeEventListener('ilaw-toast', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id} className={`max-w-xs w-full px-4 py-2 rounded-lg shadow-md text-sm text-white ${t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-emerald-600' : 'bg-slate-700'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
