import { createClient } from "@shared/lib/supabase/client";
import { resolveUserSettingsAppContext } from "./context";
import type {
  SaveUserSignupStepInput,
  UpdateUserPreferencesInput,
  UpdateUserProfileInput,
  UserSettingsAppContext,
  UserSettingsBootstrap,
} from "./types";

type UserSettingsInvokeOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
  appContext?: Partial<UserSettingsAppContext> | null;
};

function resolveInvokeHeaders(context: UserSettingsAppContext): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-app-slug": context.appSlug,
    "x-city-slug": context.citySlug,
    "x-app-environment": context.environment,
  };
}

async function invokeUserSettings<T>(
  path: string,
  options?: UserSettingsInvokeOptions
): Promise<T> {
  const method = options?.method ?? "GET";
  const context = resolveUserSettingsAppContext(options?.appContext);
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user-settings${path.startsWith("/") ? path : `/${path}`}`,
    {
      method,
      headers: {
        ...resolveInvokeHeaders(context),
        apikey:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body:
        method === "GET"
          ? undefined
          : JSON.stringify({
              ...(options?.body ?? {}),
              appContext: context,
            }),
    }
  );

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `User settings request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function getUserSettingsBootstrap(
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/bootstrap", {
    method: "GET",
    appContext,
  });
}

export async function updateUserProfile(
  input: UpdateUserProfileInput,
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/profile", {
    method: "PATCH",
    body: input,
    appContext,
  });
}

export async function updateUserPreferences(
  input: UpdateUserPreferencesInput,
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/preferences", {
    method: "PATCH",
    body: input,
    appContext,
  });
}

export async function startUserSignup(
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/signup/start", {
    method: "POST",
    appContext,
  });
}

export async function saveUserSignupStep(
  input: SaveUserSignupStepInput,
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/signup/step", {
    method: "POST",
    body: input as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function resetUserSignup(
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/signup/reset", {
    method: "POST",
    appContext,
  });
}

export async function completeUserSignup(
  appContext?: Partial<UserSettingsAppContext> | null
): Promise<UserSettingsBootstrap> {
  return invokeUserSettings<UserSettingsBootstrap>("/signup/complete", {
    method: "POST",
    appContext,
  });
}
