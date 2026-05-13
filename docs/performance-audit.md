# Performance Audit

Use the route asset audit after a production build and start:

```bash
npm run build
npm run start -- --port 3002
npm run perf:assets
npm run perf:assets:budget
```

The audit fetches representative public routes, including the current
the first published product detail route discovered from `/shop` and transactional
routes such as `/shop/cart`, `/checkout`, and `/order/lookup`. It records
HTML/CSS/JS/image bytes and summarizes media variant usage in `srcset`
candidates.

Budgets live in `docs/performance-budgets.json`. They track the current
measured Next.js shared runtime baseline with a small buffer, so budget failures
should be treated as a prompt to inspect whether new route-level CSS, client
components, shared JavaScript, or image variants were added intentionally.

Routes that return `4xx` or `5xx` fail the budget check even when their byte
counts are low. This keeps deleted or unpublished representative content from
silently passing the audit.
