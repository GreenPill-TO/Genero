import { ethers } from "ethers";
import { quoteSarafuPoolSwap } from "@shared/lib/sarafu/client";
import { sarafuPoolWriteAbi } from "@shared/lib/sarafu/abis";

const erc20Abi = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function transfer(address to,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

function parseAmountUnits(amount: string, decimals = 18): ethers.BigNumber {
  return ethers.utils.parseUnits(amount, decimals);
}

export async function readVoucherSwapQuote(options: {
  chainId: number;
  poolAddress: `0x${string}`;
  quoterAddress?: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string;
  tokenInDecimals?: number;
}): Promise<string | null> {
  try {
    const amountInUnits = BigInt(parseAmountUnits(options.amountIn, options.tokenInDecimals ?? 18).toString());

    const quote = await quoteSarafuPoolSwap({
      chainId: options.chainId,
      poolAddress: options.poolAddress,
      quoterAddress: options.quoterAddress,
      tokenOut: options.tokenOut,
      tokenIn: options.tokenIn,
      amountIn: amountInUnits,
    });

    if (!quote) {
      return null;
    }

    return ethers.utils.formatUnits(quote.expectedOut.toString(), options.tokenInDecimals ?? 18);
  } catch {
    return null;
  }
}

export async function ensureErc20Allowance(options: {
  signer: ethers.Signer;
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  amount: string;
  decimals?: number;
}): Promise<string | null> {
  const token = new ethers.Contract(options.tokenAddress, erc20Abi, options.signer);
  const required = parseAmountUnits(options.amount, options.decimals ?? 18);
  const allowance: ethers.BigNumber = await token.allowance(options.ownerAddress, options.spenderAddress);

  if (allowance.gte(required)) {
    return null;
  }

  const approveTx = await token.approve(options.spenderAddress, required);
  await approveTx.wait();
  return approveTx.hash;
}

export async function executeVoucherSwapAndTransfer(options: {
  signer: ethers.Signer;
  senderAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  tcoinAddress: `0x${string}`;
  voucherTokenAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amountInTcoin: string;
  minAmountOut: string;
  inputTokenDecimals?: number;
  outputTokenDecimals?: number;
}): Promise<{
  approvalTxHash: string | null;
  swapTxHash: string;
  transferTxHash: string;
  transferAmount: string;
}> {
  const inputTokenDecimals = options.inputTokenDecimals ?? 18;
  const outputTokenDecimals = options.outputTokenDecimals ?? 18;
  const tokenOut = new ethers.Contract(options.voucherTokenAddress, erc20Abi, options.signer);
  const pool = new ethers.Contract(options.poolAddress, sarafuPoolWriteAbi, options.signer);

  const amountInUnits = parseAmountUnits(options.amountInTcoin, inputTokenDecimals);
  const minOutUnits = parseAmountUnits(options.minAmountOut, outputTokenDecimals);

  const approvalTxHash = await ensureErc20Allowance({
    signer: options.signer,
    tokenAddress: options.tcoinAddress,
    spenderAddress: options.poolAddress,
    ownerAddress: options.senderAddress,
    amount: options.amountInTcoin,
    decimals: inputTokenDecimals,
  });

  const balanceBefore: ethers.BigNumber = await tokenOut.balanceOf(options.senderAddress);

  const swapTx = await pool.withdraw(options.voucherTokenAddress, options.tcoinAddress, amountInUnits);
  await swapTx.wait();

  const balanceAfter: ethers.BigNumber = await tokenOut.balanceOf(options.senderAddress);
  const transferAmount = balanceAfter.sub(balanceBefore);

  if (transferAmount.lt(minOutUnits)) {
    throw new Error(
      `Post-trade slippage: received ${ethers.utils.formatUnits(
        transferAmount,
        outputTokenDecimals
      )} < minimum ${ethers.utils.formatUnits(minOutUnits, outputTokenDecimals)} (swap tx: ${swapTx.hash})`
    );
  }

  try {
    const transferTx = await tokenOut.transfer(options.recipientAddress, transferAmount);
    await transferTx.wait();

    return {
      approvalTxHash,
      swapTxHash: swapTx.hash,
      transferTxHash: transferTx.hash,
      transferAmount: ethers.utils.formatUnits(transferAmount, outputTokenDecimals),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown transfer failure";
    throw new Error(`Voucher transfer failed after successful swap (swap tx: ${swapTx.hash}): ${reason}`);
  }
}
