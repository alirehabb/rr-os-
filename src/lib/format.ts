// A meaningful chunk of prospects only ever got a domain/website stored as
// company_name (confirmed against real Instantly lead data — even
// Instantly's own "company_name" field is unreliable for many leads, e.g.
// one real lead had "Europe/Amsterdam" in that field). Rather than present
// a raw domain as if it were an authoritative company name, this derives a
// readable label from it; it's a best-effort cosmetic cleanup, not a claim
// that the result is the company's real legal or brand name.
export function displayCompanyName(companyName: string): string {
  const looksLikeDomain = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(companyName.trim());
  if (!looksLikeDomain) return companyName;

  const withoutTld = companyName.replace(/^www\./i, "").replace(/\.[a-z]{2,}$/i, "");
  return withoutTld
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
