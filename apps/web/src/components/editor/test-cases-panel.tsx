'use client';

import React from 'react';
import type {
  ProblemExample,
  RunCodeResponse,
  SubmitCodeResponse,
  TestCaseEvaluation,
} from '@code-arena/shared';

interface TestCasesPanelProps {
  examples: ProblemExample[];
  activeTab: 'testcases' | 'console';
  onTabChange: (tab: 'testcases' | 'console') => void;
  selectedCaseIndex: number;
  onSelectCaseIndex: (index: number) => void;
  activeLanguageName: string;
  isRunning: boolean;
  isSubmitting: boolean;
  lastRunResult: RunCodeResponse | null;
  lastSubmitResult: SubmitCodeResponse | null;
  onRunCurrentCase: () => void;
}

export function TestCasesPanel({
  examples,
  activeTab,
  onTabChange,
  selectedCaseIndex,
  onSelectCaseIndex,
  activeLanguageName,
  isRunning,
  isSubmitting,
  lastRunResult,
  lastSubmitResult,
  onRunCurrentCase,
}: TestCasesPanelProps) {
  const currentExample = examples[selectedCaseIndex] ?? examples[0];

  // Helper to find evaluation for the currently selected test case
  const getEvaluationForCurrentCase = (): TestCaseEvaluation | undefined => {
    if (lastSubmitResult?.evaluations) {
      return lastSubmitResult.evaluations.find((ev) => ev.caseIndex === selectedCaseIndex);
    }
    if (lastRunResult?.testCaseEvaluation && lastRunResult.testCaseEvaluation.caseIndex === selectedCaseIndex) {
      return lastRunResult.testCaseEvaluation;
    }
    return undefined;
  };

  const currentEvaluation = getEvaluationForCurrentCase();

  return (
    <div className="flex flex-col h-full bg-[#E8E2D6] border border-[#252D25]/10 rounded-xl overflow-hidden shadow-xs">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#E8E2D6] border-b border-[#252D25]/10 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTabChange('testcases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] ${
              activeTab === 'testcases'
                ? 'bg-[#FDFBF7] text-[#252D25] font-semibold shadow-2xs border border-[#252D25]/10'
                : 'text-[#526052] hover:text-[#252D25] hover:bg-[#DDD7CA]'
            }`}
          >
            <svg
              className="w-3.5 h-3.5 text-emerald-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Test Cases</span>
            {examples.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E8E2D6] border border-[#252D25]/15 text-[#526052] font-semibold">
                {examples.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('console')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] ${
              activeTab === 'console'
                ? 'bg-[#FDFBF7] text-[#252D25] font-semibold shadow-2xs border border-[#252D25]/10'
                : 'text-[#526052] hover:text-[#252D25] hover:bg-[#DDD7CA]'
            }`}
          >
            <svg
              className="w-3.5 h-3.5 text-[#344E41]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Console</span>
            {(isRunning || isSubmitting) && (
              <span className="w-2 h-2 rounded-full bg-[#344E41] animate-pulse" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {(isRunning || isSubmitting) && (
            <div className="flex items-center gap-1.5 text-xs text-[#344E41] font-mono animate-fade-in font-semibold">
              <div className="w-3 h-3 border-2 border-[#344E41] border-t-transparent rounded-full animate-spin" />
              <span>{isRunning ? 'Running...' : 'Submitting...'}</span>
            </div>
          )}
          <span className="text-[11px] text-[#526052] font-mono hidden sm:inline">
            Active: {activeLanguageName}
          </span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3.5 overflow-y-auto">
        {activeTab === 'testcases' ? (
          <div>
            {examples.length === 0 ? (
              <div className="text-xs text-[#526052] italic py-6 text-center">
                No sample test cases available for this problem.
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Case selector pills */}
                <div className="flex items-center justify-between gap-2 border-b border-[#252D25]/10 pb-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {examples.map((ex, idx) => {
                      const caseEval = lastSubmitResult?.evaluations?.find((e) => e.caseIndex === idx) ||
                        (lastRunResult?.testCaseEvaluation?.caseIndex === idx ? lastRunResult.testCaseEvaluation : undefined);

                      return (
                        <button
                          key={ex.id || idx}
                          type="button"
                          onClick={() => onSelectCaseIndex(idx)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] ${
                            selectedCaseIndex === idx
                              ? 'bg-[#344E41] text-[#F5F1E8] border border-[#344E41] shadow-2xs'
                              : 'bg-[#FDFBF7] text-[#526052] hover:text-[#252D25] border border-[#252D25]/15 hover:bg-[#DDD7CA]'
                          }`}
                        >
                          <span>Case {idx + 1}</span>
                          {caseEval && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                                caseEval.isMatched
                                  ? selectedCaseIndex === idx ? 'bg-emerald-300' : 'bg-emerald-600'
                                  : selectedCaseIndex === idx ? 'bg-rose-300' : 'bg-rose-600'
                              }`}
                              title={caseEval.isMatched ? 'Passed' : 'Failed'}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={onRunCurrentCase}
                    disabled={isRunning || isSubmitting}
                    className="text-[11px] font-semibold text-[#252D25] hover:text-[#252D25] px-2.5 py-1 rounded-md bg-[#FDFBF7] hover:bg-[#DDD7CA] hover:border-[#879B7A] border border-[#252D25]/15 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shrink-0 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41]"
                  >
                    <span>Run Case {selectedCaseIndex + 1}</span>
                  </button>
                </div>

                {currentExample && (
                  <div className="space-y-3 text-xs">
                    {/* Input */}
                    <div>
                      <div className="text-[#526052] font-semibold mb-1">Input</div>
                      <pre className="font-mono bg-[#FDFBF7] p-2.5 rounded-lg border border-[#252D25]/10 text-[#252D25] overflow-x-auto whitespace-pre-wrap select-all shadow-2xs">
                        <code>{currentExample.input}</code>
                      </pre>
                    </div>

                    {/* Expected Output */}
                    <div>
                      <div className="text-[#526052] font-semibold mb-1">Expected Output</div>
                      <pre className="font-mono bg-[#FDFBF7] p-2.5 rounded-lg border border-[#252D25]/10 text-[#252D25] overflow-x-auto whitespace-pre-wrap select-all shadow-2xs">
                        <code>{currentExample.output}</code>
                      </pre>
                    </div>

                    {/* Actual Output (if evaluated) */}
                    {currentEvaluation ? (
                      <div className="animate-fade-in space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#526052] font-semibold">Actual Output</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                              currentEvaluation.isMatched
                                ? 'bg-emerald-800/10 text-emerald-800 border border-emerald-700/25'
                                : 'bg-rose-800/10 text-rose-900 border border-rose-700/25'
                            }`}
                          >
                            <span>{currentEvaluation.isMatched ? '✓ Match (Passed)' : '✗ Mismatch (Failed)'}</span>
                          </span>
                        </div>
                        <pre
                          className={`font-mono p-2.5 rounded-lg border overflow-x-auto whitespace-pre-wrap select-all shadow-2xs ${
                            currentEvaluation.isMatched
                              ? 'bg-[#FDFBF7] border-emerald-700/30 text-emerald-900 font-bold'
                              : 'bg-[#FDFBF7] border-rose-700/30 text-rose-900 font-bold'
                          }`}
                        >
                          <code>{currentEvaluation.actualOutput || '<No output produced>'}</code>
                        </pre>
                        {currentEvaluation.compileOutput && (
                          <div className="p-2.5 rounded-lg bg-rose-800/5 border border-rose-700/25 text-rose-900 font-mono text-[11px] whitespace-pre-wrap">
                            <span className="font-bold">Compile Output:</span>
                            <div>{currentEvaluation.compileOutput}</div>
                          </div>
                        )}
                        {currentEvaluation.stderr && (
                          <div className="p-2.5 rounded-lg bg-rose-800/5 border border-rose-700/25 text-rose-900 font-mono text-[11px] whitespace-pre-wrap">
                            <span className="font-bold">Standard Error:</span>
                            <div>{currentEvaluation.stderr}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#FDFBF7] border border-[#252D25]/10 text-[#526052] text-[11px]">
                        ℹ️ This case has not been executed yet. Click <strong>Run</strong> or <strong>Submit</strong> to evaluate in Judge0.
                      </div>
                    )}

                    {/* Explanation */}
                    {currentExample.explanation && (
                      <div className="p-2.5 rounded-lg bg-[#FDFBF7] border border-[#252D25]/10 text-[#526052] leading-relaxed">
                        <span className="font-semibold text-[#252D25]">Explanation: </span>
                        {currentExample.explanation}
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="text-[10px] text-[#526052] border-t border-[#252D25]/10 pt-2">
                      ⚠️ Sample test cases are public examples. A solution passing all sample cases may still fail hidden judge test cases.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Console Tab */
          <div className="font-mono text-xs space-y-3 h-full flex flex-col justify-between">
            <div className="space-y-3">
              {/* If request is in flight */}
              {(isRunning || isSubmitting) && (
                <div className="p-3.5 rounded-lg border border-[#344E41]/30 bg-[#DDE5D5]/60 text-[#252D25] flex items-center gap-3 animate-slide-up shadow-2xs">
                  <div className="w-4 h-4 border-2 border-[#344E41] border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <div className="font-semibold text-[#252D25]">
                      {isRunning ? 'Executing Code via Judge0 CE...' : 'Submitting Code via Judge0 CE...'}
                    </div>
                    <div className="text-[11px] text-[#526052] mt-0.5">
                      Submitting sandbox task to backend execution pipeline.
                    </div>
                  </div>
                </div>
              )}

              {/* Submission Verdict Banner */}
              {lastSubmitResult && !isSubmitting && (
                <div
                  className={`p-3.5 rounded-lg border leading-relaxed animate-verdict-pop shadow-2xs ${
                    lastSubmitResult.verdict === 'ACCEPTED' || lastSubmitResult.verdict === 'SAMPLE_PASSED'
                      ? 'border-emerald-700/30 bg-emerald-800/10 text-emerald-900'
                      : lastSubmitResult.verdict === 'SERVICE_UNAVAILABLE'
                      ? 'border-amber-700/30 bg-amber-800/10 text-amber-900'
                      : 'border-rose-700/30 bg-rose-800/10 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-sm mb-1">
                    <span>
                      {lastSubmitResult.verdict === 'ACCEPTED'
                        ? '🎉 ACCEPTED'
                        : lastSubmitResult.verdict === 'SAMPLE_PASSED'
                        ? '🎉 ALL SAMPLE TEST CASES PASSED'
                        : lastSubmitResult.verdict === 'SERVICE_UNAVAILABLE'
                        ? '⚠️ EXECUTION SERVICE UNAVAILABLE'
                        : `❌ VERDICT: ${lastSubmitResult.verdict.replace(/_/g, ' ')}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#FDFBF7] border border-[#252D25]/10 text-[#252D25]">
                      {lastSubmitResult.passedCases}/{lastSubmitResult.totalCases} Passed
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90">{lastSubmitResult.summary}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#252D25]" aria-live="polite">
                    {lastSubmitResult.verdict === 'ACCEPTED'
                      ? 'Outstanding! Your solution passed all visible and hidden test cases.'
                      : lastSubmitResult.verdict === 'SAMPLE_PASSED'
                      ? 'Nice work. The samples are clear, and your practice profile just got a little stronger.'
                      : lastSubmitResult.verdict === 'SERVICE_UNAVAILABLE'
                      ? 'The judge is catching its breath. Your code was not scored, so try again in a moment.'
                      : lastSubmitResult.verdict === 'COMPILE_ERROR'
                      ? 'The compiler found something to work through. Start with the first compiler message.'
                      : lastSubmitResult.verdict === 'RUNTIME_ERROR'
                      ? 'Your code started, then hit a runtime error. Check the failing sample and error output.'
                      : lastSubmitResult.verdict === 'TIME_LIMIT_EXCEEDED'
                      ? 'Your solution is still thinking. Check the loop complexity and look for repeated work.'
                      : 'Close, but not there yet. Check the test case outcomes and trace your logic.'}
                  </p>
                  {lastSubmitResult.hiddenCases && (
                    <div className="mt-2 text-[11px] text-[#526052] font-mono">
                      Hidden Test Cases: {lastSubmitResult.hiddenCases.passed}/{lastSubmitResult.hiddenCases.total} Passed
                    </div>
                  )}
                  <p className="text-[10px] mt-2 pt-1 border-t border-current/20 opacity-80">
                    {lastSubmitResult.disclaimer}
                  </p>
                </div>
              )}

              {/* Service Unavailable Card */}
              {((lastRunResult && !lastRunResult.judge0Available) ||
                (lastSubmitResult && !lastSubmitResult.judge0Available)) &&
                !isRunning &&
                !isSubmitting && (
                  <div className="p-3.5 rounded-lg border border-amber-700/30 bg-amber-800/10 text-amber-900 leading-relaxed animate-fade-in shadow-2xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <svg className="w-4 h-4 text-amber-800 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Judge0 CE Service Offline</span>
                    </div>
                    <p className="text-[11px] text-amber-900/90 mb-2">
                      {lastRunResult?.error || lastSubmitResult?.error || 'Could not connect to Judge0 CE instance.'}
                    </p>
                    <div className="p-2.5 rounded bg-[#FDFBF7] border border-[#252D25]/10 text-[11px] text-[#252D25] space-y-1">
                      <div className="text-[#252D25] font-semibold">How to connect Judge0 CE:</div>
                      <div>• Start Judge0 via Docker: <code className="text-[#252D25] bg-[#E8E2D6] px-1 py-0.5 rounded border border-[#252D25]/10 font-bold">docker run -p 2358:2358 judge0/judge0:latest</code></div>
                      <div>• Or set <code className="text-[#252D25] bg-[#E8E2D6] px-1 py-0.5 rounded border border-[#252D25]/10 font-bold">JUDGE0_BASE_URL</code> in environment variables.</div>
                    </div>
                  </div>
                )}

              {/* Run Code Result Console View */}
              {lastRunResult && lastRunResult.judge0Available && lastRunResult.result && !isRunning && (
                <div className="bg-[#FDFBF7] rounded-lg border border-[#252D25]/10 p-3 space-y-2.5 animate-fade-in shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] border-b border-[#252D25]/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#252D25] font-bold">Status:</span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          lastRunResult.result.isError
                            ? 'bg-rose-800/10 text-rose-900 border border-rose-700/25'
                            : 'bg-emerald-800/10 text-emerald-800 border border-emerald-700/25'
                        }`}
                      >
                        {lastRunResult.result.status.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[#526052]">
                      {lastRunResult.result.time && <span>Time: {lastRunResult.result.time}s</span>}
                      {lastRunResult.result.memory && <span>Mem: {lastRunResult.result.memory} KB</span>}
                    </div>
                  </div>

                  {/* Standard Output */}
                  {lastRunResult.result.stdout !== null && (
                    <div>
                      <div className="text-[#526052] text-[11px] mb-1 font-semibold">Standard Output:</div>
                      <pre className="p-2.5 rounded bg-[#E8E2D6]/40 border border-[#252D25]/10 text-[#252D25] overflow-x-auto whitespace-pre-wrap">
                        <code>{lastRunResult.result.stdout || '<Empty stdout>'}</code>
                      </pre>
                    </div>
                  )}

                  {/* Compile Output */}
                  {lastRunResult.result.compileOutput && (
                    <div>
                      <div className="text-rose-900 text-[11px] mb-1 font-semibold">Compilation Output:</div>
                      <pre className="p-2.5 rounded bg-rose-800/5 border border-rose-700/25 text-rose-900 overflow-x-auto whitespace-pre-wrap">
                        <code>{lastRunResult.result.compileOutput}</code>
                      </pre>
                    </div>
                  )}

                  {/* Standard Error */}
                  {lastRunResult.result.stderr && (
                    <div>
                      <div className="text-rose-900 text-[11px] mb-1 font-semibold">Standard Error:</div>
                      <pre className="p-2.5 rounded bg-rose-800/5 border border-rose-700/25 text-rose-900 overflow-x-auto whitespace-pre-wrap">
                        <code>{lastRunResult.result.stderr}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Initial Ready State */}
              {!lastRunResult && !lastSubmitResult && !isRunning && !isSubmitting && (
                <div className="bg-[#FDFBF7] rounded-lg border border-[#252D25]/10 p-3 text-[#526052] space-y-2 shadow-2xs">
                  <div className="text-[#526052] flex items-center justify-between text-[11px] border-b border-[#252D25]/10 pb-1.5">
                    <span className="font-semibold text-[#252D25]">CodeArena 2.0 In-Browser Console</span>
                    <span>Target: Judge0 CE</span>
                  </div>
                  <div className="text-[#526052] text-[11px] py-4 space-y-1">
                    <div>$ ready for execution</div>
                    <div>$ press &quot;Run&quot; to test active test case in Judge0 sandbox</div>
                    <div>$ press &quot;Submit&quot; to evaluate all sample test cases</div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-[#526052] pt-2 border-t border-[#252D25]/10">
              Interactive sandbox execution streams stdout, stderr, run time, and memory usage.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
