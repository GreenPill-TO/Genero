import { NextResponse } from "next/server";
import { clearDraftStores, createDraftStore, listUserDraftStoreIds } from "@shared/lib/merchantSignup/application";
import { resolveMerchantSignupContext, resolveUserMerchantApplication } from "@shared/lib/merchantSignup/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      citySlug?: string;
    };

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(body.citySlug);
    const userId = Number(userRow.id);

    const existing = await resolveUserMerchantApplication({
      supabase: serviceRole,
      userId,
      appInstanceId,
      citySlug,
    });

    if (existing && (existing.lifecycleStatus === "pending" || existing.lifecycleStatus === "live")) {
      return NextResponse.json(
        { error: "Cannot restart while the current merchant application is pending or live." },
        { status: 409 }
      );
    }

    const draftIds = await listUserDraftStoreIds({
      supabase: serviceRole,
      userId,
      appInstanceId,
    });

    await clearDraftStores({
      supabase: serviceRole,
      draftStoreIds: draftIds,
    });

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
    const message = error instanceof Error ? error.message : "Unexpected error restarting merchant application";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
