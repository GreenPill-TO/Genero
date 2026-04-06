/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import OTPForm from "./OTPForm";

describe("OTPForm", () => {
  it("uses the higher-contrast email field surface before OTP is sent", () => {
    render(
      <OTPForm
        authMethod="email"
        countryCode="+1"
        contact="test@example.com"
        passcode=""
        setCountryCode={() => {}}
        setContact={() => {}}
        setPasscode={() => {}}
        onSubmit={vi.fn()}
        onResend={vi.fn()}
        canResend={true}
        isOtpSent={false}
        errorMessage={null}
        handleAuthMethodChange={() => {}}
      />
    );

    const emailInput = screen.getByPlaceholderText("Enter your email");
    expect(emailInput.hasAttribute("pattern")).toBe(false);
    expect(emailInput.className).toContain("bg-white");
    expect(emailInput.className).toContain("border-slate-300");
  });

  it("renders six inputs and handles typing and pasting", () => {
    const setPasscode = vi.fn();
    const { container } = render(
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

    const inputs = Array.from(container.querySelectorAll('input[inputmode="numeric"]'));
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

  it("clears entered digits when the resend reset key changes", () => {
    const setPasscode = vi.fn();
    const { container, rerender } = render(
      <OTPForm
        authMethod="email"
        countryCode="+1"
        contact="test@example.com"
        passcode=""
        otpResetKey={0}
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

    const inputs = Array.from(container.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });
    expect(inputs[0].value).toBe("1");
    expect(inputs[1].value).toBe("2");

    rerender(
      <OTPForm
        authMethod="email"
        countryCode="+1"
        contact="test@example.com"
        passcode=""
        otpResetKey={1}
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

    const resetInputs = Array.from(container.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];
    resetInputs.forEach((input) => {
      expect(input.value).toBe("");
    });
  });
});
