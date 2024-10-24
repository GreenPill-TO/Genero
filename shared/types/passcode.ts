import { ApiError } from "next/dist/server/api-utils";

export type TPasscodeMutationParams = {
  onSuccessCallback: (data?: any) => void;
  onErrorCallback: (error: ApiError) => void;
};

export type TSendPasscodeInput = {
  contact: string;
  method: "phone" | "email";
};

export type TVerifyPasscodeInput = {
  contact: string;
  method: "phone" | "email";
  passcode: string;
};
