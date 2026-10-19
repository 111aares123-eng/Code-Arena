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
    <div className="flex flex-col h-full bg-[#0c121d] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl relative">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#080c14]/90 border-b border-white/[0.08] select-none">
        {/* Left: Language Selection */}
        <div className="flex items-center gap-2">
          <label htmlFor="language-select" className="text-xs text-slate-400 font-medium hidden sm:inline">
            Language:
          </label>
          <div className="relative">
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              className="appearance-none bg-[#080c14] border border-white/[0.1] hover:border-white/[0.2] text-slate-200 text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name} ({lang.version})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
            {selectedLanguage === 'python' ? 'solution.py' : 'solution.cpp'}
          </span>
        </div>

        {/* Right: Actions (Reset, Run, Submit) */}
        <div className="flex items-center gap-2">
          {/* Reset Code Button */}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.08] transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 flex items-center gap-1.5"
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
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] text-slate-200 hover:bg-white/[0.1] hover:text-white border border-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5 shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            title="Run Code via Judge0 CE"
          >
            {isRunning ? (
              <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3 text-emerald-400 fill-emerald-400" viewBox="0 0 24 24">
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
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5 shadow-sm shadow-blue-600/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Submit Solution via Judge0 CE"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0c121d] border border-white/[0.12] rounded-xl p-5 max-w-sm w-full shadow-2xl animate-verdict-pop">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white mb-1">
                  Reset {activeLanguageConfig.name} Code?
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  This will discard your current edits for <strong>{activeLanguageConfig.name}</strong> and restore the problem starter template. This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors duration-150 shadow-sm active:scale-[0.98]"
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
            <div className="flex flex-col items-center justify-center h-full bg-[#080c14] text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#080c14]/90 border-t border-white/[0.08] text-[11px] font-mono text-slate-400 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Monaco Editor Active</span>
          </span>
          <span className="text-slate-600">•</span>
          <span>UTF-8</span>
          <span className="text-slate-600">•</span>
          <span>Tab: {selectedLanguage === 'python' ? '4 spaces' : '2 spaces'}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span>{currentCode.split('\n').length} lines</span>
          <span className="text-slate-600">•</span>
          <span>{currentCode.length} chars</span>
        </div>
      </div>
    </div>
  );
}
