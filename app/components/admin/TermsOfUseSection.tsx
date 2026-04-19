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

const DEFAULT_TERMS = `Termos de Uso — Hyppado

Última atualização: ${new Date().toLocaleDateString("pt-BR")}

1. ACEITAÇÃO DOS TERMOS
Ao acessar ou usar a plataforma Hyppado, você concorda com estes Termos de Uso. Se você não concordar, não utilize o serviço.

2. DESCRIÇÃO DO SERVIÇO
A Hyppado é uma plataforma de inteligência para TikTok Shop que permite descobrir vídeos, produtos e criadores em tendência.

3. CONTA DE USUÁRIO
Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.

4. USO ACEITÁVEL
É proibido usar a plataforma para fins ilegais, compartilhar credenciais de acesso, ou realizar scraping não autorizado dos dados exibidos.

5. PROPRIEDADE INTELECTUAL
Todo o conteúdo da plataforma, incluindo textos, gráficos e software, é de propriedade da Hyppado ou de seus licenciadores.

6. LIMITAÇÃO DE RESPONSABILIDADE
A Hyppado não se responsabiliza por decisões tomadas com base nas informações exibidas na plataforma.

7. CANCELAMENTO
Você pode cancelar sua assinatura a qualquer momento. O acesso permanece até o fim do período pago.

8. ALTERAÇÕES NOS TERMOS
Podemos alterar estes termos a qualquer momento. Continuando a usar o serviço após as alterações, você as aceita.

9. CONTATO
Para dúvidas, entre em contato através do nosso canal de suporte.`;

export function TermsOfUseSection() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/terms-of-use");
      if (res.ok) {
        const data = await res.json();
        setText(data.text || DEFAULT_TERMS);
      }
    } catch {
      setText(DEFAULT_TERMS);
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
      await fetch("/api/admin/terms-of-use", {
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
    setText(DEFAULT_TERMS);
    setSaved(false);
  };

  return (
    <Grid item xs={12}>
      <Card sx={cardStyle}>
        <CardHeader
          title={
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
              Termos de Uso
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
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                /termos
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
            placeholder="Escreva os termos de uso aqui..."
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
