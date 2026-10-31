export const TRUSTED_STAGING_WORKFLOW = Object.freeze({
  repository: "MYGRAM-DB/mygram-app",
  repositoryOwner: "MYGRAM-DB",
  repositoryId: "1429829602",
  repositoryOwnerId: "346374775",
  eventName: "push",
  ref: "refs/heads/rebuild/phase-a-architecture",
  refType: "branch",
  workflowRef: "MYGRAM-DB/mygram-app/.github/workflows/staging-authz.yml@refs/heads/rebuild/phase-a-architecture",
  workflow: "MYGRAM Trusted Staging QA Smoke",
  // Fail closed until Security pins the immutable workflow-file SHA after review.
  workflowSha: null,
  subject: "repo:MYGRAM-DB@346374775/mygram-app@1429829602:ref:refs/heads/rebuild/phase-a-architecture",
  audience: "mygram-staging-qa",
  issuer: "https://token.actions.githubusercontent.com",
});

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function isTrustedStagingWorkflowClaims(
  claims,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return false;

  const audienceAllowed = typeof claims.aud === "string"
    ? claims.aud === TRUSTED_STAGING_WORKFLOW.audience
    : Array.isArray(claims.aud) && claims.aud.includes(TRUSTED_STAGING_WORKFLOW.audience);

  return (
    claims.iss === TRUSTED_STAGING_WORKFLOW.issuer &&
    audienceAllowed &&
    Number.isSafeInteger(claims.exp) &&
    claims.exp > nowSeconds &&
    Number.isSafeInteger(claims.iat) &&
    claims.iat <= nowSeconds + 60 &&
    (claims.nbf === undefined || (Number.isSafeInteger(claims.nbf) && claims.nbf <= nowSeconds)) &&
    typeof claims.jti === "string" &&
    claims.jti.length >= 8 &&
    claims.repository === TRUSTED_STAGING_WORKFLOW.repository &&
    claims.repository_owner === TRUSTED_STAGING_WORKFLOW.repositoryOwner &&
    String(claims.repository_id) === TRUSTED_STAGING_WORKFLOW.repositoryId &&
    String(claims.repository_owner_id) === TRUSTED_STAGING_WORKFLOW.repositoryOwnerId &&
    claims.event_name === TRUSTED_STAGING_WORKFLOW.eventName &&
    claims.ref === TRUSTED_STAGING_WORKFLOW.ref &&
    claims.ref_type === TRUSTED_STAGING_WORKFLOW.refType &&
    claims.workflow_ref === TRUSTED_STAGING_WORKFLOW.workflowRef &&
    claims.workflow === TRUSTED_STAGING_WORKFLOW.workflow &&
    claims.sub === TRUSTED_STAGING_WORKFLOW.subject &&
    typeof claims.sha === "string" &&
    SHA_PATTERN.test(claims.sha) &&
    typeof TRUSTED_STAGING_WORKFLOW.workflowSha === "string" &&
    SHA_PATTERN.test(TRUSTED_STAGING_WORKFLOW.workflowSha) &&
    claims.workflow_sha === TRUSTED_STAGING_WORKFLOW.workflowSha &&
    /^[0-9]+$/.test(String(claims.run_id ?? "")) &&
    Number.isSafeInteger(Number(claims.run_attempt)) &&
    Number(claims.run_attempt) >= 1
  );
}

/**
 * Extract one bearer token from an Authorization header.
 * Reject missing tokens and ambiguous values containing whitespace.
 */
export function extractBearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
