# Nava

Turn a photo of an Algerian transcript into a dated plan to study abroad: upload, extract, match, plan, write, check, export.

Built from `arch.md` at **P0 demo scope** (the "P0 demo core" cut line in §2.4), with the **AI grid degrading gracefully** when no key is present and a **user-space Postgres cluster** instead of Docker.

## Quick start

```bash
bash scripts/pg-start.sh     # user-space Postgres on 127.0.0.1:5433 (no root, no docker)
npm install
npm run db:push              # apply the 25-table schema
npm run db:seed              # taxonomy, scholarships, procedures, demo user
npm run db:validate          # Zod-validate every curated data file
npm run build
npm run start                # http://localhost:3000
```

Then open **http://localhost:3000/login?demo=1** — that signs you into the seeded demo account (`demo@safar.dz`, profile already confirmed).

Postgres does not survive a reboot: run `bash scripts/pg-start.sh` again after one. Cluster lives in `$HOME/pgdata_safar`, socket in `/tmp/pgsafar`, port **5433** (deliberately not 5432).

## Verification gates

Every one of these is expected green:

| Command | Expect |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 8 files, **185 tests** |
| `npx tsx scripts/validate-data.ts` | `ok: 39 data/config files valid.` |
| `npx tsx scripts/seed.ts` | idempotent, prints `seed complete.` |
| `npm run probe` | exit 0 (key is scoped to one text model; vision/embeddings report `unsupported`, non-fatal) |
| `npm run build` | exit 0 |
| `npm run smoke` | **69/69 checks passed** |

`npm run smoke` starts its own `next start` on `:3111` if nothing is listening there, then drives the whole flow end to end as the demo account: sign in, confirm profile, upload a PDF and let ingestion settle, run a match, create an application, mark a task done, advance (and refuse to reverse) a checklist item, save and restore a draft version, run the checker and resolve a finding, download `plan.pdf` and `calendar.ics`, export account data, render every page in fr/en/ar including the RTL pass, and confirm an unknown slug 404s. It exits non-zero on the first failure.

## What is in the box

- **35 route handlers**, **15 pages**, **43 library modules**, **19 components**.
- **25 tables** (`src/lib/db/schema.ts`), UUIDv7 ids, `timestamptz` everywhere.
- **185 unit tests** over the pure core: rule DSL and tri-state evaluation, scoring, grade conversion, date/timeline maths, checklist state machine, postprocess, i18n, ids.
- **358 message keys × 3 locales** (`fr`, `en`, `ar`), key sets asserted identical by test.
- **20 scholarships** (17 published, 3 `draft`), **12 Algerian procedures**, 41 taxonomy entries, 5 grade scales, 19 countries.
- **AI client layer** (`src/lib/ai/*`): capability probe, timeout, retry, schema validation, request logging. No `AIGRID_API_KEY` means every AI surface renders an explicit "AI unavailable" state and nothing else changes.
## How the demo flow maps to spec features

| Spec | Where it lives |
|---|---|
| F0 onboarding, auth, language | `src/middleware.ts`, `src/app/login`, `src/app/(app)/onboarding`, `src/lib/auth.ts` |
| F1 upload + ingestion | `POST /api/documents`, `src/lib/ingest.ts`, `src/lib/storage.ts` |
| F2 vision extraction | `src/lib/ai/prompts/extract.v1.ts`, `src/lib/pdfjs.ts` |
| F3 profile + goals | `src/app/(app)/profile`, `src/lib/core/completeness.ts` |
| F4 matching | `src/lib/core/eligibility/*`, `src/lib/matching.ts`, `src/app/(app)/matches` |
| F5 plan / timeline | `src/lib/plan.ts` (back-plan), `src/app/(app)/applications/[id]` |
| F6 checklist + procedures | `src/lib/core/checklist.ts`, `src/app/(app)/procedures` |
| F7 writing studio | `src/components/writing-studio.tsx`, `POST /api/drafts/:id/generate` |
| F9 checker | `src/lib/core/checker/rules.ts`, `src/lib/finding-copy.ts` |
| F10 exports | `src/lib/pdf.ts`, `src/lib/ics.ts`, `GET /api/me/export` |

F8 (revision chat), F11 (reminders), F12 (agent chat), F13 (billing) and F14 (admin console) are **out of scope for P0** — see §2.4.

## Deviations from `arch.md`

Each one is a deliberate trade, not an omission. Reason given for every line.

**Structure**

1. **One app at the repo root, no pnpm monorepo.** `apps/web` and `packages/*` collapsed into a single Next.js app: `packages/core` → `src/lib/core`, `packages/ai` → `src/lib/ai`, `packages/db` → `src/lib/db`. One `npm install`, one `next build`, no workspace plumbing for a hackathon deliverable.
2. **Hand-rolled i18n** instead of `next-intl`. Locale is a cookie (`safar_locale`) plus a request header (`x-safar-locale`) set by middleware; `getMessages()` returns a flat key map. 358 keys, one test asserting the three files stay in lockstep.
3. **`/{locale}` is a rewrite, not a parallel route tree.** `src/middleware.ts` rewrites `/ar/dashboard` → `/dashboard` and pins the cookie, so there is one tree to keep correct instead of two. Landing page lives at `/` and at `/{locale}`.
4. **Plain Tailwind primitives** (`src/components/ui.tsx`) instead of shadcn/ui. Every colour pair used for text meets WCAG AA on `--surface`, and no state is carried by colour alone (icon + text always).

**Auth and data plumbing**

5. **Cookie HMAC session, not Auth.js.** Magic-link sign-in with SHA-256 tokens in `magic_links`; `AUTH_SECRET` signs the `safar_session` cookie. `src/lib/cookies.ts` holds the cookie names so `src/middleware.ts` never imports `pg`.
6. **No email provider.** `MAGIC_LINK_DEBUG=1` returns the link in the API response as `dev_link` / `token`; `?demo=1` on `/login` posts that straight through to `/api/auth/verify`.
7. **Local filesystem storage**, not S3/MinIO: files under `data/storage/<user>/...`, keyed per user, MIME sniffed from magic bytes.
8. **Single multipart upload.** The spec's `upload-url` → `complete` two-step exists for presigned S3 URLs; with local storage the file arrives in one `POST /api/documents` and the job is enqueued in-process. Same validation, same 202.
9. **In-process async jobs**, not Redis/BullMQ. `runIngestion()` is fire-and-forget and the UI polls status. `/api/health` honestly reports `redis: "not_configured"`.
10. **No docker-compose.** `scripts/pg-start.sh` initialises and starts a user-space cluster instead.

**Exports**

11. **Hand-rolled PDF writer** (`src/lib/pdf.ts`, Helvetica/WinAnsi) rather than `@react-pdf/renderer`, which does not load under Next ESM here. The dependency was removed rather than left dead.
12. **Arabic plan export redirects to `/print/plan/:id`.** A minimal PDF writer cannot shape Arabic; the browser's print engine renders the same plan as HTML instead. fr/en produce a real PDF. This is the one place the spec's "Arabic PDF renders connected letters correctly" acceptance is *not* met, and it is met by a different, honest mechanism.
13. **ICS is hand-rolled** (`src/lib/ics.ts`): one all-day `VEVENT` per task, 7/3/1-day alarms, `UID = task-<uuid>@safar.dz` so re-import updates rather than duplicates.
14. **No letter/CV PDF or DOCX export.** The writing studio saves versions; export of the draft itself is not in P0.

**Behaviour**

15. **SSE draft generation emits `outline` then `done`/`error`.** No token-by-token streaming: generation is one structured call, so streaming would be theatre.
16. **`tasks.task_key` column added** (spec has no equivalent). Back-planning produces a new graph each replan; `task_key` is the stable identity that lets a replan preserve the student's `done` / `blocked` state instead of resetting it.
17. **Draft restore copies the old content forward as a new version** rather than rewinding `current_version_id`. History stays append-only; nothing is lost by restoring.
18. **`loadCheck` lives in `src/lib/check-data.ts`**, not in the route file, so no route module exports non-route symbols (Next validates route exports at build time).
19. **Feasibility key bridge.** The DB stores `ok`, the message files key it `feasible`; a local `feasibilityKey()` maps one to the other at the render boundary rather than renaming stored data.
20. **Reads happen in server components.** Pages query Drizzle directly for their own data; the JSON API exists for mutations, polling and exports. This is *not* a full §8.3 read API — list endpoints the UI does not call were not written.
21. **Data export returns JSON, not a zip.** `GET /api/me/export` streams profile, documents, match runs, applications, tasks, checklist, drafts with versions, and checks. A zip needs a dependency for a demo button.

**Data**

22. **`config/holidays_dz.json` ships empty.** Weekend is Fri/Sat (`weekend_days: [5, 6]`), which is real and constant; movable lunar-calendar holidays are *not* assumed, because a wrong holiday silently shifts every plan by a day. The file's `notes` field explains this to the next curator.
23. **Procedure step bodies are EN-only** (titles and summaries are trilingual). 12 procedures × ~5 steps of verified prose is a content job, not a code job; `localize()` falls back locale → fr → en, so fr and ar render English body text rather than nothing. **Content gap, not a code gap.**
24. **3 of 20 scholarships are `draft`.** They validate and seed but stay out of matching until a human promotes them.
25. **Deadlines, fees, IELTS minimums and similar facts stay `null` with `needs_verification: true`.** Nothing was filled from memory. The unverified badge and its copy (`states.unverified` / `states.unverifiedHint`) surface on every record that carries the flag, and the spec §H disclaimer appears in the app footer and the landing footer.

## AI degradation

A key **is** configured: `.env` carries `AIGRID_API_KEY`, scoped to one text model (`Qwen/Qwen3.8-27B`). It is text-only, and the code assumes nothing about it:

- `npm run probe` runs the model for real, prints `ok: true`, and exits 0. The vision endpoint and embeddings are reported `unsupported` (key scope), which is classified non-fatal.
- `/api/health` reports `aigrid: {ok: true}` when the env var is present, `{ok: false, detail: "no AIGRID_API_KEY (degraded mode)"}` when it is not.
- Document ingestion tries vision first. A scanned page or a vision-scoped rejection falls back to the PDF text layer and lands in `needs_review` with `needs_review` status, waiting for a human — never `failed`.
- A PDF with no text layer and no vision access also lands in `needs_review`: the text extraction is empty, the human fills the fields in the review screen.
- Draft generation and checker Layer 2 answer with the real model when the key is there, and with the "AI unavailable" state (`states.aiOff`) when it is not. The checker's Layer 1 rules run either way.

Remove the key and every path degrades to the states above; add it back and the same paths light up. Nothing else changes.

## Design

The UI is built to the **Nava design system** (`Nava/Design system.pdf`): navy `#15233f`, primary blue `#1167f2`, pale panel `#e1e9f2`, gold `#f4c126`, lime `#bced48`; Inter for Latin, IBM Plex Sans Arabic for Arabic; 10/12/24px radii. Tokens live in `src/app/globals.css` as semantic CSS variables (light + dark), so every surface reads from the same palette.

## Known limits

- Procedure step bodies are English only (deviation 23).
- Arabic PDF export is an HTML print view, not a PDF (deviation 12).
- No reminders, no chat, no billing, no admin console (P0 scope).
- Ingestion of a scanned image with no text layer needs a vision key to get past `needs_review`.
- Only 3 of the 12 procedures ship `official_links` (Campus France, IELTS/TOEFL, TCF/TEF), because those are the only domains I could confirm answering 200 here. The other 9 keep an empty list, so their "Official links" block stays hidden rather than showing a URL nobody checked (spec §6).
- Reticle verification is dev-only: `ReticleDev` is mounted behind `NODE_ENV === 'development'`, so production HTML carries no Reticle strings and no page requests the SDK. Webpack still writes the SDK's lazy chunks into `.next/static/chunks` (about 416 KB) because it collects `import('@reticlehq/react')` before minification removes it behind that guard. Dead files on disk, never fetched. Removing them needs a build-time flag webpack cannot see through, which is not worth it for disk space.

## Data disclaimer

> Scholarship and procedure data in Nava is curated by humans from official sources and may change without notice. Fields marked "Not verified" have not yet been confirmed against an official page. Always confirm on the provider's official website before acting.
