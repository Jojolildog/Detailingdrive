export type Identity = { userId: string; email: string };
export type OwnerConfiguration = { userId?: string; email?: string };

// Persisted Site identity is authoritative after provisioning. Email alone
// never grants access to an existing business.
export function canAccessBusiness(identity: Identity | null, ownerUserId: string): boolean {
  return Boolean(identity?.userId && identity.userId === ownerUserId);
}

export function canProvisionBusiness(identity: Identity | null, configured: OwnerConfiguration): boolean {
  if (!identity?.userId || !identity.email) return false;
  if (configured.userId?.trim()) return identity.userId === configured.userId.trim();
  return Boolean(configured.email?.trim() && identity.email.trim().toLowerCase() === configured.email.trim().toLowerCase());
}

export function isSameOriginJson(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin
    && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}
