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
      <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800">
          <div className="h-5 w-28 bg-zinc-800 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-20 bg-zinc-800 rounded animate-pulse" />
            <div className="h-7 w-16 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-500 font-mono text-xs space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing Monaco Code Editor...</span>
        </div>
        <div className="h-6 bg-zinc-900 border-t border-zinc-800" />
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
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Workspace Bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/problems"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Problems</span>
            </Link>

            <span className="text-zinc-700 hidden sm:inline">/</span>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PostgreSQL Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                Mock Fallback
              </span>
            )}

            <div className="hidden md:flex items-center gap-3 text-xs text-zinc-400">
              <span>
                Acceptance: <strong className="text-zinc-200">{problem.acceptanceRate}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Mobile View Navigation Tabs (< lg screens) */}
        <div className="flex lg:hidden items-center gap-1 mt-3 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setMobileTab('description')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'description'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Description
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'editor'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Code Editor
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('testcases')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
              mobileTab === 'testcases'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
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
            <div className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 sm:p-6 overflow-y-auto space-y-6 shadow-xl">
              {/* Problem Metadata Header */}
              <div className="border-b border-zinc-800 pb-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-zinc-400 font-medium">{problem.category}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-xs text-zinc-400">
                    Submissions: <strong className="text-zinc-200">{problem.totalSubmissions.toLocaleString()}</strong>
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
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800/90 text-zinc-300 border border-zinc-700/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statement Description */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Problem Description
                </h3>
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                  {problem.description}
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Examples
                </h3>
                <div className="space-y-3">
                  {problem.examples.map((example) => (
                    <div
                      key={example.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 font-mono text-xs"
                    >
                      <div className="text-zinc-400 font-semibold mb-2">Example {example.id}:</div>
                      <div className="space-y-1.5 text-zinc-300">
                        <div>
                          <span className="text-zinc-500 font-bold">Input: </span>
                          <code className="text-emerald-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            {example.input}
                          </code>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold">Output: </span>
                          <code className="text-indigo-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            {example.output}
                          </code>
                        </div>
                        {example.explanation && (
                          <div className="pt-1.5 text-zinc-400 font-sans text-xs">
                            <span className="font-semibold text-zinc-300">Explanation: </span>
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Constraints
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300 bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-800 font-mono">
                  {problem.constraints.map((constraint, idx) => (
                    <li key={idx} className="text-zinc-300">
                      <code className="text-zinc-200">{constraint}</code>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hints if present */}
              {problem.hints && problem.hints.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Hints
                  </h3>
                  <div className="space-y-2">
                    {problem.hints.map((hint, idx) => (
                      <details
                        key={idx}
                        className="group rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300"
                      >
                        <summary className="font-medium text-zinc-400 group-hover:text-indigo-300 cursor-pointer select-none">
                          Hint {idx + 1}
                        </summary>
                        <p className="mt-2 text-zinc-300 pl-2 border-l border-zinc-700 leading-relaxed">
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
