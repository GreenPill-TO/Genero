import { TPasscodeMutationParams, TSendPasscodeInput, TVerifyPasscodeInput } from "@shared/types/passcode";
import { useMutation } from "@tanstack/react-query";
import { sendPasscode, verifyPasscode } from "../services/supabaseService";

// Custom hook for sending the passcode
export const useSendPasscodeMutation = (params: TPasscodeMutationParams) => {
  return useMutation({
    mutationFn: (input: TSendPasscodeInput) => sendPasscode({ contact: input.contact, method: input.method }),
    onSuccess: params.onSuccessCallback,
    onError: params.onErrorCallback,
  });
};

// Custom hook for verifying the passcode
export const useVerifyPasscodeMutation = (params: TPasscodeMutationParams) => {
  return useMutation({
    mutationFn: (input: TVerifyPasscodeInput) => verifyPasscode({ contact: input.contact, method: input.method, passcode: input.passcode }),
    onSuccess: params.onSuccessCallback,
    onError: params.onErrorCallback,
  });
};
