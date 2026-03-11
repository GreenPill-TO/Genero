# BIA Pools + Indexer Tandem Runbook

## 1. Purpose
This runbook covers setup, seeding, day-2 operations, and incident response for the BIA pools + indexer tandem features.

## 2. Preconditions
1. Supabase project linked and service role key configured in app runtime.
2. Existing indexer migration (`v0.95`) already applied.
3. New migration (`v0.96`) applied.
4. App is running with authenticated flows enabled.

## 3. Deploy/Enable Steps

### 3.1 Apply migration
Run your normal migration push/reset flow and verify:
- `public.bia_registry` exists.
- `public.bia_pool_mappings` exists.
- `indexer.bia_event_rollups` and `indexer.bia_risk_signals` exist.

### 3.2 Confirm indexer endpoints
- `POST /api/indexer/touch`
- `GET /api/indexer/status?citySlug=tcoin`

Expected status payload now includes `biaSummary`.

### 3.3 Confirm auth and app scope
Ensure test users have expected app-scoped role rows in `public.roles` (`admin`, `operator`) and store assignments in `public.store_employees`.

## 4. Initial Seeding Procedure (tcoin)

### 4.1 Create BIA records
Use `POST /api/bias/create` for each BIA.

Example payload:
```json
{
  "citySlug": "tcoin",
  "code": "QUEEN_WEST",
  "name": "Queen West",
  "centerLat": 43.649,
  "centerLng": -79.397,
  "status": "active"
}
```

### 4.2 Create BIA->pool mappings
Use `POST /api/bias/mappings`.

Example payload:
```json
{
  "citySlug": "tcoin",
  "biaId": "<bia-uuid>",
  "chainId": 42220,
  "poolAddress": "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
  "tokenRegistry": "0xD3aE8C0f49680E53EF76546af18d45DF4654Af81",
  "tokenLimiter": "0x9ac2fef4b3672825BB7560377c8bEd7E255e0FEF",
  "quoter": "0xD870DEe32489b59Aa71723f6017812FB078EE371",
  "feeAddress": "0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624",
  "mappingStatus": "active",
  "forceTouch": true
}
```

### 4.3 Set BIA controls
Use `POST /api/bias/controls`.

Example payload:
```json
{
  "citySlug": "tcoin",
  "biaId": "<bia-uuid>",
  "maxDailyRedemption": 10000,
  "maxTxAmount": 500,
  "queueOnlyMode": true,
  "isFrozen": false
}
```

### 4.4 User/store affiliation
- User selects BIA via `POST /api/bias/select`.
- Merchant creates store profile via `POST /api/stores` (optional `biaId`).
- Merchant can change store BIA via `POST /api/stores/:id/bia`.

## 5. Buy/Redemption Operational Flows

### 5.1 Buy flow
Endpoint: `POST /api/pools/buy`

Required:
- authenticated user
- active user BIA (or explicit `biaId`)
- active BIA pool mapping
- unfrozen BIA pool

Outcome:
- writes `public.pool_purchase_requests`
- writes `public.governance_actions_log`

### 5.2 Redemption request
Endpoint: `POST /api/redemptions/request`

Required:
- authenticated user with store access
- store has active BIA affiliation
- active BIA mapping
- store not suspended
- pool controls allow request

Outcome:
- writes `public.pool_redemption_requests` with `pending` status
- writes governance audit log

### 5.3 Redemption approval
Endpoint: `POST /api/redemptions/:id/approve`

Required:
- admin/operator role

Outcome:
- status -> `approved` or `rejected`
- audit row emitted

### 5.4 Redemption settlement
Endpoint: `POST /api/redemptions/:id/settle`

Required:
- admin/operator role
- approved request (unless marking as failed)

Outcome:
- request status -> `settled` or `failed`
- writes `pool_redemption_settlements`
- audit row emitted

## 6. Indexer Operations

### 6.1 Trigger index run
- Automatic: login/app activity via existing trigger hook.
- Manual: call `POST /api/indexer/touch`.

### 6.2 Check index health
Call `GET /api/indexer/status?citySlug=tcoin`.

Key fields:
- `runControl`
- `checkpoints`
- `activePoolCount`
- `activeTokenCount`
- `biaSummary.activeBias`
- `biaSummary.mappedPools`
- `biaSummary.unmappedPools`
- `biaSummary.staleMappings`
- `biaSummary.lastActivityByBia`

### 6.3 Mapping reconciliation
- Use `GET /api/bias/mappings?citySlug=tcoin&chainId=42220&includeHealth=true`.
- If mismatches/stale appear, correct mapping and re-run index touch.

## 7. Risk-Control Operations

### 7.1 Freeze/unfreeze a BIA pool
- `POST /api/bias/controls` with `isFrozen: true|false`.

### 7.2 Throttle redemption
- Set `maxTxAmount` and/or `maxDailyRedemption` in BIA controls.

### 7.3 Suspend/reinstate merchant
- `POST /api/stores/risk` with `isSuspended: true|false`.

### 7.4 Audit trail
- Query `GET /api/governance/actions?citySlug=tcoin`.

## 8. Incident Response

### 8.1 Sudden redemption pressure
1. Freeze affected BIA (`isFrozen: true`).
2. Suspend suspicious stores if needed.
3. Review pending queue: `GET /api/redemptions/list?status=pending`.
4. Inspect `v_bia_pool_health` and `indexer.bia_risk_signals`.
5. Resume gradually by re-enabling controls.

### 8.2 Unmapped discovered pools
1. Check `biaSummary.unmappedPools` in indexer status.
2. Review discovered pools from `indexer.pool_links`.
3. Create/update mappings via `POST /api/bias/mappings`.
4. Force touch (mapping endpoint with `forceTouch: true`) or manually touch indexer.

### 8.3 Stale/mismatch mappings
1. Review `validation_status` in `bia_pool_mappings`.
2. Verify pool component addresses on-chain.
3. Insert corrected mapping and retire old active row.
4. Re-trigger indexer and verify stale count drops.

## 9. SQL Quick Checks

### 9.1 Active BIA mappings
```sql
select b.city_slug, b.code, m.chain_id, m.pool_address, m.validation_status
from public.bia_pool_mappings m
join public.bia_registry b on b.id = m.bia_id
where m.mapping_status = 'active' and m.effective_to is null
order by b.code;
```

### 9.2 Pending redemptions by BIA
```sql
select b.code, count(*) as pending_count, coalesce(sum(r.token_amount), 0) as pending_amount
from public.pool_redemption_requests r
join public.bia_registry b on b.id = r.bia_id
where r.status = 'pending'
group by b.code
order by pending_amount desc;
```

### 9.3 Indexer BIA summary view
```sql
select *
from public.v_bia_activity_summary
where city_slug = 'tcoin'
order by code;
```

## 10. Post-Deployment Verification Checklist
1. Create at least one BIA and one active mapping.
2. Select BIA for test user and assign BIA for test store.
3. Create buy request (`/api/pools/buy`).
4. Create redemption request (`/api/redemptions/request`).
5. Approve then settle (`/api/redemptions/:id/approve`, `/api/redemptions/:id/settle`).
6. Trigger index touch and confirm `biaSummary` + rollups/risk rows update.
7. Validate governance log entries for all admin/risk actions.
