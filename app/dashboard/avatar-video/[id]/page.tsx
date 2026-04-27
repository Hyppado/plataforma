"use client";

import { useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Box,
  Typography,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { Videocam } from "@mui/icons-material";
import { useAvatarVideoCreation } from "@/lib/swr/useAvatarVideoCreation";
import {
  StepProductConfirm,
  StepProductConfirmSkeleton,
} from "@/app/components/avatar-video/StepProductConfirm";
import { StepAvatarSelect } from "@/app/components/avatar-video/StepAvatarSelect";

// ── Step definitions ────────────────────────────────────────────
const STEPS = ["Produto", "Avatar", "Cenário", "Imagem", "Roteiro"];

// ── Placeholder for future steps ───────────────────────────────
function StepPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        py: 6,
        color: "rgba(255,255,255,0.35)",
        textAlign: "center",
      }}
    >
      <Videocam sx={{ fontSize: 48, opacity: 0.3 }} />
      <Typography sx={{ fontSize: "0.95rem" }}>
        Etapa <strong>{label}</strong> em desenvolvimento
      </Typography>
    </Box>
  );
}

function AvatarVideoCreationContent() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : null;

  const { creation, isLoading, error, mutate } = useAvatarVideoCreation(id);

  const [step, setStep] = useState(0); // 0-indexed; 0 = product confirm

  const handleContinue = () =>
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleChangeProduct = () => router.back();
  const handleCancel = () => router.push("/dashboard/trends");

  const handleAvatarContinue = async () => {
    await mutate(); // refresh creation so subsequent steps see updated avatar fields
    setStep(2);
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Page header */}
      <Box sx={{ flexShrink: 0, mb: 3 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#fff",
            mb: 0.25,
            lineHeight: 1.3,
          }}
        >
          Criar vídeo com avatar
        </Typography>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Siga as etapas para gerar imagens de referência e roteiro
        </Typography>
      </Box>

      {/* Stepper */}
      <Box sx={{ flexShrink: 0, mb: 2 }}>
        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            "& .MuiStepLabel-label": {
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.7rem",
              mt: 0.5,
            },
            "& .MuiStepLabel-label.Mui-active": {
              color: "primary.main",
              fontWeight: 700,
            },
            "& .MuiStepLabel-label.Mui-completed": {
              color: "rgba(255,255,255,0.6)",
            },
            "& .MuiStepIcon-root": {
              color: "rgba(255,255,255,0.12)",
            },
            "& .MuiStepIcon-root.Mui-active": {
              color: "primary.main",
            },
            "& .MuiStepIcon-root.Mui-completed": {
              color: "rgba(45,212,255,0.5)",
            },
            "& .MuiStepConnector-line": {
              borderColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step content */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          pb: 2,
        }}
      >
        {/* Error state */}
        {error && (
          <Box
            role="alert"
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 2,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              fontSize: "0.8125rem",
              maxWidth: 480,
              mx: "auto",
            }}
          >
            {error}
          </Box>
        )}

        {/* Loading state */}
        {isLoading && (
          <Box
            sx={{
              maxWidth: 480,
              mx: "auto",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(45,212,255,0.08)",
              borderRadius: 4,
              p: 4,
            }}
          >
            <StepProductConfirmSkeleton />
          </Box>
        )}

        {/* Step 0 — Product confirmation */}
        {!isLoading && !error && creation && step === 0 && (
          <Box
            sx={{
              maxWidth: 480,
              mx: "auto",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(45,212,255,0.08)",
              borderRadius: 4,
              p: { xs: 3, sm: 4 },
            }}
          >
            <StepProductConfirm
              creation={creation}
              onContinue={handleContinue}
              onChangeProduct={handleChangeProduct}
              onCancel={handleCancel}
            />
          </Box>
        )}

        {/* Step 1 — Avatar selection */}
        {!isLoading && !error && creation && step === 1 && (
          <Box
            sx={{
              maxWidth: 480,
              mx: "auto",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(45,212,255,0.08)",
              borderRadius: 4,
              p: { xs: 3, sm: 4 },
            }}
          >
            <StepAvatarSelect
              creation={creation}
              onContinue={handleAvatarContinue}
              onBack={() => setStep(0)}
            />
          </Box>
        )}

        {/* Steps 2+ — Placeholder */}
        {!isLoading && !error && creation && step > 1 && (
          <Box
            sx={{
              maxWidth: 480,
              mx: "auto",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(45,212,255,0.08)",
              borderRadius: 4,
              p: { xs: 3, sm: 4 },
            }}
          >
            <StepPlaceholder label={STEPS[step]} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function AvatarVideoCreationPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={32} sx={{ color: "primary.main" }} />
        </Box>
      }
    >
      <AvatarVideoCreationContent />
    </Suspense>
  );
}
