'use client';
import React from 'react';
import { FileText, UploadCloud, CheckCircle2, Loader2, AlertCircle, Sparkles, Info } from 'lucide-react';

export default function LessonForm({
  formData,
  handleChange,
  handleCheckbox,
  handleSubmit,
  bowFile,
  bowFileName,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleBowFileChange,
  handleLoadEntries,
  isExtracting,
  extractionNote,
  customResourceText,
  setCustomResourceText,
  customReferenceText,
  setCustomReferenceText,
  customLearnerContextText,
  setCustomLearnerContextText,
  hasMissingDesignation,
  loading,
  onCancel,
}) {
  return (
    <div className="bg-slate-800/80 rounded-2xl shadow-lg border border-slate-700 p-6 sm:p-10 space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
        <div className="w-1.5 h-8 bg-[#F59E0B] rounded-full"></div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Weekly Lesson Details & Intentions</h2>
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Learning Area/s (Subject)</label>
            <input
              type="text"
              name="subject"
              required
              value={formData.subject}
              onChange={handleChange}
              placeholder="Ex. Mathematics"
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Designed by Teacher/s</label>
            <input
              type="text"
              name="teacherName"
              value={formData.teacherName}
              onChange={handleChange}
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Checked by (Master Teacher / Dept. Head)</label>
            <input
              type="text"
              name="masterTeacherName"
              value={formData.masterTeacherName}
              onChange={handleChange}
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Noted by (School Principal / Head)</label>
            <input
              type="text"
              name="principalName"
              value={formData.principalName}
              onChange={handleChange}
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Grade Level and Section</label>
            <input type="text" name="gradeAndSection" required value={formData.gradeAndSection} onChange={handleChange} placeholder="Ex: Grade 10 - Kindness, Compassion" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Medium of Instruction</label>
            <select name="language" value={formData.language} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none">
              <option value="">Select language...</option>
              <option value="English (Default)">English (Default)</option>
              <option value="Filipino">Filipino</option>
              <option value="Cebuano / Visayan">Cebuano / Visayan</option>
              <option value="Ilocano">Ilocano</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">No. of Sessions</label>
            <select name="noOfSessions" value={formData.noOfSessions} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-amber-400 font-bold focus:ring-1 focus:ring-[#F59E0B] focus:outline-none">
              <option value="">Select sessions...</option>
              <option value="1 Session (1 Day)">1 Session (1 Day)</option>
              <option value="2 Sessions">2 Sessions</option>
              <option value="3 Sessions">3 Sessions</option>
              <option value="4 Sessions">4 Sessions</option>
              <option value="5 Sessions (1 Week)">5 Sessions (1 Week)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Session Duration</label>
            <select name="sessionLength" value={formData.sessionLength} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none">
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

        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center justify-between">
            <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" /> Extract from Budget of Work (BOW)</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">Optional</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">Upload or drop a BOW PDF to have the AI extract or intelligently partition merged competencies for your selected target week.</p>

          <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 cursor-pointer ${isDragging ? 'border-[#F59E0B] bg-amber-950/20 scale-[1.01]' : bowFile ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/80'}`}>
            <input id="bow-file-input" type="file" accept=".pdf" onChange={handleBowFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />

            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              {bowFile ? <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" /> : <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />}
              <div className="text-xs">
                {bowFile ? <span className="font-semibold text-emerald-300">{bowFileName}</span> : isDragging ? <span className="font-bold text-amber-400">Drop your BOW PDF here...</span> : <span className="text-slate-300"><strong className="text-amber-400 underline">Click to upload</strong> or drag & drop your BOW PDF file here</span>}
              </div>
              <span className="text-[10px] text-slate-500">PDF files only</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Term</label>
              <select name="term" value={formData.term} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100">
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Target Week</label>
              <select name="week" value={formData.week} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100">
                {Array.from({ length: 10 }, (_, i) => <option key={i} value={`Week ${i+1}`}>{`Week ${i+1}`}</option>)}
              </select>
            </div>

            <button type="button" onClick={handleLoadEntries} disabled={!bowFile || isExtracting} className={`text-sm font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 ${!bowFile || isExtracting ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-[#1B365D] hover:bg-[#254677] text-white shadow-md border border-[#F59E0B]/30'}`}>
              {isExtracting ? <><Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Extracting...</> : 'Load Entries'}
            </button>
          </div>

          {extractionNote && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-md p-3 text-xs text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div><span className="font-bold">AI Scope Adjustment Notice:</span> {extractionNote}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Learning Competency</label>
            <textarea name="learningCompetency" rows={3} value={formData.learningCompetency} onChange={handleChange} placeholder="Illustrates, solves, and graphs quadratic inequalities in one and two variables..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Content Standards</label>
            <textarea name="contentStandards" rows={3} value={formData.contentStandards} onChange={handleChange} placeholder="Demonstrates understanding of key concepts of quadratic inequalities..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Performance Standards</label>
            <textarea name="performanceStandards" rows={3} value={formData.performanceStandards} onChange={handleChange} placeholder="Is able to investigate, analyze, solve, and model real-world scenarios..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Learner Context</label>
            <select name="learnerContext" value={formData.learnerContext} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none">
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
                <input type="text" value={customLearnerContextText} onChange={(e) => setCustomLearnerContextText(e.target.value)} placeholder="Specify learner context..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Additional Instructions / Prompts <span className="text-slate-500">(Optional)</span></label>
            <textarea name="additionalPrompts" rows={3} value={formData.additionalPrompts} onChange={handleChange} placeholder="Type any custom prompts or guidelines here..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:border-[#F59E0B] focus:outline-none" />
          </div>
        </div>

        <hr className="border-slate-700 my-6" />

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300">Learning Resources Available</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-slate-400">
            {[
              'Laptop/Computer', 'Projector/Smart TV', 'Slide Presentation',
              'Visual Aids', 'Manipulatives/Models', 'Printed Worksheets',
              'Chalkboard/Whiteboard', 'Art/Craft Materials', 'Audio/Speakers',
              'Realia (Real objects)', 'Other (Please specify)...'
            ].map((item) => (
              <label key={item} className="flex items-center gap-2 cursor-pointer hover:text-slate-200">
                <input type="checkbox" value={item} checked={formData.resources.includes(item)} onChange={(e) => handleCheckbox(e, 'resources')} className="rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B]" />
                {item}
              </label>
            ))}
          </div>

          {formData.resources.includes('Other (Please specify)...') && (
            <div className="pt-2">
              <input type="text" value={customResourceText} onChange={(e) => setCustomResourceText(e.target.value)} placeholder="Enter other resources here..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none" />
            </div>
          )}
        </div>

        <div className="space-y-3 pt-3">
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
                <input type="checkbox" value={item} checked={formData.references.includes(item)} onChange={(e) => handleCheckbox(e, 'references')} className="rounded bg-slate-900 border-slate-700 text-[#F59E0B] focus:ring-[#F59E0B]" />
                {item}
              </label>
            ))}
          </div>

          {formData.references.includes('Other (Please specify)...') && (
            <div className="pt-2">
              <input type="text" value={customReferenceText} onChange={(e) => setCustomReferenceText(e.target.value)} placeholder="Enter other references here..." className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[#F59E0B] focus:outline-none" />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex-1 w-full bg-[#1B365D] hover:bg-[#254677] active:bg-[#1B365D] border border-[#F59E0B]/40 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#1B365D]/30">
            {loading ? (<><Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Brewing brilliant lesson ideas... ☕✨</>) : (<><Sparkles className="w-5 h-5 text-amber-400" /> Generate Detailed ILAW Lesson Plan</>)}
          </button>

          <button type="button" onClick={onCancel} disabled={!loading} className="flex-none bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
