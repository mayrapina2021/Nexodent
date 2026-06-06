export function getCrmBaseUrl(): string {
  return process.env.CRM_URL ?? "https://nexodentbot.web.app";
}

export function consentSignUrl(portalToken: string | null): string | null {
  return portalToken ? `${getCrmBaseUrl()}/portal/consent/${portalToken}` : null;
}
