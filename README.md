# Nutrix

The operating system for dietitians. A sibling of Gymix: different product, same design DNA and stack.

| Component | What it is | Where |
| --- | --- | --- |
| **Nutrix Professional** | Web dashboard for dietitians, assistants and practice owners | `web/src/app/dashboard` |
| **Nutrix Patient** | Patient app, delivered first as an installable web app (like the Gymix member portal) | `web/src/app/patient` |
| **Nutrix Core** | Supabase: Postgres schema, row-level security, nutrition database, automation | `supabase/` |

## Status: Phase 1 built

What works today:

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
- **Foods & recipes:** the USDA FoodData Central library (7,283 foods, public domain), 10 Lebanese dishes, and the
  practice's own foods (from labels) and recipes, whose nutrition is computed from their ingredients.
- **Team and settings:** invite dietitians or assistants, change roles, and edit practice details.
- **Patient app:** Today (that day's meals with totals) and Plan (the whole plan, including approved swaps).
- **Tests:** `supabase/tests/rls_test.sql` and `phase1_test.sql` (access rules, snapshots, template privacy).
  A browser walkthrough of the whole flow passes (script kept outside the repo).

Not built yet: Appointments, Messages, Billing and Reports are placeholders (`web/src/lib/modules.ts`). Diary,
Progress, Messages and Profile in the patient app are placeholders too.

### Known gaps in Phase 1

- **Missing Lebanese staples:** USDA has no labneh, kaak or local cheeses. Until Nutrix has its own Lebanese product
  database, dietitians add these as practice foods from their labels. Nothing is aliased to an approximate food.
- **Lebanese dishes to review:** the 10 dishes are typical home recipes, and the cooked weights of meat dishes and
  soup are assumptions stated on each recipe. They should be reviewed by a dietitian before launch.
- **Allergen tags are approximate:** tags on USDA foods are matched from food names. They help, but don't
  guarantee anything. Warnings cover the nine listed allergens only.
- **Patient timezone:** the patient app uses Beirut time to decide which day of the plan is "today".

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
#    Migrations include the USDA food library and Lebanese dishes.
npx supabase@3.0.0 start -x studio,logflare,vector,realtime,imgproxy,postgres-meta,edge-runtime,supavisor
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

## Food data licensing (to review before commercial use)

- **Open Food Facts:** an open database, but its licence (believed to be ODbL, with share-alike obligations) must
  be checked against how Nutrix would mix it with its own data.
- **Lebanese product database:** Nutrix's own verified data, entered and checked in-house, with no licence
  constraints.

## Relationship to Gymix

Gymix stopped showing nutrition screens so that Nutrix could take nutrition over (see the Gymix README, "Nutrition and
Nutrix"). The plan there is a per-gym API key and a versioned `/api/integrations/nutrix/v1` endpoint that Nutrix would
call to import members and body measurements. That link isn't built yet.
