import { NextResponse } from "next/server";
import { createDraftStore, listUserDraftStoreIds, clearDraftStores } from "@shared/lib/merchantSignup/application";
import { resolveMerchantSignupContext, resolveUserMerchantApplication } from "@shared/lib/merchantSignup/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      citySlug?: string;
      forceNew?: boolean;
    };

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(body.citySlug);
    const userId = Number(userRow.id);

    const existing = await resolveUserMerchantApplication({
      supabase: serviceRole,
      userId,
      appInstanceId,
      citySlug,
    });

    const forceNew = body.forceNew === true;

    if (existing && (existing.lifecycleStatus === "pending" || existing.lifecycleStatus === "live")) {
      return NextResponse.json(
        { error: "Cannot start a new application while current merchant status is pending/live." },
        { status: 409 }
      );
    }

    if (existing && existing.lifecycleStatus === "draft" && !forceNew) {
      return NextResponse.json({
        citySlug,
        storeId: existing.storeId,
        signupStep: existing.signupStep,
        state: "draft",
      });
    }

    if (forceNew) {
      const draftIds = await listUserDraftStoreIds({
        supabase: serviceRole,
        userId,
        appInstanceId,
      });
      await clearDraftStores({
        supabase: serviceRole,
        draftStoreIds: draftIds,
      });
    }

    const created = await createDraftStore({
      supabase: serviceRole,
      userId,
      appInstanceId,
      citySlug,
    });

    return NextResponse.json({
      citySlug,
      storeId: created.storeId,
      signupStep: 1,
      state: "draft",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error starting merchant application";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
