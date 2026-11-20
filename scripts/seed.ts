/**
 * Seed the local database from data/ (spec 16.1: `validate-data && seed`).
 * Idempotent: re-running upserts every row (slug/code primary keys).
 *
 * Run: npm run db:seed   (requires `npm run db:push` once and scripts/pg-start.sh)
 */
import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  users,
  profiles,
  scholarships,
  procedures,
  taxonomyFields,
  gradeScales,
  formations,
} from "../src/lib/db/schema";
import { uuidv7 } from "../src/lib/core/ids";
import { computeCompleteness } from "../src/lib/core/completeness";
import type { ProfileData } from "../src/lib/core/types";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

async function main() {
  // --- taxonomy (parents first: FK to self) ---
  const taxonomy: { code: string; parent_code: string | null; label: Record<string, string>; synonyms: Record<string, string[]> }[] =
    read("data/taxonomy.json");
  const parents = taxonomy.filter((t) => !t.parent_code);
  const children = taxonomy.filter((t) => t.parent_code);
  for (const t of [...parents, ...children]) {
    await db
      .insert(taxonomyFields)
      .values({ code: t.code, parentCode: t.parent_code, label: t.label, synonyms: t.synonyms })
      .onConflictDoUpdate({
        target: taxonomyFields.code,
        set: { parentCode: t.parent_code, label: t.label, synonyms: t.synonyms },
      });
  }
  console.log(`taxonomy: ${taxonomy.length}`);

  // --- grade scales ---
  const scales: { country: string; system: string; config: Record<string, unknown>; notes: string }[] =
    read("data/grade_scales.json");
  for (const s of scales) {
    await db
      .insert(gradeScales)
      .values(s)
      .onConflictDoUpdate({ target: [gradeScales.country, gradeScales.system], set: { config: s.config, notes: s.notes } });
  }
  console.log(`grade_scales: ${scales.length}`);

  // --- formations (Mode A, §7.3) ---
  const fItems: Record<string, unknown>[] = [];
  for (const file of readdirSync(join(ROOT, "data/formations")).sort()) {
    if (!file.endsWith(".json")) continue;
    fItems.push(...(read(`data/formations/${file}`) as Record<string, unknown>[]));
  }
  for (const f of fItems) {
    await db
      .insert(formations)
      .values({
        id: f.id as string,
        nameFr: f.name_fr as string,
        nameEn: (f.name_en as string | undefined) ?? null,
        nameAr: (f.name_ar as string | undefined) ?? null,
        institution: f.institution as string,
        institutionKind: f.institution_kind as string,
        city: f.city as string,
        wilayaCode: f.wilaya_code as number,
        wilayaName: f.wilaya_name as string,
        streams: f.streams as string[],
        language: f.language as string,
        domainTags: f.domain_tags as string[],
        durationYears: f.duration_years as number,
        tuition: (f.tuition as string) ?? "public",
        cutoffLastYear: (f.cutoff_last_year as number | null) ?? null,
        cutoffSource: (f.cutoff_source as string | null) ?? null,
        needsVerification: (f.needs_verification as boolean) ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: formations.id,
        set: {
          nameFr: f.name_fr as string,
          nameEn: (f.name_en as string | undefined) ?? null,
          nameAr: (f.name_ar as string | undefined) ?? null,
          institution: f.institution as string,
          institutionKind: f.institution_kind as string,
          city: f.city as string,
          wilayaCode: f.wilaya_code as number,
          wilayaName: f.wilaya_name as string,
          streams: f.streams as string[],
          language: f.language as string,
          domainTags: f.domain_tags as string[],
          durationYears: f.duration_years as number,
          tuition: (f.tuition as string) ?? "public",
          cutoffLastYear: (f.cutoff_last_year as number | null) ?? null,
          cutoffSource: (f.cutoff_source as string | null) ?? null,
          needsVerification: (f.needs_verification as boolean) ?? true,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`formations: ${fItems.length}`);

  // --- scholarships ---
  let published = 0;
  for (const file of readdirSync(join(ROOT, "data/scholarships")).sort()) {
    if (!file.endsWith(".json")) continue;
    const s = read(`data/scholarships/${file}`);
    await db
      .insert(scholarships)
      .values({
        id: uuidv7(),
        slug: s.slug,
        name: s.name,
        provider: s.provider,
        hostCountries: s.host_countries,
        levels: s.levels,
        fields: s.fields,
        description: s.description ?? null,
        funding: s.funding ?? null,
        durationMonths: s.duration_months ?? null,
        officialPageUrl: s.official_page_url,
        applicationUrl: s.application_url ?? null,
        applicationChannel: s.application_channel ?? null,
        languageRequirements: s.language_requirements,
        eligibilityRules: s.eligibility_rules,
        rulesHuman: s.rules_human ?? null,
        competitiveness: s.competitiveness ?? null,
        cycle: s.cycle,
        requiredDocuments: s.required_documents,
        essayRequirements: s.essay_requirements ?? {},
        selectionProcess: s.selection_process ?? null,
        tips: s.tips ?? [],
        status: s.status,
        needsVerification: s.needs_verification,
        verifiedAt: null,
      })
      .onConflictDoUpdate({
        target: scholarships.slug,
        set: {
          name: s.name,
          provider: s.provider,
          hostCountries: s.host_countries,
          levels: s.levels,
          fields: s.fields,
          description: s.description ?? null,
          funding: s.funding ?? null,
          durationMonths: s.duration_months ?? null,
          officialPageUrl: s.official_page_url,
          applicationUrl: s.application_url ?? null,
          applicationChannel: s.application_channel ?? null,
          languageRequirements: s.language_requirements,
          eligibilityRules: s.eligibility_rules,
          rulesHuman: s.rules_human ?? null,
          competitiveness: s.competitiveness ?? null,
          cycle: s.cycle,
          requiredDocuments: s.required_documents,
          essayRequirements: s.essay_requirements ?? {},
          selectionProcess: s.selection_process ?? null,
          tips: s.tips ?? [],
          status: s.status,
          needsVerification: s.needs_verification,
          updatedAt: new Date(),
        },
      });
    if (s.status === "published") published += 1;
  }
  console.log(`scholarships: published=${published} (draft entries stay out of matching)`);

  // --- procedures ---
  for (const file of readdirSync(join(ROOT, "data/procedures")).sort()) {
    if (!file.endsWith(".json")) continue;
    const p = read(`data/procedures/${file}`);
    await db
      .insert(procedures)
      .values({
        id: uuidv7(),
        code: p.code,
        title: p.title,
        summary: p.summary ?? null,
        steps: p.steps,
        typicalTotalDays: p.typical_total_days ?? null,
        officialLinks: p.official_links ?? [],
        needsVerification: p.needs_verification,
        verifiedAt: null,
      })
      .onConflictDoUpdate({
        target: procedures.code,
        set: {
          title: p.title,
          summary: p.summary ?? null,
          steps: p.steps,
          typicalTotalDays: p.typical_total_days ?? null,
          officialLinks: p.official_links ?? [],
          needsVerification: p.needs_verification,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`procedures: ${readdirSync(join(ROOT, "data/procedures")).filter((f) => f.endsWith(".json")).length}`);

  // --- demo account (spec 15: demo seed account with a completed example) ---
  const email = "demo@safar.dz";
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const userId = existing[0]?.id ?? uuidv7();
  if (existing[0]) {
    console.log(`demo user already exists: ${email}`);
  } else {
    await db.insert(users).values({ id: userId, email, name: "Yacine Haddad", locale: "fr", role: "student", plan: "free" });
    console.log(`demo user created: ${email}`);
  }

  const profile: Omit<ProfileData, "completeness" | "confirmedAt"> = {
    fullNameLatin: "Haddad Yacine",
    fullNameArabic: "حاد ياسين",
    birthDate: "2003-09-15",
    nationality: "DZ",
    gender: null,
    wilaya: "Alger",
    currentLevel: "licence",
    currentYear: 3,
    institution: "USTHB",
    faculty: "Faculté d'informatique",
    fieldOfStudy: "cs",
    fieldFreeText: "Informatique",
    expectedGraduation: "2027-06-30",
    gpa20: 14.2,
    gpaRankPercent: 35,
    honors: null,
    languages: [
      { lang: "en", level: "B2", cert: { name: "IELTS", score: "6.5", expires: "2028-05-01" } },
      { lang: "fr", level: "C1" },
    ],
    experiences: [{ type: "internship", title: "Stagiaire développement", org: "Sonatrach", start: "2025-06-01", end: "2025-09-01" }],
    skills: ["Python", "SQL", "React"],
    targetLevel: "master",
    targetFields: ["cs"],
    targetCountries: ["FR", "DE", "GB"],
    needsFullFunding: true,
    targetIntake: "2027-09",
    budgetMonthlyDzd: null,
    constraints: { canRelocate: true },
  };
  const completeness = computeCompleteness(profile);
  await db
    .insert(profiles)
    .values({
      id: uuidv7(),
      userId,
      ...profile,
      languages: profile.languages,
      experiences: profile.experiences,
      constraints: profile.constraints,
      completeness,
      confirmedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...profile, completeness, confirmedAt: new Date(), updatedAt: new Date() },
    });
  console.log(`demo profile: completeness=${completeness}% (demo data, not a real person)`);

  console.log("seed complete.");
  await db.$client.end?.();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
