/**
 * Tests: app/login/page.tsx
 *
 * Covers: form renders, inputs respond to typing, submit triggers signIn,
 * error message shown on failed login, password visibility toggle.
 * signIn is mocked — no network calls.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signIn } from "next-auth/react";

// LoginPage uses ThemeProvider internally — import it directly
import LoginPage from "@/app/login/page";

// ---------------------------------------------------------------------------
// Helper — delete window.location so we can spy on assignments
// ---------------------------------------------------------------------------
const mockHref = vi.fn();
beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "" },
  });
  Object.defineProperty(window.location, "href", {
    set: mockHref,
    get: () => "/",
    configurable: true,
  });
});

describe("LoginPage", () => {
  it("renders email and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    // password input: find by id — aria-label "Mostrar senha" also matches /senha/i
    expect(document.getElementById("password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("accepts email input", async () => {
    render(<LoginPage />);
    const email = screen.getByRole("textbox", { name: /email/i });
    await userEvent.type(email, "user@hyppado.com");
    expect(email).toHaveValue("user@hyppado.com");
  });

  it("accepts password input", async () => {
    render(<LoginPage />);
    // Use the HTML id directly to avoid matching "Mostrar senha" toggle button
    const password = document.getElementById("password") as HTMLInputElement;
    await userEvent.type(password, "mypassword");
    expect(password).toHaveValue("mypassword");
  });

  it("toggles password visibility", async () => {
    render(<LoginPage />);
    // Use id selector — aria-label "Mostrar senha" also matches /senha/i
    const password = document.getElementById("password") as HTMLInputElement;
    expect(password).toHaveAttribute("type", "password");

    // Find the toggle button (has Visibility icon)
    const toggleBtn = screen.getByLabelText(/mostrar senha|toggle password/i);
    if (toggleBtn) {
      await userEvent.click(toggleBtn);
      expect(password).toHaveAttribute("type", "text");
    }
  });

  it("calls signIn with credentials on submit", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({
      ok: true,
      error: null,
      status: 200,
      url: null,
    });

    render(<LoginPage />);

    await userEvent.type(
      screen.getByRole("textbox", { name: /email/i }),
      "user@hyppado.com",
    );
    await userEvent.type(
      document.getElementById("password") as HTMLInputElement,
      "password123",
    );
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "user@hyppado.com",
        password: "password123",
        redirect: false,
      });
    });
  });

  it("shows error message when signIn returns an error", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    });

    render(<LoginPage />);

    await userEvent.type(
      screen.getByRole("textbox", { name: /email/i }),
      "wrong@email.com",
    );
    await userEvent.type(
      document.getElementById("password") as HTMLInputElement,
      "wrongpassword",
    );
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/email ou senha incorretos/i),
      ).toBeInTheDocument();
    });
  });

  it("does NOT show error on initial render", () => {
    render(<LoginPage />);
    expect(
      screen.queryByText(/email ou senha incorretos/i),
    ).not.toBeInTheDocument();
  });
});
