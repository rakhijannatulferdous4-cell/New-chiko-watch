# Firestore Security Specification — New Chiko Watch & Electronics

## Data Invariants
1. Public visitors can read/list `/products/{productId}` so every customer opening the shared store link immediately sees all inventory, tag prices, offer prices, descriptions, and stock counts.
2. Secret wholesale costs (`real_buying_price`) are strictly isolated in `/product_costs/{productId}` and can ONLY be read or written by a verified admin (`isAdmin()`).
3. Customer PII (`sales_memos`) can ONLY be read or written by a verified admin (`isAdmin()`).
4. Every document ID (`{productId}`, `{memoId}`, `{uid}`) must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length 1–128).
5. All `create` and `update` writes enforce exact key allowlists (`hasAll` + `hasOnly`), strict types, string `.size()` bounds, numeric range bounds, and `request.time` server timestamps.
6. Product updates are partitioned into explicit actions (stock adjustment vs. full product edit) and enforce immutable `id` and `created_at`.

## Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Product Create**: Anonymous user attempts `create` on `/products/p1`.
2. **Unverified Email Spoof**: User with unverified email (`email_verified: false`) matching admin email attempts write on `/products/p1`.
3. **Public Wholesale Cost Scraping**: Customer attempts `get` or `list` on `/product_costs`.
4. **Public Customer PII Scraping**: Customer attempts `get` or `list` on `/sales_memos`.
5. **Shadow Field Injection on Product**: Admin/attacker injects `isFeatured: true` or `real_buying_price: 10` into `/products/p1`.
6. **ID Poisoning**: Write to `/products/bad..id$with/junk` or >128 char document ID.
7. **Orphaned Cost Document**: Write to `/product_costs/nonexistent` where `/products/nonexistent` does not exist.
8. **Negative / Overflow Price**: Write to `/products/p1` with `min_selling_price: -50` or `stock_count: -1`.
9. **Client Timestamp Forgery**: Write to `/products/p1` with `created_at` different from `request.time`.
10. **Immutable Field Tampering**: Update `/products/p1` attempting to change `created_at` or `id`.
11. **Unbounded Memo Items**: Create `/sales_memos/m1` with `items.size() > 50` or `items.size() == 0`.
12. **Self-Assigned Admin Escalation**: Non-owner signed-in user attempts to write `/admins/{theirUid}`.
