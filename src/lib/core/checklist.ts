import type { ChecklistState, Localized, RequiredDocument } from "./types";

export type ChecklistFlags = { needsCertified: boolean; needsTranslated: boolean };

/** Procedure chain => certification/translation requirements (spec F6). */
export function flagsForProcedureCodes(codes: string[] | undefined): ChecklistFlags {
  const c = codes ?? [];
  return {
    needsCertified: c.includes("copie-conforme"),
    needsTranslated: c.includes("traduction-assermentee"),
  };
}

/**
 * State machine (spec F6): missing -> in_progress -> have_original ->
 * have_certified -> have_translated -> ready, pruned to what the document's
 * procedure chain actually requires. 'ready' is always reachable (no dead ends).
 */
export function allowedNextStates(
  current: ChecklistState,
  flags: ChecklistFlags,
): ChecklistState[] {
  const chain: ChecklistState[] = ["missing"];
  chain.push("in_progress");
  if (flags.needsCertified) {
    chain.push("have_original");
    chain.push("have_certified");
  }
  if (flags.needsTranslated) chain.push("have_translated");
  chain.push("ready");

  const idx = chain.indexOf(current);
  if (idx < 0) return ["ready"];
  // forward-only: everything after the current state, plus 'ready'
  const next = chain.slice(idx + 1);
  if (!next.includes("ready")) next.push("ready");
  return [...new Set(next)];
}

export type ChecklistRow = {
  docCode: string;
  label: Localized;
  mandatory: boolean;
  notes: string | null;
  procedureCodes: string[];
};

/** Build checklist rows from a scholarship's required_documents (spec F5 step 7). */
export function buildChecklist(requiredDocs: RequiredDocument[]): ChecklistRow[] {
  return requiredDocs.map((d) => ({
    docCode: d.code,
    label: d.label,
    mandatory: d.mandatory,
    notes: d.notes ?? null,
    procedureCodes: d.procedure_codes ?? [],
  }));
}
