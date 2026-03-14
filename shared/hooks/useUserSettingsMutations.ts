"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeUserSignup,
  resetUserSignup,
  saveUserSignupStep,
  startUserSignup,
  updateUserPreferences,
  updateUserProfile,
} from "@shared/lib/userSettings/client";
import { resolveUserSettingsAppContext } from "@shared/lib/userSettings/context";
import type {
  SaveUserSignupStepInput,
  UpdateUserPreferencesInput,
  UpdateUserProfileInput,
  UserSettingsAppContext,
} from "@shared/lib/userSettings/types";
import { getUserSettingsQueryKey } from "./useUserSettings";

function useInvalidateUserSettings(appContext?: Partial<UserSettingsAppContext> | null) {
  const queryClient = useQueryClient();
  const resolved = resolveUserSettingsAppContext(appContext);

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getUserSettingsQueryKey(resolved) }),
      queryClient.invalidateQueries({ queryKey: ["user-data"] }),
    ]);
  };
}

export function useUpdateUserProfileMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: (input: UpdateUserProfileInput) => updateUserProfile(input, resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useUpdateUserPreferencesMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: (input: UpdateUserPreferencesInput) => updateUserPreferences(input, resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useStartUserSignupMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: () => startUserSignup(resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useSaveUserSignupStepMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: (input: SaveUserSignupStepInput) => saveUserSignupStep(input, resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useResetUserSignupMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: () => resetUserSignup(resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useCompleteUserSignupMutation(appContext?: Partial<UserSettingsAppContext> | null) {
  const invalidate = useInvalidateUserSettings(appContext);
  const resolved = resolveUserSettingsAppContext(appContext);

  return useMutation({
    mutationFn: () => completeUserSignup(resolved),
    onSuccess: async () => {
      await invalidate();
    },
  });
}
