/**
 * US-TAX-12 (D-146) — India's GST registration: state codes and GSTIN checks.
 */

/** GST state codes, as the first two digits of a GSTIN and the place of supply. */
export const GST_STATES: readonly { code: string; name: string; unionTerritory?: boolean }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh", unionTerritory: true },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", unionTerritory: true },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep", unionTerritory: true },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands", unionTerritory: true },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh", unionTerritory: true },
  { code: "97", name: "Other Territory" },
];

export function gstState(code: string | null | undefined) {
  return GST_STATES.find((s) => s.code === code) ?? null;
}

/** "Karnataka (29)". */
export function gstStateLabel(code: string | null | undefined): string {
  const state = gstState(code);
  return state ? `${state.name} (${state.code})` : (code ?? "");
}

/** A union territory without a legislature charges UTGST instead of SGST. */
export function isUnionTerritory(code: string | null | undefined): boolean {
  return gstState(code)?.unionTerritory === true;
}

/** Contacts' GST treatment (D-146); null outside India. */
export const GST_TREATMENTS = ["registered", "unregistered", "consumer", "overseas", "sez"] as const;
export type GstTreatment = (typeof GST_TREATMENTS)[number];

export const GST_TREATMENT_LABELS: Record<GstTreatment, string> = {
  registered: "Registered business",
  unregistered: "Unregistered business",
  consumer: "Consumer",
  overseas: "Overseas",
  sez: "Special economic zone",
};

/** Registered businesses and SEZ units must give their GSTIN. */
export function gstinRequired(treatment: GstTreatment | null | undefined): boolean {
  return treatment === "registered" || treatment === "sez";
}

export const GSTIN_INVALID_MESSAGE = "This GSTIN isn't valid — check the 15 characters.";

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** State code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z" (or another letter), check character. */
const FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][A-Z][0-9A-Z]$/;

/** The GSTIN check character: a mod-36 Luhn over the first 14 characters. */
export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36]!;
}

/** Upper-case, without spaces. */
export function normaliseGstin(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Format, state code and check character. */
export function isValidGstin(value: string): boolean {
  const gstin = normaliseGstin(value);
  return FORMAT.test(gstin) && gstState(gstin.slice(0, 2)) !== null && gstinCheckCharacter(gstin.slice(0, 14)) === gstin[14];
}

/** The state a GSTIN was issued in, from its first two digits. */
export function gstinStateCode(value: string): string | null {
  const code = normaliseGstin(value).slice(0, 2);
  return gstState(code) ? code : null;
}

/**
 * The message for a GSTIN that's invalid, or that doesn't match the state
 * chosen with it; null when it's fine.
 */
export function gstinError(value: string, stateCode?: string | null): string | null {
  if (!isValidGstin(value)) return GSTIN_INVALID_MESSAGE;
  const own = gstinStateCode(value)!;
  if (stateCode && stateCode !== own) return `This GSTIN belongs to ${gstState(own)!.name}.`;
  return null;
}

/** US-TAX-14 — an HSN (goods) or SAC (services) code: 4, 6 or 8 digits. */
export const HSN_SAC_MESSAGE = "Enter 4, 6 or 8 digits.";
export function isValidHsnSac(code: string): boolean {
  return /^(\d{4}|\d{6}|\d{8})$/.test(code);
}

/** US-TAX-14 — the warning before issuing to a registered business with lines that have no code. */
export function missingHsnSacMessage(count: number): string {
  return `${count} ${count === 1 ? "line has" : "lines have"} no HSN/SAC code. GSTR-1 needs them.`;
}
