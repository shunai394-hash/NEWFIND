/**
 * Shared entity verification for NEWFIND discoveries and future PriceSense
 * sales targets. This module never sends mail or invents contacts.
 */

export type SalesContactState =
  | "new"
  | "sent"
  | "failed"
  | "hold"
  | "excluded";

export type SalesDecisionStatus = "candidate" | "skip" | "reject";

export type SalesStage = "RESEARCH" | "EVALUATE" | "PREPARE" | "APPROVE" | "SEND";

export type SalesAgentMind = {
  identity: string;
  salesRole: string;
  targetMarket: string;
  expertise: string[];
  riskTolerance: "low" | "medium" | "high";
  communicationStyle?: string;
  goals?: string[];
  recentOutcomes?: Array<"no_reply" | "rejected" | "meeting" | "low_reply_industry">;
};

export type SalesTargetInput = {
  companyName: string;
  officialUrl?: string | null;
  email?: string | null;
  emailSource?: "extracted" | "generated" | "unknown";
  officialSiteVerified: boolean;
  previousStatus?: SalesContactState | null;
  existingDomains?: string[];
  existingCompanies?: string[];
  existingEmails?: string[];
  sources?: Array<{ url?: string | null; verified?: boolean }>;
};

export type SalesTargetDecision = {
  status: SalesDecisionStatus;
  reason: string;
  confidence: number;
  officialDomain: string | null;
  stage: SalesStage;
  emailStatus: "verified" | "email_unverified" | "invalid" | "generated" | "none";
  fit: number;
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const DISPOSABLE_HOST =
  /(^|\.)(mailinator\.com|guerrillamail\.com|tempmail\.|10minutemail\.)/i;
const GENERIC_COMPANY =
  /^(acme|example|test company|dummy|lorem|foo bar|untitled)$/i;

function compactName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function domainFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainFromEmail(value: string): string | null {
  const host = value.split("@")[1];
  return host ? host.replace(/^www\./i, "").toLowerCase() : null;
}

export function isPlausibleOfficialUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.includes(".")) return false;
    if (/(^|\.)(example\.|test$|localhost$)/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isExtractedEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const email = value.trim();
  if (!EMAIL_RE.test(email)) return false;
  const host = domainFromEmail(email);
  if (!host || DISPOSABLE_HOST.test(host)) return false;
  return true;
}

export function evaluateSalesTarget(input: SalesTargetInput): SalesTargetDecision {
  const company = compactName(input.companyName);
  if (!company || GENERIC_COMPANY.test(company)) {
    return {
      status: "reject",
      reason: "fabricated_or_empty_company",
      confidence: 0,
      officialDomain: null,
      stage: "EVALUATE",
      emailStatus: "none",
      fit: 0,
    };
  }

  const previous = input.previousStatus ?? "new";
  if (previous === "sent" || previous === "failed" || previous === "hold" || previous === "excluded") {
    return {
      status: "skip",
      reason: `already_${previous}`,
      confidence: 0,
      officialDomain: domainFromUrl(input.officialUrl),
      stage: "EVALUATE",
      emailStatus: input.email ? "verified" : "none",
      fit: 0,
    };
  }

  if (!input.officialSiteVerified || !isPlausibleOfficialUrl(input.officialUrl)) {
    return {
      status: "reject",
      reason: "official_site_unverified",
      confidence: 10,
      officialDomain: domainFromUrl(input.officialUrl),
      stage: "RESEARCH",
      emailStatus: "none",
      fit: 0,
    };
  }

  const officialDomain = domainFromUrl(input.officialUrl);
  const existingDomains = (input.existingDomains ?? []).map((item) =>
    item.replace(/^www\./i, "").toLowerCase(),
  );
  const existingCompanies = (input.existingCompanies ?? []).map(compactName);
  const existingEmails = (input.existingEmails ?? []).map((item) => item.toLowerCase());

  if (officialDomain && existingDomains.includes(officialDomain)) {
    return {
      status: "skip",
      reason: "duplicate_domain",
      confidence: 20,
      officialDomain,
      stage: "EVALUATE",
      emailStatus: "none",
      fit: 0,
    };
  }
  if (existingCompanies.includes(company)) {
    return {
      status: "skip",
      reason: "duplicate_company",
      confidence: 20,
      officialDomain,
      stage: "EVALUATE",
      emailStatus: "none",
      fit: 0,
    };
  }

  if (input.email) {
    if (input.emailSource === "generated") {
        return {
          status: "reject",
          reason: "generated_email",
          confidence: 0,
          officialDomain,
          stage: "EVALUATE",
          emailStatus: "generated",
          fit: 0,
        };
    }
    if (!isExtractedEmail(input.email)) {
        return {
          status: "reject",
          reason: "invalid_email",
          confidence: 0,
          officialDomain,
          stage: "EVALUATE",
          emailStatus: "invalid",
          fit: 0,
        };
    }
    if (existingEmails.includes(input.email.toLowerCase())) {
        return {
          status: "skip",
          reason: "duplicate_email",
          confidence: 20,
          officialDomain,
          stage: "EVALUATE",
          emailStatus: "verified",
          fit: 0,
        };
    }
    const emailDomain = domainFromEmail(input.email);
    if (emailDomain && officialDomain && emailDomain !== officialDomain) {
      const officialRoot = officialDomain.split(".").slice(-2).join(".");
      const emailRoot = emailDomain.split(".").slice(-2).join(".");
      if (officialRoot !== emailRoot) {
          return {
            status: "reject",
            reason: "email_domain_mismatch",
            confidence: 15,
            officialDomain,
            stage: "EVALUATE",
            emailStatus: "invalid",
            fit: 0,
          };
      }
    }
  }

  const confirmedSources = (input.sources ?? []).filter((item) => item.verified && item.url);
  const confidence = Math.min(95, 55 + confirmedSources.length * 15);
  const emailStatus: SalesTargetDecision["emailStatus"] = input.email
    ? "verified"
    : "none";

  return {
    status: "candidate",
    reason: "official_site_verified",
    confidence,
    officialDomain,
    stage: emailStatus === "verified" ? "PREPARE" : "EVALUATE",
    emailStatus,
    fit: confidence,
  };
}

export function evaluateSalesOpportunity(
  input: SalesTargetInput & { market?: string | null; business?: string | null },
  agent?: SalesAgentMind | null,
): SalesTargetDecision {
  const base = evaluateSalesTarget(input);
  if (base.status !== "candidate" || !agent) {
    return { ...base, stage: base.stage === "PREPARE" ? "PREPARE" : base.stage };
  }

  let fit = base.fit;
  const market = `${input.market || ""} ${input.business || ""}`.toLowerCase();
  if (agent.targetMarket && market && !market.includes(agent.targetMarket.toLowerCase())) {
    fit -= 25;
  }
  if (agent.expertise.some((item) => market.includes(item.toLowerCase()))) {
    fit += 10;
  }
  if ((agent.recentOutcomes ?? []).includes("low_reply_industry")) {
    fit -= 15;
  }
  if ((agent.recentOutcomes ?? []).includes("meeting")) {
    fit += 8;
  }
  fit = Math.max(0, Math.min(100, fit));

  if (agent.riskTolerance === "low" && base.emailStatus !== "verified") {
    return {
      ...base,
      status: "skip",
      reason: "email_unverified",
      stage: "EVALUATE",
      emailStatus: "email_unverified",
      fit,
      confidence: Math.min(base.confidence, 40),
    };
  }

  if (fit < 45) {
    return {
      ...base,
      status: "skip",
      reason: "low_fit",
      stage: "EVALUATE",
      fit,
      confidence: fit,
    };
  }

  return {
    ...base,
    fit,
    confidence: Math.round((base.confidence + fit) / 2),
    stage: "PREPARE",
    reason:
      base.emailStatus === "verified"
        ? "official_site_verified"
        : "official_site_verified_email_unverified",
    emailStatus: base.emailStatus === "none" ? "email_unverified" : base.emailStatus,
  };
}

export function salesSendAllowed(decision: SalesTargetDecision, approved: boolean) {
  return approved && decision.status === "candidate" && decision.stage === "PREPARE";
}
