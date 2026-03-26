import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Button,
  TextField,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Stack,
  Box,
} from "@mui/material";
import {
  Check as CheckIcon,
  Restore as RestoreIcon,
  Save as SaveIcon,
  CodeOutlined,
} from "@mui/icons-material";
import type { PromptConfig } from "@/lib/types/admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

interface PromptVariable {
  variable: string;
  description?: string;
}

interface PromptsSectionProps {
  promptConfig: PromptConfig | null;
  promptTab: number;
  savedPrompt: boolean;
  promptVariables: readonly PromptVariable[];
  onPromptTabChange: (tab: number) => void;
  onUpdateTemplate: (type: "insight" | "script", template: string) => void;
  onRestoreDefaults: (type: "insight" | "script") => void;
  onSave: () => void;
}

export function PromptsSection({
  promptConfig,
  promptTab,
  savedPrompt,
  promptVariables,
  onPromptTabChange,
  onUpdateTemplate,
  onRestoreDefaults,
  onSave,
}: PromptsSectionProps) {
  return (
    <Grid item xs={12} md={6}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<CodeOutlined sx={{ color: "#2DD4FF" }} />}
          title="Configuração de Prompts"
          subheader="Templates para geração de conteúdo"
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
          action={
            <Stack direction="row" spacing={1}>
              <Tooltip title="Restaurar padrões">
                <IconButton
                  onClick={() =>
                    onRestoreDefaults(promptTab === 0 ? "insight" : "script")
                  }
                  size="small"
                  sx={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <RestoreIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={savedPrompt ? <CheckIcon /> : <SaveIcon />}
                onClick={onSave}
                sx={{
                  background: savedPrompt
                    ? "rgba(76, 175, 80, 0.2)"
                    : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                  color: savedPrompt ? "#81C784" : "#fff",
                  fontWeight: 600,
                }}
              >
                {savedPrompt ? "Salvo!" : "Salvar"}
              </Button>
            </Stack>
          }
        />
        <CardContent>
          <Tabs
            value={promptTab}
            onChange={(_, v) => onPromptTabChange(v)}
            sx={{
              mb: 2,
              "& .MuiTab-root": {
                color: "rgba(255,255,255,0.5)",
                "&.Mui-selected": { color: "#2DD4FF" },
              },
              "& .MuiTabs-indicator": { background: "#2DD4FF" },
            }}
          >
            <Tab label="Insight" />
            <Tab label="Script" />
          </Tabs>
          {/* Variables Reference */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.4)" }}
            >
              Variáveis: {promptVariables.map((v) => v.variable).join(", ")}
            </Typography>
          </Box>
          {/* Template Editor */}
          <TextField
            multiline
            rows={6}
            fullWidth
            value={
              promptConfig
                ? promptTab === 0
                  ? promptConfig.insight.template
                  : promptConfig.script.template
                : ""
            }
            onChange={(e) =>
              onUpdateTemplate(
                promptTab === 0 ? "insight" : "script",
                e.target.value,
              )
            }
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                fontSize: "0.8rem",
                background: "rgba(0,0,0,0.3)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                "&:hover fieldset": {
                  borderColor: "rgba(255,255,255,0.2)",
                },
                "&.Mui-focused fieldset": { borderColor: "#2DD4FF" },
              },
              "& .MuiOutlinedInput-input": {
                color: "rgba(255,255,255,0.85)",
              },
            }}
          />
        </CardContent>
      </Card>
    </Grid>
  );
}
