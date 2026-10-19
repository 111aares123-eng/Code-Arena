'use client';

import React, { useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from './types';

interface MonacoCodeEditorProps {
  selectedLanguage: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  codeByLanguage: Record<SupportedLanguage, string>;
  onCodeChange: (language: SupportedLanguage, newCode: string) => void;
  onResetLanguageCode: (language: SupportedLanguage) => void;
  onRunCode: () => void;
  onSubmitCode: () => void;
  isRunning?: boolean;
  isSubmitting?: boolean;
}

export function MonacoCodeEditor({
  selectedLanguage,
  onLanguageChange,
  codeByLanguage,
  onCodeChange,
  onResetLanguageCode,
  onRunCode,
  onSubmitCode,
  isRunning = false,
  isSubmitting = false,
}: MonacoCodeEditorProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const activeLanguageConfig =
    SUPPORTED_LANGUAGES.find((lang) => lang.id === selectedLanguage) ||
    SUPPORTED_LANGUAGES[0];

  const currentCode = codeByLanguage[selectedLanguage] ?? '';

  const handleEditorDidMount: OnMount = (editor) => {
    // Configure editor preferences
    editor.updateOptions({
      tabSize: selectedLanguage === 'python' ? 4 : 2,
    });
  };


  const handleConfirmReset = () => {
    onResetLanguageCode(selectedLanguage);
    setShowResetConfirm(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#E8E2D6] border border-[#252D25]/10 rounded-xl overflow-hidden shadow-xs relative">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#E8E2D6] border-b border-[#252D25]/10 select-none">
        {/* Left: Language Selection */}
        <div className="flex items-center gap-2">
          <label htmlFor="language-select" className="text-xs text-[#526052] font-medium hidden sm:inline">
            Language:
          </label>
          <div className="relative">
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              className="appearance-none bg-[#FDFBF7] border border-[#252D25]/15 hover:border-[#879B7A] text-[#252D25] text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#344E41] focus:border-[#344E41] transition-colors cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name} ({lang.version})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#526052]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <span className="text-[11px] text-[#526052] font-mono hidden md:inline">
            {selectedLanguage === 'python' ? 'solution.py' : 'solution.cpp'}
          </span>
        </div>

        {/* Right: Actions (Reset, Run, Submit) */}
        <div className="flex items-center gap-2">
          {/* Reset Code Button */}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#526052] hover:text-[#252D25] hover:bg-[#DDD7CA] bg-[#FDFBF7] border border-[#252D25]/15 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] flex items-center gap-1.5"
            title="Reset to starter template"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Reset Code</span>
          </button>

          {/* Run Code Button */}
          <button
            type="button"
            onClick={onRunCode}
            disabled={isRunning || isSubmitting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FDFBF7] text-[#252D25] hover:bg-[#DDD7CA] hover:border-[#879B7A] border border-[#252D25]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5 shadow-2xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41]"
            title="Run Code via Judge0 CE"
          >
            {isRunning ? (
              <div className="w-3 h-3 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3 text-emerald-700 fill-emerald-700" viewBox="0 0 24 24">
                <path d="M4 3v18l17-9L4 3z" />
              </svg>
            )}
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>

          {/* Submit Button */}
          <button
            type="button"
            onClick={onSubmitCode}
            disabled={isRunning || isSubmitting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#344E41] hover:bg-[#25382E] text-[#F5F1E8] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5 shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#344E41]"
            title="Submit Solution via Judge0 CE"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-[#F5F1E8] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Overlay */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#252D25]/15 rounded-xl p-5 max-w-sm w-full shadow-2xl animate-verdict-pop">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-800/10 text-amber-900 border border-amber-700/25 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-[#252D25] mb-1">
                  Reset {activeLanguageConfig.name} Code?
                </h4>
                <p className="text-xs text-[#526052] leading-relaxed mb-4">
                  This will discard your current edits for <strong>{activeLanguageConfig.name}</strong> and restore the problem starter template. This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#526052] hover:text-[#252D25] hover:bg-[#E8E2D6] border border-[#252D25]/10 transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition-colors duration-150 shadow-sm active:scale-[0.98]"
                  >
                    Yes, Reset Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 min-h-[350px] relative">
        <Editor
          height="100%"
          language={activeLanguageConfig.monacoLanguage}
          value={currentCode}
          theme="vs-dark"
          onChange={(val) => onCodeChange(selectedLanguage, val ?? '')}
          onMount={handleEditorDidMount}
          loading={
            <div className="flex flex-col items-center justify-center h-full bg-[#0c121d] text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-[#344E41] border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-mono">Initializing Monaco Editor...</div>
            </div>
          }
          options={{
            fontSize: 13,
            fontFamily: 'Consolas, "Fira Code", "Courier New", monospace',
            lineNumbers: 'on',
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: selectedLanguage === 'python' ? 4 : 2,
            insertSpaces: true,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#E8E2D6] border-t border-[#252D25]/10 text-[11px] font-mono text-[#526052] select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
            <span>Monaco Editor Active</span>
          </span>
          <span className="text-[#879B7A]">•</span>
          <span>UTF-8</span>
          <span className="text-[#879B7A]">•</span>
          <span>Tab: {selectedLanguage === 'python' ? '4 spaces' : '2 spaces'}</span>
        </div>

        <div className="flex items-center gap-2 text-[#526052]">
          <span>{currentCode.split('\n').length} lines</span>
          <span className="text-[#879B7A]">•</span>
          <span>{currentCode.length} chars</span>
        </div>
      </div>
    </div>
  );
}
