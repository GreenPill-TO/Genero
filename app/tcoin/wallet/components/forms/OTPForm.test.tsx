/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import React from "react";
import OTPForm from "./OTPForm";

afterEach(cleanup);

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

  it("calls onResend when the link is clicked", () => {
    const onResend = vi.fn();
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
        onResend={onResend}
        canResend={true}
        isOtpSent={true}
        errorMessage={null}
        handleAuthMethodChange={() => {}}
      />
    );

    fireEvent.click(screen.getByText("Resend Code"));
    expect(onResend).toHaveBeenCalled();
  });

  it("auto-submits after six digits", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <OTPForm
        authMethod="email"
        countryCode="+1"
        contact="test@example.com"
        passcode=""
        setCountryCode={() => {}}
        setContact={() => {}}
        setPasscode={() => {}}
        onSubmit={onSubmit}
        onResend={vi.fn()}
        canResend={true}
        isOtpSent={true}
        errorMessage={null}
        handleAuthMethodChange={() => {}}
      />
    );
    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input, idx) => {
      fireEvent.change(input, { target: { value: String(idx) } });
    });
    expect(onSubmit).toHaveBeenCalled();
  });
});
