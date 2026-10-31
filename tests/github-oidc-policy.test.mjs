import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractBearerToken,
  isTrustedStagingWorkflowClaims,
  TRUSTED_STAGING_WORKFLOW,
} from "../supabase/functions/_shared/github-oidc-policy.mjs";

const NOW = 1_798_000_000;
const baseClaims = {
  iss: TRUSTED_STAGING_WORKFLOW.issuer,
  aud: TRUSTED_STAGING_WORKFLOW.audience,
  sub: TRUSTED_STAGING_WORKFLOW.subject,
  exp: NOW + 300,
  iat: NOW - 5,
  nbf: NOW - 5,
  jti: "github-oidc-token-123456",
  repository: TRUSTED_STAGING_WORKFLOW.repository,
  repository_owner: TRUSTED_STAGING_WORKFLOW.repositoryOwner,
  repository_id: Number(TRUSTED_STAGING_WORKFLOW.repositoryId),
  repository_owner_id: Number(TRUSTED_STAGING_WORKFLOW.repositoryOwnerId),
  event_name: TRUSTED_STAGING_WORKFLOW.eventName,
  ref: TRUSTED_STAGING_WORKFLOW.ref,
  ref_type: TRUSTED_STAGING_WORKFLOW.refType,
  workflow_ref: TRUSTED_STAGING_WORKFLOW.workflowRef,
  workflow: TRUSTED_STAGING_WORKFLOW.workflow,
  sha: "a".repeat(40),
  workflow_sha: TRUSTED_STAGING_WORKFLOW.workflowSha ?? "b".repeat(40),
  run_id: "41195057068",
  run_attempt: 1,
};

test("trusted Staging OIDC remains fail-closed until an immutable workflow SHA is approved", () => {
  assert.equal(TRUSTED_STAGING_WORKFLOW.workflowSha, null);
  assert.equal(isTrustedStagingWorkflowClaims(baseClaims, NOW), false);
});

test("untrusted event, branch, workflow path and workflow name are rejected", () => {
  for (const patch of [
    { event_name: "pull_request" },
    { ref: "refs/heads/main" },
    { ref_type: "tag" },
    { workflow_ref: "MYGRAM-DB/mygram-app/.github/workflows/ci.yml@refs/heads/rebuild/phase-a-architecture" },
    { workflow: "MYGRAM Build and Quality Gate" },
    { sub: "repo:MYGRAM-DB@346374775/mygram-app@1429829602:pull_request" },
  ]) {
    assert.equal(isTrustedStagingWorkflowClaims({ ...baseClaims, ...patch }, NOW), false);
  }
});

test("checked-in trusted workflow name matches the exact OIDC claim policy", () => {
  const source = readFileSync(new URL("../.github/workflows/staging-authz.yml", import.meta.url), "utf8");
  const actualName = source.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  assert.equal(actualName, TRUSTED_STAGING_WORKFLOW.workflow);
});

test("wrong repository identity or audience is rejected", () => {
  for (const patch of [
    { repository: "attacker/fork" },
    { repository_owner: "attacker" },
    { repository_id: 1 },
    { repository_owner_id: 2 },
    { aud: "another-audience" },
    { iss: "https://attacker.invalid" },
  ]) {
    assert.equal(isTrustedStagingWorkflowClaims({ ...baseClaims, ...patch }, NOW), false);
  }
});

test("expired, future-issued, not-yet-valid and malformed provenance claims are rejected", () => {
  for (const patch of [
    { exp: NOW },
    { exp: NOW - 1 },
    { iat: NOW + 61 },
    { nbf: NOW + 1 },
    { jti: "" },
    { sha: "not-a-commit" },
    { workflow_sha: "not-a-commit" },
    { workflow_sha: "c".repeat(40) },
    { run_id: "not-numeric" },
    { run_attempt: 0 },
  ]) {
    assert.equal(isTrustedStagingWorkflowClaims({ ...baseClaims, ...patch }, NOW), false);
  }
});

test("missing or non-object claims fail closed", () => {
  assert.equal(isTrustedStagingWorkflowClaims(null, NOW), false);
  assert.equal(isTrustedStagingWorkflowClaims("claims", NOW), false);
  assert.equal(isTrustedStagingWorkflowClaims([], NOW), false);
});

test("Bearer header parsing accepts one token and rejects malformed headers", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearerToken("bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearerToken("Basic abc.def.ghi"), null);
  assert.equal(extractBearerToken("Bearer "), null);
  assert.equal(extractBearerToken("Bearer abc def"), null);
  assert.equal(extractBearerToken(""), null);
  assert.equal(extractBearerToken(null), null);
});
