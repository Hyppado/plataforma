"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              textAlign: "center",
              padding: "32px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: "64px",
                marginBottom: "16px",
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                color: "white",
                fontWeight: 600,
                marginBottom: "8px",
                fontSize: "24px",
              }}
            >
              Erro crítico
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                marginBottom: "24px",
                fontSize: "16px",
              }}
            >
              Ocorreu um erro inesperado. Tente novamente ou entre em contato
              com o suporte.
              {error.digest && (
                <span
                  style={{
                    display: "block",
                    marginTop: "8px",
                    fontSize: "12px",
                    opacity: 0.5,
                  }}
                >
                  Ref: {error.digest}
                </span>
              )}
            </p>
            <button
              onClick={reset}
              style={{
                background: "linear-gradient(135deg, #2DD4FF 0%, #1E90FF 100%)",
                color: "white",
                fontWeight: 600,
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
