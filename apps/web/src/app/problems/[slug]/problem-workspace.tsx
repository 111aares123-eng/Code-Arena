'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Problem, RunCodeResponse, SubmitCodeResponse } from '@code-arena/shared';
import dynamic from 'next/dynamic';
import { DifficultyBadge } from '../../../components/difficulty-badge';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_STARTER_CODE,
} from '../../../components/editor/types';
import { TestCasesPanel } from '../../../components/editor/test-cases-panel';
import { runCode, submitCode } from '../../../lib/api';
import { recordPracticeSamplePassed } from '../../../lib/arena-progress';

const MonacoCodeEditor = dynamic(
  () =>
    import('../../../components/editor/monaco-code-editor').then(
      (mod) => mod.MonacoCodeEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-full bg-[#0c121d] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#080c14] border-b border-white/[0.08]">
          <div className="h-5 w-28 bg-white/[0.06] rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-20 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-7 w-16 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#080c14] p-6 text-slate-500 font-mono text-xs space-y-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing Monaco Code Editor...</span>
        </div>
        <div className="h-6 bg-[#080c14] border-t border-white/[0.08]" />
      </div>
    ),
  }
);

interface ProblemWorkspaceProps {
  problem: Problem;
  source: 'api' | 'fallback';
}

export function ProblemWorkspace({ problem, source }: ProblemWorkspaceProps) {
  // Mobile tab state: 'description' | 'editor' | 'testcases'
  const [mobileTab, setMobileTab] = useState<'description' | 'editor' | 'testcases'>('description');

  // Selected language
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('python');

  // Code state per language (preserves student's edits across language toggles)
  const [codeByLanguage, setCodeByLanguage] = useState<Record<SupportedLanguage, string>>({
    python: problem.starterCode?.python ?? DEFAULT_STARTER_CODE.python,
    cpp: problem.starterCode?.cpp ?? DEFAULT_STARTER_CODE.cpp,
  });

  // Output panel tabs: 'testcases' | 'console'
  const [outputTab, setOutputTab] = useState<'testcases' | 'console'>('testcases');
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);

  // Execution states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastRunResult, setLastRunResult] = useState<RunCodeResponse | null>(null);
  const [lastSubmitResult, setLastSubmitResult] = useState<SubmitCodeResponse | null>(null);

  const activeLanguageConfig =
    SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  const handleCodeChange = (lang: SupportedLanguage, newCode: string) => {
    setCodeByLanguage((prev) => ({
      ...prev,
      [lang]: newCode,
    }));
  };

  const handleResetLanguageCode = (lang: SupportedLanguage) => {
    const defaultTemplate = problem.starterCode?.[lang] ?? DEFAULT_STARTER_CODE[lang];
    setCodeByLanguage((prev) => ({
      ...prev,
      [lang]: defaultTemplate,
    }));
  };

  const handleRunCode = async (caseIdx = selectedCaseIndex) => {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setOutputTab('console');
    if (window.innerWidth < 1024) {
      setMobileTab('testcases');
    }

    const code = codeByLanguage[selectedLanguage] ?? '';
    const selectedExample = problem.examples[caseIdx] ?? problem.examples[0];

    try {
      const res = await runCode({
        problemSlug: problem.slug,
        sourceCode: code,
        language: selectedLanguage,
        stdin: selectedExample?.input || '',
        expectedOutput: selectedExample?.output || '',
        testCaseIndex: caseIdx,
      });

      setLastRunResult(res);
    } catch (err: unknown) {
      setLastRunResult({
        success: false,
        judge0Available: false,
        language: selectedLanguage,
        error: err instanceof Error ? err.message : String(err),
        executedAt: new Date().toISOString(),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (isRunning || isSubmitting) return;
    setIsSubmitting(true);
    setOutputTab('console');
    if (window.innerWidth < 1024) {
      setMobileTab('testcases');
    }

    const code = codeByLanguage[selectedLanguage] ?? '';

    try {
      const res = await submitCode({
        problemSlug: problem.slug,
        sourceCode: code,
        language: selectedLanguage,
      });

      setLastSubmitResult(res);
      if (res.verdict === 'SAMPLE_PASSED' || res.verdict === 'ACCEPTED') {
        recordPracticeSamplePassed(problem.slug);
      }
    } catch (err: unknown) {
      setLastSubmitResult({
        success: false,
        judge0Available: false,
        language: selectedLanguage,
        verdict: 'SERVICE_UNAVAILABLE',
        totalCases: problem.examples.length,
        passedCases: 0,
        evaluations: [],
        summary: `Submission error: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err.message : String(err),
        disclaimer:
          'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.',
        submittedAt: new Date().toISOString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      {/* Top Workspace Bar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#080c14]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/problems"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Problems</span>
            </Link>

            <span className="text-slate-600 hidden sm:inline">/</span>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#0c121d] text-slate-300 border border-white/[0.08]">
                {problem.id}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {problem.title}
              </h1>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {source === 'api' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PostgreSQL Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#0c121d] text-slate-400 border border-white/[0.08]">
                Mock Fallback
              </span>
            )}

            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <span>
                Acceptance: <strong className="text-slate-200">{problem.acceptanceRate}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Mobile View Navigation Tabs (< lg screens) */}
        <div className="flex lg:hidden items-center gap-1 mt-3 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMobileTab('description')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'description'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Description
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'editor'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Code Editor
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('testcases')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'testcases'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Test Cases & Console
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 max-w-[1720px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 min-h-[calc(100vh-125px)]">
          {/* LEFT COLUMN: Problem Statement & Details */}
          <section
            aria-labelledby="problem-statement-heading"
            className={`lg:col-span-5 flex flex-col ${
              mobileTab === 'description' ? 'block' : 'hidden lg:flex'
            }`}
          >
            <div className="flex-1 bg-[#0c121d] border border-white/[0.08] rounded-xl p-5 sm:p-6 overflow-y-auto space-y-6 shadow-sm">
              {/* Problem Metadata Header */}
              <div className="border-b border-white/[0.08] pb-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 font-medium">{problem.category}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400">
                    Submissions: <strong className="text-slate-200">{problem.totalSubmissions.toLocaleString()}</strong>
                  </span>
                </div>

                <h2 id="problem-statement-heading" className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {problem.title}
                </h2>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {problem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-slate-300 border border-white/[0.08]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statement Description */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Problem Description
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                  {problem.description}
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Examples
                </h3>
                <div className="space-y-3">
                  {problem.examples.map((example) => (
                    <div
                      key={example.id}
                      className="rounded-xl border border-white/[0.08] bg-[#080c14]/70 p-3.5 font-mono text-xs"
                    >
                      <div className="text-slate-400 font-semibold mb-2">Example {example.id}:</div>
                      <div className="space-y-1.5 text-slate-300">
                        <div>
                          <span className="text-slate-500 font-bold">Input: </span>
                          <code className="text-emerald-400 bg-[#0c121d] px-1.5 py-0.5 rounded border border-white/[0.08]">
                            {example.input}
                          </code>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold">Output: </span>
                          <code className="text-blue-300 bg-[#0c121d] px-1.5 py-0.5 rounded border border-white/[0.08]">
                            {example.output}
                          </code>
                        </div>
                        {example.explanation && (
                          <div className="pt-1.5 text-slate-400 font-sans text-xs">
                            <span className="font-semibold text-slate-300">Explanation: </span>
                            {example.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constraints */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Constraints
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 bg-[#080c14]/50 p-3.5 rounded-xl border border-white/[0.08] font-mono">
                  {problem.constraints.map((constraint, idx) => (
                    <li key={idx} className="text-slate-300">
                      <code className="text-slate-200">{constraint}</code>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hints if present */}
              {problem.hints && problem.hints.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Hints
                  </h3>
                  <div className="space-y-2">
                    {problem.hints.map((hint, idx) => (
                      <details
                        key={idx}
                        className="group rounded-lg border border-white/[0.08] bg-[#080c14]/40 p-3 text-xs text-slate-300"
                      >
                        <summary className="font-medium text-slate-400 group-hover:text-blue-300 cursor-pointer select-none">
                          Hint {idx + 1}
                        </summary>
                        <p className="mt-2 text-slate-300 pl-2 border-l border-white/[0.1] leading-relaxed">
                          {hint}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Monaco Code Editor + Test Cases Panel */}
          <section
            aria-label="Code Editor and Test Cases"
            className={`lg:col-span-7 flex flex-col gap-4 ${
              mobileTab === 'editor'
                ? 'block'
                : mobileTab === 'testcases'
                ? 'hidden'
                : 'hidden lg:flex'
            }`}
          >
            {/* Upper: Monaco Editor */}
            <div className="flex-1 min-h-[460px] flex flex-col">
              <MonacoCodeEditor
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                codeByLanguage={codeByLanguage}
                onCodeChange={handleCodeChange}
                onResetLanguageCode={handleResetLanguageCode}
                onRunCode={() => handleRunCode()}
                onSubmitCode={handleSubmitCode}
                isRunning={isRunning}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Lower: Test Cases & Console Panel */}
            <div className="h-[280px] lg:h-[300px] shrink-0 hidden lg:block">
              <TestCasesPanel
                examples={problem.examples}
                activeTab={outputTab}
                onTabChange={setOutputTab}
                selectedCaseIndex={selectedCaseIndex}
                onSelectCaseIndex={setSelectedCaseIndex}
                activeLanguageName={activeLanguageConfig.name}
                isRunning={isRunning}
                isSubmitting={isSubmitting}
                lastRunResult={lastRunResult}
                lastSubmitResult={lastSubmitResult}
                onRunCurrentCase={() => handleRunCode(selectedCaseIndex)}
              />
            </div>
          </section>

          {/* MOBILE ONLY: Standalone Test Cases & Console Tab */}
          {mobileTab === 'testcases' && (
            <section
              aria-label="Test Cases and Console"
              className="lg:hidden col-span-1 h-[calc(100vh-190px)]"
            >
              <TestCasesPanel
                examples={problem.examples}
                activeTab={outputTab}
                onTabChange={setOutputTab}
                selectedCaseIndex={selectedCaseIndex}
                onSelectCaseIndex={setSelectedCaseIndex}
                activeLanguageName={activeLanguageConfig.name}
                isRunning={isRunning}
                isSubmitting={isSubmitting}
                lastRunResult={lastRunResult}
                lastSubmitResult={lastSubmitResult}
                onRunCurrentCase={() => handleRunCode(selectedCaseIndex)}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
