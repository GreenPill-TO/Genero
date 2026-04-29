# Supabase Boundary Contract

This repo is moving toward a multi-frontend Supabase boundary where app-facing wallet, SpareChange, and contracts code uses typed Supabase Edge Functions, narrow RPCs, read-model helpers, or explicit server/worker boundaries instead of broad direct table access.

## Preferred Access

- Browser/page code should call typed application clients, narrow RPCs, or Supabase Edge Functions. It should not call `supabase.from(...)` directly against tables.
- Server routes may use request-scoped Supabase clients for authentication and narrow RPCs. They should not construct service-role clients in the deployed Next.js runtime.
- Supabase Edge Functions should prefer request-scoped publishable-key clients plus narrow RPCs for current-user reads and self-service writes. Service-role clients should be reserved for custody, settlement, admin/operator, webhook, worker, and other intentionally privileged operations.
- Edge Functions that still need service-role access should resolve the caller and app context through request-scoped RPCs first, then construct the service-role client at the narrow route/domain operation with a purpose label. This keeps broad auth/context reads out of service-role while preserving explicit privileged boundaries.
- Routine release health, wallet stats, and indexer status reads should stay behind `wallet_release_health_v1`, `wallet_stats_summary_v1`, and `indexer_scope_status_v1`.
- Storage bucket operations via `supabase.storage.from(...)` are not database table access. They are allowed when the bucket, path, and public/private behaviour are documented by the owning feature.

## Documented Exceptions

The lint guard in `scripts/check-no-direct-supabase-db.mjs` allows only named exception paths. Each exception is a cleanup candidate unless noted as a stable read-model helper.

| Path | Current reason | Future direction |
| --- | --- | --- |
| `shared/lib/supabase/walletIdentities.ts` | Stable read-only helper over `v_wallet_identities_v1`; used so browser surfaces do not query custody tables directly. | Keep as the canonical wallet identity read model unless replaced by a typed Edge Function. |
| `shared/lib/supabase/appInstance.ts` | Shared resolver for active app/city/environment context. | Prefer app context from bootstrap/Edge contracts over time. |
| `shared/lib/contracts/management/cubidSigner.ts` | Action-time Cubid signer boundary that reads wallet shares only when a signed contract write is invoked. | Keep isolated from eager page loads; revisit with Cubid custody/signing architecture. |
| `shared/lib/bia/apiAuth.ts` and `shared/lib/bia/server.ts` | Server-side BIA auth, app-scope, and local/development bypass helpers. | Keep production bypass disabled; move route compatibility shims to typed Edge/SQL boundaries as flows stabilise. |
| `shared/lib/merchantSignup/**` | Server-side merchant onboarding compatibility helpers. | Prefer existing Supabase merchant Edge Function contracts for new work. |
| `shared/lib/vouchers/routing.ts` and `shared/lib/sarafu/**` | Server/worker voucher and Sarafu routing helpers used by settlement/runtime paths. | Continue moving app-facing voucher reads to stable SQL read models, Edge Functions, or scoped RPCs. |

## Recently Closed Exceptions

| Path | Closure |
| --- | --- |
| `shared/api/services/contractManagementService.ts` | Proposal metadata and proposal-link table access now goes through `create_contract_mgmt_proposal_metadata_v1`, `link_contract_mgmt_proposal_v1`, `get_contract_mgmt_proposal_metadata_v1`, and `list_contract_mgmt_proposal_metadata_v1`. The remaining service method only performs documented `contract-management` storage bucket uploads. |

## Guardrail

`pnpm lint` runs the boundary guard. New direct table access in guarded app/shared paths should fail unless the path is deliberately added to the exception map with a short reason and this document is updated in the same change.
