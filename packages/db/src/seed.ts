import { getDb, problems, testCases } from './index';
import { MOCK_PROBLEMS } from '@code-arena/shared';
import { SEED_TEST_CASES, type SeedTestCase } from './data/seed-test-cases';

export { SEED_TEST_CASES, type SeedTestCase };

export async function seedProblems(dbInstance?: ReturnType<typeof getDb>) {
  const db = dbInstance ?? getDb();
  console.log(`Starting problem seed: inserting or updating ${MOCK_PROBLEMS.length} problems...`);

  let insertedOrUpdated = 0;

  for (const prob of MOCK_PROBLEMS) {
    const starterCodeClean: Record<string, string> = {};
    if (prob.starterCode) {
      for (const [lang, code] of Object.entries(prob.starterCode)) {
        if (code) starterCodeClean[lang] = code;
      }
    }

    await db
      .insert(problems)
      .values({
        id: prob.id,
        slug: prob.slug,
        title: prob.title,
        difficulty: prob.difficulty,
        category: prob.category,
        tags: prob.tags,
        shortDescription: prob.shortDescription,
        description: prob.description,
        examples: prob.examples,
        constraints: prob.constraints,
        supportedLanguages: prob.supportedLanguages,
        starterCode: starterCodeClean,
        hints: prob.hints || [],
        acceptanceRate: prob.acceptanceRate,
        totalSubmissions: prob.totalSubmissions,
        status: prob.status || 'PUBLISHED',
      })
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          slug: prob.slug,
          title: prob.title,
          difficulty: prob.difficulty,
          category: prob.category,
          tags: prob.tags,
          shortDescription: prob.shortDescription,
          description: prob.description,
          examples: prob.examples,
          constraints: prob.constraints,
          supportedLanguages: prob.supportedLanguages,
          starterCode: starterCodeClean,
          hints: prob.hints || [],
          acceptanceRate: prob.acceptanceRate,
          totalSubmissions: prob.totalSubmissions,
          status: prob.status || 'PUBLISHED',
          updatedAt: new Date(),
        },
      });

    insertedOrUpdated++;
    console.log(` [✓] Seeded problem ${prob.id} (${prob.slug})`);
  }

  console.log(`\n✓ Successfully seeded ${insertedOrUpdated} problems into CodeArena database.`);
  return insertedOrUpdated;
}

export async function seedTestCases(dbInstance?: ReturnType<typeof getDb>) {
  const db = dbInstance ?? getDb();
  console.log(`Starting test-case seed: inserting or updating ${SEED_TEST_CASES.length} test cases...`);

  let count = 0;

  for (const tc of SEED_TEST_CASES) {
    await db
      .insert(testCases)
      .values({
        id: tc.id,
        problemId: tc.problemId,
        orderIndex: tc.orderIndex,
        isVisible: tc.isVisible,
        input: tc.input,
        structuredInput: tc.structuredInput,
        expectedOutput: tc.expectedOutput,
        explanation: tc.explanation || null,
      })
      .onConflictDoUpdate({
        target: testCases.id,
        set: {
          problemId: tc.problemId,
          orderIndex: tc.orderIndex,
          isVisible: tc.isVisible,
          input: tc.input,
          structuredInput: tc.structuredInput,
          expectedOutput: tc.expectedOutput,
          explanation: tc.explanation || null,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`\n✓ Successfully seeded ${count} test cases into CodeArena database.`);
  return count;
}

export async function seedAll(dbInstance?: ReturnType<typeof getDb>) {
  const problemCount = await seedProblems(dbInstance);
  const testCaseCount = await seedTestCases(dbInstance);
  return { problemCount, testCaseCount };
}

// Auto-run only when executed directly from CLI
const isDirectCli =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js')));

if (isDirectCli) {
  seedAll()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    });
}
