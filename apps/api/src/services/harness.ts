import type { ExecutionLanguage, ProblemExample } from '@code-arena/shared';

export type ArgType = 'int' | 'string' | 'bool' | 'int_list' | 'linked_list' | 'linked_list_list';
export type ReturnType = 'int' | 'string' | 'bool' | 'int_list' | 'linked_list';

export interface ProblemContract {
  slug: string;
  methodName: string;
  args: { name: string; type: ArgType }[];
  returnType: ReturnType;
}

export const PROBLEM_CONTRACTS: Record<string, ProblemContract> = {
  'two-sum': {
    slug: 'two-sum',
    methodName: 'twoSum',
    args: [
      { name: 'nums', type: 'int_list' },
      { name: 'target', type: 'int' },
    ],
    returnType: 'int_list',
  },
  'reverse-linked-list': {
    slug: 'reverse-linked-list',
    methodName: 'reverseList',
    args: [{ name: 'head', type: 'linked_list' }],
    returnType: 'linked_list',
  },
  'longest-substring-without-repeating-characters': {
    slug: 'longest-substring-without-repeating-characters',
    methodName: 'lengthOfLongestSubstring',
    args: [{ name: 's', type: 'string' }],
    returnType: 'int',
  },
  'container-with-most-water': {
    slug: 'container-with-most-water',
    methodName: 'maxArea',
    args: [{ name: 'height', type: 'int_list' }],
    returnType: 'int',
  },
  'valid-parentheses': {
    slug: 'valid-parentheses',
    methodName: 'isValid',
    args: [{ name: 's', type: 'string' }],
    returnType: 'bool',
  },
  'coin-change': {
    slug: 'coin-change',
    methodName: 'coinChange',
    args: [
      { name: 'coins', type: 'int_list' },
      { name: 'amount', type: 'int' },
    ],
    returnType: 'int',
  },
  'trapping-rain-water': {
    slug: 'trapping-rain-water',
    methodName: 'trap',
    args: [{ name: 'height', type: 'int_list' }],
    returnType: 'int',
  },
  'merge-k-sorted-lists': {
    slug: 'merge-k-sorted-lists',
    methodName: 'mergeKLists',
    args: [{ name: 'lists', type: 'linked_list_list' }],
    returnType: 'linked_list',
  },
};

/**
 * Parses raw LeetCode-style input strings such as:
 * "nums = [2,7,11,15], target = 9" or "s = \"()\""
 * into a key-value record if structuredInput was not provided.
 */
export function parseRawInput(rawInput: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!rawInput || !rawInput.trim()) return result;

  // Pattern matches: identifier = value (handling arrays, numbers, strings, booleans)
  const regex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(\[[\s\S]*?\]|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|-?\d+(?:\.\d+)?|true|false|null)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawInput)) !== null) {
    const key = match[1];
    const rawVal = match[2].trim();
    try {
      // Normalizes single quoted strings to valid JSON double quotes
      let jsonVal = rawVal;
      if (jsonVal.startsWith("'") && jsonVal.endsWith("'")) {
        jsonVal = `"${jsonVal.slice(1, -1).replace(/"/g, '\\"')}"`;
      }
      result[key] = JSON.parse(jsonVal);
    } catch {
      result[key] = rawVal;
    }
  }

  return result;
}

/**
 * Resolves structured input for an example, preferring structuredInput,
 * then falling back to parsing raw input.
 */
export function resolveStructuredInput(
  example?: ProblemExample | null,
  rawInputOverride?: string
): Record<string, unknown> {
  if (example?.structuredInput && Object.keys(example.structuredInput).length > 0) {
    return example.structuredInput;
  }
  const stringToParse = rawInputOverride !== undefined ? rawInputOverride : example?.input || '';
  return parseRawInput(stringToParse);
}

/**
 * Checks if user's source code already contains a standalone entrypoint.
 */
export function isStandaloneCode(sourceCode: string, language: ExecutionLanguage): boolean {
  if (language === 'cpp') {
    // If user already wrote main function in C++
    return /\bint\s+main\s*\(/m.test(sourceCode) || /\bvoid\s+main\s*\(/m.test(sourceCode);
  }

  if (language === 'python') {
    // If user already wrote a standalone script or doesn't use Solution class
    const hasSolutionClass = /^\s*class\s+Solution\b/m.test(sourceCode);
    const hasMainGuard = /if\s+__name__\s*==\s*['"]__main__['"]\s*:/m.test(sourceCode);
    return !hasSolutionClass || hasMainGuard;
  }

  return false;
}

/**
 * Formats a JavaScript value into a valid C++ literal expression.
 */
function toCppLiteral(val: unknown, type: ArgType): string {
  switch (type) {
    case 'int':
      return typeof val === 'number' ? String(Math.floor(val)) : '0';

    case 'string':
      return JSON.stringify(typeof val === 'string' ? val : String(val ?? ''));

    case 'bool':
      return val ? 'true' : 'false';

    case 'int_list': {
      if (!Array.isArray(val)) return '{}';
      const items = val.map((x) => (typeof x === 'number' ? String(Math.floor(x)) : '0'));
      return `{${items.join(', ')}}`;
    }

    case 'linked_list': {
      if (!Array.isArray(val)) return 'buildList({})';
      const items = val.map((x) => (typeof x === 'number' ? String(Math.floor(x)) : '0'));
      return `buildList({${items.join(', ')}})`;
    }

    case 'linked_list_list': {
      if (!Array.isArray(val)) return '{}';
      const listsInit = val.map((sub) => {
        if (!Array.isArray(sub)) return 'buildList({})';
        const items = sub.map((x) => (typeof x === 'number' ? String(Math.floor(x)) : '0'));
        return `buildList({${items.join(', ')}})`;
      });
      return `{${listsInit.join(', ')}}`;
    }

    default:
      return '0';
  }
}

/**
 * Formats a JavaScript value into a valid Python literal expression.
 */
function toPythonLiteral(val: unknown, type: ArgType): string {
  switch (type) {
    case 'int':
      return typeof val === 'number' ? String(Math.floor(val)) : '0';

    case 'string':
      return JSON.stringify(typeof val === 'string' ? val : String(val ?? ''));

    case 'bool':
      return val ? 'True' : 'False';

    case 'int_list':
      return JSON.stringify(Array.isArray(val) ? val : []);

    case 'linked_list':
      return `build_list(${JSON.stringify(Array.isArray(val) ? val : [])})`;

    case 'linked_list_list':
      return `[build_list(l) for l in ${JSON.stringify(Array.isArray(val) ? val : [])}]`;

    default:
      return JSON.stringify(val ?? null);
  }
}

export interface BuildHarnessOptions {
  problemSlug: string;
  language: ExecutionLanguage;
  sourceCode: string;
  structuredInput?: Record<string, unknown>;
  rawInput?: string;
}

export interface BuildHarnessResult {
  code: string;
  wasHarnessed: boolean;
  contract?: ProblemContract;
}

/**
 * Builds a runnable execution file by injecting driver code if the problem
 * matches a known contract and the student wrote a LeetCode-style class.
 */
export function buildExecutionHarness(options: BuildHarnessOptions): BuildHarnessResult {
  const { problemSlug, language, sourceCode } = options;
  const contract = PROBLEM_CONTRACTS[problemSlug];

  // If problem is not in registry or student code is already a standalone program, return as-is
  if (!contract || isStandaloneCode(sourceCode, language)) {
    return {
      code: sourceCode,
      wasHarnessed: false,
      contract,
    };
  }

  const structuredInput =
    options.structuredInput && Object.keys(options.structuredInput).length > 0
      ? options.structuredInput
      : parseRawInput(options.rawInput || '');

  if (language === 'python') {
    return {
      code: buildPythonHarness(sourceCode, contract, structuredInput),
      wasHarnessed: true,
      contract,
    };
  }

  if (language === 'cpp') {
    return {
      code: buildCppHarness(sourceCode, contract, structuredInput),
      wasHarnessed: true,
      contract,
    };
  }

  return {
    code: sourceCode,
    wasHarnessed: false,
    contract,
  };
}

function buildPythonHarness(
  sourceCode: string,
  contract: ProblemContract,
  input: Record<string, unknown>
): string {
  const needsListNode =
    contract.args.some((a) => a.type === 'linked_list' || a.type === 'linked_list_list') ||
    contract.returnType === 'linked_list';

  const listNodeDef = needsListNode
    ? `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_list(vals):
    dummy = ListNode(0)
    curr = dummy
    if vals:
        for v in vals:
            curr.next = ListNode(v)
            curr = curr.next
    return dummy.next

def serialize_result(res):
    if res is None:
        return []
    if isinstance(res, list):
        return res
    out = []
    curr = res
    while curr:
        out.append(curr.val)
        curr = curr.next
    return out
`
    : '';

  // Prepare arguments for method invocation
  const invocationArgs = contract.args.map((arg) => {
    const val = input[arg.name];
    return toPythonLiteral(val, arg.type);
  });

  let outputPrinter = '';
  switch (contract.returnType) {
    case 'int_list':
      outputPrinter = `print(json.dumps(__arena_res, separators=(',', ':')) if isinstance(__arena_res, list) else __arena_res)`;
      break;

    case 'linked_list':
      outputPrinter = `print(json.dumps(serialize_result(__arena_res), separators=(',', ':')))`;
      break;

    case 'bool':
      outputPrinter = `print('true' if __arena_res is True else ('false' if __arena_res is False else str(__arena_res).lower()))`;
      break;

    case 'int':
    case 'string':
    default:
      outputPrinter = `print(__arena_res)`;
      break;
  }

  return `from __future__ import annotations
import sys
import json
${listNodeDef}
# --- STUDENT SOLUTION START ---
${sourceCode}
# --- STUDENT SOLUTION END ---

if __name__ == '__main__':
    __arena_sol = Solution()
    __arena_res = __arena_sol.${contract.methodName}(${invocationArgs.join(', ')})
    ${outputPrinter}
`;
}

function buildCppHarness(
  sourceCode: string,
  contract: ProblemContract,
  input: Record<string, unknown>
): string {
  const needsListNode =
    contract.args.some((a) => a.type === 'linked_list' || a.type === 'linked_list_list') ||
    contract.returnType === 'linked_list';

  const listNodePreamble = needsListNode
    ? `
#ifndef CODEARENA_LISTNODE_DEF
#define CODEARENA_LISTNODE_DEF
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

inline ListNode* buildList(const std::vector<int>& vals) {
    ListNode dummy(0);
    ListNode* curr = &dummy;
    for (int v : vals) {
        curr->next = new ListNode(v);
        curr = curr->next;
    }
    return dummy.next;
}

inline void printList(ListNode* head) {
    std::cout << "[";
    ListNode* curr = head;
    bool first = true;
    while (curr) {
        if (!first) std::cout << ",";
        first = false;
        std::cout << curr->val;
        curr = curr->next;
    }
    std::cout << "]\\n";
}
#endif
`
    : '';

  // Variable initialization lines
  const varInits: string[] = [];
  const invocationArgNames: string[] = [];

  for (const arg of contract.args) {
    const val = input[arg.name];
    const literal = toCppLiteral(val, arg.type);
    const varName = `__arena_${arg.name}`;

    switch (arg.type) {
      case 'int':
        varInits.push(`    int ${varName} = ${literal};`);
        break;
      case 'string':
        varInits.push(`    std::string ${varName} = ${literal};`);
        break;
      case 'bool':
        varInits.push(`    bool ${varName} = ${literal};`);
        break;
      case 'int_list':
        varInits.push(`    std::vector<int> ${varName} = ${literal};`);
        break;
      case 'linked_list':
        varInits.push(`    ListNode* ${varName} = ${literal};`);
        break;
      case 'linked_list_list':
        varInits.push(`    std::vector<ListNode*> ${varName} = ${literal};`);
        break;
    }
    invocationArgNames.push(varName);
  }

  let outputPrinter = '';
  switch (contract.returnType) {
    case 'int_list':
      outputPrinter = `
    std::cout << "[";
    for (size_t i = 0; i < __arena_res.size(); ++i) {
        std::cout << __arena_res[i] << (i + 1 < __arena_res.size() ? "," : "");
    }
    std::cout << "]\\n";`;
      break;

    case 'linked_list':
      outputPrinter = `
    printList(__arena_res);`;
      break;

    case 'bool':
      outputPrinter = `
    std::cout << (__arena_res ? "true" : "false") << "\\n";`;
      break;

    case 'int':
    case 'string':
    default:
      outputPrinter = `
    std::cout << __arena_res << "\\n";`;
      break;
  }

  return `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <stack>
#include <queue>
#include <utility>

${listNodePreamble}

// --- STUDENT SOLUTION START ---
${sourceCode}
// --- STUDENT SOLUTION END ---

int main() {
    Solution __arena_sol;
${varInits.join('\n')}
    auto __arena_res = __arena_sol.${contract.methodName}(${invocationArgNames.join(', ')});${outputPrinter}
    return 0;
}
`;
}
