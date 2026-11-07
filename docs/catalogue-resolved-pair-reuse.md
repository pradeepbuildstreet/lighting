# Reuse unchanged resolved group comparisons

The recurrence investigation found six revision-7 products approved as distinct in the same immutable ten-product group, with valid current approvals and completed jobs. The group preview recomputed their heuristic matches without consulting that resolution. This patch corrects group preview/outside-candidate classification using existing history; it performs no migration, backfill or real product decision.

Both products must have retained outcomes in the same validated tags-evidence-v2 group. Their current revisions and comparison evidence must match their reviewed snapshots. The loader checks exact group/audit/review links and the latest recorded decisions; corrections, rejection, duplicate status, reversal revisions or changed evidence prevent reuse. Distinctness is not inferred transitively or merely from approved status. Operational activation/publication/price changes and unrelated products do not reopen unchanged pairs.

Group previews expose unresolved comparisons separately from resolved_comparisons (up to 200 metadata entries plus the full count). Resolved pairs no longer block scope as outsiders. Preview freshness includes the reused proof metadata and confirmation re-evaluates it under the existing catalogue locks. Exact-request replay remains unchanged. Full-catalogue scan limits/counts, algorithm safeguards, explicit per-product decisions and publication/activation rules remain unchanged.

Approved products intentionally remain in the shared browser for retained-target selection. The review workspace explains that listing/selection is not an outstanding review and links original resolution history. An administrator may still intentionally submit a new explicit group decision; no outcome is selected automatically.

Scope deliberately leaves single-product audit candidate history, automatic clean-audit rules and worker behaviour unchanged. Historical candidate rows are evidence, not a new pending decision, and are not deleted. Standalone approvals without a shared validated group are not treated as permanent pair-level exclusions.

Verification: 25 isolated executable policy/partition and mocked-loader cases passed with synthetic fixtures, including the six-product/15-pair scenario, invalidation and new-candidate blocking. Full backend suites, frontend type-check/build, PostgreSQL execution of the loader and rendered-browser checks remain to be observed after release deployment. Existing hosting/build hooks may run on the release push.
