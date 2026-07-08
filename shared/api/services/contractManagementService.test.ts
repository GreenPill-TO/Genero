import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const getPublicUrlMock = vi.hoisted(() => vi.fn());
const storageFromMock = vi.hoisted(() =>
  vi.fn(() => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  }))
);

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: rpcMock,
    storage: {
      from: storageFromMock,
    },
  }),
}));

import {
  createProposalMetadata,
  getProposalMetadataById,
  linkOnChainProposal,
  listProposalMetadataByCity,
  uploadContractManagementImage,
} from "./contractManagementService";

describe("contractManagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates proposal metadata through the narrow RPC boundary", async () => {
    const metadata = { id: "metadata-1", city_slug: "tcoin" };
    rpcMock.mockResolvedValue({ data: metadata, error: null });

    await expect(
      createProposalMetadata({
        citySlug: "tcoin",
        proposalType: "charity",
        title: "Neighbourhood Kitchen",
        description: "Food security proposal",
        imageUrl: "https://example.test/image.png",
        payload: { wallet: "0x0000000000000000000000000000000000000003" },
        createdByUserId: 1001,
      })
    ).resolves.toEqual(metadata);

    expect(rpcMock).toHaveBeenCalledWith("create_contract_mgmt_proposal_metadata_v1", {
      p_city_slug: "tcoin",
      p_proposal_type: "charity",
      p_title: "Neighbourhood Kitchen",
      p_description: "Food security proposal",
      p_image_url: "https://example.test/image.png",
      p_payload: { wallet: "0x0000000000000000000000000000000000000003" },
      p_created_by_user_id: 1001,
    });
  });

  it("links on-chain proposals through the narrow RPC boundary", async () => {
    const link = { id: 1, proposal_id: 7 };
    rpcMock.mockResolvedValue({ data: link, error: null });

    await expect(
      linkOnChainProposal({
        proposalId: 7,
        citySlug: "tcoin",
        metadataId: "metadata-1",
        txHash: "0xabc",
      })
    ).resolves.toEqual(link);

    expect(rpcMock).toHaveBeenCalledWith("link_contract_mgmt_proposal_v1", {
      p_proposal_id: 7,
      p_city_slug: "tcoin",
      p_metadata_id: "metadata-1",
      p_tx_hash: "0xabc",
    });
  });

  it("reads proposal metadata through RPCs", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { id: "metadata-1" }, error: null })
      .mockResolvedValueOnce({ data: [{ id: "metadata-1" }], error: null });

    await expect(getProposalMetadataById("metadata-1")).resolves.toEqual({ id: "metadata-1" });
    await expect(listProposalMetadataByCity("tcoin")).resolves.toEqual([{ id: "metadata-1" }]);

    expect(rpcMock).toHaveBeenNthCalledWith(1, "get_contract_mgmt_proposal_metadata_v1", {
      p_id: "metadata-1",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "list_contract_mgmt_proposal_metadata_v1", {
      p_city_slug: "tcoin",
    });
  });

  it("surfaces RPC errors without falling back to direct table access", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    await expect(getProposalMetadataById("metadata-1")).rejects.toThrow("permission denied");
  });

  it("keeps contract image uploads on the documented storage boundary", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://cdn.example.test/image.png" } });

    const file = new File(["image"], "photo.png", { type: "image/png" });

    await expect(uploadContractManagementImage({ citySlug: "tcoin", file })).resolves.toBe(
      "https://cdn.example.test/image.png"
    );

    expect(storageFromMock).toHaveBeenCalledWith("contract-management");
    expect(uploadMock).toHaveBeenCalledWith("tcoin/123-i.png", file, { upsert: false });
  });
});
