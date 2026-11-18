/**
 * Phase 0 Payload-First Security TDD Spec for Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads are rejected by firestore.rules.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Unauthenticated product create',
    path: 'products/nc-101',
    operation: 'create',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email spoof on product create',
    path: 'products/nc-102',
    operation: 'create',
    auth: { uid: 'u1', email: 'rakhijannatulferdous4@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Public read on secret product_costs',
    path: 'product_costs/nc-101',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Public list on customer sales_memos PII',
    path: 'sales_memos',
    operation: 'list',
    auth: { uid: 'cust-1', email: 'customer@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on /products',
    path: 'products/nc-103',
    operation: 'create',
    payload: { id: 'nc-103', shadowField: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Document ID poisoning (>128 chars or invalid chars)',
    path: `products/${'a'.repeat(140)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Orphaned /product_costs write without parent /products doc',
    path: 'product_costs/missing-product-999',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Negative stock_count or price',
    path: 'products/nc-104',
    operation: 'create',
    payload: { stock_count: -5, min_selling_price: -100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Client timestamp forgery on created_at',
    path: 'products/nc-105',
    operation: 'create',
    payload: { created_at: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Immutable created_at mutation on update',
    path: 'products/nc-101',
    operation: 'update',
    payload: { created_at: '2021-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Unbounded or empty sales_memos items list',
    path: 'sales_memos/memo-1',
    operation: 'create',
    payload: { items: [] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Self-assigned admin privilege escalation',
    path: 'admins/attacker-uid',
    operation: 'create',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
