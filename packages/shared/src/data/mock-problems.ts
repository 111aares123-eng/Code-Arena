import type { Problem, ProblemDifficulty } from '../types/problem';

export const MOCK_PROBLEMS: Problem[] = [
  {
    id: 'prob-001',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'Algorithms',
    tags: ['Array', 'Hash Table'],
    shortDescription: 'Given an array of integers and an integer target, return indices of the two numbers such that they add up to target.',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly one solution***, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      {
        id: 1,
        input: 'nums = [2,7,11,15], target = 9',
        structuredInput: { nums: [2, 7, 11, 15], target: 9 },
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      {
        id: 2,
        input: 'nums = [3,2,4], target = 6',
        structuredInput: { nums: [3, 2, 4], target: 6 },
        output: '[1,2]',
        explanation: 'nums[1] + nums[2] == 2 + 4 == 6, so indices [1, 2] are returned.',
      },
      {
        id: 3,
        input: 'nums = [3,3], target = 6',
        structuredInput: { nums: [3, 3], target: 6 },
        output: '[0,1]',
      },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '53.8%',
    totalSubmissions: 12480,
    hints: [
      'A really brute force way would be to search for all possible pairs of numbers but that would be slow. Again, it is best to try out brute force solutions for just for completeness.',
      'So, if we check sub-arrays of length 2, can we do something better? What if we remember values using a Hash Map?',
    ],
    starterCode: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your solution here
        pass
`,
      cpp: `#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-002',
    slug: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    category: 'Data Structures',
    tags: ['Linked List', 'Recursion'],
    shortDescription: 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
    description: `Given the \`head\` of a singly linked list, reverse the list, and return *the reversed list*.`,
    examples: [
      {
        id: 1,
        input: 'head = [1,2,3,4,5]',
        structuredInput: { head: [1, 2, 3, 4, 5] },
        output: '[5,4,3,2,1]',
      },
      {
        id: 2,
        input: 'head = [1,2]',
        structuredInput: { head: [1, 2] },
        output: '[2,1]',
      },
      {
        id: 3,
        input: 'head = []',
        structuredInput: { head: [] },
        output: '[]',
      },
    ],
    constraints: [
      'The number of nodes in the list is the range [0, 5000].',
      '-5000 <= Node.val <= 5000',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '76.2%',
    totalSubmissions: 9410,
    hints: [
      'A linked list can be reversed either iteratively or recursively. Could you implement both?',
    ],
    starterCode: {
      python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

class Solution:
    def reverseList(self, head):
        # Write your solution here
        pass
`,
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        // Write your solution here
        return nullptr;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-003',
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    category: 'Algorithms',
    tags: ['Hash Table', 'String', 'Sliding Window'],
    shortDescription: 'Given a string s, find the length of the longest substring without duplicate characters.',
    description: `Given a string \`s\`, find the length of the **longest substring** without duplicate characters.`,
    examples: [
      {
        id: 1,
        input: 's = "abcabcbb"',
        structuredInput: { s: "abcabcbb" },
        output: '3',
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        id: 2,
        input: 's = "bbbbb"',
        structuredInput: { s: "bbbbb" },
        output: '1',
        explanation: 'The answer is "b", with the length of 1.',
      },
      {
        id: 3,
        input: 's = "pwwkew"',
        structuredInput: { s: "pwwkew" },
        output: '3',
        explanation: 'The answer is "wke", with the length of 3. Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.',
      },
    ],
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '35.4%',
    totalSubmissions: 8200,
    hints: [
      'Use a sliding window approach with two pointers and a set to keep track of characters inside the window.',
    ],
    starterCode: {
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Write your solution here
        pass
`,
      cpp: `#include <string>
#include <unordered_set>

class Solution {
public:
    int lengthOfLongestSubstring(std::string s) {
        // Write your solution here
        return 0;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-004',
    slug: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'Medium',
    category: 'Algorithms',
    tags: ['Array', 'Two Pointers', 'Greedy'],
    shortDescription: 'Find two lines that together with the x-axis form a container, such that the container contains the most water.',
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines drawn such that the two endpoints of the \`i\`-th line are \`(i, 0)\` and \`(i, height[i])\`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return *the maximum amount of water a container can store*.

**Notice** that you may not slant the container.`,
    examples: [
      {
        id: 1,
        input: 'height = [1,8,6,2,5,4,8,3,7]',
        structuredInput: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] },
        output: '49',
        explanation: 'The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water the container can contain is 49.',
      },
      {
        id: 2,
        input: 'height = [1,1]',
        structuredInput: { height: [1, 1] },
        output: '1',
      },
    ],
    constraints: [
      'n == height.length',
      '2 <= n <= 10^5',
      '0 <= height[i] <= 10^4',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '56.1%',
    totalSubmissions: 6730,
    starterCode: {
      python: `class Solution:
    def maxArea(self, height: list[int]) -> int:
        # Write your solution here
        pass
`,
      cpp: `#include <vector>
#include <algorithm>

class Solution {
public:
    int maxArea(std::vector<int>& height) {
        // Write your solution here
        return 0;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-005',
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    category: 'Data Structures',
    tags: ['String', 'Stack'],
    shortDescription: 'Determine if an input string containing just the characters (, ), {, }, [ and ] is valid.',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        id: 1,
        input: 's = "()"',
        structuredInput: { s: "()" },
        output: 'true',
      },
      {
        id: 2,
        input: 's = "()[]{}"',
        structuredInput: { s: "()[]{}" },
        output: 'true',
      },
      {
        id: 3,
        input: 's = "(]"',
        structuredInput: { s: "(]" },
        output: 'false',
      },
      {
        id: 4,
        input: 's = "([])"',
        structuredInput: { s: "([])" },
        output: 'true',
      },
    ],
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only \'()[]{}\'.',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '41.2%',
    totalSubmissions: 11050,
    starterCode: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        # Write your solution here
        pass
`,
      cpp: `#include <string>
#include <stack>

class Solution {
public:
    bool isValid(std::string s) {
        // Write your solution here
        return false;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-006',
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    category: 'Algorithms',
    tags: ['Dynamic Programming', 'Breadth-First Search'],
    shortDescription: 'Compute the fewest number of coins that you need to make up a given target amount.',
    description: `You are given an integer array \`coins\` representing coins of different denominations and an integer \`amount\` representing a total amount of money.

Return *the fewest number of coins that you need to make up that amount*. If that amount of money cannot be made up by any combination of the coins, return \`-1\`.

You may assume that you have an infinite number of each kind of coin.`,
    examples: [
      {
        id: 1,
        input: 'coins = [1,2,5], amount = 11',
        structuredInput: { coins: [1, 2, 5], amount: 11 },
        output: '3',
        explanation: '11 = 5 + 5 + 1',
      },
      {
        id: 2,
        input: 'coins = [2], amount = 3',
        structuredInput: { coins: [2], amount: 3 },
        output: '-1',
      },
      {
        id: 3,
        input: 'coins = [1], amount = 0',
        structuredInput: { coins: [1], amount: 0 },
        output: '0',
      },
    ],
    constraints: [
      '1 <= coins.length <= 12',
      '1 <= coins[i] <= 2^31 - 1',
      '0 <= amount <= 10^4',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '44.3%',
    totalSubmissions: 5420,
    starterCode: {
      python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        # Write your solution here
        pass
`,
      cpp: `#include <vector>
#include <algorithm>

class Solution {
public:
    int coinChange(std::vector<int>& coins, int amount) {
        // Write your solution here
        return -1;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-007',
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    category: 'Algorithms',
    tags: ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack'],
    shortDescription: 'Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.',
    description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.`,
    examples: [
      {
        id: 1,
        input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
        structuredInput: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] },
        output: '6',
        explanation: 'The elevation map is represented by array [0,1,0,2,1,0,1,3,2,1,2,1]. In this case, 6 units of rain water are being trapped.',
      },
      {
        id: 2,
        input: 'height = [4,2,0,3,2,5]',
        structuredInput: { height: [4, 2, 0, 3, 2, 5] },
        output: '9',
      },
    ],
    constraints: [
      'n == height.length',
      '1 <= n <= 2 * 10^4',
      '0 <= height[i] <= 10^5',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '61.7%',
    totalSubmissions: 3910,
    hints: [
      'For each element in the array, what determines the amount of water trapped above it? It is bounded by the maximum heights to its left and right.',
    ],
    starterCode: {
      python: `class Solution:
    def trap(self, height: list[int]) -> int:
        # Write your solution here
        pass
`,
      cpp: `#include <vector>
#include <algorithm>

class Solution {
public:
    int trap(std::vector<int>& height) {
        // Write your solution here
        return 0;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
  {
    id: 'prob-008',
    slug: 'merge-k-sorted-lists',
    title: 'Merge k Sorted Lists',
    difficulty: 'Hard',
    category: 'Data Structures',
    tags: ['Linked List', 'Divide and Conquer', 'Heap'],
    shortDescription: 'Merge k sorted linked lists and return it as one sorted list.',
    description: `You are given an array of \`k\` linked-lists \`lists\`, each linked-list is sorted in ascending order.

*Merge all the linked-lists into one sorted linked-list and return it.*`,
    examples: [
      {
        id: 1,
        input: 'lists = [[1,4,5],[1,3,4],[2,6]]',
        structuredInput: { lists: [[1, 4, 5], [1, 3, 4], [2, 6]] },
        output: '[1,1,2,3,4,4,5,6]',
        explanation: 'The linked-lists are:\n[\n  1->4->5,\n  1->3->4,\n  2->6\n]\nmerging them into one sorted list:\n1->1->2->3->4->4->5->6',
      },
      {
        id: 2,
        input: 'lists = []',
        structuredInput: { lists: [] },
        output: '[]',
      },
      {
        id: 3,
        input: 'lists = [[]]',
        structuredInput: { lists: [[]] },
        output: '[]',
      },
    ],
    constraints: [
      'k == lists.length',
      '0 <= k <= 10^4',
      '0 <= lists[i].length <= 500',
      '-10^4 <= lists[i][j] <= 10^4',
      'lists[i] is sorted in ascending order.',
      'The sum of lists[i].length will not exceed 10^4.',
    ],
    supportedLanguages: ['Python', 'C++'],
    acceptanceRate: '52.1%',
    totalSubmissions: 4180,
    starterCode: {
      python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

class Solution:
    def mergeKLists(self, lists: list) -> list:
        # Write your solution here
        pass
`,
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* mergeKLists(std::vector<ListNode*>& lists) {
        // Write your solution here
        return nullptr;
    }
};
`,
    },
    status: 'PUBLISHED',
  },
];

export function getMockProblems(): Problem[] {
  return MOCK_PROBLEMS;
}

export function getMockProblemBySlug(slug: string): Problem | undefined {
  return MOCK_PROBLEMS.find((p) => p.slug === slug);
}

export function getAllProblemTags(): string[] {
  const tagsSet = new Set<string>();
  MOCK_PROBLEMS.forEach((p) => p.tags.forEach((tag) => tagsSet.add(tag)));
  return Array.from(tagsSet).sort();
}

export function getDifficultyStats(): Record<ProblemDifficulty | 'Total', number> {
  const stats: Record<ProblemDifficulty | 'Total', number> = {
    Total: MOCK_PROBLEMS.length,
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  MOCK_PROBLEMS.forEach((p) => {
    stats[p.difficulty]++;
  });

  return stats;
}
