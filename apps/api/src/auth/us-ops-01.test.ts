import { describe, expect, it } from "vitest";
import { isLocalHostname, sameLocalOrigin } from "./local-origins";

const request = (headers: Record<string, string>) => new Request("http://api:4000/api/auth/sign-in/email", { method: "POST", headers });

/** US-OPS-01 (D-279) — Spine opens on any local address; sign-in trusts the address a request came to, when it's local. */
describe("US-OPS-01 · sign-in from any of Spine's local addresses", () => {
  it("trusts the local address the request came to: localhost, this machine's IP, a .local name, on any port", () => {
    for (const address of ["http://localhost:7746", "http://10.85.0.30:7746", "http://192.168.1.20", "http://172.20.0.4:7746", "http://spine.local:7746", "https://100.101.102.103", "http://[::1]:7746", "http://127.0.0.1:52211"]) {
      const host = new URL(address).host;
      expect(sameLocalOrigin(request({ origin: address, host })), address).toEqual([new URL(address).origin]);
    }
  });

  it("never trusts another site, another device's address, or a public name pointed at a local IP", () => {
    const cases: Record<string, string>[] = [
      { origin: "http://evil.example.com", host: "10.85.0.30:7746" }, // another site
      { origin: "http://192.168.1.50:7746", host: "10.85.0.30:7746" }, // another device on the network
      { origin: "http://10.85.0.30:8080", host: "10.85.0.30:7746" }, // another port: another app
      { origin: "http://rebind.example.com:7746", host: "rebind.example.com:7746" }, // a public name, even as its own host
      { origin: "http://8.8.8.8:7746", host: "8.8.8.8:7746" }, // a public IP
      { origin: "null", host: "localhost:7746" },
      { origin: "file:///tmp/page.html", host: "localhost:7746" },
      { host: "localhost:7746" }, // no Origin
      { origin: "http://localhost:7746" }, // no Host
    ];
    for (const headers of cases) expect(sameLocalOrigin(request(headers)), JSON.stringify(headers)).toEqual([]);
    expect(sameLocalOrigin(undefined)).toEqual([]);
  });

  it("knows which names and addresses are local", () => {
    for (const name of ["localhost", "app.localhost", "spine.local", "nas.lan", "box.home.arpa", "spine.internal", "127.0.0.1", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.1.1", "100.64.0.1", "::1", "[::1]", "fd12:3456::1", "fe80::1", "::ffff:192.168.1.1"]) {
      expect(isLocalHostname(name), name).toBe(true);
    }
    for (const name of ["example.com", "spine.example.com", "localhost.example.com", "172.15.0.1", "172.32.0.1", "100.128.0.1", "8.8.8.8", "2001:db8::1", "::ffff:8.8.8.8", "spine.ts.net"]) {
      expect(isLocalHostname(name), name).toBe(false);
    }
  });
});
