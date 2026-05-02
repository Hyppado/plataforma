/**
 * Tests: AvatarPromptsSection — admin-editable AI prompt editor component
 *
 * Covers:
 * - Initial loading state
 * - Loaded state: all 3 card titles rendered
 * - Read-only status shown by default
 * - Entering edit mode on a single card
 * - Editing text and tracking changes
 * - Undo functionality
 * - Restore default button
 * - Missing required variable warning + disabled save
 * - Cancel exits edit mode without saving
 * - Successful save flow
 * - Save error handling
 * - Load error renders Alert
 * - Variable chips show Portuguese labels with ★ for required
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvatarPromptsSection } from "@/app/components/admin/avatar-video/AvatarPromptsSection";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/admin/admin-client", () => ({
  getPromptConfig: vi.fn(),
  updatePromptConfig: vi.fn(),
}));

vi.mock("@/lib/admin/config-defaults", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/admin/config-defaults")>();
  return {
    ...original,
    getDefaultAvatarVideoPrompts: vi.fn(() => ({
      image:
        "{{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}",
      veoSystem: "You are an expert. Return JSON.",
      veoUser:
        "Product: {{product_name}}{{product_category}} Style: {{style_description}} {{style_label}} Total: {{total}}\n{{part_descriptions}}",
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { getPromptConfig, updatePromptConfig } =
  await import("@/lib/admin/admin-client");

const FAKE_CONFIG = {
  avatarVideo: {
    image:
      "{{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}",
    veoSystem: "You are an expert. Return JSON.",
    veoUser:
      "Product: {{product_name}}{{product_category}} Style: {{style_description}} {{style_label}} Total: {{total}}\n{{part_descriptions}}",
  },
  insight: {
    template: "{{transcript_text}} {{product_name}} {{product_category}}",
    settings: {},
  },
  script: {
    template: "{{transcript_text}} {{product_name}} {{product_category}}",
    settings: {},
  },
};

function setup() {
  const user = userEvent.setup();
  render(<AvatarPromptsSection />);
  return { user };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AvatarPromptsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPromptConfig).mockResolvedValue(
      FAKE_CONFIG as Parameters<typeof getPromptConfig>[0] extends never
        ? never
        : Awaited<ReturnType<typeof getPromptConfig>>,
    );
    vi.mocked(updatePromptConfig).mockResolvedValue(undefined);
  });

  it("renders a loading spinner initially", () => {
    setup();
    // MUI CircularProgress renders a role="progressbar"
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows all 3 card titles after loading", async () => {
    setup();
    await waitFor(() => {
      expect(
        screen.getByText("Geração da imagem do influencer"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Instrução de sistema para o VEO 3.1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Instrução de usuário para o VEO 3.1"),
    ).toBeInTheDocument();
  });

  it("renders 3 'Editar prompt' buttons in read-only state", async () => {
    setup();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Editar prompt/i }),
      ).toHaveLength(3),
    );
  });

  it("shows 'Somente leitura' chip for all cards in default state", async () => {
    setup();
    await waitFor(() => {
      // Each card renders the label in both the Chip and an overlay on the textarea,
      // so there are at least 3 occurrences (one per card).
      const instances = screen.getAllByText("Somente leitura");
      expect(instances.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("clicking 'Editar prompt' switches a card to edit mode", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    const editButtons = screen.getAllByRole("button", {
      name: /Editar prompt/i,
    });
    await user.click(editButtons[0]!);

    // Status chip changes to "Editando"
    expect(screen.getByText("Editando")).toBeInTheDocument();
    // "Cancelar" and "Salvar" buttons appear
    expect(
      screen.getByRole("button", { name: /Cancelar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar/i })).toBeInTheDocument();
  });

  it("other cards remain read-only while one card is being edited", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    // Click "Editar prompt" for first card
    const editButtons = screen.getAllByRole("button", {
      name: /Editar prompt/i,
    });
    await user.click(editButtons[0]!);

    // Should still have 2 more "Editar prompt" buttons (the other 2 cards)
    expect(
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    ).toHaveLength(2);
  });

  it("cancel exits edit mode and reverts draft", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    const editButtons = screen.getAllByRole("button", {
      name: /Editar prompt/i,
    });
    await user.click(editButtons[0]!);

    // Type something
    const textareas = screen.getAllByRole("textbox");
    await user.type(textareas[0]!, " EXTRA_TEXT");

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    // Should be back to 3 "Editar prompt" buttons, updatePromptConfig not called
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Editar prompt/i }),
      ).toHaveLength(3),
    );
    expect(updatePromptConfig).not.toHaveBeenCalled();
  });

  it("undo button is disabled when no changes have been made", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[0]!,
    );

    // Undo button should be disabled (history empty)
    const undoBtn = screen.getByRole("button", { name: /Desfazer \(0\)/i });
    expect(undoBtn).toBeDisabled();
  });

  it("undo count increments as user types", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[0]!,
    );

    const textareas = screen.getAllByRole("textbox");
    // Each keystroke adds to undo history via onChange handler
    await user.type(textareas[0]!, "A");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Desfazer \(1\)/i }),
      ).toBeInTheDocument();
    });
  });

  it("clicking undo restores previous draft and decrements counter", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[0]!,
    );
    const textareas = screen.getAllByRole("textbox");
    await user.type(textareas[0]!, "X");

    const undoBtn1 = screen.getByRole("button", { name: /Desfazer \(1\)/i });
    await user.click(undoBtn1);

    // History should be back to 0
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Desfazer \(0\)/i }),
      ).toBeInTheDocument(),
    );
  });

  it("missing required variable shows warning alert and disables save", async () => {
    const configMissingRequired = {
      ...FAKE_CONFIG,
      avatarVideo: {
        ...FAKE_CONFIG.avatarVideo,
        // Remove required {{subject_block}} from image prompt
        image:
          "{{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}",
      },
    };
    vi.mocked(getPromptConfig).mockResolvedValue(
      configMissingRequired as Awaited<ReturnType<typeof getPromptConfig>>,
    );

    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[0]!,
    );

    // The save button should be disabled since required var is missing
    const saveBtn = screen.getByRole("button", { name: /Salvar/i });
    expect(saveBtn).toBeDisabled();

    // Warning alert appears ("Para salvar, mantenha as variáveis obrigatórias...")
    expect(
      screen.getByText(/Para salvar, mantenha as variáveis obrigatórias/),
    ).toBeInTheDocument();
  });

  it("save calls updatePromptConfig and shows 'Salvo' chip", async () => {
    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    // Edit the veoSystem card (no required variables — simpler to test)
    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[1]!,
    );

    const textareas = screen.getAllByRole("textbox");
    await user.type(textareas[1]!, " EXTRA");

    const saveBtn = screen.getByRole("button", { name: /Salvar/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updatePromptConfig).toHaveBeenCalledOnce();
    });

    // After save, "Salvo" chip appears
    await waitFor(() => {
      expect(screen.getByText("Salvo")).toBeInTheDocument();
    });
  });

  it("save error shows error alert and remains in edit mode", async () => {
    vi.mocked(updatePromptConfig).mockRejectedValue(new Error("Network error"));

    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    // Edit veoSystem (no required vars)
    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[1]!,
    );
    const textareas = screen.getAllByRole("textbox");
    await user.type(textareas[1]!, " SOMETHING");

    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Still in edit mode
    expect(
      screen.getByRole("button", { name: /Cancelar/i }),
    ).toBeInTheDocument();
  });

  it("shows error Alert when getPromptConfig fails to load", async () => {
    vi.mocked(getPromptConfig).mockRejectedValue(new Error("Load failed"));

    setup();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Geração da imagem do influencer"),
    ).not.toBeInTheDocument();
  });

  it("shows step labels Etapa 1, Etapa 2, Etapa 3", async () => {
    setup();
    await waitFor(() => screen.getByText("Geração da imagem do influencer"));

    // Each card renders its step prefix
    expect(screen.getByText(/Etapa 1/)).toBeInTheDocument();
    expect(screen.getByText(/Etapa 2/)).toBeInTheDocument();
    expect(screen.getByText(/Etapa 3/)).toBeInTheDocument();
  });

  it("variable chips show Portuguese labels with ★ for required", async () => {
    setup();
    await waitFor(() => screen.getByText("Geração da imagem do influencer"));

    // "Sujeito ★" — required variable (getByText would fail when multiple chips show ★)
    expect(screen.getAllByText(/Sujeito/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/★/).length).toBeGreaterThan(0);
    // "Produto" chip exists
    expect(screen.getAllByText(/Produto/).length).toBeGreaterThan(0);
  });

  it("'Restaurar padrão' resets draft to default value", async () => {
    const customImage =
      "CUSTOM {{subject_block}} {{product_block}} {{placement_block}} POSE: {{pose}} ENV: {{environment}}";
    vi.mocked(getPromptConfig).mockResolvedValue({
      ...FAKE_CONFIG,
      avatarVideo: { ...FAKE_CONFIG.avatarVideo, image: customImage },
    } as Awaited<ReturnType<typeof getPromptConfig>>);

    const { user } = setup();
    await waitFor(() =>
      screen.getAllByRole("button", { name: /Editar prompt/i }),
    );

    await user.click(
      screen.getAllByRole("button", { name: /Editar prompt/i })[0]!,
    );

    const restoreBtn = screen.getByRole("button", {
      name: /Restaurar padrão/i,
    });
    await user.click(restoreBtn);

    // The default image prompt does NOT include "CUSTOM"
    const textareas = screen.getAllByRole("textbox");
    expect((textareas[0] as HTMLTextAreaElement).value).not.toContain("CUSTOM");
  });
});
