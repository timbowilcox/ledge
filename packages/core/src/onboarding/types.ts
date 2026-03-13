// ---------------------------------------------------------------------------
// Onboarding domain types
// ---------------------------------------------------------------------------

export interface OnboardingState {
  readonly id: string;
  readonly userId: string;
  readonly businessType: string | null;
  readonly businessAge: string | null;
  readonly paymentProcessor: string | null;
  readonly bankSituation: string | null;
  readonly businessStructure: string | null;
  readonly country: string | null;
  readonly currency: string | null;
  readonly completedSteps: readonly string[];
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OnboardingChecklistItem {
  readonly id: string;
  readonly userId: string;
  readonly item: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly dismissed: boolean;
}

export type BusinessType = "saas" | "freelance" | "ecommerce" | "other";
export type BusinessAge = "just_started" | "under_year" | "one_to_three" | "three_plus";
export type PaymentProcessor = "stripe" | "paypal" | "other" | "none";
export type BankSituation = "separate" | "mixed" | "not_sure";
export type BusinessStructure =
  | "sole_proprietor"
  | "llc"
  | "s_corp"
  | "c_corp"
  | "not_incorporated"
  | "au_pty_ltd"
  | "au_sole_trader";

/** Maps business_type from onboarding to template slug */
export const BUSINESS_TYPE_TO_TEMPLATE: Record<string, string> = {
  saas: "saas",
  freelance: "consulting",
  ecommerce: "ecommerce",
  other: "saas", // default fallback
};

export const CHECKLIST_ITEMS = [
  "business_profile",
  "chart_of_accounts",
  "bank_connected",
  "first_classified",
  "connect_stripe",
  "tax_profile",
] as const;

export type ChecklistItemKey = (typeof CHECKLIST_ITEMS)[number];
