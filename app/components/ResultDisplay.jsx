'use client';
import React from 'react';
import { Loader2, Download } from 'lucide-react';

export default function ResultDisplay({
  lessonPlan,
  snapshotData,
  headerRef,
  renderSafeContent,
  handleDownloadDocx,
  handleDownloadSeparatedDocx,
  downloadingDocx,
  downloadingSeparatedDocx,
}) {
  return (
    <div className="mt-8 p-4 sm:p-8 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-xl space-y-6 overflow-x-auto font-sans">
      <div ref={headerRef} className="text-center border-b-2 border-[#1B365D] pb-3">
        <h2 className="text-xl font-extrabold text-[#1B365D] tracking-wide uppercase">
          LESSON PLAN TEMPLATE FOR {(snapshotData?.subject || 'SUBJECT').toUpperCase()} {(snapshotData?.term || '').toUpperCase()} {(snapshotData?.week || '').toUpperCase()}
        </h2>
      </div>

      {lessonPlan.rawText ? (
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
          {lessonPlan.rawText}
        </div>
      ) : (
        <>
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="w-1/4 p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D]">Lesson Title</td>
                <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.lessonTitle || snapshotData?.lessonName)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2.5 font-bold bg-[#EAEFF5] border-r border-slate-300 text-[#1B365D]">Learning Area/s</td>
                <td className="p-2.5 text-slate-800">{renderSafeContent(lessonPlan.header?.learningArea || snapshotData?.subject)}</td>
              </tr>
            </tbody>
          </table>

          <div className="pt-4 flex gap-3">
            <button onClick={handleDownloadDocx} disabled={downloadingDocx} className="bg-[#1B365D] text-white px-4 py-2 rounded-md flex items-center gap-2">
              {downloadingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Matrix DOCX
            </button>

            <button onClick={handleDownloadSeparatedDocx} disabled={downloadingSeparatedDocx} className="bg-[#1B365D] text-white px-4 py-2 rounded-md flex items-center gap-2">
              {downloadingSeparatedDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Separated DOCX
            </button>
          </div>
        </>
      )}
    </div>
  );
}
