// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Hoist mocks for dynamic flag control
const mocks = vi.hoisted(() => ({ flag: false }));

// Mock dependencies
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/env.public", () => ({
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  get NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED() {
    return mocks.flag;
  },
}));

vi.mock("../actions", () => ({
  signInWithMagicLink: vi.fn(),
}));

import { LoginForm } from "../login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Microsoft sign-in button visibility", () => {
    it("hides Microsoft button when flag is false", () => {
      mocks.flag = false;
      const { unmount } = render(<LoginForm />);
      
      expect(screen.queryByRole("button", { name: /microsoft/i })).not.toBeInTheDocument();
      unmount();
    });

    it("shows Microsoft button when flag is true", () => {
      mocks.flag = true;
      const { unmount } = render(<LoginForm />);
      
      expect(screen.getByRole("button", { name: /microsoft/i })).toBeInTheDocument();
      unmount();
    });
  });

  describe("magic link no-enumeration", () => {
    it("shows success message without revealing if email exists", async () => {
      const { signInWithMagicLink } = await import("../actions");
      vi.mocked(signInWithMagicLink).mockResolvedValue({ success: true });

      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole("button", { name: /send magic link/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/check your email for a sign-in link/i)).toBeInTheDocument();
      });
      
      // Verify it was called with email and next param
      expect(signInWithMagicLink).toHaveBeenCalledWith("test@example.com", null);
    });

    it("shows generic error message on failure without enumeration", async () => {
      const { signInWithMagicLink } = await import("../actions");
      vi.mocked(signInWithMagicLink).mockResolvedValue({ 
        error: "We couldn't send the email. Please try again." 
      });

      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole("button", { name: /send magic link/i });

      fireEvent.change(emailInput, { target: { value: "nonexistent@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/we couldn't send the email/i)).toBeInTheDocument();
      });

      // Verify the message is generic and doesn't say "user not found"
      expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/doesn't exist/i)).not.toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("prevents submission with empty email via HTML5 validation", async () => {
      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      const submitButton = screen.getByRole("button", { name: /send magic link/i }) as HTMLButtonElement;

      // HTML5 required attribute should prevent submission
      expect(emailInput.required).toBe(true);
      expect(submitButton.type).toBe("submit");
    });

    it("clears email input after successful submission", async () => {
      const { signInWithMagicLink } = await import("../actions");
      vi.mocked(signInWithMagicLink).mockResolvedValue({ success: true });

      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      const submitButton = screen.getByRole("button", { name: /send magic link/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput.value).toBe("");
      });
    });
  });
});
