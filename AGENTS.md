# AGENTS.md

## Environment

- OS: Linux
- Repository root: `next-prisma-tailwind-ecommerce`
- Project shape: two separate Next.js apps under `apps/admin` and `apps/storefront`
- Package manager: Bun is the primary package manager, detected from `bun.lockb` at the repository root and in both app folders. Some package folders also contain `yarn.lock`, but the apps use Bun lockfiles.

## Project Structure

- `apps/admin`: Admin dashboard app, runs on port `8888`.
- `apps/storefront`: Customer storefront app, runs on port `7777`.
- `apps/admin/prisma/schema.prisma`: Admin Prisma schema.
- `apps/storefront/prisma/schema.prisma`: Storefront Prisma schema.
- `apps/admin/src/app/api`: Admin App Router API routes.
- `apps/storefront/src/app/api`: Storefront App Router API routes.
- `apps/admin/src/components`: Admin UI components.
- `apps/storefront/src/components`: Storefront UI components.
- `apps/admin/src/lib/prisma.ts`: Admin Prisma client singleton.
- `apps/storefront/src/lib/prisma.ts`: Storefront Prisma client singleton.
- `packages/*`: Local support packages for mail, SMS, regex, OAuth, RNG, slugify, and payment helpers.

## Install Dependencies

Install dependencies from the repository root:

```sh
bun install
```

If app-level dependencies need to be refreshed independently:

```sh
cd apps/admin && bun install
cd apps/storefront && bun install
```

## Prisma

Generate Prisma client for admin:

```sh
cd apps/admin && bun run db:generate
```

Generate Prisma client for storefront:

```sh
cd apps/storefront && bun run db:generate
```

Format Prisma schema for admin:

```sh
cd apps/admin && bun run db:format
```

Format Prisma schema for storefront:

```sh
cd apps/storefront && bun run db:format
```

Run database schema push for admin:

```sh
cd apps/admin && bun run db:push
```

Run database schema push for storefront:

```sh
cd apps/storefront && bun run db:push
```

This project currently uses `prisma db push` scripts rather than migration scripts. If proper migrations are introduced later, document the migration commands here and prefer migration-based workflows for shared environments.

## Development Servers

Run admin dev server:

```sh
cd apps/admin && bun run dev
```

Run storefront dev server:

```sh
cd apps/storefront && bun run dev
```

## Builds

Build admin:

```sh
cd apps/admin && bun run build
```

Build storefront:

```sh
cd apps/storefront && bun run build
```

## Tests

No test scripts or test runner configuration are currently present. If tests are added, add app-level scripts and document them here.

Expected future commands:

```sh
cd apps/admin && bun run test
cd apps/storefront && bun run test
```

## Coding Guidelines

- Use TypeScript for new code.
- Follow existing Next.js App Router patterns under `src/app` and `src/app/api`.
- Prefer server components for server-side data loading and client components only for interactive UI.
- Keep route handlers thin when business logic grows; move transaction-heavy inventory/order behavior into focused helper or service modules.
- Validate request bodies with Zod before writing to the database.
- Never trust client-submitted prices, discounts, totals, stock quantities, user IDs, or warehouse availability.
- Use Prisma relation includes/selects intentionally to avoid over-fetching.
- Preserve existing UI/component patterns: shadcn-style primitives, `react-hook-form`, `zodResolver`, `DataTable`, and `AlertModal` where appropriate.
- Keep changes minimal and consistent with the current codebase style.

## Prisma Schema Rules

- The admin and storefront Prisma schemas are duplicated. Any schema change must be applied to both:
  - `apps/admin/prisma/schema.prisma`
  - `apps/storefront/prisma/schema.prisma`
- After schema changes, run Prisma format and generate for both apps.
- Keep enum/model names identical across both schemas.
- Do not remove legacy fields such as `Product.stock` unless all app code and data migration paths have been updated.

## Inventory Rules

- `Inventory.quantity` is physical stock.
- `Inventory.reservedQuantity` is stock held for active orders.
- Available stock is `quantity - reservedQuantity`.
- All stock mutations must run inside database transactions.
- Every stock mutation must create an `InventoryMovement` audit record.
- Reservation creation, release, expiration, transfer completion, inventory adjustment, and shipment consumption are stock mutations.
- Do not allow negative stock unless the product explicitly has `allowBackorders = true`.
- Do not bypass reservation logic during order creation.
- Do not send emails inside database transactions. Commit the transaction first, then send mail or owner notifications.

## Inventory Implementation Scope

The Inventory Management System must include:

- `Warehouse`
- `Inventory`
- `InventoryMovement`
- `StockTransfer`
- `InventoryReservation`
- `Product.trackInventory`
- `Product.allowBackorders`
- `Order.warehouseId`

Admin functionality must include warehouse management, inventory management, movement history, transfer lifecycle, low-stock indicators, and low-stock warnings.

Storefront functionality must include product availability, cart/checkout stock validation, stock reservation on order creation, cancellation release, shipment consumption, and reservation expiration.
