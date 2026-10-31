export const CONTRACT_VERSION = "1.0.1";

export const RESOURCE_OWNERS = {
  identity: "platform",
  social: "social-products",
  messaging: "messenger",
  media: "platform-media",
  localization: "localization",
  moderation: "admin-ops",
};

/**
 * Validate the Messenger keyset cursor against the verified Staging schema.
 * The database has created_at + id; it does not expose a sequence column.
 */
export function validateCursor(cursor) {
  if (!cursor || !Number.isInteger(cursor.limit) || cursor.limit < 1 || cursor.limit > 100) {
    throw new Error("INVALID_PAGE_LIMIT");
  }

  const before = cursor.before ?? null;
  if (before !== null) {
    if (
      typeof before.created_at !== "string" ||
      !Number.isFinite(Date.parse(before.created_at)) ||
      typeof before.id !== "string" ||
      before.id.length === 0
    ) {
      throw new Error("INVALID_CURSOR");
    }
  }

  return { before, limit: cursor.limit };
}

export function assertResourceOwner(resource, owner) {
  if (RESOURCE_OWNERS[resource] !== owner) {
    throw new Error("RESOURCE_OWNER_MISMATCH");
  }
}
