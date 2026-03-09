// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import {
  getRegistrySnapshot,
  getVersionRecord,
  promoteVersion,
  registerAndPromote,
} from "@shared/lib/contracts/management/registryOps";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

export default function RegistryPage() {
  const { userId, flags } = useManagementContext();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [versionToPromote, setVersionToPromote] = useState("1");
  const [inspectVersion, setInspectVersion] = useState("1");
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [registerInput, setRegisterInput] = useState({
    chainId: "545",
    tcoin: "0x0000000000000000000000000000000000000001",
    ttc: "0x0000000000000000000000000000000000000002",
    cad: "0x0000000000000000000000000000000000000003",
    orchestrator: "0x0000000000000000000000000000000000000004",
    voting: "0x0000000000000000000000000000000000000005",
    metadataURI: "https://example.org/deployments/tcoin/v-next.json",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      const data = await getRegistrySnapshot();
      setSnapshot(data);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to read registry state.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function doPromote() {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const tx = await promoteVersion({ userId, version: Number(versionToPromote) });
      setMessage(`Promotion submitted. Tx: ${tx.txHash}`);
      await refresh();
    } catch (err: any) {
      setMessage(err?.message ?? "Promotion failed.");
    } finally {
      setLoading(false);
    }
  }

  async function doRegisterAndPromote() {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const tx = await registerAndPromote({
        userId,
        chainId: Number(registerInput.chainId),
        contracts: {
          tcoin: registerInput.tcoin as `0x${string}`,
          ttc: registerInput.ttc as `0x${string}`,
          cad: registerInput.cad as `0x${string}`,
          orchestrator: registerInput.orchestrator as `0x${string}`,
          voting: registerInput.voting as `0x${string}`,
        },
        metadataURI: registerInput.metadataURI,
      });
      setMessage(`Register+promote submitted. Tx: ${tx.txHash}`);
      await refresh();
    } catch (err: any) {
      setMessage(err?.message ?? "Register+promote failed.");
    } finally {
      setLoading(false);
    }
  }

  async function inspect() {
    setLoading(true);
    setInspectResult(null);

    try {
      const record = await getVersionRecord({ version: Number(inspectVersion) });
      setInspectResult(record);
    } catch (err: any) {
      setInspectResult({ error: err?.message ?? "Failed to load version record." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Registry Interface</h1>
        <p className="contract-muted">Role required: REGISTRY_ADMIN.</p>
        {!flags?.REGISTRY_ADMIN ? <p className="contract-muted">Current wallet is not registry owner.</p> : null}
        {message ? <p>{message}</p> : null}
        <div className="contract-actions">
          <button disabled={loading} onClick={refresh}>Refresh Snapshot</button>
        </div>
        {snapshot ? (
          <>
            <p><strong>City:</strong> {snapshot.context.citySlug}</p>
            <p><strong>Current Version:</strong> {snapshot.currentVersion}</p>
            <p><strong>Latest Version:</strong> {snapshot.latestVersion}</p>
            <p><strong>Registry Address:</strong> {snapshot.context.registry.address}</p>
          </>
        ) : null}
      </section>

      <section className="contract-card">
        <h2>Promote Existing Version</h2>
        <div className="contract-field">
          <label>Version</label>
          <input value={versionToPromote} onChange={(e) => setVersionToPromote(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button disabled={loading || !flags?.REGISTRY_ADMIN} onClick={doPromote}>Promote Version</button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Register + Promote Version Bundle</h2>
        {Object.entries(registerInput).map(([key, value]) => (
          <div className="contract-field" key={key}>
            <label>{key}</label>
            <input
              value={value}
              onChange={(e) =>
                setRegisterInput((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
            />
          </div>
        ))}
        <div className="contract-actions">
          <button disabled={loading || !flags?.REGISTRY_ADMIN} onClick={doRegisterAndPromote}>
            Register and Promote
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Inspect Version Record</h2>
        <div className="contract-field">
          <label>Version</label>
          <input value={inspectVersion} onChange={(e) => setInspectVersion(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button disabled={loading} onClick={inspect}>Inspect</button>
        </div>
        {inspectResult ? <pre>{JSON.stringify(inspectResult, null, 2)}</pre> : null}
      </section>
    </div>
  );
}
