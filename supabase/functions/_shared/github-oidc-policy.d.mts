export interface GithubOidcClaims {
  [claim: string]: unknown;
}

export const TRUSTED_STAGING_WORKFLOW: Readonly<Record<string, string>>;

export function isTrustedStagingWorkflowClaims(
  claims: unknown,
  nowSeconds?: number,
): boolean;
