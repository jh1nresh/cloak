import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: { id: "dummy-owner", avatar_url: "https://93.184.216.34/avatar.jpg", body_video_url: "https://93.184.216.34/body.mp4" },
  capture: "original", counts: new Map<string, number>(), submissions: 0,
}));
vi.mock("@/lib/db", () => ({
  getTryOnById: vi.fn(async () => ({ id: "shared-result", user_id: state.user.id, status: "completed", result_url: "https://93.184.216.34/result.jpg", fashn_prediction_id: "private-provider-job", saved_item_id: "private-item" })),
  getLookById: vi.fn(async () => ({ id: "shared-look", user_id: state.user.id, pipeline: "motion", status: "completed", video_url: "https://93.184.216.34/result.mp4", result_url: "https://93.184.216.34/poster.jpg", provider_job_id: "private-provider-job", saved_item_id: "private-item" })),
  getUserById: vi.fn(async (id: string) => id === state.user.id ? state.user : null),
  setUserBodyVideo: vi.fn(async () => { state.capture = "replacement"; return state.user; }),
  checkPersistentRateLimit: vi.fn(async ({ key, maxRequests }: { key: string; maxRequests: number }) => {
    const count = (state.counts.get(key) || 0) + 1; state.counts.set(key, count);
    return { allowed: count <= maxRequests, retry_after_seconds: 60 };
  }),
  getSavedItemById: vi.fn(), getGarmentById: vi.fn(),
  insertTryOn: vi.fn(async () => ({ id: "new-job" })),
  updateTryOn: vi.fn(async () => ({ id: "new-job", status: "processing" })),
  insertLook: vi.fn(async () => ({ id: "look" })),
  lockTryOnForFinalizing: vi.fn(), updateLookByTryOnId: vi.fn(), lockLookForFinalizing: vi.fn(), updateLook: vi.fn(),
}));
vi.mock("@/lib/cloudinary", () => ({ uploadVideo: vi.fn(async () => ({ url: "https://dummy.invalid/new.mp4", posterUrl: "https://dummy.invalid/new.jpg" })), uploadWithWatermark: vi.fn() }));
vi.mock("@/lib/fashn", () => ({ submitFashnTryOn: vi.fn(async () => { state.submissions++; return "dummy-provider-job"; }), submitFashnModelSwap: vi.fn(), getFashnOutputImage: vi.fn(), getFashnTryOnStatus: vi.fn() }));
vi.mock("@/lib/decart", () => ({ fetchDecartResultVideo: vi.fn(), getDecartJobStatus: vi.fn() }));
import { GET as status } from "@/app/api/tryon/[id]/route";
import { GET as lookStatus } from "@/app/api/looks/[id]/route";
import { POST as replaceCapture } from "@/app/api/body-video/route";
import { POST as generate } from "@/app/api/tryon/route";

afterEach(() => { state.capture = "original"; state.counts.clear(); state.submissions = 0; vi.unstubAllEnvs(); });

describe("shared results and operator quotas", () => {
  it("returns a shared still without the stronger profile capability", async () => {
    const response = await status(new NextRequest("http://dummy.invalid/api/tryon/shared-result"), { params: Promise.resolve({ id: "shared-result" }) });
    const result = await response.json();
    expect(result.result_url).toContain("result.jpg");
    const upload = new FormData();
    if (result.user_id) upload.set("userId", result.user_id);
    upload.set("video", new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])], "dummy.mp4", { type: "video/mp4" }));
    const mutation = await replaceCapture(new NextRequest("http://dummy.invalid/api/body-video", { method: "POST", body: upload }));
    expect({ status: mutation.status, capture: state.capture }).toEqual({ status: 400, capture: "original" });
    expect(result).not.toHaveProperty("user_id");
    expect(result).not.toHaveProperty("fashn_prediction_id");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("projects motion status without owner, library or provider identifiers", async () => {
    const response = await lookStatus(new NextRequest("http://dummy.invalid/api/looks/shared-look"), { params: Promise.resolve({ id: "shared-look" }) });
    const result = await response.json();
    expect(result.video_url).toContain("result.mp4");
    for (const field of ["user_id", "saved_item_id", "provider_job_id"]) expect(result).not.toHaveProperty(field);
  });

  it("does not restore a paid-generation allowance by changing untrusted headers", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CLOAK_TRUSTED_IP_HEADER", "");
    const responses: number[] = [];
    for (let index = 0; index < 8; index++) {
      const request = new NextRequest("http://dummy.invalid/api/tryon", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": index < 7 ? "192.0.2.10" : "192.0.2.11", "x-real-ip": String(index) }, body: JSON.stringify({ userId: state.user.id, avatarUrl: state.user.avatar_url, garmentImageBase64: "data:image/png;base64,iVBORw0KGgo=" }) });
      responses.push((await generate(request)).status);
    }
    expect(responses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(responses.slice(6)).toEqual([429, 429]);
    expect(state.submissions).toBe(6);
  });
});
