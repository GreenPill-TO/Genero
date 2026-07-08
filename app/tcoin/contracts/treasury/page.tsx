"use client";

import { useState } from "react";
import { orchestratorV2Abi } from "@shared/lib/contracts/management/abis";
import { getCityContext } from "@shared/lib/contracts/management/clients";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

type TreasuryWriteFunction =
  | "rebaseTCOIN"
  | "updateDemurrageRate"
  | "updateRebasePeriod"
  | "whitelistStore"
  | "removeStoreFromWhitelist"
  | "applyGovernanceValues";

export default function TreasuryPage() {
  const { userId, flags } = useManagementContext();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [demurrageRate, setDemurrageRate] = useState("99967");
  const [rebasePeriod, setRebasePeriod] = useState("86400");
  const [storeAddress, setStoreAddress] = useState("0x0000000000000000000000000000000000000006");
  const [values, setValues] = useState({
    pegValue: "330",
    userTtc: "92",
    storeTtc: "95",
    userCad: "87",
    storeCad: "90",
    minReserve: "800000",
    maxReserve: "1200000",
    reserveRatio: "1000000",
  });

  async function run(functionName: TreasuryWriteFunction, args: unknown[], successMessage: string) {
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
        functionName,
        args,
      });
      setMessage(`${successMessage} Tx: ${tx.txHash}`);
    } catch (err: any) {
      setMessage(err?.message ?? "Treasury operation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Treasury Interface</h1>
        <p className="contract-muted">Role required: TREASURY_ADMIN.</p>
        {!flags?.TREASURY_ADMIN ? (
          <p className="contract-muted">Current wallet is not recognized as treasury admin on-chain.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>Rebase and Demurrage</h2>
        <div className="contract-actions">
          <button disabled={loading || !flags?.TREASURY_ADMIN} onClick={() => run("rebaseTCOIN", [], "Rebase submitted.")}>
            Trigger Rebase
          </button>
        </div>
        <div className="contract-field">
          <label>Demurrage Rate</label>
          <input value={demurrageRate} onChange={(e) => setDemurrageRate(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.TREASURY_ADMIN}
            onClick={() => run("updateDemurrageRate", [BigInt(demurrageRate)], "Demurrage update submitted.")}
          >
            Update Demurrage
          </button>
        </div>
        <div className="contract-field">
          <label>Rebase Period (seconds)</label>
          <input value={rebasePeriod} onChange={(e) => setRebasePeriod(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.TREASURY_ADMIN}
            onClick={() => run("updateRebasePeriod", [BigInt(rebasePeriod)], "Rebase period update submitted.")}
          >
            Update Rebase Period
          </button>
        </div>
        <div className="contract-field">
          <label>Store Address</label>
          <input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.TREASURY_ADMIN}
            onClick={() => run("whitelistStore", [storeAddress], "Store whitelist transaction submitted.")}
          >
            Whitelist Store
          </button>
          <button
            disabled={loading || !flags?.TREASURY_ADMIN}
            onClick={() => run("removeStoreFromWhitelist", [storeAddress], "Store removal transaction submitted.")}
          >
            Remove Store
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Apply Governance Values</h2>
        <div className="contract-field">
          <label>Peg Value</label>
          <input value={values.pegValue} onChange={(e) => setValues((prev) => ({ ...prev, pegValue: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Redemption User TTC</label>
          <input value={values.userTtc} onChange={(e) => setValues((prev) => ({ ...prev, userTtc: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Redemption Store TTC</label>
          <input value={values.storeTtc} onChange={(e) => setValues((prev) => ({ ...prev, storeTtc: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Redemption User CAD</label>
          <input value={values.userCad} onChange={(e) => setValues((prev) => ({ ...prev, userCad: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Redemption Store CAD</label>
          <input value={values.storeCad} onChange={(e) => setValues((prev) => ({ ...prev, storeCad: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Minimum Reserve Ratio</label>
          <input value={values.minReserve} onChange={(e) => setValues((prev) => ({ ...prev, minReserve: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Maximum Reserve Ratio</label>
          <input value={values.maxReserve} onChange={(e) => setValues((prev) => ({ ...prev, maxReserve: e.target.value }))} />
        </div>
        <div className="contract-field">
          <label>Reserve Ratio</label>
          <input value={values.reserveRatio} onChange={(e) => setValues((prev) => ({ ...prev, reserveRatio: e.target.value }))} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.TREASURY_ADMIN}
            onClick={() =>
              run(
                "applyGovernanceValues",
                [
                  BigInt(values.pegValue),
                  BigInt(values.userTtc),
                  BigInt(values.storeTtc),
                  BigInt(values.userCad),
                  BigInt(values.storeCad),
                  BigInt(values.minReserve),
                  BigInt(values.maxReserve),
                  BigInt(demurrageRate),
                  BigInt(values.reserveRatio),
                ],
                "Governance values apply transaction submitted."
              )
            }
          >
            Apply Governance Values
          </button>
        </div>
      </section>
    </div>
  );
}
