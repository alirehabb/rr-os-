export const CONTRACT_PLACEHOLDERS = ["signer_name", "signer_title", "client_name", "date"] as const;

// Simple {{key}} substitution — the founder writes the actual contract
// language, this only fills in the handful of dynamic fields at signing time.
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => vars[key] ?? match);
}
