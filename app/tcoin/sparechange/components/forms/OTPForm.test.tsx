/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import OTPForm from "./OTPForm";

describe("OTPForm", () => {
  it("renders six inputs and handles typing and pasting", () => {
    const setPasscode = vi.fn();
    const { getAllByRole } = render(
      <OTPForm
        authMethod="email"
        countryCode="+1"
        contact="test@example.com"
        passcode=""
        setCountryCode={() => {}}
        setContact={() => {}}
        setPasscode={setPasscode}
        onSubmit={vi.fn()}
        onResend={vi.fn()}
        canResend={true}
        isOtpSent={true}
        errorMessage={null}
        handleAuthMethodChange={() => {}}
      />
    );

    const inputs = getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
    expect(document.activeElement).toBe(inputs[0]);

    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(setPasscode).toHaveBeenLastCalledWith("1");
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "123456" },
    } as any);
    expect(setPasscode).toHaveBeenLastCalledWith("123456");
  });
});
