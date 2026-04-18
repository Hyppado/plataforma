"use client";

import { useState } from "react";
import { Box, Container, Typography, Grid, Button } from "@mui/material";
import { Inventory2, ShoppingBag } from "@mui/icons-material";
import Link from "next/link";
import { ProductCard } from "@/app/components/cards/ProductCard";
import { ProductDetailsModal } from "@/app/components/cards/ProductDetailsModal";
import { useSavedProducts } from "@/lib/storage/saved";
import type { ProductDTO } from "@/lib/types/dto";

export default function ProdutosSalvosPage() {
  const savedProducts = useSavedProducts();
  const products = savedProducts.products.map((item) => item.product);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const isEmpty = products.length === 0;

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 700,
              color: "#fff",
              mb: 0.5,
            }}
          >
            Produtos salvos
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {!isEmpty
              ? `${products.length} ${products.length === 1 ? "produto salvo" : "produtos salvos"}`
              : "Itens que você marcou para revisar depois."}
          </Typography>
        </Box>

        {!isEmpty && (
          <Button
            size="small"
            onClick={() => {
              if (confirm("Remover todos os produtos salvos?")) {
                savedProducts.clear();
              }
            }}
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              textTransform: "none",
              "&:hover": {
                color: "rgba(255,255,255,0.8)",
                background: "rgba(255,255,255,0.05)",
              },
            }}
          >
            Limpar salvos
          </Button>
        )}
      </Box>

      {/* Empty State */}
      {isEmpty && (
        <Box
          sx={{
            borderRadius: 3,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(45, 212, 255, 0.08)",
            p: 6,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Inventory2
              sx={{
                fontSize: 64,
                color: "rgba(255,255,255,0.15)",
              }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                  mb: 1,
                }}
              >
                Você ainda não salvou nenhum produto.
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.5)",
                  mb: 3,
                }}
              >
                Quando você salvar, eles aparecerão aqui.
              </Typography>
              <Button
                component={Link}
                href="/dashboard/products"
                variant="outlined"
                startIcon={<ShoppingBag />}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  borderColor: "rgba(45, 212, 255, 0.3)",
                  color: "#2DD4FF",
                  "&:hover": {
                    borderColor: "#2DD4FF",
                    background: "rgba(45, 212, 255, 0.08)",
                  },
                }}
              >
                Ver Produtos Hype
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Products Grid */}
      {!isEmpty && (
        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {products.map((product) => (
            <Grid item xs={6} sm={6} md={4} lg={2.4} key={product.id}>
              <ProductCard
                product={product}
                onViewDetails={(p) => setSelectedProduct(p)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {selectedProduct && (
        <ProductDetailsModal
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
        />
      )}
    </Container>
  );
}
