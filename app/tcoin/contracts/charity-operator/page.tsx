// @ts-nocheck
"use client";

import { useState } from "react";
import { orchestratorV2Abi } from "@shared/lib/contracts/management/abis";
import { getCityContext, writeCityContractWithCubid } from "@shared/lib/contracts/management/clients";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

export default function CharityOperatorPage() {
  const { userId, flags } = useManagementContext();
  const [amount, setAmount] = useState("1000000000000000000");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function mint() {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const context = await getCityContext();
      const tx = await writeCityContractWithCubid({
        userId,
        address: context.contracts.ORCHESTRATOR,
        abi: orchestratorV2Abi,
        functionName: "mintTCOINForCharity",
        args: [BigInt(amount)],
      });

      setMessage(`Charity mint transaction submitted. Tx: ${tx.txHash}`);
    } catch (err: any) {
      setMessage(err?.message ?? "Charity mint failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Charity Operator Interface</h1>
        <p className="contract-muted">Role required: CHARITY_OPERATOR.</p>
        {!flags?.CHARITY_OPERATOR ? (
          <p className="contract-muted">Current wallet is not recognized as a charity operator on-chain.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>Mint Accrued TCOIN</h2>
        <div className="contract-field">
          <label>Amount (wei)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button disabled={loading || !flags?.CHARITY_OPERATOR} onClick={mint}>
            Mint TCOIN For Charity
          </button>
        </div>
      </section>
    </div>
  );
}
