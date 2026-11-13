import { afterEach, expect, it, vi } from "vitest";
import net from "node:net";
import tls from "node:tls";
import { dummyDatabaseCertificate } from "./tls-fixture";
import { getPool } from "@/lib/db";

afterEach(() => { vi.unstubAllEnvs(); delete (globalThis as { cloakPgPool?: unknown }).cloakPgPool; });
it.each([{ query: "", trusted: false, ip: "127.0.0.1", allowed: false }, { query: "?sslmode=no-verify", trusted: false, ip: "127.0.0.1", allowed: false }, { query: "", trusted: true, ip: "127.0.0.2", allowed: false }, { query: "", trusted: true, ip: "127.0.0.1", allowed: true }])("authenticates the dummy database peer: %j", async ({ query, trusted, ip, allowed }) => {
  const certificate = dummyDatabaseCertificate(ip);
  const secureContext = tls.createSecureContext(certificate);
  let acceptedStartup = false;
  const sockets = new Set<net.Socket>();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("data", () => {
      socket.write("S");
      const secure = new tls.TLSSocket(socket, { isServer: true, secureContext });
      secure.on("error", () => {}); sockets.add(secure);
      secure.once("data", () => { acceptedStartup = true; secure.write(Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73])); });
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("DATABASE_SSL_CA", trusted ? certificate.cert : "");
  vi.stubEnv("DATABASE_SSL", "true"); vi.stubEnv("PGSSLMODE", "");
  vi.stubEnv("DATABASE_URL", `postgres://dummy:dummy@127.0.0.1:${(server.address() as net.AddressInfo).port}/dummy${query}`);
  const pool = getPool();
  let connected = false, failure = "";
  try { const client = await pool.connect(); connected = true; client.release(); } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  finally { for (const socket of sockets) socket.destroy(); await pool.end(); await new Promise<void>(resolve => server.close(() => resolve())); }
  expect({ connected, acceptedStartup }, failure).toEqual({ connected: allowed, acceptedStartup: allowed });
}, 10000);
