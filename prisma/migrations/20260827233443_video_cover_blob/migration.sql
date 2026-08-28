-- Capa de vídeo: URL de origem (CDN EchoTik, exige assinatura) e a cópia
-- permanente no Vercel Blob, que é o que a interface consome.
ALTER TABLE "EchotikVideoTrendDaily" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "EchotikVideoTrendDaily" ADD COLUMN "coverBlobUrl" TEXT;
