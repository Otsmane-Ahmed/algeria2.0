import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Drizzle mirror of arch.md §5 (PostgreSQL schema).
 * Deviations from the spec SQL, all deliberate:
 *  - email is `text` (lowercased in code) instead of `citext` (no extension needed)
 *  - enum CHECK constraints are enforced by shared Zod schemas at the API boundary
 *  - P1 tables (subscriptions, payments, reminders, conversations, messages, sources) are omitted
 * All ids are UUIDv7 generated in `src/lib/core/ids.ts` (time-sortable, no extension needed).
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    locale: text("locale").notNull().default("fr"),
    mode: text("mode").notNull().default("abroad"), // "bac" (Mode A) | "abroad" (Mode B)
    role: text("role").notNull().default("student"),
    plan: text("plan").notNull().default("free"),
    marketingOptIn: boolean("marketing_opt_in").default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("users_deleted_at_idx").on(t.deletedAt)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    fullNameLatin: text("full_name_latin"),
    fullNameArabic: text("full_name_arabic"),
    birthDate: date("birth_date", { mode: "string" }),
    nationality: text("nationality").default("DZ"),
    gender: text("gender"),
    wilaya: text("wilaya"),
    currentLevel: text("current_level"),
    currentYear: smallint("current_year"),
    institution: text("institution"),
    faculty: text("faculty"),
    fieldOfStudy: text("field_of_study"),
    fieldFreeText: text("field_free_text"),
    expectedGraduation: date("expected_graduation", { mode: "string" }),
    gpa20: numeric("gpa_20", { precision: 4, scale: 2, mode: "number" }),
    gpaRankPercent: numeric("gpa_rank_percent", { precision: 5, scale: 2, mode: "number" }),
    honors: text("honors"),
    languages: jsonb("languages")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    experiences: jsonb("experiences")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'`),
    targetLevel: text("target_level"),
    targetFields: text("target_fields")
      .array()
      .notNull()
      .default(sql`'{}'`),
    targetCountries: text("target_countries")
      .array()
      .notNull()
      .default(sql`'{}'`),
    needsFullFunding: boolean("needs_full_funding").default(true),
    targetIntake: text("target_intake"),
    budgetMonthlyDzd: integer("budget_monthly_dzd"),
    constraints: jsonb("constraints")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<Record<string, unknown>>(),
    completeness: smallint("completeness").notNull().default(0),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("profiles_user_idx").on(t.userId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("transcript"),
    originalFilename: text("original_filename"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    pageCount: smallint("page_count"),
    status: text("status").notNull().default("uploaded"),
    errorCode: text("error_code"),
    languageDetected: text("language_detected"),
    expiresOn: date("expires_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("documents_user_kind_idx").on(t.userId, t.kind),
    uniqueIndex("documents_user_sha_uq").on(t.userId, t.sha256),
  ],
);

export const documentPages = pgTable(
  "document_pages",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNo: smallint("page_no").notNull(),
    imageKey: text("image_key").notNull(),
    ocrText: text("ocr_text"),
    width: integer("width"),
    height: integer("height"),
  },
  (t) => [uniqueIndex("document_pages_uq").on(t.documentId, t.pageNo)],
);

export const extractions = pgTable("extractions", {
  id: uuid("id").primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptId: text("prompt_id").notNull(),
  raw: jsonb("raw").notNull().$type<Record<string, unknown>>(),
  fieldConfidence: jsonb("field_confidence")
    .notNull()
    .$type<Record<string, number>>(),
  warnings: text("warnings")
    .array()
    .notNull()
    .default(sql`'{}'`),
  status: text("status").notNull().default("pending_review"),
  confirmedByUserAt: timestamp("confirmed_by_user_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const academicTerms = pgTable(
  "academic_terms",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    extractionId: uuid("extraction_id").references(() => extractions.id, {
      onDelete: "set null",
    }),
    academicYear: text("academic_year"),
    levelLabel: text("level_label"),
    termLabel: text("term_label"),
    average20: numeric("average_20", { precision: 4, scale: 2, mode: "number" }),
    creditsEarned: numeric("credits_earned", { precision: 5, scale: 1, mode: "number" }),
    creditsTotal: numeric("credits_total", { precision: 5, scale: 1, mode: "number" }),
    result: text("result"),
    courses: jsonb("courses")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("academic_terms_user_idx").on(t.userId)],
);

export const scholarships = pgTable(
  "scholarships",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: jsonb("name").notNull().$type<Record<string, string>>(),
    provider: jsonb("provider").notNull().$type<Record<string, unknown>>(),
    hostCountries: text("host_countries")
      .array()
      .notNull()
      .default(sql`'{}'`),
    levels: text("levels")
      .array()
      .notNull()
      .default(sql`'{}'`),
    fields: text("fields")
      .array()
      .notNull()
      .default(sql`'{}'`),
    description: jsonb("description").$type<Record<string, string> | null>(),
    funding: jsonb("funding").$type<Record<string, unknown> | null>(),
    durationMonths: integer("duration_months"),
    officialPageUrl: text("official_page_url").notNull(),
    applicationUrl: text("application_url"),
    applicationChannel: text("application_channel"),
    languageRequirements: jsonb("language_requirements")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    eligibilityRules: jsonb("eligibility_rules").notNull().$type<Record<string, unknown>>(),
    rulesHuman: text("rules_human"),
    competitiveness: smallint("competitiveness"),
    cycle: jsonb("cycle").notNull().$type<Record<string, unknown>>(),
    requiredDocuments: jsonb("required_documents")
      .notNull()
      .$type<unknown[]>(),
    essayRequirements: jsonb("essay_requirements")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<Record<string, unknown>>(),
    selectionProcess: text("selection_process"),
    tips: jsonb("tips")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    status: text("status").notNull().default("draft"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => users.id),
    needsVerification: boolean("needs_verification").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("scholarships_status_idx").on(t.status),
    index("scholarships_hosts_idx").on(t.hostCountries),
    index("scholarships_levels_idx").on(t.levels),
  ],
);

export const scholarshipVersions = pgTable("scholarship_versions", {
  id: uuid("id").primaryKey(),
  scholarshipId: uuid("scholarship_id")
    .notNull()
    .references(() => scholarships.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
  changedBy: uuid("changed_by").references(() => users.id),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const procedures = pgTable("procedures", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: jsonb("title").notNull().$type<Record<string, string>>(),
  summary: jsonb("summary").$type<Record<string, string> | null>(),
  steps: jsonb("steps").notNull().$type<unknown[]>(),
  typicalTotalDays: jsonb("typical_total_days").$type<{
    min: number | null;
    max: number | null;
  } | null>(),
  officialLinks: text("official_links")
    .array()
    .notNull()
    .default(sql`'{}'`),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  needsVerification: boolean("needs_verification").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const taxonomyFields = pgTable("taxonomy_fields", {
  code: text("code").primaryKey(),
  parentCode: text("parent_code"),
  label: jsonb("label").notNull().$type<Record<string, string>>(),
  synonyms: jsonb("synonyms")
    .notNull()
    .default(sql`'{}'::jsonb`)
    .$type<Record<string, string[]>>(),
});

export const gradeScales = pgTable(
  "grade_scales",
  {
    country: text("country").notNull(),
    system: text("system").notNull(),
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.country, t.system] })],
);

export const matchRuns = pgTable("match_runs", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  profileSnapshot: jsonb("profile_snapshot").notNull().$type<Record<string, unknown>>(),
  catalogVersion: text("catalog_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => matchRuns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id")
      .notNull()
      .references(() => scholarships.id),
    verdict: text("verdict").notNull(),
    score: smallint("score").notNull(),
    factors: jsonb("factors").notNull().$type<unknown[]>(),
    blockers: jsonb("blockers")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<unknown[]>(),
    missingInfo: jsonb("missing_info")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<string[]>(),
    daysToDeadline: integer("days_to_deadline"),
    explanation: jsonb("explanation").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("matches_run_sch_uq").on(t.runId, t.scholarshipId)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id")
      .notNull()
      .references(() => scholarships.id),
    cycleId: text("cycle_id").notNull(),
    status: text("status").notNull().default("planning"),
    targetSubmissionDate: date("target_submission_date", { mode: "string" }),
    notes: text("notes"),
    feasibility: text("feasibility"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("applications_user_sch_cycle_uq").on(t.userId, t.scholarshipId, t.cycleId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** Graph key from buildTaskGraph ("proc:transcript:copie-conforme"); stable across replans. */
    key: text("task_key"),
    title: jsonb("title").notNull().$type<Record<string, string>>(),
    detail: jsonb("detail").$type<Record<string, string> | null>(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    startDate: date("start_date", { mode: "string" }),
    estDays: integer("est_days"),
    dependsOn: uuid("depends_on")
      .array()
      .notNull()
      .default(sql`'{}'`),
    requiredDocumentCode: text("required_document_code"),
    procedureCode: text("procedure_code"),
    status: text("status").notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isCritical: boolean("is_critical").notNull().default(false),
    orderIdx: integer("order_idx"),
  },
  (t) => [index("tasks_app_due_idx").on(t.applicationId, t.dueDate)],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    docCode: text("doc_code").notNull(),
    label: jsonb("label").notNull().$type<Record<string, string>>(),
    mandatory: boolean("mandatory").notNull().default(true),
    status: text("status").notNull().default("missing"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
  },
  (t) => [index("checklist_app_idx").on(t.applicationId)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    language: text("language").notNull(),
    title: text("title"),
    currentVersionId: uuid("current_version_id"),
    interviewAnswers: jsonb("interview_answers")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("drafts_user_idx").on(t.userId)],
);

export const draftVersions = pgTable(
  "draft_versions",
  {
    id: uuid("id").primaryKey(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    contentMd: text("content_md").notNull(),
    wordCount: integer("word_count"),
    source: text("source").notNull(),
    instruction: text("instruction"),
    model: text("model"),
    promptId: text("prompt_id"),
    factsUsed: jsonb("facts_used").$type<unknown[] | null>(),
    missingPlaceholders: text("missing_placeholders")
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("draft_versions_uq").on(t.draftId, t.versionNo)],
);

export const checks = pgTable("checks", {
  id: uuid("id").primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull().default("running"),
  readinessScore: smallint("readiness_score"),
  summary: jsonb("summary").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const checkFindings = pgTable(
  "check_findings",
  {
    id: uuid("id").primaryKey(),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    title: jsonb("title").notNull().$type<Record<string, string>>(),
    detail: jsonb("detail").$type<Record<string, string> | null>(),
    evidence: jsonb("evidence").$type<Record<string, unknown> | null>(),
    fixHint: jsonb("fix_hint").$type<Record<string, string> | null>(),
    source: text("source").notNull(),
    resolved: boolean("resolved").notNull().default(false),
  },
  (t) => [index("check_findings_check_idx").on(t.checkId)],
);

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id"),
    requestId: text("request_id"),
    role: text("role"),
    model: text("model"),
    promptId: text("prompt_id"),
    latencyMs: integer("latency_ms"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    attempts: smallint("attempts"),
    status: text("status"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("llm_calls_user_idx").on(t.userId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id"),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("events_name_idx").on(t.name)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id"),
    action: text("action"),
    entity: text("entity"),
    entityId: uuid("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown> | null>(),
});

/**
 * Single-use magic links (spec 12.1: "Magic link single-use, 15-min expiry").
 * Only the SHA-256 of the token is stored, so a DB read never exposes a usable
 * sign-in link. Not in the spec's SQL listing; added because the spec requires
 * single-use links and there is no other place to enforce that.
 */
export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("magic_links_email_idx").on(t.email), index("magic_links_expiry_idx").on(t.expiresAt)],
);

// ---------------------------------------------------------------------------
// Mode A: bac orientation (nava-full-documentation.md §7)
// ---------------------------------------------------------------------------

/**
 * Bac-graduate profile, built by the Mode A intake chatbot (§7.1). No file
 * upload anywhere in Mode A intake — every field is typed, tapped or spoken.
 * Unverified / estimated values are flagged (`averageIsEstimate`) and shown
 * as such in the UI; nothing here is a promise of admission.
 */
export const bacProfiles = pgTable(
  "bac_profiles",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    stream: text("stream"), // bac stream (filière), e.g. "sciences_experimentales"
    streamOption: text("stream_option"),
    bacAverage: numeric("bac_average", { precision: 4, scale: 2, mode: "number" }),
    averageIsEstimate: boolean("average_is_estimate").notNull().default(false),
    bacYear: smallint("bac_year"),
    homeWilaya: text("home_wilaya"),
    interests: jsonb("interests")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<string[]>(),
    workStyle: text("work_style"), // people | machines | data | ideas
    practicality: text("practicality"), // practical | theoretical | unsure
    studyLengthPref: text("study_length_pref"), // 3 | 5 | 5+ | unsure
    constraints: jsonb("constraints")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<Record<string, unknown>>(),
    draftWishes: jsonb("draft_wishes")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<string[]>(),
    abroadOpenness: text("abroad_openness"), // yes | maybe_later | no
    checklist: jsonb("checklist")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<Record<string, string>>(), // doc code -> "to_get" | "in_progress" | "done"
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("bac_profiles_user_idx").on(t.userId)],
);

/** Ordered wish list (fiche de vœux, §7.2). Position is a real ranking. */
export const wishes = pgTable(
  "wishes",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    formationId: text("formation_id").notNull(),
    position: smallint("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("wishes_user_idx").on(t.userId),
    uniqueIndex("wishes_user_formation_idx").on(t.userId, t.formationId),
  ],
);

/** Curated Algerian post-bac formations (Mode A catalog, §9.5). */
export const formations = pgTable("formations", {
  id: text("id").primaryKey(), // slug
  nameFr: text("name_fr").notNull(),
  nameEn: text("name_en"),
  nameAr: text("name_ar"),
  institution: text("institution").notNull(),
  institutionKind: text("institution_kind").notNull(), // university | grande_ecole | institute
  city: text("city").notNull(),
  wilayaCode: smallint("wilaya_code").notNull(),
  wilayaName: text("wilaya_name").notNull(),
  streams: text("streams").array().notNull(),
  language: text("language").notNull(), // fr | ar | en
  domainTags: text("domain_tags").array().notNull(),
  durationYears: smallint("duration_years").notNull(),
  tuition: text("tuition").notNull().default("public"), // public (free) | private
  cutoffLastYear: numeric("cutoff_last_year", { precision: 4, scale: 2, mode: "number" }),
  cutoffSource: text("cutoff_source"),
  needsVerification: boolean("needs_verification").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
