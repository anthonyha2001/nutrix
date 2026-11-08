// Printed plans in English, French or Arabic. Client-safe.
//
// Fixed words are translated here, by hand. Food names come from confirmed
// translations (food_translations); suggestFoodName only pre-fills the box the
// dietitian confirms, it is never printed on its own.

import type { MealSlot } from "./nutrition";

export type PlanLang = "en" | "fr" | "ar";
export const PLAN_LANGS: { id: PlanLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية" },
];

type Words = {
  slots: Record<MealSlot, string>;
  forPatient: string;
  from: string;
  to: string;
  dailyTarget: string;
  protein: string;
  carbs: string;
  fat: string;
  avoid: string;
  yourDay: string;
  or: string;
  fromDietitian: string;
  shoppingList: string;
  shoppingFor: (days: number, repeating: boolean) => string;
  shoppingNote: string;
  weekdays: string[];
  day: string;
  kcal: string;
  g: string;
  kg: string;
};

const WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const PLAN_WORDS: Record<PlanLang, Words> = {
  en: {
    slots: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" },
    forPatient: "For",
    from: "from",
    to: "to",
    dailyTarget: "Daily target",
    protein: "protein",
    carbs: "carbs",
    fat: "fat",
    avoid: "Avoid",
    yourDay: "Your day",
    or: "Or",
    fromDietitian: "From your dietitian",
    shoppingList: "Shopping list",
    shoppingFor: (d, r) => `For ${d} days${r ? ", repeating the plan" : ""}.`,
    shoppingNote: "Amounts as eaten: buy a little extra for peel and bones, and remember cooked rice, pasta and legumes weigh more than dry.",
    weekdays: WEEKDAYS_EN,
    day: "Day",
    kcal: "kcal",
    g: "g",
    kg: "kg",
  },
  fr: {
    slots: { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snack: "Collation" },
    forPatient: "Pour",
    from: "du",
    to: "au",
    dailyTarget: "Objectif quotidien",
    protein: "protéines",
    carbs: "glucides",
    fat: "lipides",
    avoid: "À éviter",
    yourDay: "Votre journée",
    or: "Ou",
    fromDietitian: "De votre diététicienne",
    shoppingList: "Liste de courses",
    shoppingFor: (d, r) => `Pour ${d} jours${r ? ", en répétant le plan" : ""}.`,
    shoppingNote: "Quantités telles que consommées : prévoyez un peu plus pour les épluchures et les os ; le riz, les pâtes et les légumineuses cuits pèsent plus que secs.",
    weekdays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
    day: "Jour",
    kcal: "kcal",
    g: "g",
    kg: "kg",
  },
  ar: {
    slots: { breakfast: "الفطور", lunch: "الغداء", dinner: "العشاء", snack: "وجبة خفيفة" },
    forPatient: "إلى",
    from: "من",
    to: "إلى",
    dailyTarget: "الهدف اليومي",
    protein: "بروتين",
    carbs: "نشويات",
    fat: "دهون",
    avoid: "تجنّب",
    yourDay: "يومك",
    or: "أو",
    fromDietitian: "من اختصاصية التغذية",
    shoppingList: "لائحة المشتريات",
    shoppingFor: (d, r) => `لمدة ${d} أيام${r ? "، مع تكرار البرنامج" : ""}.`,
    shoppingNote: "الكميات كما تؤكل: اشترِ كمية إضافية قليلة للقشر والعظم، والأرز والمعكرونة والبقوليات المطبوخة أثقل منها نيئة.",
    weekdays: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    day: "اليوم",
    kcal: "سعرة",
    g: "غ",
    kg: "كغ",
  },
};

// "Monday" -> "Lundi" / "الاثنين"; "Day 3" -> "Jour 3" / "اليوم 3"; any other label as written.
export function dayLabel(label: string, lang: PlanLang) {
  const w = PLAN_WORDS[lang];
  const i = WEEKDAYS_EN.indexOf(label);
  if (i >= 0) return w.weekdays[i];
  const m = label.match(/^Day (\d+)$/);
  return m ? `${w.day} ${m[1]}` : label;
}

// Serving labels that translate cleanly ("1 cup", "1 slice", "1 large").
const SERVING_WORDS: Record<string, { fr: string; ar: string }> = {
  cup: { fr: "tasse", ar: "كوب" },
  tbsp: { fr: "c. à soupe", ar: "ملعقة كبيرة" },
  tablespoon: { fr: "c. à soupe", ar: "ملعقة كبيرة" },
  tsp: { fr: "c. à café", ar: "ملعقة صغيرة" },
  teaspoon: { fr: "c. à café", ar: "ملعقة صغيرة" },
  slice: { fr: "tranche", ar: "شريحة" },
  piece: { fr: "pièce", ar: "حبة" },
  portion: { fr: "portion", ar: "حصة" },
  serving: { fr: "portion", ar: "حصة" },
  large: { fr: "grand", ar: "حبة كبيرة" },
  medium: { fr: "moyen", ar: "حبة وسط" },
  small: { fr: "petit", ar: "حبة صغيرة" },
  loaf: { fr: "pain", ar: "رغيف" },
  bowl: { fr: "bol", ar: "صحن" },
  glass: { fr: "verre", ar: "كوب" },
  handful: { fr: "poignée", ar: "حفنة" },
};

const fmt = (n: number, lang: PlanLang) => (Math.round(n * 100) / 100).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");

// "1.5 x cup (240 g)" in the plan's language. A serving label that doesn't
// translate cleanly is replaced by its weight alone, so nothing half-English
// is printed.
export function amountIn(item: { grams: number; serving?: { label: string; qty: number } | null }, lang: PlanLang) {
  const w = PLAN_WORDS[lang];
  const grams = `${fmt(Math.round(item.grams), lang)} ${w.g}`;
  if (!item.serving || item.serving.qty <= 0) return grams;
  const word = item.serving.label.toLowerCase().replace(/^1\s+/, "").trim();
  if (lang === "en") return `${fmt(item.serving.qty, lang)} x ${item.serving.label.replace(/^1\s+/, "")} (${grams})`;
  const t = SERVING_WORDS[word]?.[lang];
  return t ? `${fmt(item.serving.qty, lang)} × ${t} (${grams})` : grams;
}

export function weightIn(g: number, lang: PlanLang) {
  const w = PLAN_WORDS[lang];
  return g >= 1000 ? `${fmt(Math.round(g / 100) / 10, lang)} ${w.kg}` : `${fmt(Math.round(g / 5) * 5 || Math.round(g), lang)} ${w.g}`;
}

// ---- Suggestions for food names (pre-fill only, confirmed by the dietitian) --

const FOODS: [RegExp, string, string][] = [
  [/^eggs?\b/, "Œuf", "بيض"], [/^egg white/, "Blanc d'œuf", "بياض البيض"],
  [/^milk\b/, "Lait", "حليب"], [/^yogh?urt\b/, "Yaourt", "لبن"], [/^yogurt, greek|greek yogurt/, "Yaourt grec", "لبن يوناني"],
  [/^labneh|^labne\b/, "Labné", "لبنة"], [/^cheese, feta|^feta/, "Feta", "جبنة فيتا"], [/^cheese, halloumi|^halloumi/, "Halloumi", "جبنة حلوم"],
  [/^cheese, cottage|cottage cheese/, "Fromage cottage", "جبنة قريش"], [/^cheese\b/, "Fromage", "جبنة"], [/^butter\b/, "Beurre", "زبدة"],
  [/^bread, pita|^pita/, "Pain libanais", "خبز عربي"], [/^bread, whole.?wheat|whole wheat bread/, "Pain complet", "خبز أسمر"], [/^bread\b/, "Pain", "خبز"],
  [/^rice, brown|brown rice/, "Riz complet", "أرز بني"], [/^rice\b/, "Riz", "أرز"], [/^pasta\b|^spaghetti|^macaroni/, "Pâtes", "معكرونة"],
  [/^oats?\b|^oatmeal|^cereals, oats/, "Flocons d'avoine", "شوفان"], [/^bulgur|^burghul/, "Boulgour", "برغل"], [/^quinoa/, "Quinoa", "كينوا"],
  [/^potato(es)?\b/, "Pomme de terre", "بطاطا"], [/^sweet potato/, "Patate douce", "بطاطا حلوة"],
  [/^chicken, breast|chicken breast|^chicken, broilers?.*breast/, "Blanc de poulet", "صدر دجاج"], [/^chicken\b/, "Poulet", "دجاج"],
  [/^turkey\b/, "Dinde", "حبش"], [/^beef\b/, "Bœuf", "لحم بقر"], [/^lamb\b/, "Agneau", "لحم غنم"],
  [/^fish, salmon|^salmon/, "Saumon", "سلمون"], [/^fish, tuna|^tuna/, "Thon", "تونة"], [/^fish\b/, "Poisson", "سمك"], [/^shrimp/, "Crevettes", "قريدس"],
  [/^lentils?\b/, "Lentilles", "عدس"], [/^chickpeas?\b|^chick-peas/, "Pois chiches", "حمص حب"], [/^hummus|^houmous/, "Houmous", "حمص بطحينة"],
  [/^beans, fava|^fava|^broadbeans/, "Fèves", "فول"], [/^beans\b/, "Haricots", "فاصوليا"],
  [/^olive oil|^oil, olive/, "Huile d'olive", "زيت زيتون"], [/^olives?\b/, "Olives", "زيتون"], [/^tahini|^sesame butter/, "Tahini", "طحينة"],
  [/^almonds?\b|^nuts, almonds/, "Amandes", "لوز"], [/^walnuts?\b|^nuts, walnuts/, "Noix", "جوز"], [/^pistachio|^nuts, pistachio/, "Pistaches", "فستق حلبي"],
  [/^peanut butter/, "Beurre de cacahuète", "زبدة الفول السوداني"], [/^peanuts?\b/, "Cacahuètes", "فستق عبيد"],
  [/^apples?\b/, "Pomme", "تفاح"], [/^bananas?\b/, "Banane", "موز"], [/^oranges?\b/, "Orange", "برتقال"], [/^grapes?\b/, "Raisin", "عنب"],
  [/^strawberr/, "Fraises", "فريز"], [/^dates?\b|^dates, /, "Dattes", "تمر"], [/^figs?\b/, "Figues", "تين"], [/^pomegranate/, "Grenade", "رمان"],
  [/^watermelon/, "Pastèque", "بطيخ أحمر"], [/^melon/, "Melon", "شمام"], [/^peach/, "Pêche", "دراق"], [/^apricot/, "Abricot", "مشمش"], [/^pear/, "Poire", "إجاص"],
  [/^avocado/, "Avocat", "أفوكادو"], [/^lemon/, "Citron", "حامض"],
  [/^cucumber/, "Concombre", "خيار"], [/^tomato(es)?\b/, "Tomate", "بندورة"], [/^lettuce/, "Laitue", "خس"], [/^spinach/, "Épinards", "سبانخ"],
  [/^carrots?\b/, "Carotte", "جزر"], [/^onions?\b/, "Oignon", "بصل"], [/^garlic/, "Ail", "ثوم"], [/^peppers?, sweet|^peppers?\b/, "Poivron", "فليفلة"],
  [/^eggplant|^aubergine/, "Aubergine", "باذنجان"], [/^zucchini|^squash, summer/, "Courgette", "كوسا"], [/^cauliflower/, "Chou-fleur", "قرنبيط"],
  [/^broccoli/, "Brocoli", "بروكولي"], [/^cabbage/, "Chou", "ملفوف"], [/^mushrooms?\b/, "Champignons", "فطر"], [/^parsley/, "Persil", "بقدونس"],
  [/^mint/, "Menthe", "نعناع"], [/^honey/, "Miel", "عسل"], [/^sugar/, "Sucre", "سكر"], [/^jam\b|^jams/, "Confiture", "مربى"],
  [/^coffee/, "Café", "قهوة"], [/^tea\b/, "Thé", "شاي"], [/^water\b/, "Eau", "ماء"], [/^orange juice|^juice, orange/, "Jus d'orange", "عصير برتقال"],
  [/^chocolate, dark|dark chocolate/, "Chocolat noir", "شوكولا داكنة"], [/^chocolate/, "Chocolat", "شوكولا"],
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// A starting point for the dietitian to confirm, from the start of the food's name.
export function suggestFoodName(name: string, lang: "ar" | "fr"): string {
  const n = fold(name);
  const hit = FOODS.find(([re]) => re.test(n));
  if (!hit) return "";
  return lang === "fr" ? hit[1] : hit[2];
}
