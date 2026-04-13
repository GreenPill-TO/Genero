// @ts-nocheck
"use client";

import { useState } from "react";
import {
  createProposalMetadata,
  linkOnChainProposal,
  uploadContractManagementImage,
} from "@shared/api/services/contractManagementService";
import { getProposalCount } from "@shared/lib/contracts/management/proposals";
import { useManagementContext } from "@tcoin/contracts/hooks/useManagementContext";

export default function CityManagerPage() {
  const { userId, flags, context } = useManagementContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [charityId, setCharityId] = useState("201");
  const [name, setName] = useState("Toronto Neighbourhood Kitchen");
  const [wallet, setWallet] = useState("0x0000000000000000000000000000000000000003");
  const [description, setDescription] = useState("Community-run kitchen focused on neighbourhood food security.");
  const [website, setWebsite] = useState("https://example.org");
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function onSubmit() {
    if (!userId || !context) {
      setMessage("Missing user or city context.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadContractManagementImage({ citySlug: context.citySlug, file: imageFile });
      }

      const metadata = await createProposalMetadata({
        citySlug: context.citySlug,
        proposalType: "charity",
        title: name,
        description,
        imageUrl,
        payload: {
          wallet,
          website,
          description,
        },
        createdByUserId: userId,
      });

      const beforeCount = await getProposalCount();
      const { proposeCharity } = await import("@shared/lib/contracts/management/proposals-write");
      const tx = await proposeCharity({
        userId,
        charityId: Number(charityId),
        name,
        wallet: wallet as `0x${string}`,
        metadataRecordId: metadata.id,
        votingWindowSeconds: 86400,
      });

      const proposalId = beforeCount + 1;
      await linkOnChainProposal({
        proposalId,
        citySlug: context.citySlug,
        metadataId: metadata.id,
        txHash: tx.txHash,
      });

      setMessage(`Charity proposal submitted (proposal #${proposalId}). Tx: ${tx.txHash}`);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to create city-manager proposal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contract-grid">
      <section className="contract-card">
        <h1>City Manager Interface</h1>
        <p className="contract-muted">Role required: CITY_MANAGER (owner).</p>
        {!flags?.CITY_MANAGER ? (
          <p className="contract-muted">Current wallet is not recognized as city manager on-chain.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="contract-card">
        <h2>Propose New Charity</h2>

        <div className="contract-field">
          <label>Charity ID</label>
          <input value={charityId} onChange={(e) => setCharityId(e.target.value)} />
        </div>

        <div className="contract-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="contract-field">
          <label>Wallet Address</label>
          <input value={wallet} onChange={(e) => setWallet(e.target.value)} />
        </div>

        <div className="contract-field">
          <label>Description</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="contract-field">
          <label>Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div className="contract-field">
          <label>Picture</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
        </div>

        <div className="contract-actions">
          <button disabled={loading || !flags?.CITY_MANAGER} onClick={onSubmit}>
            Submit Charity Proposal
          </button>
        </div>
      </section>
    </div>
  );
}
