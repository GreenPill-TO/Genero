import { NextResponse } from "next/server";
import {
  isMerchantSignupEnabled,
  resolveMerchantSignupContext,
  resolveUserMerchantApplication,
} from "@shared/lib/merchantSignup/server";
import type { MerchantApplicationStatusResponse } from "@shared/lib/merchantSignup/types";

export async function GET(req: Request) {
  try {
    if (!isMerchantSignupEnabled()) {
      const citySlug = new URL(req.url).searchParams.get("citySlug") ?? "tcoin";
      return NextResponse.json({
        citySlug,
        state: "none",
        storeId: null,
        signupStep: null,
        statusMeta: null,
        application: null,
      } satisfies MerchantApplicationStatusResponse);
    }

    const url = new URL(req.url);
    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(
      url.searchParams.get("citySlug") ?? undefined
    );

    const application = await resolveUserMerchantApplication({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      citySlug,
    });

    if (!application) {
      return NextResponse.json({
        citySlug,
        state: "none",
        storeId: null,
        signupStep: null,
        statusMeta: null,
        application: null,
      } satisfies MerchantApplicationStatusResponse);
    }

    return NextResponse.json({
      citySlug,
      state: application.lifecycleStatus,
      storeId: application.storeId,
      signupStep: application.signupStep,
      statusMeta: application.statusMeta,
      application,
    } satisfies MerchantApplicationStatusResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error resolving merchant application status";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
