import { Fragment } from "react";
import type { PropsWithChildren } from "react";

export class WebAuthnCrypto {
  async decryptString(): Promise<string> {
    throw new Error("WebAuthnCrypto is unavailable in the current environment.");
  }

  async encryptString(): Promise<string> {
    throw new Error("WebAuthnCrypto is unavailable in the current environment.");
  }
}

export const WalletCubidProvider = ({ children }: PropsWithChildren) => {
  return <Fragment>{children}</Fragment>;
};

export const WalletComponent = WalletCubidProvider;
