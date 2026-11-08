# Nutrix

The operating system for dietitians. A sibling of Gymix: different product, same design DNA and stack.

| Component | What it is | Where |
| --- | --- | --- |
| **Nutrix Professional** | Web dashboard for dietitians, assistants and practice owners | `web/src/app/dashboard` |
| **Nutrix Patient** | Patient app, delivered first as an installable web app (like the Gymix member portal) | `web/src/app/patient` |
| **Nutrix Core** | Supabase: Postgres schema, row-level security, nutrition database, automation | `supabase/` |

## Status: Phases 1 and 2 built

Phase 2 added:

- **Appointments:** a week calendar (with a dietitian filter for owners and assistants), booking requests and an
  upcoming list. Booking happens in a dialog, and a dietitian can't be double-booked (enforced by the database).
  Each appointment opens a detail view with a pre-consultation summary (weight trend, plan, the last 7 days of
  diary and check-ins, water, allergies, last note). From there you can confirm, move, cancel, mark attended or
  no-show (from the appointment's day only), send a WhatsApp reminder, or add a consultation note.
- **Business:** consultation services and packages (owner sets prices). Packages are sold from the patient file,
  which creates an invoice. Attending counts against the package that expires soonest; without a package the
  service price is billed. Payments are in USD, card, transfer, Whish, OMT, or LBP cash at the practice rate.
  Refunds and voids keep invoice numbers without gaps. There are printable invoices and receipts, and an overview
  of revenue per month, outstanding balances and packages ending within 14 days.
- **Messages:** one private thread per patient with their clinicians (owner and assigned dietitian), with unread
  counts in the sidebar and the patient app.
- **Patient app:** Today (eaten so far, water, daily check-in, next appointment, "I ate this" per planned meal
  with a choice of swaps), Diary (search and log any food, day by day), Progress (record weight, chart,
  history), Messages, Appointments (request, cancel) and Profile (package consultations left).
- **Patient file:** new Diary, Appointments and Billing tabs. Assistants get Appointments and Billing only.
- **Tests:** `supabase/tests/phase2_test.sql` (double-booking, package use, billing, LBP conversion, who sees
  money, messages and diary).

**Platform super admin** (same model as Gymix): `/admin` shows per-practice numbers, with no patient data.
- **Support access:** open any practice as owner, dietitian or assistant. A banner shows where you are, with the
  way back.
- **Lab:** a test practice only the admin uses. It can also be opened as a patient.
- **Feature switches:** each feature is Off, Lab only or Everyone, with exceptions for a single practice. The
  switches today are `messages`, `patient_diary` and `patient_booking`.
- **Security:** all admin actions are database functions that check `is_platform_admin()`, so the web app needs
  no secret key.
- **Creating an admin:** run `SUPABASE_URL=... SUPABASE_SECRET_KEY=... ADMIN_PASSWORD=... node web/scripts/create-super-admin.mjs <email> "<name>"`.
  Run it again after a local `supabase db reset`.

**Ease of use (dietitian side):**

- **Search anywhere (Ctrl+K or Cmd+K):** patients (with shortcuts to their consultation and a new plan), foods,
  templates and pages. Searches name, phone or email.
- **Giving a plan:** the builder saves a draft or gives the plan to the patient in one step. Drafts show a "Give
  to" button in the plan list.
- **Suggested targets:** the builder suggests energy and macros from the patient's weight, height, age, sex and
  activity:
  - energy: Mifflin-St Jeor x activity, adjusted for the goal, never below resting energy or 1,200/1,500 kcal;
  - macros: protein by body weight, fat 30%, carbs the rest.

  The dietitian picks the goal and adjusts the numbers. New plans start from these targets, and the templates
  closest to them are listed first.
- **One-click swaps:** a food's swaps panel suggests similar foods at the same energy. They come from the same
  category, with the closest macro balance and energy density, cooked matched with cooked, and none of the
  patient's allergens. Each can be added as a swap or replace the food.
- **Plan quality check:** before a plan is given, a live list shows:
  - the patient's allergies, including in swaps;
  - energy and protein against the targets;
  - empty days and meals;
  - swaps far from their food's energy.

  Giving a plan with warnings asks to confirm.
- **Consultation mode** (`/dashboard/patients/<id>/consult`, from the patient file or an appointment): the last 7
  days, weight trend and allergies beside the weigh-in, the note (linked to the appointment), the meal plan, the
  next visit and attendance.
- **WhatsApp messages:** prepared from the patient's file. They cover appointment reminders, plan ready, missed
  appointment, not logging, check-in, weigh-in, package ending and balance due. They are edited, then sent from
  the dietitian's own WhatsApp; nothing is sent automatically.
- **Getting started:** a checklist on the overview for new practices, and quick actions in the patient file.
- **Calendar:** click an empty time to book it, or drag a confirmed or requested appointment to move it (after a
  confirmation).
- **Builder safety and copying:** unsaved work is kept in the browser and offered back; Undo (Ctrl+Z); copy a meal
  to all days; duplicate a plan or copy it to another patient.
- **Printable plan:** `/print/plan/<id>`, with a shopping list for the week. Save it as PDF to send on WhatsApp.
- **Notes:** First visit, Follow-up and SOAP structures, the dietitian's own saved structures (kept on the device),
  and quick phrases.
- **Target weight:** shown in the patient overview, with weeks to go estimated from the last 8 weeks of weigh-ins.
  The plan check also mentions days with less than 20 g of fibre.
- **Lab results:** a Labs tab with common tests (HbA1c, lipids, vitamin D…), flags against typical adult ranges,
  and trends. Same access as measurements.
- **Intake form:** `/intake/<token>` is a single-use link, valid 14 days, that the patient fills in without an
  account before the first visit.
  - Answers fill empty fields in the file. Text the dietitian already wrote is kept, and the patient's answers
    are added under it, marked as theirs.
  - Ticked allergies are added, and the reported weight is recorded.
  - Tests: `supabase/tests/clinical_tools_test.sql`.
- **Import lab results and body composition** (Import buttons on the Labs and Measurements tabs). Nothing is saved
  until the dietitian approves it, beside the original document.
  - **Without AI, free:** InBody/LookinBody and Tanita exports (CSV or Excel), digital lab PDFs and InBody result
    sheets as PDF.
  - **Readers** (`web/src/lib/import/`): every value is a number printed on the line it quotes. Units are converted
    only with fixed factors, implausible values and limits ("<150") are flagged, and dates are read by their label
    (birth dates ignored).
  - **Name check:** the patient's name is looked for on the document; if it is missing, saving requires a "this is
    theirs" tick. Rows for other people in a device export are left unticked.
  - **Photos and scans:** read by AI only when the "AI reading of photos and scans" switch is on in /admin and
    `ANTHROPIC_API_KEY` is set. Claude Haiku 5.5 is used by default (about 0.2 US cents a document), and Claude
    Opus 5.5 only on "Read again with the stronger AI". The AI only transcribes the printed rows; the same
    deterministic readers then parse and check them, and AI-read values always start unticked.
- **Package renewal:** a prompt on the appointment, in consultation mode and in billing when a package is on its
  last consultation or ends within 14 days. Owners and assistants renew it in one step.

Still to build: Reports (Phase 3), the daily briefing and follow-up rules (Phase 3), device imports (Phase 3),
and meal photos and barcodes (Phase 4). Reminders are sent by hand on WhatsApp for now; automatic reminders come
with the follow-up engine.

What Phase 1 built:

- **Accounts:** sign up, log in, practice onboarding. Staff invites and patient records are claimed automatically
  when that email signs up.
- **Patients:** list with search and archive, add or edit (dialogs), assign a dietitian. Each patient file has
  tabs for an overview (weight, change, BMI, current plan, latest note), meal plans, measurements (weight chart),
  consultation notes, and health history with structured allergies.
- **Meal plans:** a builder for breakfast, lunch, dinner and snacks, with one or many days. It has food search,
  amounts in grams or servings, approved swaps, daily targets with live totals, and allergy warnings. Plans start as
  drafts and are then given to the patient. The previous plan becomes read-only, and any plan can be saved as a
  template.
- **Templates:** a private library (meal, daily, weekly, program) with search, type tabs, favourites, duplicate and
  delete. A plan made from a template is a copy.
- **Foods & recipes:** a shared library built from open datasets (see "Food library" below), 10 Lebanese dishes,
  and the practice's own foods (from labels) and recipes, whose nutrition is computed from their ingredients.
- **Team and settings:** invite dietitians or assistants, change roles, and edit practice details.
- **Patient app:** Today (that day's meals with totals) and Plan (the whole plan, including approved swaps).
- **Tests:** `supabase/tests/rls_test.sql` and `phase1_test.sql` (access rules, snapshots, template privacy).
  A browser walkthrough of the whole flow passes (script kept outside the repo).

### Known gaps

- **Lebanese staples:** the generic datasets have no labneh, kaak or local cheeses. Packaged Lebanese products
  come from Open Food Facts once it is loaded, but coverage depends on what contributors have entered. Until Nutrix
  has its own verified Lebanese product database, dietitians add missing items as practice foods from their
  labels. Nothing is aliased to an approximate food.
- **Lebanese dishes to review:** the 10 dishes are typical home recipes, and the cooked weights of meat dishes and
  soup are assumptions stated on each recipe. They should be reviewed by a dietitian before launch.
- **Allergen tags are approximate:** tags on USDA foods are matched from food names. They help, but don't
  guarantee anything. Warnings cover the nine listed allergens only.
- **Messages refresh every 5 seconds** while open (local Supabase runs without Realtime). Switch to Supabase
  Realtime in production if instant delivery matters.
- **One practice per patient account:** a patient linked to two practices sees the first one only.

## Design DNA (shared with Gymix)

Nutrix reuses the Gymix design system as is:

- **Tokens** (`web/src/app/globals.css`): the same canvas `#f4f5f2`, surface, line, ink `#0d1117`, muted, danger and
  success. Only the accent changes: Gymix lime `#c8f135` becomes Nutrix mint `#8fe3c2`. Macro colours (protein, carbs,
  fat) are added for nutrition charts.
- **Type**: Geist. **Shapes**: `rounded-lg` buttons, `rounded-xl` cards and inputs, `rounded-2xl` dialogs.
- **Shell**: the same sidebar (ink active item with an accent icon), mobile drawer, patient bottom tab bar, page
  ease-in, staggered cards, dialog pop and toast animations. All are switched off for reduced motion.
- **Components copied from Gymix**: `ui`, `dialog` (Modal, Dialog, useDialogAction), `confirm`, `toaster`,
  `row-menu`, `page-tabs`, `route-modal`, `form-controls`, `search-select`.
- **Logo**: a bold "N" whose stem sprouts a leaf, drawn with the same stroke weights as the Gymix "G"
  (`web/src/components/logo-mark.tsx`, `web/src/app/icon.svg`).

The Gymix UI rules apply here too:

- No emojis anywhere.
- No native browser popups. Use `useConfirm`.
- Lists stand alone, and every create or edit form opens in a dialog on the same page.
- Pages split their content with in-page tabs.
- Menus render in a portal so they're never clipped.

## Stack

Same as Gymix: Next.js 16.4 (App Router, `cacheComponents`, React Compiler), React 19, Tailwind CSS v4,
Supabase (Postgres + Auth + Storage), lucide icons, Vercel (fra1). Next 16 differs from older docs: read
`web/node_modules/next/dist/docs/` before writing framework code (see `web/AGENTS.md`).

## Running locally

Ports are chosen so Nutrix runs beside Gymix: Supabase on 544xx (Gymix uses 543xx) and the web app on **3300**
(3000 and 3200 are taken).

```bash
# 1. Database (Docker must be running), from the repo root. Same CLI version as Gymix, so the Docker images are shared.
#    Migrations include USDA SR Legacy (7,283 foods) and the Lebanese dishes.
npx supabase@3.0.0 start -x studio,logflare,vector,realtime,imgproxy,postgres-meta,edge-runtime,supavisor
#    Then the food library (about 45,000 foods, ~45 MB; see foods-import/README.md):
#    cd foods-import && npm install && npm run download && npm run build
#    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npm run load
# 2. Web app
cd web
cp .env.example .env.local     # paste the anon key printed by `supabase start`
npm install
npm run dev                    # http://localhost:3300
npm run gen:types              # after schema changes, replaces the hand-written database.types.ts
```

Schema tests (each test file runs against a fresh database in a throwaway container):

```bash
MSYS_NO_PATHCONV=1 bash supabase/tests/run_tests.sh
```

## Access model

- **Practice roles:** `owner`, `dietitian` and `assistant`.
- **Patients** are records in `patients`, optionally linked to a login (`user_id`) for the patient app.
- **Clinical separation:** the owner sees every patient. A dietitian sees only the patients assigned to them. An
  assistant sees contact details (for booking and billing) but never clinical data.
- **Rule for every future clinical table** (plans, notes, measurements, diary, photos): gate reads and writes on
  `public.can_see_clinical(patient_id)`, and gate patient access on `public.is_patient_self(patient_id)`. Never gate
  on role alone.
- Sensitive or cross-table changes go through `SECURITY DEFINER` functions, as in Gymix.

## Roadmap

### Phase 1: Core practice (built)

Patients, meal plans, private templates, foods and recipes, team, settings.

How the decisions were built:

- **Plans are snapshots.** Assigning a template copies its meals into the patient's plan, with each food's nutrients
  copied in. Editing a template, or correcting a food, never changes an assigned plan. A plan records which template
  it came from, for reference only.
- **Templates are private.** Each template has an `owner_id` (the dietitian), and RLS limits it to that dietitian.
  A shared practice library could be added later as an explicit opt-in.
- **Nutrients per 100 g** on every food, with servings as named gram weights. Totals are computed, never typed in.
- **Lebanese foods** (tabbouleh, fattoush, kibbeh, mujaddara, warak enab, fatteh, manakish, kafta, lentil soup)
  ship as recipes built from ingredients, so a dietitian can see and adjust what's in them. Every food records its
  `source` (Nutrix verified, a practice's custom food, or an imported dataset) and the dataset's licence.
- **Allergies** are structured (not free text), so plans can warn when a food conflicts with a patient's allergies.

### Phase 2: Appointments and business

Calendar, booking requests, reminders, attendance, consultation notes, pre-consultation summaries. Packages,
pricing, payments (USD, with LBP recorded at the practice rate, as in Gymix), balances, remaining consultations,
expiry alerts, invoices. Patient diary, check-ins, water, messages.

### Phase 3: Follow-ups, devices and reports

- **Follow-ups:** a rules engine runs daily over diary, check-ins, measurements, appointments and packages. It
  produces the dietitian's briefing and notifications. Every rule can be switched off and has a limit on how often
  it alerts. Rules are listed in `FOLLOW_UP_RULES` (`web/src/lib/modules.ts`).
- **Devices:** every measurement row carries a `source` (manual, InBody, Tanita, Withings, Apple Health) and an
  `external_id`, so imports are idempotent and can be traced back to their device.
- **Reports:** branded PDFs, built from a draft that the dietitian reviews before sending.

### Phase 4: Food intelligence

- **Meal photos:** an existing vision API suggests the foods it sees and estimates portions. Nutrix matches them to
  its own food database, the patient confirms or corrects, and only then is the meal saved. Nutrients always come
  from the database, never from the AI. Estimates are labelled as estimates.
- **Barcodes:** scan a product, look it up, enter the amount eaten, and add it to the diary.

AI stays an assistant everywhere. It never diagnoses, prescribes or changes a plan, and AI-generated meal plans are
not on the roadmap.

## Device integrations: research status (unverified)

Nothing below has been confirmed yet. Verify each item before promising an integration to anyone.

| Device | Starting point | Open questions |
| --- | --- | --- |
| Withings | Public developer API with OAuth patient consent | Terms for commercial use, which metrics are exposed, rate limits |
| InBody | Business or partner API (LookinBody) | Whether access is granted to third-party software, cost, which models |
| Tanita | Professional software exports, consumer cloud | Whether any API exists for professional scales, or only file exports |
| Apple Health | HealthKit | Needs a native iOS app; a web app can't read it. Decide when the native patient app starts |

## Food library

The shared library is loaded by `foods-import/` (download, normalise to per 100 g, bulk load). Migrations hold
only the schema. Each dataset is registered in `food_datasets` with its licence and the attribution the Foods page
shows. Re-imports upsert by `(dataset, source_ref)` and archive dropped rows, never deleting them.

| Dataset | Stored | Licence |
| --- | --- | --- |
| USDA SR Legacy, FNDDS (Survey), Foundation | 13,080 generic foods | CC0 |
| Canadian Nutrient File 2015 | 5,676 generic foods | Open Government Licence - Canada (attribution) |
| Open Food Facts, Lebanon and region | 26,367 packaged products | ODbL (attribution, share-alike) |
| Everything else on Open Food Facts | looked up live, saved when used | ODbL |

The stored library is about 45,000 foods and takes about 45 MB with its indexes. Search takes about 20 ms. Storing
every product worldwide was tried and rejected: 3.4M rows, 4.3 GB, slower search. Any other product is found
online by barcode or by "Search Open Food Facts" in the food search. It is saved to the library only when someone
picks it, which needs `SUPABASE_SECRET_KEY` on the server.

Search (`search_foods`) ignores accents, matches name, brand and aliases, and finds products by barcode. It lists
generic foods before packaged products.

### Licensing (to review before commercial use)

- **Open Food Facts (ODbL):** commercial use is allowed. A derivative database of OFF must be offered under ODbL,
  so OFF rows are kept as their own dataset (`share_alike = true`), never merged into other rows, and can be
  published or removed in one step.
- **Lebanese product database:** Nutrix's own verified data, entered and checked in-house, with no licence
  constraints.

## Relationship to Gymix

Gymix stopped showing nutrition screens so that Nutrix could take nutrition over (see the Gymix README, "Nutrition and
Nutrix"). The plan there is a per-gym API key and a versioned `/api/integrations/nutrix/v1` endpoint that Nutrix would
call to import members and body measurements. That link isn't built yet.
