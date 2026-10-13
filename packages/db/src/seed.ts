import { getDb, problems } from './index';
import { MOCK_PROBLEMS } from '@code-arena/shared';

export async function seedProblems() {
  const db = getDb();
  console.log(`Starting seed: inserting or updating ${MOCK_PROBLEMS.length} problems...`);

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
}

// Auto-run when executed directly from CLI
seedProblems()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed execution error:', err);
    process.exit(1);
  });
