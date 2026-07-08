// @ts-nocheck
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProposal,
  listProposalIdsByStatus,
} from "@shared/lib/contracts/management/proposals";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

const STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  EXECUTED: 3,
  CANCELLED: 4,
} as const;

export default function GovernancePage() {
  const { userId, flags } = useManagementContext();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<any[]>([]);
  const [approvedProposals, setApprovedProposals] = useState<any[]>([]);

  const [pegValue, setPegValue] = useState("335");
  const [pegWindow, setPegWindow] = useState("86400");

  const [charityId, setCharityId] = useState("101");
  const [charityName, setCharityName] = useState("Toronto Community Aid");
  const [charityWallet, setCharityWallet] = useState("0x0000000000000000000000000000000000000001");
  const [charityMetadataId, setCharityMetadataId] = useState("metadata-charity-101");

  const [reserveCode, setReserveCode] = useState("USDC");
  const [reserveToken, setReserveToken] = useState("0x0000000000000000000000000000000000000002");
  const [reserveDecimals, setReserveDecimals] = useState("6");
  const [reserveMetadataId, setReserveMetadataId] = useState("metadata-reserve-usdc");

  const refresh = useCallback(async () => {
    try {
      const [pending, approved] = await Promise.all([
        listProposalIdsByStatus({ status: STATUS.PENDING, cursor: 0, size: 20 }),
        listProposalIdsByStatus({ status: STATUS.APPROVED, cursor: 0, size: 20 }),
      ]);

      const pendingItems = await Promise.all(pending.ids.map((id) => getProposal({ proposalId: id })));
      const approvedItems = await Promise.all(approved.ids.map((id) => getProposal({ proposalId: id })));

      setPendingProposals(pendingItems);
      setApprovedProposals(approvedItems);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to load governance proposals.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<any>, doneMessage: string) {
    if (!userId) {
      setMessage("No Cubid user session found.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await action();
      setMessage(`${doneMessage} Tx: ${result?.txHash ?? "submitted"}`);
      await refresh();
    } catch (err: any) {
      setMessage(err?.message ?? "Governance transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runProposalWrite(
    action: (writes: typeof import("@shared/lib/contracts/management/proposals-write")) => Promise<any>,
    doneMessage: string
  ) {
    return run(async () => {
      const writes = await import("@shared/lib/contracts/management/proposals-write");
      return action(writes);
    }, doneMessage);
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>Governance Interface</h1>
        <p className="contract-muted">Role required: GOVERNANCE_STEWARD (propose/vote), owner for execute/cancel.</p>
        {!flags?.GOVERNANCE_STEWARD ? (
          <p className="contract-muted">You are not currently recognized as a steward on-chain.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>Peg Value Proposal</h2>
        <div className="contract-field">
          <label>Proposed Peg Value (2dp integer)</label>
          <input value={pegValue} onChange={(e) => setPegValue(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Voting Window (seconds)</label>
          <input value={pegWindow} onChange={(e) => setPegWindow(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite(
                (writes) =>
                  writes.proposePegValue({
                    userId,
                    proposedPegValue: Number(pegValue),
                    votingWindowSeconds: Number(pegWindow),
                  }),
                "Peg proposal submitted."
              )
            }
          >
            Propose Peg Value
          </button>
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite(
                (writes) => writes.votePegValue({ userId, proposedPegValue: Number(pegValue) }),
                "Peg vote submitted."
              )
            }
          >
            Vote Peg Value
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Charity Proposal</h2>
        <div className="contract-field">
          <label>Charity ID</label>
          <input value={charityId} onChange={(e) => setCharityId(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Name</label>
          <input value={charityName} onChange={(e) => setCharityName(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Wallet</label>
          <input value={charityWallet} onChange={(e) => setCharityWallet(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Metadata Record ID</label>
          <input value={charityMetadataId} onChange={(e) => setCharityMetadataId(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite(
                (writes) =>
                  writes.proposeCharity({
                    userId,
                    charityId: Number(charityId),
                    name: charityName,
                    wallet: charityWallet as `0x${string}`,
                    metadataRecordId: charityMetadataId,
                    votingWindowSeconds: Number(pegWindow),
                  }),
                "Charity proposal submitted."
              )
            }
          >
            Propose Charity
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Reserve Currency Proposal</h2>
        <div className="contract-field">
          <label>Code (e.g. USDC)</label>
          <input value={reserveCode} onChange={(e) => setReserveCode(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Token Address</label>
          <input value={reserveToken} onChange={(e) => setReserveToken(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Decimals</label>
          <input value={reserveDecimals} onChange={(e) => setReserveDecimals(e.target.value)} />
        </div>
        <div className="contract-field">
          <label>Metadata Record ID</label>
          <input value={reserveMetadataId} onChange={(e) => setReserveMetadataId(e.target.value)} />
        </div>
        <div className="contract-actions">
          <button
            disabled={loading || !flags?.GOVERNANCE_STEWARD}
            onClick={() =>
              runProposalWrite(
                (writes) =>
                  writes.proposeReserveCurrency({
                    userId,
                    code: reserveCode,
                    token: reserveToken as `0x${string}`,
                    decimals: Number(reserveDecimals),
                    metadataRecordId: reserveMetadataId,
                    votingWindowSeconds: Number(pegWindow),
                  }),
                "Reserve currency proposal submitted."
              )
            }
          >
            Propose Reserve Currency
          </button>
        </div>
      </section>

      <section className="contract-card">
        <h2>Pending Proposals</h2>
        {pendingProposals.length === 0 ? <p className="contract-muted">No pending proposals.</p> : null}
        {pendingProposals.map((proposal) => (
          <article key={proposal.proposalId} className="contract-card" style={{ marginTop: "0.75rem" }}>
            <p>
              <strong>#{proposal.proposalId}</strong> {proposal.proposalType} — {proposal.name || proposal.code}
            </p>
            <p>
              Votes: {proposal.yesVotes} yes / {proposal.noVotes} no
            </p>
            <div className="contract-actions">
              <button
                disabled={loading || !flags?.GOVERNANCE_STEWARD}
                onClick={() =>
                  runProposalWrite(
                    (writes) => writes.voteProposal({ userId, proposalId: proposal.proposalId, support: true }),
                    "Voted yes."
                  )
                }
              >
                Vote Yes
              </button>
              <button
                disabled={loading || !flags?.GOVERNANCE_STEWARD}
                onClick={() =>
                  runProposalWrite(
                    (writes) => writes.voteProposal({ userId, proposalId: proposal.proposalId, support: false }),
                    "Voted no."
                  )
                }
              >
                Vote No
              </button>
              <button
                disabled={loading || !flags?.CITY_MANAGER}
                onClick={() =>
                  runProposalWrite(
                    (writes) => writes.executeProposal({ userId, proposalId: proposal.proposalId }),
                    "Proposal executed."
                  )
                }
              >
                Execute
              </button>
              <button
                disabled={loading || !flags?.CITY_MANAGER}
                onClick={() =>
                  runProposalWrite(
                    (writes) => writes.cancelProposal({ userId, proposalId: proposal.proposalId }),
                    "Proposal cancelled."
                  )
                }
              >
                Cancel
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="contract-card">
        <h2>Approved Proposals</h2>
        {approvedProposals.length === 0 ? <p className="contract-muted">No approved proposals.</p> : null}
        {approvedProposals.map((proposal) => (
          <article key={proposal.proposalId} className="contract-card" style={{ marginTop: "0.75rem" }}>
            <p>
              <strong>#{proposal.proposalId}</strong> {proposal.proposalType} — {proposal.name || proposal.code}
            </p>
            <div className="contract-actions">
              <button
                disabled={loading || !flags?.CITY_MANAGER}
                onClick={() =>
                  runProposalWrite(
                    (writes) => writes.executeProposal({ userId, proposalId: proposal.proposalId }),
                    "Proposal executed."
                  )
                }
              >
                Execute
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
