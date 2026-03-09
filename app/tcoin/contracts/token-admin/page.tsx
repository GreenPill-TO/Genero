// @ts-nocheck
"use client";

import { useState } from "react";
import { keccak256, stringToBytes } from "viem";
import { accessControlTokenAbi } from "@shared/lib/contracts/management/abis";
import {
  getCityContext,
  getCityPublicClient,
  writeCityContractWithCubid,
} from "@shared/lib/contracts/management/clients";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

const OWNER_ROLE = keccak256(stringToBytes("OWNER_ROLE"));
const MINTER_ROLE = keccak256(stringToBytes("MINTER_ROLE"));

export default function TokenAdminPage() {
  const { userId, flags } = useManagementContext();
  const [selectedToken, setSelectedToken] = useState<"TTC" | "CAD">("TTC");
  const [targetAddress, setTargetAddress] = useState("0x0000000000000000000000000000000000000005");
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function withToken(fnName: string, args: unknown[], done: string) {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const context = await getCityContext();
      const address = selectedToken === "TTC" ? context.contracts.TTC : context.contracts.CAD;

      const tx = await writeCityContractWithCubid({
        userId,
        address,
        abi: accessControlTokenAbi,
        functionName: fnName,
        args,
      });

      setMessage(`${done} Tx: ${tx.txHash}`);
    } catch (err: any) {
      setMessage(err?.message ?? "Token admin transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    setLoading(true);
    setStats(null);

    try {
      const context = await getCityContext();
      const address = selectedToken === "TTC" ? context.contracts.TTC : context.contracts.CAD;
      const client = getCityPublicClient(context.chainId);

      const [symbol, minted, burned, ownerRole] = await Promise.all([
        client.readContract({ address, abi: accessControlTokenAbi, functionName: "symbol", args: [] }),
        client.readContract({ address, abi: accessControlTokenAbi, functionName: "getTotalMinted", args: [] }),
        client.readContract({ address, abi: accessControlTokenAbi, functionName: "getTotalBurned", args: [] }),
        client.readContract({
          address,
          abi: accessControlTokenAbi,
          functionName: "hasRole",
          args: [OWNER_ROLE, targetAddress],
        }),
      ]);

      setStats(
        `symbol=${symbol} totalMinted=${String(minted)} totalBurned=${String(burned)} targetHasOwnerRole=${String(
          ownerRole
        )}`
      );
    } catch (err: any) {
      setStats(err?.message ?? "Failed to load token stats.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Token Admin Interface</h1>
        <p className="contract-muted">Role required: TOKEN_ADMIN.</p>
        {!flags?.TOKEN_ADMIN ? <p className="contract-muted">Current wallet is not token admin on-chain.</p> : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>AccessControl Operations</h2>
        <div className="contract-field">
          <label>Token</label>
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value as "TTC" | "CAD")}>
            <option value="TTC">TTC</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
        <div className="contract-field">
          <label>Target Address</label>
          <input value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.TOKEN_ADMIN}
            onClick={() => withToken("grantRole", [MINTER_ROLE, targetAddress], "Granted MINTER_ROLE.")}
          >
            Grant MINTER_ROLE
          </button>
          <button
            disabled={loading || !flags?.TOKEN_ADMIN}
            onClick={() => withToken("revokeRole", [MINTER_ROLE, targetAddress], "Revoked MINTER_ROLE.")}
          >
            Revoke MINTER_ROLE
          </button>
          <button disabled={loading || !flags?.TOKEN_ADMIN} onClick={() => withToken("pause", [], "Token pause submitted.")}>Pause</button>
          <button
            disabled={loading || !flags?.TOKEN_ADMIN}
            onClick={() => withToken("unpause", [], "Token unpause submitted.")}
          >
            Unpause
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Token Telemetry</h2>
        <div className="contract-actions">
          <button disabled={loading} onClick={loadStats}>Refresh Stats</button>
        </div>
        {stats ? <p>{stats}</p> : <p className="contract-muted">No token metrics loaded yet.</p>}
      </section>
    </div>
  );
}
