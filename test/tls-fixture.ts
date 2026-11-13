import { generateKeyPairSync, sign } from "node:crypto";

// Generates only a disposable self-signed test peer; no private key is stored.
export function dummyDatabaseCertificate(ip = "127.0.0.1") {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const der = (tag: number, ...parts: Buffer[]) => {
    const value = Buffer.concat(parts), length = value.length;
    const size = length < 128 ? [length] : length < 256 ? [129, length] : [130, length >> 8, length & 255];
    return Buffer.concat([Buffer.from([tag, ...size]), value]);
  };
  const algorithm = der(48, Buffer.from("06082a8648ce3d040302", "hex"));
  const name = der(48, der(49, der(48, Buffer.from("0603550403", "hex"), der(12, Buffer.from("dummy.invalid")))));
  const utc = (offset: number) => der(23, Buffer.from(new Date(Date.now() + offset).toISOString().replace(/[-:]/g, "").slice(2, 15).replace("T", "") + "Z"));
  const san = der(48, Buffer.from("0603551d11", "hex"), der(4, der(48, der(135, Buffer.from(ip.split(".").map(Number))))));
  const ca = der(48, Buffer.from("0603551d13", "hex"), der(4, der(48, der(1, Buffer.from([255])))));
  const tbs = der(48, der(160, der(2, Buffer.from([2]))), der(2, Buffer.from([1])), algorithm, name, der(48, utc(-86400000), utc(86400000)), name, publicKey.export({ type: "spki", format: "der" }), der(163, der(48, san, ca)));
  const certificate = der(48, tbs, algorithm, der(3, Buffer.from([0]), sign("sha256", tbs, privateKey)));
  const cert = "-----BEGIN CERTIFICATE-----\n" + certificate.toString("base64").match(/.{1,64}/g)!.join("\n") + "\n-----END CERTIFICATE-----\n";
  return { key: privateKey.export({ type: "pkcs8", format: "pem" }), cert };
}
