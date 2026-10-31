import { describe, it, expect } from 'bun:test';
import {
  evaluateSubmission,
  normalizeOutput,
  compareOutputs,
} from '../src/index.ts';

describe('CodeArena Evaluator — Output Normalization & Comparison', () => {
  it('normalizes CRLF and trailing whitespace', () => {
    expect(normalizeOutput('hello world\r\n')).toBe('hello world');
    expect(normalizeOutput('hello world  \n')).toBe('hello world');
    expect(normalizeOutput('line 1  \r\nline 2   \r\n\r\n')).toBe('line 1\nline 2');
    expect(normalizeOutput('42\n')).toBe('42');
  });

  it('preserves internal whitespace differences', () => {
    expect(compareOutputs('hello world\n', 'hello   world\n')).toBe(false);
    expect(compareOutputs('1 2 3\r\n', '1 2 3\n')).toBe(true);
  });
});

describe('CodeArena Evaluator — Test-Case Evaluation', () => {
  it('Test 1: Python — all test cases pass', async () => {
    const result = await evaluateSubmission({
      language: 'python',
      code: `import sys
for line in sys.stdin:
    if line.strip():
        n = int(line.strip())
        print(n * 2)
`,
      testCases: [
        { id: 'c1', input: '5\n', expectedOutput: '10' },
        { id: 'c2', input: '12\n', expectedOutput: '24' },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Accepted');
    expect(result.totalCases).toBe(2);
    expect(result.passedCases).toBe(2);
    expect(result.failedCases).toBe(0);
    expect(result.compileError).toBeUndefined();
    expect(result.testCaseResults.length).toBe(2);
    expect(result.testCaseResults[0].passed).toBe(true);
    expect(result.testCaseResults[0].verdict).toBe('Accepted');
    expect(result.testCaseResults[0].actualOutput?.trim()).toBe('10');
    expect(result.testCaseResults[1].passed).toBe(true);
    expect(result.testCaseResults[1].verdict).toBe('Accepted');
    expect(result.testCaseResults[1].actualOutput?.trim()).toBe('24');
  }, 25000);

  it('Test 2: Python — one test case produces a wrong answer', async () => {
    const result = await evaluateSubmission({
      language: 'python',
      code: `import sys
line = sys.stdin.read().strip()
if line:
    n = int(line)
    print(n * 2)
`,
      testCases: [
        { id: 'c1', input: '5', expectedOutput: '10' },
        { id: 'c2', input: '7', expectedOutput: '999' }, // Intentionally wrong
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Wrong Answer');
    expect(result.totalCases).toBe(2);
    expect(result.passedCases).toBe(1);
    expect(result.failedCases).toBe(1);
    expect(result.testCaseResults[0].passed).toBe(true);
    expect(result.testCaseResults[0].verdict).toBe('Accepted');
    expect(result.testCaseResults[1].passed).toBe(false);
    expect(result.testCaseResults[1].verdict).toBe('Wrong Answer');
    expect(result.testCaseResults[1].expectedOutput).toBe('999');
    expect(result.testCaseResults[1].actualOutput?.trim()).toBe('14');
  }, 25000);

  it('Test 3: C++ — all test cases pass', async () => {
    const result = await evaluateSubmission({
      language: 'cpp',
      code: `#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
`,
      testCases: [
        { id: 'cpp1', input: '3 4', expectedOutput: '7' },
        { id: 'cpp2', input: '100 250', expectedOutput: '350' },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Accepted');
    expect(result.totalCases).toBe(2);
    expect(result.passedCases).toBe(2);
    expect(result.failedCases).toBe(0);
    expect(result.compileError).toBeUndefined();
    expect(result.testCaseResults[0].passed).toBe(true);
    expect(result.testCaseResults[0].verdict).toBe('Accepted');
    expect(result.testCaseResults[0].actualOutput?.trim()).toBe('7');
    expect(result.testCaseResults[1].passed).toBe(true);
    expect(result.testCaseResults[1].verdict).toBe('Accepted');
    expect(result.testCaseResults[1].actualOutput?.trim()).toBe('350');
  }, 30000);

  it('Test 4: C++ — one test case produces a wrong answer', async () => {
    const result = await evaluateSubmission({
      language: 'cpp',
      code: `#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
`,
      testCases: [
        { id: 'cpp1', input: '3 4', expectedOutput: '7' },
        { id: 'cpp2', input: '10 20', expectedOutput: '999' },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Wrong Answer');
    expect(result.totalCases).toBe(2);
    expect(result.passedCases).toBe(1);
    expect(result.failedCases).toBe(1);
    expect(result.testCaseResults[0].passed).toBe(true);
    expect(result.testCaseResults[1].passed).toBe(false);
    expect(result.testCaseResults[1].verdict).toBe('Wrong Answer');
    expect(result.testCaseResults[1].actualOutput?.trim()).toBe('30');
  }, 30000);

  it('Test 5: Compilation error in C++', async () => {
    const result = await evaluateSubmission({
      language: 'cpp',
      code: `#include <iostream>
int main() {
    std::cout << SyntaxErrorWithoutSemicolon
    return 0;
}
`,
      testCases: [
        { id: 'c1', input: '1', expectedOutput: '1' },
        { id: 'c2', input: '2', expectedOutput: '2' },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Compilation Error');
    expect(result.compileError).toBeDefined();
    expect(result.compileError).toContain('SyntaxErrorWithoutSemicolon');
    expect(result.passedCases).toBe(0);
    expect(result.failedCases).toBe(2);
    expect(result.testCaseResults[0].verdict).toBe('Compilation Error');
    expect(result.testCaseResults[1].verdict).toBe('Compilation Error');
  }, 25000);

  it('Test 6: Runtime error in Python', async () => {
    const result = await evaluateSubmission({
      language: 'python',
      code: `import sys
n = int(sys.stdin.read().strip())
print(10 // n)
`,
      testCases: [
        { id: 'c1', input: '0', expectedOutput: '0' },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Runtime Error');
    expect(result.totalCases).toBe(1);
    expect(result.passedCases).toBe(0);
    expect(result.failedCases).toBe(1);
    expect(result.testCaseResults[0].verdict).toBe('Runtime Error');
    expect(result.testCaseResults[0].stderr).toContain('ZeroDivisionError');
  }, 25000);

  it('Test 7: Timeout (Time Limit Exceeded) in Python', async () => {
    const result = await evaluateSubmission({
      language: 'python',
      code: `while True:
    pass
`,
      testCases: [
        { id: 'c1', input: '1', expectedOutput: '1' },
      ],
      timeLimitMs: 1000,
    });

    expect(result.verdict).toBe('Time Limit Exceeded');
    expect(result.totalCases).toBe(1);
    expect(result.passedCases).toBe(0);
    expect(result.failedCases).toBe(1);
    expect(result.testCaseResults[0].verdict).toBe('Time Limit Exceeded');
    expect(result.testCaseResults[0].durationMs).toBeGreaterThanOrEqual(950);
  }, 25000);

  it('Test 8: Empty test-case list', async () => {
    const result = await evaluateSubmission({
      language: 'python',
      code: 'print("No cases")',
      testCases: [],
    });

    expect(result.verdict).toBe('Accepted');
    expect(result.totalCases).toBe(0);
    expect(result.passedCases).toBe(0);
    expect(result.failedCases).toBe(0);
    expect(result.testCaseResults.length).toBe(0);
  });

  it('Test 9: Hidden test results never reveal input, expected output or actual output', async () => {
    const secretInput = 'SECRET_INPUT_KEY_12345';
    const secretExpected = 'SECRET_EXPECTED_RESULT_67890';

    const result = await evaluateSubmission({
      language: 'python',
      code: `import sys
data = sys.stdin.read().strip()
print("SECRET_EXPECTED_RESULT_67890")
`,
      testCases: [
        {
          id: 'visible-1',
          input: 'visible-data',
          expectedOutput: 'SECRET_EXPECTED_RESULT_67890',
          isHidden: false,
        },
        {
          id: 'hidden-1',
          input: secretInput,
          expectedOutput: secretExpected,
          isHidden: true,
        },
      ],
      timeLimitMs: 8000,
    });

    expect(result.verdict).toBe('Accepted');
    expect(result.totalCases).toBe(2);
    expect(result.passedCases).toBe(2);

    const visibleRes = result.testCaseResults[0];
    const hiddenRes = result.testCaseResults[1];

    // Visible case: diagnostic details ARE provided
    expect(visibleRes.isHidden).toBe(false);
    expect(visibleRes.input).toBe('visible-data');
    expect(visibleRes.expectedOutput).toBe('SECRET_EXPECTED_RESULT_67890');
    expect(visibleRes.actualOutput?.trim()).toBe('SECRET_EXPECTED_RESULT_67890');

    // Hidden case: strictly REDACTED
    expect(hiddenRes.isHidden).toBe(true);
    expect(hiddenRes.passed).toBe(true);
    expect(hiddenRes.verdict).toBe('Accepted');
    expect(hiddenRes.durationMs).toBeGreaterThan(0);

    // Verify complete absence of hidden test details
    expect(hiddenRes.input).toBeUndefined();
    expect(hiddenRes.expectedOutput).toBeUndefined();
    expect(hiddenRes.actualOutput).toBeUndefined();
    expect(hiddenRes.stderr).toBeUndefined();
    expect(hiddenRes.error).toBeUndefined();

    // Verify string serialization of the hidden result does not leak secrets
    const serialized = JSON.stringify(hiddenRes);
    expect(serialized).not.toContain(secretInput);
    expect(serialized).not.toContain(secretExpected);
  }, 25000);

  it('Test 10: Supports caller-selected test case slices (single sample, all samples, or full suite)', async () => {
    const code = `import sys
n = int(sys.stdin.read().strip())
print(n * 10)
`;
    const sampleCase1 = { id: 'sample-1', input: '1', expectedOutput: '10', isHidden: false };
    const sampleCase2 = { id: 'sample-2', input: '2', expectedOutput: '20', isHidden: false };
    const hiddenCase1 = { id: 'hidden-1', input: '3', expectedOutput: '30', isHidden: true };
    const hiddenCase2 = { id: 'hidden-2', input: '4', expectedOutput: '40', isHidden: true };

    // Slice 1: Caller supplies a single selected sample case
    const singleResult = await evaluateSubmission({
      language: 'python',
      code,
      testCases: [sampleCase1],
      timeLimitMs: 5000,
    });
    expect(singleResult.totalCases).toBe(1);
    expect(singleResult.passedCases).toBe(1);
    expect(singleResult.verdict).toBe('Accepted');
    expect(singleResult.testCaseResults[0].id).toBe('sample-1');
    expect(singleResult.testCaseResults[0].actualOutput?.trim()).toBe('10');

    // Slice 2: Caller supplies all visible sample cases
    const allSamplesResult = await evaluateSubmission({
      language: 'python',
      code,
      testCases: [sampleCase1, sampleCase2],
      timeLimitMs: 5000,
    });
    expect(allSamplesResult.totalCases).toBe(2);
    expect(allSamplesResult.passedCases).toBe(2);
    expect(allSamplesResult.verdict).toBe('Accepted');

    // Slice 3: Caller supplies full server-authorized suite (samples + hidden)
    const fullSuiteResult = await evaluateSubmission({
      language: 'python',
      code,
      testCases: [sampleCase1, sampleCase2, hiddenCase1, hiddenCase2],
      timeLimitMs: 5000,
    });
    expect(fullSuiteResult.totalCases).toBe(4);
    expect(fullSuiteResult.passedCases).toBe(4);
    expect(fullSuiteResult.verdict).toBe('Accepted');
    expect(fullSuiteResult.testCaseResults[2].isHidden).toBe(true);
    expect(fullSuiteResult.testCaseResults[2].actualOutput).toBeUndefined();
    expect(fullSuiteResult.testCaseResults[3].isHidden).toBe(true);
    expect(fullSuiteResult.testCaseResults[3].actualOutput).toBeUndefined();
  }, 30000);
});

