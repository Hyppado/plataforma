"use client";

/**
 * app/components/avatar-video/StepAvatarSelect.tsx
 *
 * Step 2 of the avatar video wizard — avatar selection.
 *
 * The user can choose between:
 *   1. A pre-built avatar from the admin gallery
 *   2. Uploading their own reference image (used as visual style reference)
 *
 * On "Continuar":
 *   - Gallery mode: PATCHes the creation with { avatarId }
 *   - Upload mode: POSTs the file to the upload route, then PATCHes with the
 *     returned blob URL
 *
 * Calls `onContinue()` after saving, or `onBack()` for navigation back.
 */

import { useState, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  CheckCircle,
  InfoOutlined,
  ArrowForward,
  ArrowBack,
  UploadFile,
  Close,
} from "@mui/icons-material";
import { useAvatarProfiles } from "@/lib/swr/useAvatarProfiles";
import type { CreationDTO, AvatarProfileDTO } from "@/lib/avatar-video/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "gallery" | "upload";

interface Props {
  creation: CreationDTO;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AvatarCard({
  avatar,
  selected,
  onSelect,
}: {
  avatar: AvatarProfileDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        border: "2px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        transition: "border-color 0.15s",
        position: "relative",
        background: "rgba(255,255,255,0.03)",
        "&:hover": {
          borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
        },
      }}
    >
      {/* Thumbnail */}
      <Box
        sx={{
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        <img
          src={avatar.thumbnailUrl ?? avatar.imageUrl}
          alt={avatar.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </Box>

      {/* Name */}
      <Typography
        sx={{
          fontSize: "0.65rem",
          textAlign: "center",
          px: 0.5,
          py: 0.75,
          color: selected ? "primary.main" : "rgba(255,255,255,0.7)",
          fontWeight: selected ? 600 : 400,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {avatar.name}
      </Typography>

      {/* Selection checkmark */}
      {selected && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.6)",
            lineHeight: 0,
          }}
        >
          <CheckCircle sx={{ fontSize: 18, color: "primary.main" }} />
        </Box>
      )}
    </Box>
  );
}

function AvatarGallerySkeleton() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1.5,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Skeleton
            variant="rectangular"
            sx={{ aspectRatio: "1/1", width: "100%" }}
          />
          <Skeleton variant="text" sx={{ mt: 0.5, mx: 0.5 }} />
        </Box>
      ))}
    </Box>
  );
}

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.25,
        p: 1.5,
        borderRadius: 2,
        background: "rgba(45,212,255,0.06)",
        border: "1px solid rgba(45,212,255,0.15)",
      }}
    >
      <InfoOutlined
        sx={{ fontSize: 16, color: "primary.main", flexShrink: 0, mt: "1px" }}
      />
      <Typography
        sx={{
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.5,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepAvatarSelect({ creation, onContinue, onBack }: Props) {
  const { avatars, isLoading: loadingAvatars } = useAvatarProfiles();

  // Initialise mode from creation state
  const initialMode: Mode = creation.uploadedAvatarImageUrl
    ? "upload"
    : "gallery";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(
    creation.avatarProfileId ?? null,
  );

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // Could be an object URL (new file) or a Vercel Blob URL (existing)
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(
    creation.uploadedAvatarImageUrl ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (_: React.MouseEvent, next: Mode | null) => {
    if (next) setMode(next);
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
      if (!ALLOWED.includes(file.type)) {
        setSaveError("Formato inválido. Use JPG, PNG ou WEBP.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSaveError("A imagem deve ter no máximo 5 MB.");
        return;
      }

      setSaveError(null);
      // Revoke previous object URL to avoid memory leaks
      if (uploadedPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedPreviewUrl);
      }
      setUploadedFile(file);
      setUploadedPreviewUrl(URL.createObjectURL(file));
      // Selecting a file implicitly switches to upload mode
      setMode("upload");
      // Clear gallery selection so mutual exclusivity is obvious
      setSelectedAvatarId(null);
    },
    [uploadedPreviewUrl],
  );

  const handleSelectGalleryAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    // Clear upload selection so mutual exclusivity is obvious
    if (uploadedPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    setUploadedFile(null);
    setUploadedPreviewUrl(null);
  };

  const handleRemoveUpload = () => {
    if (uploadedPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    setUploadedFile(null);
    setUploadedPreviewUrl(null);
    setSaveError(null);
  };

  const canContinue =
    !saving && (mode === "gallery" ? !!selectedAvatarId : !!uploadedPreviewUrl);

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setSaveError(null);

    try {
      if (mode === "gallery") {
        const res = await fetch(`/api/avatar-video/creations/${creation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId: selectedAvatarId,
            uploadedAvatarImageUrl: null,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Erro ao salvar avatar");
        }
      } else {
        let avatarImageUrl = uploadedPreviewUrl;

        // Upload new file if user picked one (object URL = unsaved)
        if (uploadedFile) {
          const formData = new FormData();
          formData.append("file", uploadedFile);
          const uploadRes = await fetch(
            `/api/avatar-video/creations/${creation.id}/upload-avatar`,
            { method: "POST", body: formData },
          );
          if (!uploadRes.ok) {
            const data = (await uploadRes.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(data.error ?? "Erro ao fazer upload da imagem");
          }
          const body = (await uploadRes.json()) as {
            uploadedAvatarImageUrl: string;
          };
          avatarImageUrl = body.uploadedAvatarImageUrl;
        }

        const patchRes = await fetch(
          `/api/avatar-video/creations/${creation.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              avatarId: null,
              uploadedAvatarImageUrl: avatarImageUrl,
            }),
          },
        );
        if (!patchRes.ok) {
          const data = (await patchRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Erro ao salvar imagem");
        }
      }

      onContinue();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Header */}
      <Box>
        <Typography
          component="h2"
          sx={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#fff",
            mb: 0.25,
          }}
        >
          Escolha um avatar
        </Typography>
        <Typography
          sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
        >
          Defina a aparência do apresentador no vídeo
        </Typography>
      </Box>

      {/* Mode toggle */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        fullWidth
        sx={{
          "& .MuiToggleButton-root": {
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "none",
            color: "rgba(255,255,255,0.5)",
            borderColor: "rgba(255,255,255,0.12)",
            py: 0.75,
            "&.Mui-selected": {
              color: "primary.main",
              background: "rgba(45,212,255,0.08)",
              borderColor: "rgba(45,212,255,0.3)",
            },
          },
        }}
      >
        <ToggleButton value="gallery">Galeria de avatares</ToggleButton>
        <ToggleButton value="upload">Minha foto</ToggleButton>
      </ToggleButtonGroup>

      {/* ── Gallery mode ── */}
      {mode === "gallery" && (
        <>
          {loadingAvatars ? (
            <AvatarGallerySkeleton />
          ) : avatars.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: "center",
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.8125rem",
              }}
            >
              Nenhum avatar disponível no momento.
              <br />
              Use a opção{" "}
              <Box
                component="span"
                onClick={() => setMode("upload")}
                sx={{ color: "primary.main", cursor: "pointer" }}
              >
                Minha foto
              </Box>{" "}
              para continuar.
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1.5,
              }}
            >
              {avatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  selected={selectedAvatarId === avatar.id}
                  onSelect={() => handleSelectGalleryAvatar(avatar.id)}
                />
              ))}
            </Box>
          )}

          <InfoCallout>
            Os avatares são personagens digitais criados para representar o
            apresentador do vídeo. Nenhum rosto real é capturado ou reproduzido.
          </InfoCallout>
        </>
      )}

      {/* ── Upload mode ── */}
      {mode === "upload" && (
        <>
          {/* Dropzone / preview */}
          {uploadedPreviewUrl ? (
            <Box
              sx={{ position: "relative", borderRadius: 2, overflow: "hidden" }}
            >
              {/* Fixed-height contain container — no cropping */}
              <Box
                sx={{
                  width: "100%",
                  height: 160,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Box
                  component="img"
                  src={uploadedPreviewUrl}
                  alt="Pré-visualização da imagem enviada"
                  sx={{
                    maxWidth: "100%",
                    maxHeight: 160,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </Box>
              <Box
                component="button"
                type="button"
                onClick={handleRemoveUpload}
                aria-label="Remover imagem"
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.65)",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  "&:hover": { background: "rgba(0,0,0,0.85)" },
                }}
              >
                <Close sx={{ fontSize: 16, color: "#fff" }} />
              </Box>
            </Box>
          ) : (
            <Box
              component="button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              sx={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                p: 4,
                border: "2px dashed rgba(45,212,255,0.25)",
                borderRadius: 2,
                textAlign: "center",
                transition: "border-color 0.15s, background 0.15s",
                "&:hover": {
                  borderColor: "rgba(45,212,255,0.5)",
                  background: "rgba(45,212,255,0.04)",
                },
              }}
            >
              <UploadFile
                sx={{ fontSize: 36, color: "primary.main", opacity: 0.8 }}
              />
              <Typography
                sx={{ fontSize: "0.8125rem", color: "#fff", fontWeight: 600 }}
              >
                Clique para selecionar uma imagem
              </Typography>
              <Typography
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}
              >
                JPG, PNG ou WEBP · máx. 5 MB
              </Typography>
            </Box>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Upload button if a preview is set but we want to allow re-select */}
          {uploadedPreviewUrl && (
            <Button
              variant="text"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              sx={{
                fontSize: "0.75rem",
                color: "primary.main",
                textTransform: "none",
                alignSelf: "flex-start",
              }}
            >
              Trocar imagem
            </Button>
          )}

          <InfoCallout>
            A imagem enviada é usada como{" "}
            <Box component="strong" sx={{ color: "rgba(255,255,255,0.85)" }}>
              referência visual de estilo
            </Box>{" "}
            para a geração do vídeo. Nenhum dado biométrico é extraído ou
            armazenado. A IA não garante reprodução exata de aparência.
          </InfoCallout>
        </>
      )}

      {/* Error message */}
      {saveError && (
        <Box
          role="alert"
          sx={{
            p: 1.5,
            borderRadius: 2,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
            fontSize: "0.8125rem",
          }}
        >
          {saveError}
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
        <Button
          variant="contained"
          disabled={!canContinue}
          onClick={handleContinue}
          endIcon={
            saving ? (
              <CircularProgress size={16} sx={{ color: "inherit" }} />
            ) : (
              <ArrowForward />
            )
          }
          sx={{
            fontWeight: 700,
            textTransform: "none",
            py: 1.25,
            background: "linear-gradient(135deg, #2DD4FF 0%, #00B8E6 100%)",
            color: "#000",
            "&:hover": {
              background: "linear-gradient(135deg, #6BE0FF 0%, #2DD4FF 100%)",
            },
            "&.Mui-disabled": {
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.25)",
            },
          }}
        >
          {saving ? "Salvando…" : "Continuar"}
        </Button>

        <Button
          variant="outlined"
          onClick={onBack}
          startIcon={<ArrowBack />}
          sx={{
            fontWeight: 600,
            textTransform: "none",
            py: 1,
            borderColor: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.7)",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          Voltar
        </Button>
      </Box>
    </Box>
  );
}
