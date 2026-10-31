You are building "Brightloop Subscription Management System", a unified platform that runs the full life of a subscription business: products and plans, quotations, subscriptions, automatic recurring invoicing, taxes, discounts, payments, and revenue reporting.

TECH STACK (do not deviate):
- Frontend: React 18 + Vite + Tailwind CSS (react-router-dom, axios, @tanstack/react-query, react-hook-form + zod, recharts, lucide-react)
- Backend: Node.js + Express.js (REST, JSON), zod for validation, jsonwebtoken, bcrypt, helmet, cors, express-rate-limit, node-cron, nodemailer, pino logger
- Database: PostgreSQL + Prisma ORM (all multi-step writes inside prisma.$transaction)
- Version control: Git + GitHub, one commit per feature, Conventional Commits (feat:, fix:, chore:, docs:)

MONOREPO LAYOUT:
/server   (Express + Prisma)
/client   (React + Vite + Tailwind)
/README.md, /AGENTS.md, .gitignore, .env.example files

THREE ROLES (enforced on the backend, mirrored in the UI):
- ADMIN: controls everything (products, plans, taxes, discounts, staff creation, all data)
- STAFF: day-to-day work with limited access (customers, quotations, subscriptions, invoices, payments, reports read). CANNOT create staff, taxes, discounts, or delete products/plans
- CUSTOMER: portal only; sees ONLY their own subscriptions, invoices, payments

BUSINESS RULES THAT MUST NEVER BREAK:
1. One account per email (unique, case-insensitive: store lowercased).
2. Password: MORE than 8 characters (minimum 9), at least one uppercase, one lowercase, one special character. Same rule on frontend and backend.
3. Only ADMIN can create STAFF users. Public signup always creates CUSTOMER.
4. Money uses Prisma Decimal (never float). Round to 2 decimals at line level, then sum.
5. Never bill twice, never skip: invoice generation is idempotent, enforced by a DB unique constraint on (subscriptionId, periodStart, periodEnd) plus a transaction.
6. Subscription status flow: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED. Invoice status flow: DRAFT -> CONFIRMED -> PAID (CANCELLED allowed from DRAFT/CONFIRMED). Invalid transitions return 409 with a clear message.
7. Discounts are created only by ADMIN, auto-apply to the next invoice, stop when expired or usage limit reached.
8. Every list endpoint is paginated, filterable, and has proper DB indexes. Every page must respond in under 2 seconds with 10,000+ subscriptions.
9. Customers can only ever read their own data. Always scope queries by the authenticated user's customerId.

CODE STANDARDS:
- Backend layering: routes -> controllers -> services -> prisma. Business logic ONLY in services.
- Central error handler returning { error: { code, message, details } }. Validate every request body/query with zod.
- Use async handler wrapper, never leave unhandled promise rejections.
- No secrets in code; read from .env. Provide .env.example.
- Write clean, commented, production-quality code. Add a short summary of what you built and how to run/test it at the end of every task.