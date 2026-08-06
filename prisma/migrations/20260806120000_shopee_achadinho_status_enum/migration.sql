-- Converte ShopeeAchadinhoProduct.status de TEXT para enum.
--
-- Contexto: o gate de aprovação introduziu REJECTED e tornou a distinção
-- PENDING (aguardando revisão) x READY (publicado) semanticamente relevante.
-- Com TEXT, um typo vira bug silencioso de dados.
--
-- CUIDADO: `prisma migrate deploy` roda dentro do buildCommand da Vercel.
-- Se este cast falhar, o build falha e o deploy é abortado. Por isso o CASE
-- tem um ELSE — qualquer valor legado inesperado vira PENDING (a fila de
-- revisão) em vez de derrubar o deploy.

-- CreateEnum
CREATE TYPE "ShopeeAchadinhoStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED'
);

-- AlterTable — o default precisa sair antes da troca de tipo
ALTER TABLE "ShopeeAchadinhoProduct" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ShopeeAchadinhoProduct"
  ALTER COLUMN "status" TYPE "ShopeeAchadinhoStatus"
  USING (
    CASE upper(trim("status"))
      WHEN 'PENDING'    THEN 'PENDING'
      WHEN 'PROCESSING' THEN 'PROCESSING'
      WHEN 'READY'      THEN 'READY'
      WHEN 'FAILED'     THEN 'FAILED'
      WHEN 'REJECTED'   THEN 'REJECTED'
      ELSE 'PENDING'
    END
  )::"ShopeeAchadinhoStatus";

ALTER TABLE "ShopeeAchadinhoProduct" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Backfill do acervo anterior ao gate de aprovação.
--
-- A partir deste deploy o feed público exige status READY. Todos os
-- achadinhos criados ANTES do gate estão em PENDING e sumiriam do feed até
-- alguém rodar prisma/approveAchadinhos.ts — uma janela de feed vazio.
--
-- Este UPDATE roda na MESMA transação do cast, então essa janela não existe.
--
-- Não é uma concessão do gate: estes registros JÁ eram públicos antes desta
-- migração. Publicá-los preserva o estado atual em vez de expor algo novo.
-- Tudo que o pipeline produzir a partir daqui passa pela revisão do admin.
--
-- Só publica o que é utilizável: sem nome de produto ou sem link de afiliado
-- não há o que mostrar, então o registro fica na fila de revisão.
UPDATE "ShopeeAchadinhoProduct"
   SET "status" = 'READY'
 WHERE "status" = 'PENDING'
   AND "productName" IS NOT NULL
   AND "affiliateLink" IS NOT NULL;
