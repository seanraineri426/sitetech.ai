// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LoginForm } from "../login-form";

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

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (process.env as Record<string, unknown>).NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED;
  });

  afterEach(() => {
    cleanup();
  });

  describe("Microsoft sign-in button visibility", () => {
    it("hides Microsoft button when flag is not set", () => {
      render(<LoginForm />);
      
      expect(screen.queryByRole("button", { name: /microsoft/i })).not.toBeInTheDocument();
    });

    it("hides Microsoft button when flag is false", () => {
      process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED = "false";
      render(<LoginForm />);
      
      expect(screen.queryByRole("button", { name: /microsoft/i })).not.toBeInTheDocument();
    });

    it("shows Microsoft button when flag is true", () => {
      process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED = "true";
      render(<LoginForm />);
      
      expect(screen.getByRole("button", { name: /microsoft/i })).toBeInTheDocument();
    });
  });

  describe("magic link no-enumeration", () => {
    it("shows success message without revealing if email exists", async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null });
      (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          signInWithOtp: mockSignInWithOtp,
          signInWithOAuth: vi.fn(),
        },
      });

      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole("button", { name: /send magic link/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/check your email for a sign-in link/i)).toBeInTheDocument();
      });
    });

    it("shows generic error message on failure without enumeration", async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const mockSignInWithOtp = vi.fn().mockResolvedValue({ 
        error: { message: "User not found" } 
      });
      (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          signInWithOtp: mockSignInWithOtp,
          signInWithOAuth: vi.fn(),
        },
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
      const { createClient } = await import("@/lib/supabase/client");
      const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null });
      (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          signInWithOtp: mockSignInWithOtp,
          signInWithOAuth: vi.fn(),
        },
      });

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
