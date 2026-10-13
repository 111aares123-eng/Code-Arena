export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';

export type ProblemStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ProblemExample {
  id: number;
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  category: string;
  tags: string[];
  shortDescription: string;
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  supportedLanguages: string[];
  acceptanceRate: string;
  totalSubmissions: number;
  hints?: string[];
  starterCode?: {
    python?: string;
    cpp?: string;
    [key: string]: string | undefined;
  };
  status?: ProblemStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ProblemFilters {
  search: string;
  difficulty: 'ALL' | ProblemDifficulty;
  tag?: string;
}
