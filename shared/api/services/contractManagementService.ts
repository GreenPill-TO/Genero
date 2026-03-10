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
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contract_mgmt_proposal_metadata")
    .insert({
      city_slug: input.citySlug,
      proposal_type: input.proposalType,
      title: input.title,
      description: input.description,
      image_url: input.imageUrl ?? null,
      payload: input.payload ?? {},
      created_by_user_id: input.createdByUserId,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

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
  const { data, error } = await supabase
    .from("contract_mgmt_proposal_links")
    .insert({
      proposal_id: proposalId,
      city_slug: citySlug,
      metadata_id: metadataId,
      tx_hash: txHash,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getProposalMetadataById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_mgmt_proposal_metadata")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listProposalMetadataByCity(citySlug: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_mgmt_proposal_metadata")
    .select("*")
    .eq("city_slug", citySlug)
    .order("created_at", { ascending: false });

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
