-- Seed default VideoScenario rows.
-- Uses ON CONFLICT DO NOTHING so re-running is safe.
-- promptHint values guide VEO 3 prompt generation for each scene.

INSERT INTO "VideoScenario" (id, name, description, "promptHint", "isDefault", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(), 'Sala de estar',
    'Ambiente doméstico e aconchegante',
    'living room setting, comfortable sofa, warm lighting, home decor',
    true, true, 10, NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'Cozinha',
    'Espaço moderno de cozinha',
    'modern kitchen setting, countertop, kitchen appliances, bright lighting',
    true, true, 20, NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'Quarto',
    'Quarto decorado e iluminado',
    'bedroom setting, bed with pillows, soft lighting, cozy atmosphere',
    true, true, 30, NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'Loja',
    'Ambiente de loja ou varejo',
    'retail store setting, product shelves, bright commercial lighting',
    true, true, 40, NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'Estúdio',
    'Fundo neutro de estúdio profissional',
    'professional studio setting, neutral background, studio lighting, clean look',
    true, true, 50, NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'Carro',
    'Interior de veículo em movimento',
    'inside a car, driving perspective, city or road background, natural light through windows',
    true, true, 60, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;
