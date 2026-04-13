// @ts-nocheck
import { ethers } from "ethers";
import { getCityContext, isManagementWritesEnabled } from "./clients";
import { createCubidWalletSigner } from "./cubidSigner";

export async function writeCityContractWithCubid({
  citySlug,
  userId,
  address,
  abi,
  functionName,
  args = [],
}: {
  citySlug?: string;
  userId: number;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}) {
  if (!isManagementWritesEnabled()) {
    throw new Error(
      "Management writes are disabled. Set NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES=true to enable transactions."
    );
  }

  const context = await getCityContext(citySlug);
  const signer = await createCubidWalletSigner(userId, context.rpcUrl);
  const contract = new ethers.Contract(address, abi as any, signer);

  const tx = await contract[functionName](...(args as []));
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    chainId: context.chainId,
  };
}

export async function writeRegistryContractWithCubid({
  citySlug,
  userId,
  address,
  abi,
  functionName,
  args = [],
}: {
  citySlug?: string;
  userId: number;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}) {
  if (!isManagementWritesEnabled()) {
    throw new Error(
      "Management writes are disabled. Set NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES=true to enable transactions."
    );
  }

  const context = await getCityContext(citySlug);
  const signer = await createCubidWalletSigner(userId, context.registry.rpcUrl);
  const contract = new ethers.Contract(address, abi as any, signer);

  const tx = await contract[functionName](...(args as []));
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    chainId: context.registry.chainId,
  };
}
