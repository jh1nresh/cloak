import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const streamState = vi.hoisted(() => ({ pulls: 0, cancelled: false }));
vi.mock("@/lib/security", async (original) => ({ ...await original<typeof import("@/lib/security")>(), MAX_GARMENT_DATA_URL_BYTES: 16, fetchPublicUrl: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("@/lib/rate-limit", () => ({ checkRequestRateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/db", () => ({ getUserById: vi.fn(async () => ({ body_video_url: "https://dummy.invalid/body.mp4" })), getGarmentById: vi.fn(), getSavedItemById: vi.fn(), insertMotionLook: vi.fn(async () => ({ id: "dummy-look" })), updateLook: vi.fn(async () => ({ id: "dummy-look", status: "processing" })) }));
vi.mock("@/lib/decart", () => ({ submitDecartVton: vi.fn(async () => "dummy-provider-job") }));
import { POST } from "@/app/api/looks/motion/route";
import { submitDecartVton } from "@/lib/decart";

afterEach(() => vi.unstubAllGlobals());
it("cancels a finite source as soon as its downscaled byte ceiling is exceeded", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("body.mp4")) return new Response("dummy-body");
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) { streamState.pulls++; if (streamState.pulls <= 4) controller.enqueue(new Uint8Array(8)); else controller.close(); },
      cancel() { streamState.cancelled = true; },
    }, { highWaterMark: 0 }));
  }));
  const response = await POST(new NextRequest("http://dummy.invalid/api/looks/motion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "dummy-owner", garmentImageUrl: "https://dummy.invalid/garment.jpg" }) }));
  expect(response.status).toBe(413);
  expect(streamState.pulls).toBeLessThan(4);
  expect(streamState.cancelled).toBe(true);
});

it("keeps an ordinary bounded source usable without contacting a provider", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(8))));
  const response = await POST(new NextRequest("http://dummy.invalid/api/looks/motion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "dummy-owner", garmentImageUrl: "https://dummy.invalid/garment.jpg" }) }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ lookId: expect.any(String), status: "processing" });
  const [submitted] = vi.mocked(submitDecartVton).mock.calls[0];
  expect([submitted.garment.size, submitted.video.size]).toEqual([8, 8]);
});
