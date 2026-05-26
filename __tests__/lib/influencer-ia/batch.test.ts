/**
 * Tests: lib/influencer-ia/batch.ts
 *
 * Coverage: submitBatchJob (Gemini Batch API submission),
 * retrieveBatchResult (result extraction + Blob upload).
 * All external I/O is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  getSecretSettingMock,
  getSettingMock,
  uploadBufferToBlobMock,
  getPromptConfigFromDBMock,
  batchesCreateMock,
  batchesGetMock,
} = vi.hoisted(() => ({
  getSecretSettingMock: vi.fn(),
  getSettingMock: vi.fn(),
  uploadBufferToBlobMock: vi.fn(),
  getPromptConfigFromDBMock: vi.fn(),
  batchesCreateMock: vi.fn(),
  batchesGetMock: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSecretSetting: getSecretSettingMock,
  getSetting: getSettingMock,
  SETTING_KEYS: {
    GOOGLE_AI_API_KEY: "google_ai.api_key",
    GOOGLE_AI_MODEL: "google_ai.model",
  },
}));

vi.mock("@/lib/storage/blob", () => ({
  uploadBufferToBlob: uploadBufferToBlobMock,
  isEchotikCdnUrl: () => false,
  signEchotikCoverUrl: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/admin/config", () => ({
  getPromptConfigFromDB: getPromptConfigFromDBMock,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    batches = {
      create: batchesCreateMock,
      get: batchesGetMock,
    };
  },
  JobState: {
    JOB_STATE_SUCCEEDED: "JOB_STATE_SUCCEEDED",
    JOB_STATE_FAILED: "JOB_STATE_FAILED",
    JOB_STATE_PENDING: "JOB_STATE_PENDING",
    JOB_STATE_RUNNING: "JOB_STATE_RUNNING",
    JOB_STATE_QUEUED: "JOB_STATE_QUEUED",
  },
}));

// sharp is used by fetchImageBuffer — not exercised here since image URLs are null
vi.mock("sharp", () => ({
  default: vi.fn(),
}));

import { submitBatchJob, retrieveBatchResult } from "@/lib/influencer-ia/batch";
import type { InfluencerImageInput } from "@/lib/influencer-ia/generate";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const BASE_INPUT: InfluencerImageInput = {
  avatarImageUrl: null,
  avatarName: "Ana Silva",
  avatarDescription: "Brazilian content creator",
  productImageUrl: null,
  productName: "Creme Hidratante Premium",
  productCategory: "beleza",
  pose: "De Frente",
  customPose: null,
  environment: "Casa",
  customEnvironment: null,
  style: "Casual",
  enhancements: [],
};

const FAKE_IMAGE_B64 = Buffer.from("fake-image-data").toString("base64");
const TEST_JOB_NAME = "batches/test-job-123";

function makeSucceededJob(imageB64 = FAKE_IMAGE_B64) {
  return {
    name: TEST_JOB_NAME,
    state: "JOB_STATE_SUCCEEDED",
    dest: {
      inlinedResponses: [
        {
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: imageB64 } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// submitBatchJob()
// ---------------------------------------------------------------------------

describe("submitBatchJob()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecretSettingMock.mockResolvedValue("test-api-key");
    getSettingMock.mockResolvedValue(null); // uses default model
    getPromptConfigFromDBMock.mockRejectedValue(new Error("no config")); // fallback to default template
    batchesCreateMock.mockResolvedValue({
      name: TEST_JOB_NAME,
      state: "JOB_STATE_PENDING",
    });
  });

  it("throws if google_ai.api_key secret is absent (fail closed)", async () => {
    getSecretSettingMock.mockResolvedValue(null);
    await expect(submitBatchJob(BASE_INPUT)).rejects.toThrow();
  });

  it("uses the configured model from DB settings", async () => {
    getSettingMock.mockResolvedValue("gemini-custom-model");
    await submitBatchJob(BASE_INPUT);
    expect(batchesCreateMock).toHaveBeenCalledOnce();
    const call = batchesCreateMock.mock.calls[0][0];
    expect(call.model).toBe("gemini-custom-model");
  });

  it("falls back to default model when setting is absent", async () => {
    getSettingMock.mockResolvedValue(null);
    await submitBatchJob(BASE_INPUT);
    const call = batchesCreateMock.mock.calls[0][0];
    expect(call.model).toBe("gemini-3.1-flash-image-preview");
  });

  it("submits an inlined request with the prompt text included", async () => {
    await submitBatchJob(BASE_INPUT);
    const call = batchesCreateMock.mock.calls[0][0];
    const request = (call.src as Array<{ contents: unknown; config: unknown }>)[0];
    expect(request).toBeDefined();
    // contents[0].parts[0] should be the text prompt
    const parts = (request as { contents: Array<{ parts: Array<{ text?: string }> }> }).contents[0].parts;
    expect(parts[0].text).toBeTruthy();
    expect(typeof parts[0].text).toBe("string");
    expect(parts[0].text).toContain("Creme Hidratante Premium");
  });

  it("requests IMAGE modality with 9:16 4K imageConfig", async () => {
    await submitBatchJob(BASE_INPUT);
    const call = batchesCreateMock.mock.calls[0][0];
    const request = (call.src as Array<{ config: { responseModalities: string[]; imageConfig: { aspectRatio: string; imageSize: string } } }>)[0];
    expect(request.config.responseModalities).toContain("IMAGE");
    expect(request.config.imageConfig.aspectRatio).toBe("9:16");
    expect(request.config.imageConfig.imageSize).toBe("4K");
  });

  it("returns the batchJobName from the API response", async () => {
    const name = await submitBatchJob(BASE_INPUT);
    expect(name).toBe(TEST_JOB_NAME);
  });

  it("throws if batches.create returns no job name", async () => {
    batchesCreateMock.mockResolvedValue({ state: "JOB_STATE_PENDING" }); // no name
    await expect(submitBatchJob(BASE_INPUT)).rejects.toThrow();
  });

  it("propagates errors from batches.create", async () => {
    batchesCreateMock.mockRejectedValue(new Error("API unavailable"));
    await expect(submitBatchJob(BASE_INPUT)).rejects.toThrow("API unavailable");
  });
});

// ---------------------------------------------------------------------------
// retrieveBatchResult()
// ---------------------------------------------------------------------------

describe("retrieveBatchResult()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecretSettingMock.mockResolvedValue("test-api-key");
    batchesGetMock.mockResolvedValue(makeSucceededJob());
    uploadBufferToBlobMock.mockResolvedValue(
      "https://blob.vercel-storage.com/influencer-ia/out.png",
    );
  });

  it("throws if google_ai.api_key is absent (fail closed)", async () => {
    getSecretSettingMock.mockResolvedValue(null);
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });

  it("calls ai.batches.get with the provided job name", async () => {
    await retrieveBatchResult(TEST_JOB_NAME);
    expect(batchesGetMock).toHaveBeenCalledWith({ name: TEST_JOB_NAME });
  });

  it("decodes the base64 image from inlinedResponses and uploads to Blob", async () => {
    await retrieveBatchResult(TEST_JOB_NAME);
    const [buffer, path, contentType] = uploadBufferToBlobMock.mock.calls[0] as [Buffer, string, string];
    expect(buffer).toEqual(Buffer.from(FAKE_IMAGE_B64, "base64"));
    expect(path).toMatch(/^influencer-ia\/.+\.png$/);
    expect(contentType).toBe("image/png");
  });

  it("returns the Vercel Blob URL", async () => {
    const url = await retrieveBatchResult(TEST_JOB_NAME);
    expect(url).toBe("https://blob.vercel-storage.com/influencer-ia/out.png");
  });

  it("throws if job state is not JOB_STATE_SUCCEEDED", async () => {
    batchesGetMock.mockResolvedValue({
      name: TEST_JOB_NAME,
      state: "JOB_STATE_PENDING",
    });
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });

  it("throws if job state is JOB_STATE_FAILED", async () => {
    batchesGetMock.mockResolvedValue({
      name: TEST_JOB_NAME,
      state: "JOB_STATE_FAILED",
      error: { message: "Generation failed" },
    });
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });

  it("throws if inlinedResponses contains no image part", async () => {
    batchesGetMock.mockResolvedValue({
      name: TEST_JOB_NAME,
      state: "JOB_STATE_SUCCEEDED",
      dest: {
        inlinedResponses: [
          {
            response: {
              candidates: [
                { content: { parts: [{ text: "some text" }] } },
              ],
            },
          },
        ],
      },
    });
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });

  it("throws if dest.inlinedResponses is absent", async () => {
    batchesGetMock.mockResolvedValue({
      name: TEST_JOB_NAME,
      state: "JOB_STATE_SUCCEEDED",
      dest: {},
    });
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });

  it("throws if Blob upload returns null", async () => {
    uploadBufferToBlobMock.mockResolvedValue(null);
    await expect(retrieveBatchResult(TEST_JOB_NAME)).rejects.toThrow();
  });
});
