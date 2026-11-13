import { afterEach, expect, it, vi } from "vitest";
import { Client } from "pg";
import type { PeerCertificate } from "node:tls";
import { databaseTransportOptions } from "@/lib/database-tls";

afterEach(() => vi.unstubAllEnvs());

const certificate = (host: string) => ({
  subject: { CN: host }, subjectaltname: `DNS:${host}`,
}) as unknown as PeerCertificate;

it("keeps the driver's empty-host Unix socket connection string intact", () => {
  vi.stubEnv("DATABASE_SSL", ""); vi.stubEnv("PGSSLMODE", "");
  const input = "postgres://dummy:dummy@/app?host=%2Fvar%2Frun%2Fpostgresql";
  const options = databaseTransportOptions(input);
  expect(options.connectionString).toBe(input);
  expect(options.ssl).toBe(false);
  expect(new Client(options)).toMatchObject({ host: "/var/run/postgresql" });
});

it.each([
  ["postgres://dummy:dummy@/app?host=db.example.com&sslmode=require", "fallback.invalid", "db.example.com"],
  ["postgres:///app?host=db.example.com&sslmode=require", "fallback.invalid", "db.example.com"],
  ["postgres://url.invalid/app?host=db.example.com&sslmode=require", "fallback.invalid", "db.example.com"],
  ["postgres://url.invalid/app?host=old.invalid&host=db.example.com&sslmode=require", "fallback.invalid", "db.example.com"],
  ["postgres:///app?sslmode=require", "env.example.com", "env.example.com"],
  ["postgres://url.example.com/app?sslmode=require", "env.invalid", "url.example.com"],
  ["postgres:///app?sslmode=require", "", "localhost"],
])("verifies the same effective host as pg for %s", (input, environmentHost, expectedHost) => {
  vi.stubEnv("DATABASE_SSL", ""); vi.stubEnv("PGSSLMODE", ""); vi.stubEnv("PGHOST", environmentHost);
  const options = databaseTransportOptions(input);
  expect(new Client(options)).toMatchObject({ host: expectedHost });
  expect(options.connectionString).not.toContain("sslmode");
  expect(options.connectionString).not.toContain("DUMMY");
  const ssl = options.ssl;
  if (!ssl) throw new Error("Expected verified TLS");
  expect(ssl.rejectUnauthorized).toBe(true);
  expect(ssl.checkServerIdentity("irrelevant-transport-name", certificate(expectedHost))).toBeUndefined();
  expect(ssl.checkServerIdentity("irrelevant-transport-name", certificate("wrong.invalid"))).toBeInstanceOf(Error);
});

it("uses the final duplicate mode while removing all URL TLS overrides", () => {
  vi.stubEnv("DATABASE_SSL", ""); vi.stubEnv("PGSSLMODE", "");
  const options = databaseTransportOptions("postgres://db.example.com/app?sslmode=disable&sslmode=no-verify&uselibpqcompat=true");
  expect(options.ssl).toMatchObject({ rejectUnauthorized: true });
  expect(options.connectionString).toBe("postgres://db.example.com/app");
});

it.each(["sslcert", "sslkey", "sslrootcert"])("rejects %s before the driver reads any file", name => {
  expect(() => databaseTransportOptions(`postgres://dummy@/app?${name}=/never-read`)).toThrow("Configure database certificates outside DATABASE_URL");
});
