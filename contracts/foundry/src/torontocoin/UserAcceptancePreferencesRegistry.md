# UserAcceptancePreferencesRegistry

## Purpose

`UserAcceptancePreferencesRegistry` is the canonical on-chain read/write surface for user voucher acceptance policy.

It stores user-managed preferences for:

- pool acceptance or denial
- merchant-voucher acceptance, denial, and ranked preference order
- token-address acceptance, denial, and ranked preference order
- one global `strictAcceptedOnly` mode

The registry is designed to be read by:

- `LiquidityRouter`
- future off-chain user-to-user pathfinding
- wallet UI
- indexers and reputation dashboards

## Core Semantics

### Default posture

- Items are allowed unless explicitly denied.

### Strict mode

- `strictAcceptedOnly == true` means unlisted items are not acceptable.
- Preferred merchants and preferred tokens count as accepted.
- Denied items always remain denied.

### Category model

- Pools are allow/deny only. They are not ranked on-chain.
- Merchants can be accepted, denied, and ranked.
- Tokens can be accepted, denied, and ranked.

### Precedence

- `Denied` overrides everything.
- `Preferred` implies acceptance.
- `Accepted` without ranking is acceptable but unranked.
- `Unset` means allowed unless strict mode is enabled.

## Write Surface

- `setStrictAcceptedOnly(bool enabled)`
- `setPoolAcceptance(bytes32 poolId, AcceptanceStatus status)`
- `setMerchantAcceptance(bytes32 merchantId, AcceptanceStatus status)`
- `replacePreferredMerchants(bytes32[] merchantIds)`
- `setTokenAcceptance(address token, AcceptanceStatus status)`
- `replacePreferredTokens(address[] tokenAddresses)`

Preferred-list replacement is whole-list replacement:

- duplicates are rejected
- zero ids / zero token addresses are rejected
- previous rank mappings are cleared and rebuilt
- newly preferred merchants or tokens cannot remain denied

## Read Surface

The contract exposes both raw-status and effective-acceptance reads:

- `getPoolAcceptance(...)`
- `getMerchantAcceptance(...)`
- `getTokenAcceptance(...)`
- `isPoolAccepted(...)`
- `isMerchantAccepted(...)`
- `isTokenAccepted(...)`

Enumeration and rank helpers are also available:

- `getAcceptedPoolIds(...)`
- `getDeniedPoolIds(...)`
- `getAcceptedMerchantIds(...)`
- `getDeniedMerchantIds(...)`
- `getPreferredMerchantIds(...)`
- `getAcceptedTokenAddresses(...)`
- `getDeniedTokenAddresses(...)`
- `getPreferredTokenAddresses(...)`
- `getMerchantPreferenceRank(...)`
- `getTokenPreferenceRank(...)`

For routing and pathfinding consumers, the canonical bootstrap read is:

- `getRoutingPreferences(address user)`

That snapshot returns the user's strict-mode flag plus the accepted, denied, and preferred vectors needed to evaluate route compatibility off-chain or inside router logic.

## Router Integration

`LiquidityRouter` now reads this registry directly instead of accepting user pool and merchant preference vectors as calldata.

Current router usage:

- denied pools hard-exclude a pool
- denied merchants hard-exclude any matching pool
- strict mode requires the output token (`cplTCOIN`) to be accepted
- strict mode allows a pool when either:
  - the pool is explicitly accepted, or
  - the pool matches an accepted merchant voucher
- preferred merchant order contributes a deterministic score bonus

The router does not perform general user-to-user voucher ranking. It only consumes the canonical preference state to filter and score pools.

## Pathfinding Use

This registry is intended to let off-chain systems answer questions like:

- which pools does a user refuse entirely?
- which merchant vouchers does a user rank highest?
- which token addresses are acceptable in strict mode?
- what is the recipient’s best-ranked merchant-voucher order?
- what is the sender’s least-desired acceptable merchant-voucher order?

The contract does not choose a path or rank a final voucher transfer. It provides the canonical protocol-readable state needed for those off-chain decisions.
