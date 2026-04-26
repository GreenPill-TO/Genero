// @ts-nocheck
"use client";

import Link from "next/link";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";
import { isManagementWritesEnabled } from "@shared/lib/contracts/management/clients";

const contractsBasePath = "/tcoin/contracts";

export default function ContractsHomePage() {
  const { walletAddress, roles, flags, context, loading, error } = useManagementContext();

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Control Plane Overview</h1>
        <p className="contract-muted">
          City-generic contract management powered by the on-chain city registry and role-aware controls.
        </p>
        {loading ? <p>Resolving wallet + on-chain roles...</p> : null}
        {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
        {walletAddress ? <p><strong>Wallet:</strong> {walletAddress}</p> : null}
        {context ? (
          <>
            <p><strong>City:</strong> {context.citySlug}</p>
            <p><strong>Chain:</strong> {context.chainId}</p>
            <p><strong>Registry Version:</strong> {context.version}</p>
          </>
        ) : null}
        <p>
          <strong>Write Mode:</strong>{" "}
          {isManagementWritesEnabled() ? "Enabled" : "Disabled (set NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES=true)"}
        </p>
      </section>

      <section className="contract-card">
        <h2>Resolved Roles</h2>
        {!roles.length ? <p className="contract-muted">No management roles resolved for this wallet.</p> : null}
        <ul>
          {roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </section>

      <section className="contract-card">
        <h2>Interface Map</h2>
        <ul>
          <li>
            <Link href={`${contractsBasePath}/governance`}>Governance</Link> — peg proposals, charity/reserve proposals, voting, execution.
          </li>
          <li>
            <Link href={`${contractsBasePath}/city-manager`}>City Manager</Link> — metadata-backed charity proposal creation.
          </li>
          <li>
            <Link href={`${contractsBasePath}/stewards`}>Stewards</Link> — steward nomination and verification.
          </li>
          <li>
            <Link href={`${contractsBasePath}/charity-operator`}>Charity Operator</Link> — mint accrued charity TCOIN allocation.
          </li>
          <li>
            <Link href={`${contractsBasePath}/treasury`}>Treasury</Link> — rebase and governance value application.
          </li>
          <li>
            <Link href={`${contractsBasePath}/token-admin`}>Token Admin</Link> — TTC/CAD AccessControl ops and pause controls.
          </li>
          <li>
            <Link href={`${contractsBasePath}/registry`}>Registry</Link> — version registration/promotion/rollback.
          </li>
        </ul>
      </section>

      <section className="contract-card">
        <h2>Role Gates</h2>
        <ul>
          <li>Governance Steward: {String(Boolean(flags?.GOVERNANCE_STEWARD))}</li>
          <li>City Manager: {String(Boolean(flags?.CITY_MANAGER))}</li>
          <li>Treasury Admin: {String(Boolean(flags?.TREASURY_ADMIN))}</li>
          <li>Token Admin: {String(Boolean(flags?.TOKEN_ADMIN))}</li>
          <li>Charity Operator: {String(Boolean(flags?.CHARITY_OPERATOR))}</li>
          <li>Registry Admin: {String(Boolean(flags?.REGISTRY_ADMIN))}</li>
        </ul>
      </section>
    </div>
  );
}
