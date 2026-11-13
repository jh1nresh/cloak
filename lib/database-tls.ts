import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { parse } from "pg-connection-string";

export function databaseTransportOptions(connectionString: string) {
  // Inspect URL options before the driver parser can read certificate files.
  // Preserve its empty-host/socket syntax instead of forcing it through URL.
  const hash = connectionString.indexOf("#");
  const address = hash < 0 ? connectionString : connectionString.slice(0, hash);
  const fragment = hash < 0 ? "" : connectionString.slice(hash);
  const query = address.startsWith("/") ? -1 : address.indexOf("?");
  const params = new URLSearchParams(query < 0 ? "" : address.slice(query + 1));
  const values = Object.fromEntries(params);
  const modes = [values.sslmode, process.env.PGSSLMODE];
  const enabled = process.env.DATABASE_SSL === "true" ||
    modes.some(mode => mode && mode !== "disable") ||
    (params.has("ssl") && !["false", "0", "disable"].includes(values.ssl));
  for (const name of ["sslcert", "sslkey", "sslrootcert"]) {
    if (params.has(name)) throw new Error("Configure database certificates outside DATABASE_URL; use DATABASE_SSL_CA for a private CA");
  }
  // pg connection-string TLS options otherwise replace the explicit verified policy.
  const originalOptions = params.toString();
  for (const name of ["sslmode", "ssl", "uselibpqcompat"]) params.delete(name);
  if (params.toString() !== originalOptions) {
    connectionString = address.slice(0, query) + (params.size ? `?${params}` : "") + fragment;
  }
  const parsed = parse(connectionString);
  const host = parsed.host || process.env.PGHOST || "localhost";
  return {
    connectionString,
    ssl: enabled ? {
      rejectUnauthorized: true,
      checkServerIdentity: (_hostname: string, certificate: PeerCertificate) =>
        checkServerIdentity(host.replace(/^\[|\]$/g, ""), certificate),
      ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}),
    } : false,
  };
}
