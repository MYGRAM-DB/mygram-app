export const CONTRACT_VERSION="1.0.0";
export const RESOURCE_OWNERS={identity:"platform",social:"social-products",messaging:"messenger",media:"platform-media",localization:"localization",moderation:"admin-ops"};
export function validateCursor(c){if(!Number.isInteger(c.limit)||c.limit<1||c.limit>100)throw Error("INVALID_PAGE_LIMIT");if(c.afterSequence!==null&&(!Number.isInteger(c.afterSequence)||c.afterSequence<0))throw Error("INVALID_CURSOR");return c}
export function assertResourceOwner(resource,owner){if(RESOURCE_OWNERS[resource]!==owner)throw Error("RESOURCE_OWNER_MISMATCH")}