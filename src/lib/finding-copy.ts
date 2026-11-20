import type { Locale } from "./core/types";

/**
 * User-facing copy for deterministic checker findings (spec F9).
 * Keys are rule codes from core/checker/rules.ts; params are interpolated.
 * Localized at read time so one finding row serves all three UI languages.
 */

type Copy = { title: string; detail: string; fix?: string };

const COPY: Record<string, Record<Locale, (p: Record<string, string | number>) => Copy>> = {
  missing_mandatory_doc: {
    en: (p) => ({ title: `Missing document: ${p.doc}`, detail: "This document is mandatory for the application.", fix: "Upload it or mark the checklist item ready." }),
    fr: (p) => ({ title: `Document manquant : ${p.doc}`, detail: "Ce document est obligatoire pour la candidature.", fix: "Téléversez-le ou marquez l'élément comme prêt." }),
    ar: (p) => ({ title: `مستند مفقود: ${p.doc}`, detail: "هذا المستند إلزامي للطلب.", fix: "ارفعه أو علّم البند جاهزاً." }),
  },
  doc_not_certified: {
    en: (p) => ({ title: `${p.doc} needs certified copy`, detail: "The procedure chain requires a certified copy (copie conforme).", fix: "Start the certification step." }),
    fr: (p) => ({ title: `${p.doc} exige une copie conforme`, detail: "La chaîne de procédure exige une copie conforme.", fix: "Lancez l'étape de certification." }),
    ar: (p) => ({ title: `${p.doc} يحتاج نسخة مصادق عليها`, detail: "سلسلة الإجراءات تتطلب نسخة مصادق عليها.", fix: "ابدأ خطوة المصادقة." }),
  },
  doc_not_translated: {
    en: (p) => ({ title: `${p.doc} needs a sworn translation`, detail: "The destination requires a sworn translation.", fix: "Order the translation." }),
    fr: (p) => ({ title: `${p.doc} exige une traduction assermentée`, detail: "La destination exige une traduction assermentée.", fix: "Commandez la traduction." }),
    ar: (p) => ({ title: `${p.doc} يحتاج ترجمة محلفة`, detail: "الوجهة تتطلب ترجمة محلفة.", fix: "اطلب الترجمة." }),
  },
  cert_expired: {
    en: (p) => ({ title: `Certificate expired on ${p.date}`, detail: "An attached certificate is expired.", fix: "Renew it before applying." }),
    fr: (p) => ({ title: `Certificat expiré le ${p.date}`, detail: "Un certificat joint est expiré.", fix: "Renouvelez-le avant de candidater." }),
    ar: (p) => ({ title: `الشهادة منتهية منذ ${p.date}`, detail: "شهادة مرفقة منتهية الصلاحية.", fix: "جدها قبل التقدم." }),
  },
  cert_expires_before_deadline: {
    en: (p) => ({ title: `Certificate expires ${p.date}, before the deadline`, detail: "The certificate will no longer be valid when the deadline arrives.", fix: "Plan a renewal." }),
    fr: (p) => ({ title: `Le certificat expire le ${p.date}, avant la date limite`, detail: "Le certificat ne sera plus valide à la date limite.", fix: "Prévoyez un renouvellement." }),
    ar: (p) => ({ title: `تنتهي الشهادة في ${p.date}, قبل الموعد النهائي`, detail: "لن تكون الشهادة سارية عند الموعد النهائي.", fix: "خطّط للتجديد." }),
  },
  format_mismatch: {
    en: (p) => ({ title: `Wrong format for ${p.doc}`, detail: `Expected ${p.expected}, got ${p.actual}.`, fix: "Convert or re-scan the file." }),
    fr: (p) => ({ title: `Mauvais format pour ${p.doc}`, detail: `Attendu : ${p.expected}, reçu : ${p.actual}.`, fix: "Convertissez ou rescanez le fichier." }),
    ar: (p) => ({ title: `صيغة خاطئة لـ ${p.doc}`, detail: `المتوقع ${p.expected}، الوارد ${p.actual}.`, fix: "حوّل الملف أو أعد مسحه." }),
  },
  plan_impossible: {
    en: () => ({ title: "Plan is impossible as dated", detail: "The earliest start is more than 7 days past today.", fix: "Pick an earlier cycle or reduce requirements." }),
    fr: () => ({ title: "Le plan est impossible en l'état", detail: "Le début le plus tôt dépasse aujourd'hui de plus de 7 jours.", fix: "Visez un cycle plus tôt ou allégez les exigences." }),
    ar: () => ({ title: "الخطة غير ممكنة كما هي", detail: "أقرب بداية تتجاوز اليوم بأكثر من 7 أيام.", fix: "اختر دورة أقرب أو خفّف المتطلبات." }),
  },
  plan_tight: {
    en: () => ({ title: "Plan is tight", detail: "The earliest start is already in the past (7 days or less).", fix: "Start this week and track tasks daily." }),
    fr: () => ({ title: "Le plan est serré", detail: "Le début le plus tôt est déjà passé (7 jours ou moins).", fix: "Commencez cette semaine et suivez les tâches chaque jour." }),
    ar: () => ({ title: "الخطة ضيقة", detail: "أقرب بداية ماضية بالفعل (7 أيام أو أقل).", fix: "ابدأ هذا الأسبوع وتابع المهام يومياً." }),
  },
  eligibility_lost: {
    en: () => ({ title: "Eligibility changed since your last match", detail: "A fresh scoring run produced a lower verdict.", fix: "Check which factor changed." }),
    fr: () => ({ title: "L'éligibilité a changé depuis le dernier match", detail: "Un nouveau calcul donne un verdict moins favorable.", fix: "Vérifiez quel facteur a changé." }),
    ar: (p) => ({ title: `تغيّرت الأهلية: ${p.verdict ?? ""}`.trim(), detail: "أعاد الحساب نتائج أقل.", fix: "تحقق من العامل المتغيّر." }),
  },
  unresolved_placeholders: {
    en: (p) => ({ title: `${p.count} placeholder(s) left in the letter`, detail: "The draft still contains [[MISSING: ...]] markers.", fix: "Fill them from your profile or delete the sentence." }),
    fr: (p) => ({ title: `${p.count} marqueur(s) restant dans la lettre`, detail: "Le brouillon contient encore des marqueurs [[MISSING: ...]].", fix: "Complétez-les depuis votre profil ou supprimez la phrase." }),
    ar: (p) => ({ title: `${p.count} علامة ناقصة في الرسالة`, detail: "ما زال في المسودة علامات [[MISSING: ...]].", fix: "املأها من ملفك أو احذف الجملة." }),
  },
  letter_over_limit: {
    en: (p) => ({ title: `Letter is over the limit (${p.words} words)`, detail: `Limit: ${p.limit} words.`, fix: "Cut the weakest paragraph." }),
    fr: (p) => ({ title: `La lettre dépasse la limite (${p.words} mots)`, detail: `Limite : ${p.limit} mots.`, fix: "Coupez le paragraphe le plus faible." }),
    ar: (p) => ({ title: `الرسالة تتجاوز الحد (${p.words} كلمة)`, detail: `الحد: ${p.limit} كلمة.`, fix: "اقطع أضعف فقرة." }),
  },
  letter_under_limit: {
    en: (p) => ({ title: `Letter is under the limit (${p.words} words)`, detail: `Aim for at least ${p.limit} words.`, fix: "Add concrete evidence from your profile." }),
    fr: (p) => ({ title: `La lettre est sous la limite (${p.words} mots)`, detail: `Visez au moins ${p.limit} mots.`, fix: "Ajoutez des preuves concrètes de votre profil." }),
    ar: (p) => ({ title: `الرسالة أقصر من الحد (${p.words} كلمة)`, detail: `اسعَ إلى ${p.limit} كلمة على الأقل.`, fix: "أضف أدلة ملموسة من ملفك." }),
  },
  draft_language_mismatch: {
    en: (p) => ({ title: `Draft language is ${p.got}, expected ${p.want}`, detail: "The submission language differs from what you chose.", fix: "Switch the language or update your choice." }),
    fr: (p) => ({ title: `La langue du brouillon est ${p.got}, attendu ${p.want}`, detail: "La langue du brouillon diffère de votre choix.", fix: "Changez la langue ou mettez à jour votre choix." }),
    ar: (p) => ({ title: `لغة المسودة ${p.got}، والمتوقع ${p.want}`, detail: "لغة المسودة تختلف عن اختيارك.", fix: "غيّر اللغة أو حدّث اختيارك." }),
  },
  gpa_citation_mismatch: {
    en: (p) => ({ title: `Letter quotes ${p.quoted}, profile says ${p.actual}`, detail: "A grade in the letter does not match your profile.", fix: "Correct the letter to match your transcript." }),
    fr: (p) => ({ title: `La lettre cite ${p.quoted}, le profil dit ${p.actual}`, detail: "Une note citée ne correspond pas à votre profil.", fix: "Corrigez la lettre pour qu'elle corresponde au relevé." }),
    ar: (p) => ({ title: `الرسالة تذكر ${p.quoted}، والملف يقول ${p.actual}`, detail: "درجة وردت في الرسالة لا تطابق ملفك.", fix: "صحّح الرسالة لتطابق كشف الدرجات." }),
  },
  name_mismatch: {
    en: (p) => ({ title: `Name differs across documents (${p.a} vs ${p.b})`, detail: "Inconsistent names slow down verification.", fix: "Use exactly the name on your passport." }),
    fr: (p) => ({ title: `Noms différents entre documents (${p.a} vs ${p.b})`, detail: "Des noms incohérents ralentissent la vérification.", fix: "Utilisez exactement le nom de votre passeport." }),
    ar: (p) => ({ title: `الأسماء مختلفة بين المستندات (${p.a} مقابل ${p.b})`, detail: "عدم تطابق الأسماء يبطئ التحقق.", fix: "استخدم الاسم نفسه كما في جواز السفر." }),
  },
  stamp_missing: {
    en: () => ({ title: "Diploma has no stamp visible", detail: "The checker could not see an official stamp.", fix: "Confirm the stamp or upload a clearer scan." }),
    fr: () => ({ title: "Aucun tampon visible sur le diplôme", detail: "Le contrôle n'a pas vu de tampon officiel.", fix: "Confirmez le tampon ou téléversez un scan plus clair." }),
    ar: () => ({ title: "لا يوجد ختم ظاهر على الشهادة", detail: "لم يعثر الفحص على ختم رسمي.", fix: "أكّد الختم أو ارفع نسخة أوضح." }),
  },
  passport_validity_short: {
    en: (p) => ({ title: `Passport valid until ${p.date}`, detail: "Validity may be shorter than intake + 6 months.", fix: "Renew the passport if possible." }),
    fr: (p) => ({ title: `Passeport valide jusqu'au ${p.date}`, detail: "La validité peut être inférieure à la rentrée + 6 mois.", fix: "Renouvelez le passeport si possible." }),
    ar: (p) => ({ title: `جواز السفر صالح حتى ${p.date}`, detail: "قد تكون المدة أقصر من موعد الاقبال بستة أشهر.", fix: "جدّد الجواز إن أمكن." }),
  },
};

/** Localized title/detail/fix for one rule finding (falls back to the code). */
export function findingCopy(
  code: string,
  params: Record<string, string | number>,
  locale: Locale,
): { title: string; detail: string; fix: string | null } {
  const entry = COPY[code];
  if (!entry) {
    return { title: code, detail: JSON.stringify(params), fix: null };
  }
  const fn = entry[locale] ?? entry.en;
  const copy = fn(params);
  return { title: copy.title, detail: copy.detail, fix: copy.fix ?? null };
}
