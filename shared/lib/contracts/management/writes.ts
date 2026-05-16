import { ethers } from "ethers";
import { getCityContext, isManagementWritesEnabled } from "./clients";
import { createCubidWalletSigner } from "./cubidSigner";

type ContractWriter = ethers.Contract & {
  [methodName: string]: (...args: unknown[]) => Promise<ethers.ContractTransaction>;
};

function getWriteMethod(contract: ContractWriter, functionName: string) {
  const candidate = contract[functionName];
  if (typeof candidate !== "function") {
    throw new Error(`Contract method "${functionName}" is not available on the supplied ABI.`);
  }

  return candidate;
}

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
  const contract = new ethers.Contract(
    address,
    abi as unknown as ethers.ContractInterface,
    signer
  ) as ContractWriter;
  const tx = await getWriteMethod(contract, functionName)(...args);
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
  const contract = new ethers.Contract(
    address,
    abi as unknown as ethers.ContractInterface,
    signer
  ) as ContractWriter;
  const tx = await getWriteMethod(contract, functionName)(...args);
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    chainId: context.registry.chainId,
  };
}
