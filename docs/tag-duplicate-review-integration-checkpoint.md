# Tag duplicate audit/review integration checkpoint

Base reviewed: release 9c60f5072720a1c510045e2b4201547389166dfd.

The existing duplicate service dispatches by persisted product_attributes/product_tags presence. Tag-model run and review require taxonomy version 3. No activation marker or migration is included. Legacy corpus and scoring remain on the legacy path. Both paths take advisory locks 8102401 then 8102403, matching the shared product writer.

Tag audits load the existing batched attributes/tags/image evidence loader, compare the bounded complete product corpus (including cross-kind identity/image candidates), store tags-evidence-v2 and image_score, and return the final persisted corpus digest. The synchronous tag scan fails closed above 1000 total products; it is not a background scanner. Missing subject attributes fail closed.

Pending tag reviews reject old algorithms, changed revisions, newer audits, previous reviews, and changed evidence. The canonical tag digest includes product identity, revisions, active/duplicate/review state, attributes, tag/group activity and image hashes. Equivalent record/tag/image/key ordering does not change it. Review still leaves publication disabled. Legacy completed-approval stability is not changed; no global freshness requirement is added to publication.

Validation: 20 passing isolated Node protocol/digest tests, with a mocked database, injected tag scorer/evidence loader, and test-only validator/legacy-scoring doubles in the sandbox. Three JavaScript syntax checks passed. The committed test file uses the repository validator and legacy scorer when run in the repository; that full repository run has not been performed here. Real tag scorer/loader SQL execution, transactions/rollback, concurrent reference/media edits, HTTP/UI, production build and live acceptance remain unverified.

Database inspection confirmed taxonomy versions 1 and 2 only; legacy fixture/light constraint, check_publish/current_duplicate_approval and public_products remain installed alongside guard_tag_model_publication. This code does not change those definitions. Publication/readiness/visibility cutover, manual product writer/editor, review evidence UI, import UI and customer filters remain separate work. Compatibility behaviour, media, wishlist, main and existing product identities are not changed by this patch.
