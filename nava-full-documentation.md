# Nava: Complete UI / UX Documentation

> One assistant, two journeys. Bac graduates get oriented (Algeria first, abroad as an option). Algerian university students get a full study-abroad paperwork guide.

This document explains everything: the history of the idea, both modes, every screen, every step, every feature, every workflow, every state, the visual identity, the copy rules, the Figma Make prompts, the demo script, and the open questions. It is written for the person designing the interface (you), so each section says what the screen contains, what the user does, and what the AI does behind it.

**Legend used throughout**
- **[NEW]** a screen or feature added in the latest idea (two modes).
- **[CHANGED]** an existing screen that gets new content.
- **[REUSE]** an existing screen, unchanged.
- **[PROPOSAL]** an idea I suggested that you have not confirmed yet.
- **[VERIFY]** a real-world Algerian rule or number that must be checked against an official source before it appears in the demo.

---

## Table of contents

1. History of the idea
2. Product vision, users and the jury concern
3. The two modes and the mode switcher
4. Visual identity
5. Global layout (shell)
6. Complete user flow
7. Mode A in extreme detail (bac orientation)
8. Mode B in extreme detail (study abroad)
9. Shared screens
10. Feature ideas to stand out
11. Screen inventory (Figma checklist)
12. Component library
13. States and edge cases
14. Copy and content rules
15. Data and trust rules
16. Figma Make prompts and workflow
17. Two-minute demo script
18. Assumptions and open questions
19. Change log of this revision

---

## 1. History of the idea

| Stage | Idea | Status |
|---|---|---|
| 1 | **BLÉ-PASS IA** (Team T3I): AI platform with a "digital passport" for Algeria's local cereal varieties, QR codes, a digital gene bank, GIS maps and IoT storage monitoring. Client: the Algerian agriculture government. | Abandoned. Style board with a green/amber palette and farmer illustrations was made for it. |
| 2 | **Nava**, track "AI for Student Life" (Algeria 2.0, Track 01), described in `arch.md`: a student photographs a transcript, AI extracts the data, matches scholarships, builds a plan and timeline, explains Algerian paperwork, writes letters, checks readiness and chats in Arabic / French / English / Darija. | Replaced by stage 3, but all of its screens are kept as Mode B. |
| 3 | **Nava, two modes** (current). Mode A for bac graduates, Mode B for Algerian university students who want to continue abroad. | Current. |

**Why the pivot:** guiding every student straight to the paperwork for leaving Algeria would likely upset the jury. The fix is to start earlier (right after the bac), help students choose well inside Algeria first, show abroad as one honest option, and keep the full abroad guide for students who are already at university.

**Your role:** you only design the interface (UI/UX). You build it in **Figma Make** from text prompts. You are a beginner, so every prompt in this project is written to be pasted directly, and restyling is done in a second prompt after the structure is generated.

**Design target:** desktop version, 1440 px wide, with an Arabic right-to-left (RTL) version of at least the dashboard.

---

## 2. Product vision, users and the jury concern

### 2.1 Vision
"Turn what a student knows about themselves (their bac result, their interests, their documents) into a clear, verified plan, in their own language."

### 2.2 Users

| User | Situation | What they need | Mode |
|---|---|---|---|
| **Bac graduate** | Just received the bac result, has a bac average and a stream (filière), must submit a *fiche de vœux* (the list of wishes for post-bac orientation), is unsure which faculty or school fits. | A ranked list of realistic options in Algeria, an honest idea of their chances, a safe wish order, a plan for the inscription steps, and optionally a look at what exists abroad. | **A** |
| **Algerian university student** | Already studying (licence or master) and wants to continue outside Algeria. | Scholarships that fit, a plan with deadlines, a guide to Algerian paperwork (legalization, translation, certified copies), help writing letters, a final readiness check. | **B** |
| **Reviewer / admin** | Keeps rules and cut-off data fresh. | A table of data with last-verified dates. | Admin |

### 2.3 The jury concern and the design answer
The concern: "an assistant that pushes Algerian students to leave." The answer is built into the interface, not only into the talk:

1. **Algeria first.** In Mode A, Matches opens on the **In Algeria** tab. **Abroad** is a second tab, never mixed into the same list.
2. **The chatbot asks about abroad late and neutrally.** It is one question near the end ("Would you also like to see options abroad?") with the answer "Maybe later" as the default.
3. **Honest comparison.** The Compare screen shows Algeria vs abroad on cost (in DZD), duration, chance, language, city and career outcomes, with no pushing language.
4. **Neutral words.** "Options", never "escape" or "best chance to leave".
5. **Labeled data.** Cut-offs from past years are shown as "Estimate, last year". Anything unconfirmed shows "Not verified, check the official site".
6. **The student decides.** Every AI output carries "AI-generated, verify". Nothing is submitted without the student's confirmation. The AI never says "you will be accepted".

---

## 3. The two modes and the mode switcher

| | **Mode A: Bac orientation** [NEW] | **Mode B: Study abroad from Algeria** [REUSE] |
|---|---|---|
| Who | Bac graduates | Algerian university students |
| Entry data | **Chatbot** conversation (no file upload) | Transcript photo / PDF upload with AI reading |
| Core question | "Which Algerian faculty or school fits my bac average and wishes?" | "Which scholarship or program abroad fits my profile, and what must I do before the deadline?" |
| Main output | Ranked options, safe wish order, inscription plan | Ranked scholarships, application plan, written documents, readiness check |
| Default region | Algeria | Abroad |
| Sidebar | Dashboard, My Bac, Fiche de vœux, Matches, Compare, My Plan, Chat, Settings | Dashboard, Documents, Profile, Matches, My Applications, Writing Studio, Chat, Settings |

### 3.1 How the mode is chosen
- At onboarding, a **"Who are you?"** step shows two large cards: "I just got my bac" and "I'm studying at an Algerian university". Under the cards, a small link: "Not sure? Try both".
- The choice sets the mode, which controls the sidebar, the dashboard content and what Matches shows.

### 3.2 The mode switcher
- A two-segment toggle at the **top of the sidebar**: "Bac orientation" | "Study abroad".
- Switching never deletes data. Each mode keeps its own profile, and the switch is also available in Settings.
- When the user switches for the first time, a small card explains: "Each mode keeps its own information. You can switch any time."

---

## 4. Visual identity

The current style board uses a navy / blue / lime palette (replacing the earlier green/amber one). **Hex values below are estimates read from a screenshot: click each swatch in Figma and replace them with the exact values.**

### 4.1 Colors

| Name | Hex (estimate) | Role |
|---|---|---|
| Navy | `#13233F` | Sidebar, headings, primary text on light backgrounds, dark sections |
| Bright blue | `#1469F5` | Primary buttons, links, active states, focus rings, progress fills, info, "AI-generated" labels |
| Lime | `#B8EE48` | Accent and highlight, active-sidebar indicator, success / "ready" states, score ring when complete. **Always navy text on lime, never white.** |
| Pale blue | `#E1E8F2` | Card backgrounds, table header rows, selected rows, input backgrounds |
| White | `#FFFFFF` | Page background |
| Greys | `#000000 #2F2F2F #B3AFAC #D6D6D6 #E8E8E8` | Body text, secondary text, borders, dividers, disabled states |
| Yellow | `#F6C12A` | Warnings, "Stretch" verdict, medium confidence, deadlines coming soon |
| Red | `#D9141A` | Errors, blockers, "Ineligible" verdict, destructive actions |

### 4.2 Verdict and status pills (always icon + text, never color only)

| Verdict | Background | Text | Icon |
|---|---|---|---|
| Eligible | Lime | Navy | Check |
| Likely | Bright blue | White | Check |
| Stretch | Yellow | Navy | Warning triangle |
| Unknown | Grey | Dark grey | Question mark |
| Ineligible / Blocker | Red | White | X |

Other badges
- **Not verified**: outlined grey with an info icon.
- **Verified**: pale blue with a bright-blue check.
- **AI-generated, verify**: blue label, on every AI-written element.
- **Estimate, last year**: outlined grey, used on cut-off figures.
- **Confidence dots** (data extraction in Mode B): lime = high, yellow = medium, red = low or empty.

### 4.3 Typography
- **Creato Display**: headings and big numbers (scores, countdowns, the readiness ring).
- **Roboto**: body text, tables, labels, inputs, buttons.
- Fallback: Roboto for everything if Creato Display is unavailable.
- **Arabic**: IBM Plex Sans Arabic or Noto Sans Arabic, same weights and sizes.
- Sentence case everywhere. No all-caps labels.

### 4.4 Illustrations (from the style board)
- The **stressed student at a desk with a laptop and books**: onboarding, empty states ("Nothing here yet"), error states, "not ready" in the readiness check.
- The **group of three celebrating students with a lightbulb**: landing hero, login, "Ready to submit" success state, dashboard welcome banner.
- Keep the illustrations' own colors. Do not recolor.

### 4.5 Buttons and components
- **Primary**: filled bright blue, white text.
- **Secondary**: outlined navy.
- **Accent**: lime with navy text, **one per screen** (for example "Start free", "See my matches").
- **Info**: pale blue with blue text.
- **Destructive**: red with white text.
- **Disabled**: light grey.
- Corner radius: 8–12 px on buttons and inputs, 12–16 px on cards. Soft, subtle shadows on cards.
- **Sidebar**: navy background, white icons and labels, active item with a lime indicator.
- **Top bar**: white with a light grey bottom border.
- **Rings and progress bars**: bright blue fill on a light grey track, lime when complete.
- **Charts and timeline bars**: thin lines, light grey grid. Blue = normal, lime = done, red = critical or blocked, yellow = at risk.
- **Inputs**: pale blue or white, grey border, bright-blue focus ring.
- Contrast must meet WCAG AA.

### 4.6 Right-to-left (Arabic)
Same colors, fonts and components with a mirrored layout: sidebar on the right, mirrored chevrons and arrows, chat bubbles mirrored. **Numbers, dates, grades and scores stay left-to-right.**

---

## 5. Global layout (the shell)

Every screen after login sits inside the same shell.

1. **Left sidebar** (navy). Top: logo and the **mode switcher**. Below: the tabs of the current mode. Active tab has a lime indicator.
2. **Top bar** (white): global search, notification bell (deadlines, new matches, reminders), language switcher (العربية / Français / English), user avatar menu (profile, settings, log out).
3. **Floating chat button** (bottom corner): opens a small chat widget on every page after login. In Mode A, the full-page chatbot is a separate screen (see section 7.1).
4. **Footer disclaimer** on data-heavy pages: "Scholarship, program and procedure data is curated from official sources and may change. Items marked 'Not verified' have not been confirmed. Always check the official website."
5. **Banners**: offline banner ("Showing the saved version"), data-freshness banner when information is older than the threshold.

---

## 6. Complete user flow

### 6.1 Entry (shared)

| # | Screen | What happens | Status |
|---|---|---|---|
| 1 | **Landing** | Hero with the tagline covering both journeys, two entry buttons, a three-step visual (Tell → Match → Plan), the trust section (privacy), FAQ, language switcher. | CHANGED |
| 2 | **Login** | Email magic link or Google. No password. | REUSE |
| 3 | **Onboarding: language and consent** | Language choice (AR / FR / EN), Terms and Privacy checkbox. | REUSE |
| 4 | **Onboarding: who are you?** | Two cards, sets the mode. | NEW |

### 6.2 Mode A (bac orientation)

| # | Screen | One-line summary |
|---|---|---|
| 1 | **Bac chatbot** (first step) | Guided chat collects stream, bac average, year, wilaya, interests, constraints. No upload. |
| 2 | **Fiche de vœux** | Rank wishes, see a chance chip per wish, get a safer order suggestion. |
| 3 | **Matches** | In Algeria (default) / Abroad tabs, ranked cards, expandable factors. |
| 4 | **Compare + what-if** | Side-by-side options and live "what if my average were different". |
| 5 | **My Plan** | Inscription timeline and documents checklist with guides. |
| 6 | **Abroad handoff** | If the student chooses an abroad option, they continue inside Mode B's application screens. |

> The earlier "Formation detail" screen (programme, career paths, cut-off history chart, cost, official source) was **removed**. Its useful pieces now live in the expandable Matches card (see 7.3). The earlier "Bac documents" upload step was **removed** and replaced by the chatbot.

### 6.3 Mode B (study abroad)

| # | Screen | One-line summary |
|---|---|---|
| 1 | **Documents** | Upload university transcripts and other documents. |
| 2 | **Document review** | Split view: image on the left, editable extracted data on the right. |
| 3 | **Profile + goals** | One question per screen. |
| 4 | **Matches** | Scholarships with verdicts and what-if. |
| 5 | **Scholarship detail** | Rules, funding, dates, sources, "Track this". |
| 6 | **Application** (6 tabs) | Overview, Timeline, Documents, Writing, Check, Notes. |
| 7 | **Writing Studio** | Editor + revision chat + diff. |
| 8 | **Pre-submission check** | Readiness score and findings. |

### 6.4 Shared after onboarding
Dashboard (mode-aware), Chat (floating widget and full page), Tools hub (optional), Settings, Admin (internal).

---

## 7. Mode A in extreme detail (bac orientation)

### 7.1 Step 1: The Bac chatbot (replaces the form and the PDF upload)

**Purpose.** Collect everything the system needs to orient a bac graduate through a friendly conversation, instead of a long form or a document upload. There is **no file upload, no paperclip, no drop zone** in Mode A's intake. Everything is typed, tapped or spoken.

**Why a chatbot.** Bac graduates are young and stressed. A conversation feels lighter than a form, supports Darija and voice notes, can ask follow-up questions, and can accept several answers in one message.

#### 7.1.1 Screen layout (desktop)
- **Left, about 65% width: the chat.**
  - Header: Nava avatar, name, language selector (AR / FR / EN, plus a "Darija" toggle for how the bot writes Arabic), "Restart", "Save and continue later".
  - **Stage indicator** under the header (a real sequence, so numbered): 1 About your bac, 2 Your interests, 3 Your constraints, 4 Your wishes, 5 Confirm.
  - Message area: bot bubbles (pale blue, left), user bubbles (bright blue, white text, right; mirrored in RTL), timestamps hidden by default.
  - **Quick-reply chips** under the last bot message (tap to answer).
  - **Input bar**: text field, microphone button (voice note), send button. **No attachment button.**
- **Right, about 35% width: "What I know about you" live card.**
  - Title, a completeness ring (0–100%), and the fields filling in as the user answers: Stream, Bac average, Bac year, Wilaya, Interests (tags), Constraints, Wishes, Abroad openness.
  - Each filled field has a small **edit** pencil; empty fields show "Not yet".
  - A field the AI inferred (for example an interest tag from free text) carries a small blue "AI-suggested" label until the student confirms it.

#### 7.1.2 The conversation, turn by turn

Each turn lists: what the bot says, the input type, validation, what is saved, and what happens on a wrong or missing answer. Sample lines are shown in English; the real product shows them in the chosen language.

**Turn 0: Greeting**
- Bot: "Hi, I'm Nava. In about 5 minutes I'll help you find the Algerian faculty or school that fits you. I only use your answers to build your options, and you can change anything."
- Chips: "Let's start" / "How does this work?"
- "How does this work?" opens a short three-line explanation (you tell me, I match, you decide) and returns to the chips.
- Arabic sample: "مرحبا! أنا نافا. سأساعدك في اختيار التخصص والمؤسسة المناسبة بعد الباك."

**Turn 1: Stream (filière)**
- Bot: "Which bac stream did you take?"
- Input: single-choice chips: Sciences expérimentales, Mathématiques, Technique mathématique, Gestion et économie, Lettres et philosophie, Langues étrangères, "Other".
- If **Technique mathématique**, a follow-up chip set for the technical option (for example mechanical, civil, electrical, process engineering) [VERIFY the exact option list].
- Saved: `stream` (and `stream_option` when relevant). "Other" opens a text field.

**Turn 2: Bac average and year**
- Bot: "What was your bac average out of 20?"
- Input: number field (two decimals allowed) plus the chip "I don't have my result yet".
- **Validation:** accepts 0 to 20. If the value looks unusual (for example above 20 or below 5), the bot replies: "That looks unusual. Did you mean 14.35?" with chips to confirm or retype.
- **"I don't have my result yet"** opens an expected-average slider (labeled **Estimate**) so the student can still explore. The profile card shows "Estimated average" in yellow until a real value replaces it.
- Then: "Which year did you take the bac?" Chips: this year, last year, two years ago, earlier.
- Saved: `bac_average`, `average_is_estimate` (true/false), `bac_year`.

**Turn 2b (optional): Subject marks**
- Bot: "Want more precise results? You can add your main subject marks. Some programs weigh subjects differently."
- Input: small table (mathematics, physics, natural sciences, Arabic, French, English, philosophy, and others depending on stream), each optional, with a "Skip" chip.
- Saved: `subject_marks` (optional). [VERIFY] whether the matching formulas used in your data really weigh subjects per formation. If they do not, hide this turn.

**Turn 3: Wilaya**
- Bot: "Which wilaya do you live in? I'll use it to show nearby options."
- Input: type-ahead over the 58 wilayas, or chips for the most common ones.
- Saved: `home_wilaya`.

**Turn 4: Interests**
- Bot: "What do you enjoy, or what do you imagine yourself doing one day? Write freely, in any language, or send a voice note."
- Input: free text or voice note.
- The AI extracts **interest tags** (for example "computer science", "medicine", "teaching") and shows them as editable chips under the message: "Here is what I understood. Remove or add tags."
- Then three quick micro-questions with chips, one after another:
  1. "Do you prefer working with people, machines, data or ideas?" (multi-select)
  2. "More practical or more theoretical?" (single-select)
  3. "How long are you ready to study?" (3 years / 5 years / 5 or more / not sure)
- Saved: `interest_tags[]` (with a flag for AI-suggested vs user-added), `work_style`, `study_length_pref`.

**Turn 5: Constraints**
- Bot: "A few practical things so the results are realistic."
- One question per message, chips:
  - **Distance:** my wilaya only / nearby wilayas / anywhere in Algeria.
  - **Budget:** monthly support from the family (ranges in DZD; "I need free or public options only").
  - **Housing:** I need university housing / I have a place.
  - **Institution type:** public / private / both.
  - **Study language:** Arabic / French / English / any.
  - **Must avoid:** optional free text ("I don't want long clinical studies", for example).
- Saved: `constraints{}`.

**Turn 6: Fiche de vœux**
- Bot: "Have you already written your wishes?"
- Chips: "Yes, I'll add them" / "Not yet, suggest some" / "Skip".
- "Yes": the student types the wishes or adds them with a search chip ("Add a wish" opens a small search over formations). The chatbot parses a typed list ("1 computer science at USTHB, 2 ...") and matches each line to a formation, asking to confirm ambiguous lines.
- "Not yet": the chatbot promises suggestions after the confirm step.
- Saved: `draft_wishes[]` (ordered, may be empty). These pre-fill the **Fiche de vœux** screen.

**Turn 7: Openness to abroad**
- Bot: "Would you also like to see options abroad, next to the Algerian ones? You can change this later."
- Chips: "Yes" / "Maybe later" (default, highlighted) / "No".
- Saved: `abroad_openness`. This controls whether the **Abroad** tab in Matches is shown prominently, shown quietly (default), or hidden behind a link.

**Turn 8: Confirm**
- Bot posts a **confirm card** inside the chat: a clean summary of everything (stream, average and whether it is an estimate, year, wilaya, interests, constraints, wishes, abroad openness) with an edit link on every line.
- Buttons: **Confirm and see my options** (lime accent, the one accent button on the screen) and **Edit something** (secondary).
- On confirm: the profile is saved, the stage indicator completes (lime), and the student is taken to **Fiche de vœux** (if wishes exist) or **Matches** (if not).

#### 7.1.3 Behaviors the chatbot must support
- **Several answers in one message.** "I'm from Sétif, I got 14.3 in sciences" fills three fields. The bot confirms: "Got it: Sciences expérimentales, 14.30, Sétif. Right?"
- **Changing an answer.** Through the pencil on the live card or by saying it ("actually my average is 13.8"). The bot confirms the update and recomputes later results.
- **Skipping.** Every question except stream and average can be skipped. Skipped fields show "Not yet" and lower the completeness ring; the bot says what skipping costs ("Without your wilaya I can't show nearby options").
- **Off-topic questions.** "What is the difference between an école supérieure and a faculty?" The bot answers briefly, then returns: "Back to your profile: what was your average?"
- **Feeling overwhelmed.** If the student writes something like "I don't know what I want", the bot slows down, normalizes it, and offers a gentler path (interest micro-questions first, with chips only).
- **Save and continue later.** Progress is saved automatically. The Dashboard shows a "Continue your chat" card at the exact turn the student left.
- **Languages.** The bot answers in the language the student writes in. Darija in Arabic script is supported. Numbers and grades render left-to-right inside RTL text.
- **Never invents marks.** The bot never fills a number the student did not give.

#### 7.1.4 Chatbot states
- Typing indicator and streaming text.
- Error ("I couldn't process that. Try again") with a retry button and a request id.
- Offline ("You're offline. Your answers are saved on this device and will sync later").
- Rate-limit or slow response ("This is taking longer than usual").
- Empty (first load: greeting only).
- Completed (the page turns into a read-only conversation with a "Talk to the chatbot to update your profile" button).

#### 7.1.5 After the chat: the "My Bac" page
The **My Bac** tab in the sidebar becomes a profile summary page: the same fields as the live card, each editable inline, a completeness ring, a "Chat to update" button that reopens the chatbot at the relevant turn, and the date the profile was last confirmed. There is no document section in this tab.

### 7.2 Step 2: Fiche de vœux

**Purpose.** Help the student build or improve their ranked list of wishes with honest chances.

**Layout.**
- Left (main): the ordered wish list. Right: an insight panel.
- Each wish row: drag handle, order number (a real ranking, so numbers are appropriate), formation name, institution, city, **chance chip** (Eligible / Likely / Stretch / Unknown / Ineligible), a small score ring, the gap versus last year's cut-off ("0.42 below last year's cut-off, estimate"), remove button.
- "Add a wish": opens a search modal over formations with the same chips and filters as Matches.

**Intelligence.**
- **Warnings** (yellow or red banner): too many risky wishes at the top, no safe option at the bottom, duplicate formations, a formation that doesn't accept the student's stream.
- **Suggest a safer order**: shows a preview as a diff (old order vs new order) with accept or reject per change. Nothing is reordered without confirmation.
- **Number of wishes**: the maximum allowed is configurable [VERIFY the official limit].
- **Export**: "Download my fiche as PDF" (an output, not an input).

**States.** Empty (illustration + "Start from your matches" button), loading, partial (some chances unknown because data is missing, with the "Unknown" pill), error.

### 7.3 Step 3: Matches (Algeria and Abroad)

**Purpose.** Show ranked options the student can add to their wishes or compare.

**Header.** "We found N options for you", filter chips (domain, city or wilaya, public / private, school type, language, study length), sort (best match, nearest, cut-off).

**Tabs.** **In Algeria** (default) and **Abroad**.

**Card anatomy (In Algeria).**
- Formation name and institution, city with a distance label from the student's wilaya.
- **Score ring** (Creato Display number) and **verdict pill**.
- **Last-year cut-off** with the "Estimate, last year" badge.
- Three **factor chips** with icons: matches your stream (check), average vs cut-off (check / warning / x), distance (check or question mark).
- Actions: **Add to my wishes**, **Add to compare**, **Save**, **Hide**.

**Expanded card** (click to open; this replaces the removed Formation detail screen).
- A **factor table**: label, student's value, requirement, status icon, source link.
- Blockers and missing information as buttons ("Add your Math mark to sharpen this result").
- An **AI explanation** (2 to 3 sentences, labeled "AI-generated, verify").
- "Not verified" badge when a source is missing.

**Abroad tab.** Same card structure with extra items: funding badge (full / partial / none), estimated cost in DZD, language requirement, an "Estimate" label. The primary action is "Add to compare" and "Start planning" (which hands off to Mode B, see 7.6).

**States.** Loading skeleton, empty (illustration, "Try fewer filters"), error with retry, partial (AI explanation failed but rules shown), stale data banner.

### 7.4 Step 4: Compare and what-if

**Compare.**
- 2 to 3 columns, identical rows: institution, city, duration, cost in DZD (monthly and yearly), language, chance, career outcomes, housing, notes.
- Works for any mix: Algeria vs Algeria, Algeria vs abroad.
- A **Trade-offs summary** at the bottom (AI-generated label) written neutrally: what each option is strong at and what it requires.
- Buttons: "Add to wishes", "Remove from compare".

**What-if panel (right side).**
- Sliders: bac average (for example from 3 points below to 3 points above), and a draggable wish order.
- Toggle: "Include options abroad".
- **Live updates**: chance chips and score rings change as sliders move, with a short animation, so the student sees the effect.
- A "Reset" button returns to the real values. The panel is always labeled "Simulation, not your real result".

### 7.5 Step 5: My Plan (inscription)

**Purpose.** Turn the chosen wishes into a plan of dated steps and documents to prepare.

- **Timeline** (horizontal bars): registration windows, confirmation deadlines, document deadlines. Dates carry "Not verified" until confirmed [VERIFY all dates]. Friday and Saturday shaded as weekends.
- **Documents checklist**: cards per document (for example bac certificate, birth certificate, photos, residence certificate [VERIFY the real list]). Each card has: why it's needed, an expandable **"How to get it in Algeria"** guide (steps, where to go, typical cost range in DZD, typical days, warnings, official link, "last verified" date), and a **status selector** (To get, In progress, Done). **No file upload in Mode A.**
- **Reminders**: calendar export (.ics) and in-app notifications.
- **Download plan as PDF**.

### 7.6 Step 6: Abroad handoff
- Trigger: the student clicks "Start planning" on an Abroad card.
- A transition screen explains: "This continues in the study-abroad workspace. Your bac profile stays saved."
- The student lands in the **Mode B Application page** (Overview, Timeline, Documents, Writing, Check, Notes) for that option.
- **Important nuance** [see open question 18.4]: Mode B's Documents tab allows file attachment because it belongs to Mode B. Only Mode A's *intake* has no upload.

---

## 8. Mode B in extreme detail (study abroad)

Everything here existed before and is unchanged. It is documented fully so nothing is lost.

### 8.1 Documents [REUSE]
- **Drop zone** with a camera option for phones.
- **Grid of document cards**: thumbnail, kind (Transcript, Diploma, CV, Language certificate, Other), status stepper.
- **Status stepper**: Uploaded, Preparing pages, Reading with AI, Ready to review.
- **States**: processing skeleton, needs review (yellow), error with retry, low-quality warning ("The photo is blurry or dark. Retake it for better results.").
- Filters by kind and status.

### 8.2 Document review [REUSE]
- **Split view.** Left: the document image with zoom, pan and highlight boxes over extracted fields. Right: editable form (Identity, Institution, Level, Year, Field of study, a Terms table with editable grades, Cumulative average).
- **Confidence dots** per field: lime (≥ 0.9), yellow (0.8 to 0.9), red (< 0.8 or empty); empty required fields in red.
- **Warning banners with one-click fixes**: for example "Use the recomputed average: 13.78 vs the document's 13.8".
- A large **Confirm** button saves the corrected data.

### 8.3 Profile and goals [REUSE]
- **Profile sections** (editable) and a **completeness meter**.
- **Goals questionnaire**, one question per screen: target level (Master, PhD, Licence, Exchange, Not sure), target fields, countries (chips with flags and "Anywhere"), full funding needed (yes / no), languages (FR / EN / DE self-level A1–C2 plus certificate upload), experience, timeline, constraints.

### 8.4 Matches (scholarships) [REUSE]
- Header: "We found N opportunities for you", filter chips (country, level, funding, deadline window, verdict), sort.
- **Scholarship card**: name, provider, flag, funding badge, verdict pill, score ring, **deadline countdown** ("in 74 days" or "Deadline unknown"), three factor chips with check / x / ? icons, "Not verified" badge when needed.
- **Expandable card**: factor table (label, student value, requirement, status, source link), blockers, missing-info buttons ("Add IELTS score, +12 potential"), AI explanation with the "AI-generated, verify" label.
- **Actions**: Track this, Save for later, Hide.
- **What-if panel** (sidebar): sliders or inputs for GPA, language certificate, experience months, showing how verdicts change live.

### 8.5 Scholarship detail [REUSE]
Human-readable eligibility rules, funding, language requirements, required documents, cycle dates with "verified N days ago" stamp, official links, and a **Track this** call to action.

### 8.6 Application page (six tabs) [REUSE]
1. **Overview**: big deadline countdown, readiness ring, next three tasks, risk banner ("Tight: start these 3 tasks today").
2. **Timeline**: Gantt-style horizontal bars with the critical path highlighted, draggable due dates, "mark done" checkboxes, Friday-Saturday shaded.
3. **Documents**: checklist cards with the status flow **Missing, In progress, Have original, Have certified, Have translated, Ready**. Each card: why it's needed, expandable "How to get it in Algeria" guide (steps, where, cost range, typical days, warnings, official links, last verified), attach file, status selector, due date.
4. **Writing**: list of drafts (motivation letter, CV, personal statement) with "Create" buttons.
5. **Check**: pre-submission readiness (see 8.8).
6. **Notes and links**: official page, portal, sources of each rule with verification date.

### 8.7 Writing Studio [REUSE]
- **Left**: rich-text editor with per-paragraph actions (Rewrite, Shorter, More concrete, Translate), right-to-left aware.
- **Right context panel**: scholarship prompts, word counter with the limit, "fact pack" chips, **missing-info panel** where `[[MISSING: …]]` placeholders are highlighted in yellow, version history.
- **Revision chat**: the student writes an instruction in Darija, Arabic, French or English. The answer is a **diff view** with accept/reject per change and a one- or two-sentence summary.
- **Export**: PDF and DOCX. A small "AI draft" label stays visible.

### 8.8 Pre-submission check [REUSE]
- "Run readiness check" button, a readiness ring with a label (**Ready to submit**, **Almost ready**, **Not ready**).
- Findings grouped by severity: **Blocker** (red), **Warning** (yellow), **Info** (blue), each with icon, text, evidence (quoted sentence or document link), a **Fix** deep link, a "Resolved" toggle, and **Re-run**.
- A print-friendly view.
- Illustrations: celebrating group on "Ready", stressed student on "Not ready".

---

## 9. Shared screens

### 9.1 Dashboard (mode-aware) [CHANGED]
Top: a header banner with the celebrating-students illustration and a welcome line, and a **mode card** that shows the current mode and a link to switch.

- **Mode A content**: "Next best action" card (for example "Continue your chat" or "Rank your wishes"), profile completeness, **wishes status** (how many wishes, how many risky), upcoming deadlines with countdown badges, new matches since the last visit.
- **Mode B content**: "Next best action", profile completeness, upcoming deadlines, tracked applications as cards with readiness rings, new matches.

### 9.2 Chat (floating widget and full page) [CHANGED]
- Message bubbles, **tool-call chips** ("Checking the rules…"), **confirm cards** for actions ("Track Chevening and build your plan" with Apply and Cancel), suggestion chips, streaming text.
- The chat knows the current mode. Suggestion chips change: Mode A ("Explain my cut-off", "Compare my wishes"), Mode B ("What documents do I still need?").
- The Mode A **intake chatbot** (section 7.1) is a dedicated full-page experience; the floating widget is for questions after intake.

### 9.3 Tools hub [NEW, optional, PROPOSAL]
A sidebar page of small tools: grade converter, scam check, budget simulator, interview coach (section 10).

### 9.4 Settings [CHANGED]
Language, notifications, plan (Free / Pro), data export, delete account, and **Switch mode**.

### 9.5 Admin [REUSE]
Scholarships and formations table with filters (needs verification, last verified more than 90 days), editor form preview, freshness queue (extended to cut-off data).

---

## 10. Feature ideas to stand out [PROPOSAL]

The solution is acceptable but simple. These ideas make it feel unique, local and proactive. Priorities are for a hackathon.

| # | Feature | What it does | Priority |
|---|---|---|---|
| 1 | **Grade converter** | Converts Algerian /20 grades to the German scale (Bavarian formula), French/ECTS, UK classification and US GPA per program. | Must |
| 2 | **Scam detector** | Paste a link, email or WhatsApp message; the AI returns "Likely fake / Suspicious / Verified" with red flags (asks for fees, fake domain, no official source). | Must |
| 3 | **Procedure copilot with real costs** | Campus France flow, test booking, legalization, blocked-account amounts, visa steps, with DZD prices, delays and where to go in your wilaya. | Should |
| 4 | **Budget simulator** | Scholarship covers X, living costs by city, gap in DZD, savings plan. | Nice |
| 5 | **Gap-closing roadmap** | Turns "Stretch" into "You are 3 steps from Eligible: IELTS 6.5 (+12), a 6-month internship (+8), a second recommendation letter (+5)" and adds them to the timeline. | Must |
| 6 | **WhatsApp / Telegram bot** | Deadline reminders and quick answers where students already are, Darija voice notes supported. | Should |
| 7 | **Smart deadlines** | Timeline adjusts for real Algerian delays, calendar sync, "at risk" alerts. | Should |
| 8 | **Mock interview coach** | Voice or video practice with live transcript and a feedback scorecard in FR/EN. | Should |
| 9 | **Professor / supervisor finder** | Matches interests to labs and drafts the cold email. | Nice |
| 10 | **Recommendation letter pack** | Request email + one-page brief for the professor + an editable draft. | Nice |
| 11 | **Auto-fill application forms** | Browser extension or copy-ready sheet from the profile. | Nice |
| 12 | **"Students like you"** | Anonymized stories of similar Algerian students and optional mentors. | Nice |
| 13 | **Crowd-verified data** | Students flag "rules changed"; freshness badges update. | Nice |
| 14 | **Explainability** | A prominent "Why this score?" on every result (already part of the design). | Must |
| 15 | **After-acceptance companion** | Housing tips, arrival checklist, contract translator, first-month budget. | Nice |
| 16 | **Low-bandwidth PWA mode** | Works on slow 3G, offline reading of saved plans. | Nice |
| 17 | **Parent mode** | Read-only progress link with an Arabic summary. | Nice |

**Ideas that fit Mode A especially well:** the gap-closing roadmap (apply it to the bac average and wishes), explainability, low-bandwidth mode, parent mode, and the chatbot's Darija voice notes.

**Screens these ideas add:** Tools hub, Scam-check screen (paste box + verdict card with red flags), Interview coach screen, "Your path to Eligible" roadmap inside Matches, a phone-frame bot preview on the landing page.

---

## 11. Screen inventory (Figma checklist)

| # | Screen | Mode | Status | Priority for the demo |
|---|---|---|---|---|
| 1 | Landing | Shared | Changed | High |
| 2 | Login | Shared | Reuse | Medium |
| 3 | Onboarding: language and consent | Shared | Reuse | Medium |
| 4 | Onboarding: who are you? | Shared | New | High |
| 5 | Dashboard (A version) | A | Changed | High |
| 6 | Dashboard (B version) | B | Changed | Medium |
| 7 | **Bac chatbot (full page, with live card)** | A | **New** | **Highest** |
| 8 | My Bac (profile summary) | A | New | Medium |
| 9 | Fiche de vœux | A | New | High |
| 10 | Matches, In Algeria tab | A | Changed | **Highest** |
| 11 | Matches, Abroad tab | A | Changed | Medium |
| 12 | Compare | A | New | High |
| 13 | What-if panel | A | New | High |
| 14 | My Plan | A | Changed | Medium |
| 15 | Abroad handoff transition | A to B | New | Low |
| 16 | Documents | B | Reuse | High |
| 17 | Document review | B | Reuse | **Highest** |
| 18 | Profile and goals | B | Reuse | Medium |
| 19 | Matches (scholarships) | B | Reuse | **Highest** |
| 20 | Scholarship detail | B | Reuse | Medium |
| 21 | Application: Overview | B | Reuse | High |
| 22 | Application: Timeline (Gantt) | B | Reuse | **Highest** |
| 23 | Application: Documents | B | Reuse | High |
| 24 | Application: Writing / Check / Notes | B | Reuse | Medium |
| 25 | Writing Studio | B | Reuse | **Highest** |
| 26 | Pre-submission check | B | Reuse | High |
| 27 | Chat widget and full page | Shared | Changed | High |
| 28 | Tools hub (+ tools) | Shared | New | Optional |
| 29 | Settings | Shared | Changed | Low |
| 30 | Admin | Internal | Reuse | Low |
| 31 | Arabic RTL version of the Dashboard | Shared | New | Medium |

**Removed from the design:** the Mode A **Bac documents** upload screen, and the Mode A **Formation detail** screen.

---

## 12. Component library

Build these once in Figma and reuse them everywhere.

- **Buttons**: primary, secondary, accent (lime), info, destructive, disabled, icon-only.
- **Inputs**: text, number, search with type-ahead, dropdown, chips (single and multi-select), slider, toggle, segmented control (mode switcher, tabs), checkbox, radio.
- **Chat**: bot bubble, user bubble, quick-reply chip, typing indicator, tool-call chip, confirm card, voice-note bar.
- **Cards**: KPI card, match card (collapsed and expanded), compare column, checklist card, document card, plan step card, empty-state card.
- **Badges and pills**: five verdict pills, Verified, Not verified, AI-generated, Estimate (last year), funding badges, status badges.
- **Data display**: score ring, readiness ring, progress bar, completeness meter, stepper, Gantt timeline bar, line chart, confidence dot.
- **Layout**: sidebar (with mode switcher), top bar, floating chat button, footer disclaimer, banners (offline, stale data, risk).
- **Overlays**: modal (add a wish), drawer, toast, tooltip.
- **Illustrations**: stressed student, celebrating group, Algeria silhouette (optional brand element).

---

## 13. States and edge cases (design every data view)

| State | What to show |
|---|---|
| **Loading** | Skeleton shapes matching the final layout. |
| **Empty** | Illustration, one sentence explaining what will appear, one clear action. |
| **Error** | Plain message about what went wrong, a retry button, a request id. No apology. |
| **Offline** | Banner: "You're offline. Showing the saved version." |
| **Partial** | The AI explanation failed but the rules still show, with a small note. |
| **Unverified** | "Not verified. Check the official site." badge. |
| **Estimate** | "Estimate, last year" badge on cut-offs, "Simulation" label on what-if. |
| **Stale** | Freshness banner when data is older than the threshold. |
| **No results** | "No options match. Try removing one filter." plus a reset button. |
| **Low confidence** | Mode B extraction: yellow or red dots and a banner explaining what to check. |
| **Success** | Celebrating illustration only on real milestones (ready to submit, profile confirmed). |

Mode A chatbot-specific states are listed in section 7.1.4.

---

## 14. Copy and content rules

- **Write from the student's point of view.** Say what something is or does in plain words. "Your wishes", not "wish list object".
- **Active voice and exact button names.** "Add to my wishes", not "Submit". An action keeps the same name through the flow: the button says "Confirm", the toast says "Confirmed".
- **Sentence case.** No all-caps labels.
- **No promises.** Never "you will be accepted", "guaranteed", "100% chance". Use verdict words (Eligible, Likely, Stretch, Unknown, Ineligible) with an explanation.
- **Label AI.** "AI-generated, verify" on every AI text, suggestion or simulation.
- **Errors explain and offer a fix.** "That looks unusual. Did you mean 14.35?" Errors never blame the student.
- **Empty is an invitation.** "No wishes yet. Start from your matches."
- **Neutral on leaving.** Algerian and foreign options are described with the same tone and the same level of detail.
- **Trilingual.** Every string exists in Arabic, French and English; Arabic text is RTL while numbers stay LTR.

---

## 15. Data and trust rules

1. Every rule, cut-off, deadline, cost or procedure carries a **source link** and a **last verified** date.
2. Data older than a threshold shows a stale-data banner.
3. Past-year cut-offs are always labeled as estimates.
4. A prediction is a decision-support output, never a guarantee.
5. The student confirms any data the AI extracted or inferred before it is used.
6. Privacy statement in plain language on the landing page and at the start of the chatbot: answers are used only to build the student's options and can be edited or deleted.
7. Data export and account deletion are available in Settings.
8. Never claim an official partnership or endorsement that doesn't exist.

---

## 16. Figma Make prompts and workflow

### 16.1 What was done so far
1. A full structure prompt generated the first design (BLÉ-PASS IA); later a **restyle-only prompt** applied your colors, fonts, illustrations and chart style without moving anything.
2. For Nava, a structure prompt covered landing, login, onboarding, dashboard, documents, document review, profile, matches, scholarship detail, application, writing studio, check, chat, settings and admin, then a restyle prompt applied the navy / blue / lime identity.
3. The two-mode idea now needs a **third prompt** (below) that adds Mode A and changes the sidebar.

### 16.2 Workflow tips
- Attach your style board image with every prompt.
- Send the **structure** prompt first, then the **restyle** prompt. Mixing them makes Figma Make drop one of the two.
- If a prompt is too big, split it: shell and landing first, then screens in groups.
- Use "Keep everything else exactly as is" to avoid changes to finished screens.
- If lime text is hard to read on white, add: "Never use lime as text color on white. Lime is only a background with navy text."
- If illustrations get recolored: "Keep illustrations exactly as in the board."

### 16.3 Ready-to-paste prompt: add Mode A and the chatbot

```
Keep every existing screen, layout, style and interaction exactly as they are. Add the following to the existing Nava design, using the same visual identity (navy, bright blue, lime, pale blue, yellow, red, Creato Display + Roboto, same components).

1) MODE SWITCHER
At the top of the left sidebar, under the logo, add a two-segment toggle: "Bac orientation" | "Study abroad". "Study abroad" shows the current sidebar (Dashboard, Documents, Profile, Matches, My Applications, Writing Studio, Chat, Settings). "Bac orientation" shows a new sidebar: Dashboard, My Bac, Fiche de vœux, Matches, Compare, My Plan, Chat, Settings.

2) ONBOARDING STEP "Who are you?"
After language and consent, add a screen with two large cards: "I just got my bac" and "I'm studying at an Algerian university". A small link below: "Not sure? Try both". Selecting a card sets the mode.

3) BAC CHATBOT (full page, Mode A). NO file upload, no paperclip, no drop zone.
- Left, 65% width: chat. Header with Nava avatar, language selector (AR / FR / EN), "Restart", "Save and continue later". Under it a stage indicator: 1 About your bac, 2 Your interests, 3 Your constraints, 4 Your wishes, 5 Confirm. Bot bubbles in pale blue on the left, user bubbles in bright blue with white text on the right. Quick-reply chips under the last bot message. Input bar with text field, microphone button and send button only.
- Right, 35% width: a card "What I know about you" with a completeness ring and fields filling in live: Stream, Bac average, Bac year, Wilaya, Interests (tag chips), Constraints, Wishes, Abroad openness. Each field has a small edit pencil; empty fields show "Not yet"; AI-inferred tags carry a small blue "AI-suggested" label.
- Show a realistic conversation: greeting ("Hi, I'm Nava. In about 5 minutes I'll help you find the Algerian faculty or school that fits you."), stream question with chips (Sciences expérimentales, Mathématiques, Technique mathématique, Gestion et économie, Lettres et philosophie, Langues étrangères, Other), average question with a number input and a chip "I don't have my result yet", wilaya type-ahead, an interests free-text answer followed by extracted interest tag chips, constraint chips (distance, budget, housing, public/private, study language), and a final confirm card summarizing everything with edit links and two buttons: "Confirm and see my options" (lime) and "Edit something" (outlined).
- Include states: typing indicator, error with retry, offline banner, completed read-only state.

4) MY BAC page (Mode A)
A profile summary with the same fields as the live card, inline-editable, a completeness ring, and a "Chat to update" button. No documents section.

5) FICHE DE VŒUX page
Ordered list with drag handles, order numbers, formation, institution, city, a verdict pill (Eligible / Likely / Stretch / Unknown / Ineligible, icon + text), a small score ring, and a line like "0.42 below last year's cut-off (estimate)". Warning banner "Too many risky wishes at the top". Buttons: "Add a wish" (opens a search modal), "Suggest a safer order" (shows a before/after diff with accept/reject), "Download my fiche as PDF".

6) MATCHES for Mode A
Segmented tabs "In Algeria" (default) | "Abroad". Filter chips (domain, wilaya, public/private, school type, language, study length) and sort. Cards: formation + institution, city, score ring, verdict pill, "Estimate, last year" cut-off badge, three factor chips with icons, actions "Add to my wishes", "Add to compare", "Save", "Hide". Expanded card: factor table (label, my value, requirement, status icon, source link), missing-info buttons, AI explanation labeled "AI-generated, verify". Do NOT create a separate formation detail page.

7) COMPARE page
2 to 3 columns with identical rows: institution, city, duration, cost in DZD, language, chance, career outcomes, housing. A neutral "Trade-offs" summary labeled "AI-generated, verify". On the right, a What-if panel with a bac-average slider, a draggable wish order, a toggle "Include options abroad", a "Reset" button, and the label "Simulation, not your real result". Chips update live.

8) MY PLAN page
Horizontal timeline of inscription steps, and a documents checklist with cards (why needed, expandable "How to get it in Algeria", cost range, typical days, official link, last verified date, status selector To get / In progress / Done). No file upload. Buttons: "Add to calendar", "Download plan as PDF".

9) DASHBOARD for Mode A
Same layout as the current dashboard, but with: "Next best action" (for example "Continue your chat"), profile completeness, wishes status, upcoming deadlines, new matches.

Link everything: Who are you? → Bac chatbot → Confirm → Fiche de vœux → Matches → Compare → My Plan. On an Abroad card, "Start planning" opens the existing Application page.
```

---

## 17. Two-minute demo script

| Time | Screen | What you say and show |
|---|---|---|
| 0:00 | Landing | "Nava helps Algerian students make informed choices, at the bac and at university." |
| 0:15 | Who are you? | Click "I just got my bac". |
| 0:25 | **Bac chatbot** | Show 3 quick turns (stream chip, average typed, wilaya typed). Point to the live card filling in. "No forms, no uploads." |
| 0:50 | Confirm card | Confirm. |
| 1:00 | **Matches (In Algeria)** | Show verdict pills, "Estimate, last year" badges, expand one card to show factors and sources. |
| 1:20 | Compare + what-if | Drag the average slider and show chips changing. Mention the neutral trade-offs. |
| 1:35 | Switch mode | Toggle to "Study abroad". |
| 1:40 | Application timeline or Writing Studio | Show the Gantt or the revision diff. |
| 1:55 | Close | "Algeria first, abroad when it makes sense, always verified, always the student's decision." |

---

## 18. Assumptions and open questions

1. **Real orientation rules [VERIFY].** The exact scoring formulas, subject weights, cut-offs, number of wishes allowed and registration dates for post-bac orientation were not in your files. The design labels them as estimates and uses placeholders. Replace them with official data before the demo.
2. **Stream list [VERIFY].** The six bac streams and the technical sub-options are from general knowledge. Confirm them.
3. **Subject marks (turn 2b).** Keep this optional turn only if your matching data really weighs subjects.
4. **Handoff and attachments.** In Mode A there is no file upload at intake. After the Abroad handoff, the Mode B Application's Documents tab still lets the student attach files. If you want zero uploads anywhere in the demo, replace attachments there with status toggles.
5. **Mode B for bac students who want to leave.** The Abroad tab in Mode A links into Mode B's Application. Decide whether bac students need a lighter version of that application page (no transcripts, bac documents only).
6. **Style board colors.** Hex values were estimated from a screenshot. Replace them with exact values in Figma.
7. **Arabic fonts.** Creato Display has no Arabic glyphs; confirm the Arabic font pair visually.
8. **Removed items.** The Mode A Bac documents step and the Formation detail screen are intentionally gone. If the jury asks about programme details or cut-off history charts, answer that cut-off history is shown as a single "last year" estimate in the card and sources are in the expanded card.
9. **Data sources.** Decide where formation and scholarship data come from (curated spreadsheet, official sites) and who keeps it fresh (Admin screen).

---

## 19. Change log of this revision

**Removed**
- Mode A **Bac documents** step (PDF / photo upload of the bac transcript).
- Mode A **Formation detail** screen (programme, career paths, cut-off history chart, cost, official source).
- References to "documents" in the Mode A sidebar tab "My Bac".

**Replaced**
- The first step "Bac profile" (stream, bac average, year, wilaya, interests quiz, constraints) **is now a chatbot conversation** with a live profile card, quick-reply chips, a confirm card, and no upload.
- Mode A sidebar "My Bac (profile + documents)" became "My Bac (chatbot + profile)".
- Mode A "My Plan" documents checklist uses status toggles only (no file attach).

**Moved**
- Useful bits of the removed Formation detail (factor table, sources, explanation) now live in the **expandable Matches card**.
- The "Add to my wishes" action moved from Formation detail to the Matches card.

**Unchanged**
- All of Mode B, the shared screens, the visual identity, and the jury-framing rules.
