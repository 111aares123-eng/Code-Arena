export type SupportedLanguage = 'python' | 'cpp';

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  monacoLanguage: string;
  version: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    id: 'python',
    name: 'Python 3',
    monacoLanguage: 'python',
    version: '3.10',
  },
  {
    id: 'cpp',
    name: 'C++ 17',
    monacoLanguage: 'cpp',
    version: '17',
  },
];

export const DEFAULT_STARTER_CODE: Record<SupportedLanguage, string> = {
  python: `# Write your solution here
class Solution:
    pass
`,
  cpp: `// Write your solution here
#include <iostream>

int main() {
    return 0;
}
`,
};

