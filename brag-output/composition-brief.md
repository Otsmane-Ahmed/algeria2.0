# Hyperframes Composition Brief: Nava

## Objective
Create a launch/pitch-style brag video for Nava — a serious, polished 52-second investor pitch film explaining the product idea.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~52 seconds (user explicitly requested "1 min or less"; this overrides the 15–25s default)

## Source Material
- Project root: `/home/ahmed/hackathon2`
- Primary files read: `src/messages/en.json` (verbatim copy), `src/app/globals.css` (brand tokens), landing page, README/arch knowledge
- Product name: **Nava**
- Tagline / strongest claim: "From a photo of your transcript to a real plan to study abroad"
- Key UI/visual moments to recreate: transcript upload with OCR progress; scholarship match with verdict chips; dated plan with document checklist; source/verification card; stat cards; the two mode cards
- Copy that must appear verbatim:
  - "Your transcript already contains a plan." / "We read it and build the steps."
  - "CURATED, NOT GENERATED:" + "Every fact in Nava links to its official source and verification date."
  - "We never invent a deadline, a fee or a test minimum. Unverified facts are marked and treated as unknown."
  - "20+ curated scholarships" · "12 Algerian procedures" · "3 languages, full parity" (EN/FR/AR)
  - "I just got my bac" / "I'm studying at an Algerian university" + the two mode-card bodies
  - "Download plan (PDF)"
- Logo: a graduation-cap glyph (mörtarbo/mortarboard shape, teal) + the wordmark "Nava" — recreate simply in SVG/HTML (cap icon + serif wordmark). No external logo file needed.

## Creative Direction
- Tone preset: **polished**
- Creative direction: "quiet premium pitch film for an investor — restrained, confident, zero hype"
- Interpretation: fewer scene types, generous holds, serif headline voice, no hype words, one accent color doing quiet work. Facts state themselves.
- Angle: the information layer Algerian students are missing — a curated, deterministic engine that reads real grades and outputs a plan.
- Hook: headline slam on mint — "Your transcript already contains a plan."
- Outro / punchline: Nava logo + tagline, long hold.
- Avoid:
  - Generic SaaS language ("streamline", "empower", "revolutionize")
  - Abstract filler visuals, unrelated redesign
  - Dark-mode drift — stay on the light mint canvas; make light cinematic
  - Any invented numbers (use only: 20+, 12, 3, 100% progress bar is a UI mock, that's fine)

## Visual Identity
- Background: **#f2f8f7** (mint canvas) — all scenes share it
- Text: **#16325a** headings, **#283338** body
- Accent: **#1c5d5f** (deep teal), support: sage **#65b8a2**, dusty rose **#d6aec1**, sea **#cae1e2**, card mint **#e4f0f1**, surface **#ffffff**, border **#c9dcdd**
- Verdict colors: success #1a6b4a on #e2f0e8; warning #a4571f on #f2e8e2
- Display font: **Source Serif 4** — local woff2 already copied to `assets/fonts/SourceSerif4-normal-400-700.woff2` (needs an in-file `@font-face`)
- Body font: **Inter** — `assets/fonts/Inter.ttf` (in-file `@font-face`)
- Eyebrow font: **IBM Plex Mono** — `assets/fonts/IBMPlexMono-500.woff2` (in-file `@font-face`; uppercase, wide tracking, colored dot prefix)
- Visual references: mono eyebrow + dot motif; pill buttons; flat white cards with 2px borders; verdict chips with icon + text; serif headlines; mint canvas

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. **Hook** — 5s — headline slam, eyebrow, ghost word, wordmark
2. **The problem** — 7s — headline + 3 deadline/procedure cards, alternating slide
3. **The product, working** — 14s — app frame: Upload (OCR progress) → Match (verdict chips) → Plan (timeline + checklist ticks)
4. **Trust contract** — 9s — serif quote verbatim + source card with Verified chip
5. **Breadth** — 10s — 3 stat cards + 2 mode cards
6. **Outro** — 7s — logo + tagline, glow, music release

## Audio
- Audio role: warm, steady business bed under a quiet edit
- Audio arc: quiet entry → restrained middle with sparse SFX → slight lift at breadth → release under logo
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (already copied into `composition/assets/music/`)
- Music treatment: volume 0.30 from t=0; dip toward 0.22 under the Scene 4 quote; fade to ~0.08 across the outro; end by 52s
- Music cue guidance: bundled preset at `/home/ahmed/.agents/skills/brag/assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (tempo, strongCues, beats). Target ≤3 strong-cue locks: headline landing (~1.5–2s), match-chip payoff (~20–24s), logo (~45–47s). Sequential text reveals snap to every other beat (reading floor wins).
- Audio-reactive treatment: subtle — mint background warmth / hero glow breathe with RMS; no waveform or eq visuals. If extraction is unavailable (no helper/ffmpeg), document and skip.
- Audio-coupled moments:
  - Scene 2 card arrivals — card-slide (casino) or drop (interface)
  - Scene 3 OCR progress — soft ticks; chip stamps — card-place; checklist ticks — soft ui clicks
  - Scene 4 source card — one soft drop
  - Scene 5 stat landings — chip-lay (casino)
  - Scene 6 logo — impactBell_heavy_000 at modest volume
- SFX selection guidance: `/home/ahmed/.agents/skills/brag/assets/sfx/sfx-analysis.md` — prefer low high-frequency-risk sounds; sparse polished posture, 8–12 SFX total across 52s
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, volume after the animation exists; copy chosen files into `composition/assets/sfx/…` (create subfolders as needed)
- Voiceover: **disabled** (no `--voice` flag) — do not add narration

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. This is a `/brag` handoff, not the generic promo workflow: /brag owns angle, copy, storyboard, tone; Hyperframes owns composition structure, exact timing, animation mechanics, runtime choice, lint rules, render workflow.

Requirements:
- At least one real UI/copy/visual element from the project (verbatim copy above + recreated app UI)
- All text readable in the final render (video-scale type: headlines 64–120px, body 28–42px, labels 18–24px)
- Total duration ~52s (explicit user request overriding the 15–25s default)
- Music + sparse SFX layer as planned; no narration
- Audio-reactive: subtle RMS breathing on background/glow if extraction available, else document and skip
- 1–3 strong-cue beat locks, sequential text on every-other-beat, reading floor respected
- All claims grounded in the project copy (see verbatim list; no invented stats — the "Verified · Jan 2025" chip is a plausible fictional stand-in, already declared in the plan)
- Single scene-agnostic shared background allowed (persistent decorative layers), scenes as clips with `class="clip"` + `data-start`/`data-duration`
- Run `npx hyperframes check` before render (brag's single gate)
- Keep creation and rendering local; no publish/cloud without a separate explicit user request
- Render to `brag-output/brag.mp4` at `--quality looks` (or delivery) once the composition passes check
