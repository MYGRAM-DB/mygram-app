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
    typeof claims.workflow_sha === "string" &&
    SHA_PATTERN.test(claims.workflow_sha) &&
    typeof claims.run_id === "string" &&
    /^[0-9]+$/.test(claims.run_id) &&
    Number.isSafeInteger(claims.run_attempt) &&
    claims.run_attempt >= 1
  );
}
