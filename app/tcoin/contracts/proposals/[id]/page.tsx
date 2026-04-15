// @ts-nocheck
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getProposal } from "@shared/lib/contracts/management/proposals";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(params?.id || 0);
  const { userId, flags } = useManagementContext();
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!proposalId) {
      setMessage("Invalid proposal id.");
      return;
    }

    setLoading(true);
    try {
      const data = await getProposal({ proposalId });
      setProposal(data);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to load proposal.");
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<any>, done: string) {
    if (!userId) {
      setMessage("Missing Cubid user session.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const tx = await action();
      setMessage(`${done} Tx: ${tx.txHash}`);
      await refresh();
    } catch (err: any) {
      setMessage(err?.message ?? "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runProposalWrite(
    action: (writes: typeof import("@shared/lib/contracts/management/proposals-write")) => Promise<any>,
    done: string
  ) {
    return run(async () => {
      const writes = await import("@shared/lib/contracts/management/proposals-write");
      return action(writes);
    }, done);
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Proposal #{proposalId}</h1>
        <p className="contract-muted">
          <Link href="/governance">Back to governance</Link>
        </p>
        {loading ? <p>Loading proposal...</p> : null}
        {message ? <p>{message}</p> : null}
        {proposal ? <pre>{JSON.stringify(proposal, null, 2)}</pre> : null}
      </section>

      <section className="contract-card">
        <h2>Actions</h2>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite((writes) => writes.voteProposal({ userId, proposalId, support: true }), "Voted yes.")
            }
          >
            Vote Yes
          </button>
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite((writes) => writes.voteProposal({ userId, proposalId, support: false }), "Voted no.")
            }
          >
            Vote No
          </button>
          <button
            disabled={loading || !flags?.CITY_MANAGER}
            onClick={() => runProposalWrite((writes) => writes.executeProposal({ userId, proposalId }), "Executed.")}
          >
            Execute
          </button>
          <button
            disabled={loading || !flags?.CITY_MANAGER}
            onClick={() => runProposalWrite((writes) => writes.cancelProposal({ userId, proposalId }), "Cancelled.")}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
