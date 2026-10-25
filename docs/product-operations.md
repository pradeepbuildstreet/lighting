# Product operational updates

Implementation is staged on release. This backend foundation is not the completed unified admin UI.

## Dedicated endpoint

After authenticated admin middleware, GET /api/admin/catalogue/products/:id/operations returns product and edit_token. PATCH the same endpoint with exactly operation, value and expected_token. operation is selling_price (non-negative decimal, up to two fractional digits) or active (boolean). Currency cannot be changed here.

The token is generated in PostgreSQL from the current complete product row. Row locks and existing catalogue advisory locks serialize writes; stale tokens receive 409. Identity, revision, approval, duplicate association and publication fields are checked after the update inside the transaction. A mismatch rolls back. Each successful update has an admin audit entry. Dealer prices are never written by this endpoint.

## Deployment order

Apply database/supabase/migrations/04_product_operational_status.sql before enabling the active toggle. It adds a narrowly scoped deactivation exception to both installed publication guards using their existing function definitions, preserving their security settings and other checks. It does not rewrite product data or change the public view. A product may remain published while inactive; it is excluded from public visibility. Reactivation continues to run publication prerequisites.

The migration is recorded in Git, not automatically applied by committing this file. Normal content saves continue to invalidate review/publication as before.

## Verification still required

Run node --test backend/test/catalogue-product-operations.test.js and full backend tests, then database transaction tests for published deactivation/reactivation, concurrent token conflicts, audit rollback and price-only state preservation. The tests added here have not been executed by the connector. UI consolidation and shared customer-renderer preview remain pending.
