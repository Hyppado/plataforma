"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Check as CheckIcon, Save as SaveIcon } from "@mui/icons-material";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const DEFAULT_POLICY = `Política de Privacidade — Hyppado

Última atualização: ${new Date().toLocaleDateString("pt-BR")}

1. INFORMAÇÕES QUE COLETAMOS
Coletamos informações que você nos fornece diretamente ao criar uma conta, como nome e endereço de e-mail.

2. USO DAS INFORMAÇÕES
Utilizamos suas informações para fornecer, manter e melhorar nossos serviços, processar transações e enviar comunicações relacionadas ao serviço.

3. COMPARTILHAMENTO DE INFORMAÇÕES
Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto conforme descrito nesta política ou com seu consentimento.

4. COOKIES
Utilizamos cookies e tecnologias similares para melhorar sua experiência, lembrar suas preferências e analisar o uso do serviço.

5. SEGURANÇA
Adotamos medidas técnicas e organizacionais adequadas para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.

6. SEUS DIREITOS (LGPD)
Você tem o direito de acessar, corrigir ou excluir seus dados pessoais, bem como revogar o consentimento a qualquer momento. Entre em contato pelo suporte para exercer esses direitos.

7. CONTATO
Para dúvidas sobre esta política, entre em contato conosco através do nosso canal de suporte.`;

export function PrivacyPolicySection() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/privacy-policy");
      if (res.ok) {
        const data = await res.json();
        setText(data.text || DEFAULT_POLICY);
      }
    } catch {
      setText(DEFAULT_POLICY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/privacy-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = () => {
    setText(DEFAULT_POLICY);
    setSaved(false);
  };

  return (
    <Grid item xs={12}>
      <Card sx={cardStyle}>
        <CardHeader
          title={
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
              Política de Privacidade
            </Typography>
          }
          subheader={
            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5 }}
            >
              Texto exibido na página pública{" "}
              <Box
                component="a"
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                /privacidade
              </Box>
            </Typography>
          }
        />
        <CardContent>
          <TextField
            fullWidth
            multiline
            minRows={16}
            value={loading ? "" : text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            disabled={loading || saving}
            placeholder="Escreva a política de privacidade aqui..."
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "rgba(255,255,255,0.85)",
                fontFamily: "monospace",
                fontSize: 13,
                background: "rgba(0,0,0,0.25)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.25)" },
                "&.Mui-focused fieldset": { borderColor: "primary.main" },
              },
            }}
          />
          <Stack
            direction="row"
            spacing={2}
            sx={{ mt: 2 }}
            justifyContent="flex-end"
          >
            <Button
              size="small"
              variant="outlined"
              onClick={restoreDefault}
              disabled={loading || saving}
              sx={{
                color: "rgba(255,255,255,0.5)",
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              Restaurar padrão
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={save}
              disabled={loading || saving}
              startIcon={saved ? <CheckIcon /> : <SaveIcon />}
              color={saved ? "success" : "primary"}
            >
              {saved ? "Salvo!" : "Salvar"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
