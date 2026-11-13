import { checkServerIdentity, type PeerCertificate } from "node:tls";

export function databaseTransportOptions(connectionString: string) {
  const url = new URL(connectionString);
  const modes = [url.searchParams.get("sslmode"), process.env.PGSSLMODE];
  const enabled = process.env.DATABASE_SSL === "true" ||
    modes.some(mode => mode && mode !== "disable") || (url.searchParams.has("ssl") && !["false", "0", "disable"].includes(url.searchParams.get("ssl")!));
  for (const name of ["sslcert", "sslkey", "sslrootcert"]) {
    if (url.searchParams.has(name)) throw new Error("Configure database certificates outside DATABASE_URL; use DATABASE_SSL_CA for a private CA");
  }
  // pg connection-string TLS options otherwise replace the explicit verified policy.
  for (const name of ["sslmode", "ssl", "uselibpqcompat"]) url.searchParams.delete(name);
  return {
    connectionString: url.toString(),
    ssl: enabled ? {
      rejectUnauthorized: true,
      checkServerIdentity: (_hostname: string, certificate: PeerCertificate) =>
        checkServerIdentity(url.hostname.replace(/^\[|\]$/g, ""), certificate),
      ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}),
    } : false,
  };
}
