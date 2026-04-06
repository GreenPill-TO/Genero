/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import React from "react";
import OTPForm from "./OTPForm";

afterEach(cleanup);

describe("OTPForm", () => {
  it("marks the auth contact input as an email field before OTP is sent", () => {
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

    const emailInput = screen.getByRole("textbox", { name: /email address/i });
    expect(emailInput.getAttribute("type")).toBe("email");
    expect(emailInput.getAttribute("name")).toBe("email");
    expect(emailInput.getAttribute("autocomplete")).toBe("email");
    expect(emailInput.getAttribute("inputmode")).toBe("email");
    expect(emailInput.hasAttribute("pattern")).toBe(false);
    expect(emailInput.className).toContain("bg-white");
    expect(emailInput.className).toContain("border-slate-300");
    expect(emailInput.className).toContain("placeholder:text-slate-500");
  });

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
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears the OTP digits when a resend reset key changes", () => {
    const setPasscode = vi.fn();
    const { rerender } = render(
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

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });
    expect((inputs[0] as HTMLInputElement).value).toBe("1");
    expect((inputs[1] as HTMLInputElement).value).toBe("2");

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

    const resetInputs = screen.getAllByRole("textbox");
    resetInputs.forEach((input) => {
      expect((input as HTMLInputElement).value).toBe("");
    });
  });
});
