import { afterEach, expect, it, vi } from "vitest";
import dnsPromises from "node:dns/promises";
import dns from "node:dns";
import http from "node:http";
import { fetchPublicUrl, getClientIp } from "@/lib/security";
import { NextRequest } from "next/server";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("keeps unconfigured or ambiguous ingress headers out of quota identity", () => {
  vi.stubEnv("CLOAK_TRUSTED_IP_HEADER", "");
  expect(getClientIp(new NextRequest("http://dummy.invalid", { headers: { "x-forwarded-for": "192.0.2.10" } }))).toBe("unknown");
  vi.stubEnv("CLOAK_TRUSTED_IP_HEADER", "x-owned-client-ip");
  expect(getClientIp(new NextRequest("http://dummy.invalid", { headers: { "x-owned-client-ip": "192.0.2.10" } }))).toBe("192.0.2.10");
  expect(getClientIp(new NextRequest("http://dummy.invalid", { headers: { "x-owned-client-ip": "192.0.2.10, 192.0.2.11" } }))).toBe("unknown");
});

it("does not connect to a blocked dummy peer after checking a different address", async () => {
  let hits = 0;
  const server = http.createServer((_request, response) => { hits++; response.end("dummy"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  vi.spyOn(dnsPromises, "lookup").mockImplementation((async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as typeof dnsPromises.lookup);
  vi.spyOn(dns, "lookup").mockImplementation(((host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (host !== "rebind.test") throw new Error("Unexpected resolver lookup");
    if (options?.all) callback(null, [{ address: "127.0.0.1", family: 4 }]); else callback(null, "127.0.0.1", 4);
  }) as typeof dns.lookup);
  try {
    try { const response = await fetchPublicUrl(`http://rebind.test:${port}/dummy`); await response.text(); } catch { /* A rejected connection preserves the boundary. */ }
    expect(dnsPromises.lookup).toHaveBeenCalled();
    expect(hits).toBe(0);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 12000);
