// @ts-nocheck
import { createClient } from "@shared/lib/supabase/client";

export type ProposalMetadataInput = {
  citySlug: string;
  proposalType: "charity" | "reserve";
  title: string;
  description: string;
  imageUrl?: string | null;
  payload?: Record<string, unknown>;
  createdByUserId: number;
};

export async function createProposalMetadata(input: ProposalMetadataInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_contract_mgmt_proposal_metadata_v1", {
    p_city_slug: input.citySlug,
    p_proposal_type: input.proposalType,
    p_title: input.title,
    p_description: input.description,
    p_image_url: input.imageUrl ?? null,
    p_payload: input.payload ?? {},
    p_created_by_user_id: input.createdByUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function linkOnChainProposal({
  proposalId,
  citySlug,
  metadataId,
  txHash,
}: {
  proposalId: number;
  citySlug: string;
  metadataId: string;
  txHash: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("link_contract_mgmt_proposal_v1", {
    p_proposal_id: proposalId,
    p_city_slug: citySlug,
    p_metadata_id: metadataId,
    p_tx_hash: txHash,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getProposalMetadataById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_contract_mgmt_proposal_metadata_v1", {
    p_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listProposalMetadataByCity(citySlug: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_contract_mgmt_proposal_metadata_v1", {
    p_city_slug: citySlug,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function uploadContractManagementImage({
  citySlug,
  file,
}: {
  citySlug: string;
  file: File;
}) {
  const supabase = createClient();
  const extension = file.name.split(".").pop() || "png";
  const filePath = `${citySlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("contract-management")
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("contract-management").getPublicUrl(filePath);
  return data.publicUrl;
}
