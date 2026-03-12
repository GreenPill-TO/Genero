import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { isBuyTcoinCheckoutEnabled } from "@shared/lib/onramp/feature";
import {
  buildTransakSession,
  getOrCreateDepositWallet,
  resolveOnrampConfig,
  type OnrampCheckoutSessionRow,
} from "@services/onramp/src";

function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") {
    return "CAD";
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" ? "CAD" : trimmed;
}

function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" ? null : trimmed;
}

async function resolveUserRecipientWallet(serviceRole: any, userId: number): Promise<`0x${string}`> {
  const { data, error } = await serviceRole
    .from("wallet_list")
    .select("public_key")
    .eq("user_id", userId)
    .eq("namespace", "EVM")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve recipient wallet: ${error.message}`);
  }

  if (!data?.public_key || !isAddress(data.public_key)) {
    throw new Error("No EVM wallet found for this user. Connect wallet before using Buy TCOIN.");
  }

  return getAddress(data.public_key) as `0x${string}`;
}

export async function POST(req: Request) {
  try {
    if (!isBuyTcoinCheckoutEnabled()) {
      return NextResponse.json(
        {
          error: "Buy TCOIN checkout is currently unavailable.",
          fallback: "Use Top Up with Interac eTransfer.",
        },
        { status: 404 }
      );
    }

    const { serviceRole, userRow } = await resolveApiAuthContext();
    const config = resolveOnrampConfig();
    const body = (await req.json()) as {
      citySlug?: string;
      fiatAmount?: number | string;
      fiatCurrency?: string;
      countryCode?: string;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const fiatAmount = toNumber(body.fiatAmount, 0);
    if (!(fiatAmount > 0)) {
      return NextResponse.json({ error: "fiatAmount must be a positive number." }, { status: 400 });
    }

    const fiatCurrency = normalizeCurrency(body.fiatCurrency);
    const countryCode = normalizeCountryCode(body.countryCode);

    const recipientWallet = await resolveUserRecipientWallet(serviceRole, Number(userRow.id));

    const deposit = await getOrCreateDepositWallet({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      citySlug,
      chainId: config.targetChainId,
    });

    const nowIso = new Date().toISOString();

    const insertedResult = await serviceRole
      .from("onramp_checkout_sessions")
      .insert({
        user_id: userRow.id,
        app_instance_id: appInstanceId,
        city_slug: citySlug,
        provider: "transak",
        fiat_currency: fiatCurrency,
        fiat_amount: fiatAmount,
        country_code: countryCode,
        target_chain_id: config.targetChainId,
        target_input_asset: config.targetInputAsset,
        final_asset: config.finalAsset,
        deposit_address: deposit.wallet.address,
        recipient_wallet: recipientWallet,
        status: "created",
        metadata: {
          source: "wallet_buy_tcoin",
          depositWalletCreated: deposit.created,
          swapAdapterId: config.swapAdapterId,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertedResult.error || !insertedResult.data) {
      throw new Error(`Failed to create onramp checkout session: ${insertedResult.error?.message ?? "unknown"}`);
    }

    const session = insertedResult.data as OnrampCheckoutSessionRow;

    const transak = await buildTransakSession({
      sessionId: session.id,
      userId: Number(userRow.id),
      appInstanceId,
      citySlug,
      fiatAmount,
      fiatCurrency,
      countryCode,
      recipientWallet,
      depositAddress: deposit.wallet.address,
    });

    const updateResult = await serviceRole
      .from("onramp_checkout_sessions")
      .update({
        provider_session_id: transak.providerSessionId,
        provider_order_id: transak.providerOrderId,
        metadata: {
          ...(session.metadata ?? {}),
          widgetUrl: transak.widgetUrl,
        },
        updated_at: nowIso,
      })
      .eq("id", session.id);

    if (updateResult.error) {
      throw new Error(`Failed to finalize onramp checkout session: ${updateResult.error.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "onramp_checkout_session_created",
      city_slug: citySlug,
      actor_user_id: userRow.id,
      reason: "User initiated Buy TCOIN checkout session",
      payload: {
        sessionId: session.id,
        provider: "transak",
        fiatAmount,
        fiatCurrency,
        countryCode,
        depositAddress: deposit.wallet.address,
        recipientWallet,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      provider: "transak",
      status: "created",
      depositAddress: deposit.wallet.address,
      recipientWallet,
      widgetUrl: transak.widgetUrl,
      widgetConfig: transak.widgetConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp session error";
    const status = message === "Unauthorized" ? 401 : message.startsWith("No EVM wallet") ? 400 : 500;
    return NextResponse.json(
      {
        error: message,
        fallback: "Use Top Up with Interac eTransfer.",
      },
      { status }
    );
  }
}
