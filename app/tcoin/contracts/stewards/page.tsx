// @ts-nocheck
"use client";

import { useState } from "react";
import { orchestratorV2Abi } from "@shared/lib/contracts/management/abis";
import {
  getCityContext,
  getCityPublicClient,
} from "@shared/lib/contracts/management/clients";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

export default function StewardsPage() {
  const { userId, flags } = useManagementContext();
  const [stewardId, setStewardId] = useState("301");
  const [stewardName, setStewardName] = useState("Steward Candidate");
  const [stewardAddress, setStewardAddress] = useState("0x0000000000000000000000000000000000000004");
  const [lookupAddress, setLookupAddress] = useState("0x0000000000000000000000000000000000000004");
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function nominate() {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const context = await getCityContext();
      const { writeCityContractWithCubid } = await import("@shared/lib/contracts/management/writes");
      const tx = await writeCityContractWithCubid({
        userId,
        address: context.contracts.ORCHESTRATOR,
        abi: orchestratorV2Abi,
        functionName: "nominateSteward",
        args: [BigInt(stewardId), stewardName, stewardAddress],
      });

      setMessage(`Steward nomination submitted. Tx: ${tx.txHash}`);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to nominate steward.");
    } finally {
      setLoading(false);
    }
  }

  async function lookup() {
    setLoading(true);
    setLookupResult(null);

    try {
      const context = await getCityContext();
      const client = getCityPublicClient(context.chainId);
      const [isSteward, count] = await Promise.all([
        client.readContract({
          address: context.contracts.ORCHESTRATOR,
          abi: orchestratorV2Abi,
          functionName: "isSteward",
          args: [lookupAddress],
        }),
        client.readContract({
          address: context.contracts.ORCHESTRATOR,
          abi: orchestratorV2Abi,
          functionName: "getStewardCount",
          args: [],
        }),
      ]);

      setLookupResult(`isSteward=${String(isSteward)} | totalStewards=${String(count)}`);
    } catch (err: any) {
      setLookupResult(err?.message ?? "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Steward Interface</h1>
        <p className="contract-muted">Charity wallets can nominate stewards when eligible on-chain.</p>
        {!flags?.CHARITY_OPERATOR ? (
          <p className="contract-muted">Current wallet is not recognized as a charity operator.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>Nominate Steward</h2>
        <div className="contract-field">
          <label>Steward ID</label>
          <input value={stewardId} onChange={(e) => setStewardId(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Name</label>
          <input value={stewardName} onChange={(e) => setStewardName(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Steward Wallet</label>
          <input value={stewardAddress} onChange={(e) => setStewardAddress(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button disabled={loading || !flags?.CHARITY_OPERATOR} onClick={nominate}>
            Submit Nomination
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Steward Status Check</h2>
        <div className="contract-field">
          <label>Wallet</label>
          <input value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button disabled={loading} onClick={lookup}>
            Check Steward Status
          </button>
        </div>
        {lookupResult ? <p>{lookupResult}</p> : null}
      </section>
    </div>
  );
}
