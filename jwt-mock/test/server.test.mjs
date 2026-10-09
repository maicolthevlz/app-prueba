import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createJwtMock } from "../server.mjs";

let baseUrl;
let server;
let keyDirectory;
let stopCleanup;

before(async () => {
  keyDirectory = await mkdtemp(join(tmpdir(), "essa-jwt-mock-test-"));
  const mock = await createJwtMock({
    codeTtlMs: 1_000,
    keyDirectory,
    logger: { error() {}, warn() {} },
  });
  stopCleanup = mock.stopCleanup;
  await new Promise((resolve) => {
    server = mock.app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  stopCleanup?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await rm(keyDirectory, { recursive: true, force: true });
});

async function issueToken() {
  const response = await fetch(`${baseUrl}/token`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.token_type, "Bearer");
  assert.ok(body.access_token);
  return body.access_token;
}

async function exchange(token) {
  return fetch(`${baseUrl}/exchange-code`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

test("health, OpenID configuration and JWKS are available", async () => {
  const [healthResponse, openIdResponse, jwksResponse] = await Promise.all([
    fetch(`${baseUrl}/health`),
    fetch(`${baseUrl}/.well-known/openid-configuration`),
    fetch(`${baseUrl}/jwks.json`),
  ]);
  assert.deepEqual(await healthResponse.json(), { ok: true, service: "ESSA JWT Mock" });
  const metadata = await openIdResponse.json();
  assert.equal(metadata.issuer, baseUrl);
  assert.equal(metadata.jwks_uri, `${baseUrl}/jwks.json`);
  const jwks = await jwksResponse.json();
  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].alg, "RS256");
  assert.equal(jwks.keys[0].kty, "RSA");
});

test("GET and POST /token issue an RS256 token with the expected claims", async () => {
  for (const method of ["GET", "POST"]) {
    const response = await fetch(`${baseUrl}/token`, { method });
    assert.equal(response.status, 200);
    const { access_token: token } = await response.json();
    const [header, payload] = token.split(".").slice(0, 2).map((part) =>
      JSON.parse(Buffer.from(part, "base64url").toString("utf8")),
    );
    assert.equal(header.alg, "RS256");
    for (const claim of ["oid", "sub", "email", "document", "given_name", "family_name", "iss", "aud", "iat", "exp"]) {
      assert.ok(payload[claim], `missing claim ${claim}`);
    }
  }
});

test("a valid token becomes a code that can only be consumed once", async () => {
  const exchangeResponse = await exchange(await issueToken());
  assert.equal(exchangeResponse.status, 200);
  const { code } = await exchangeResponse.json();
  const consume = () => fetch(`${baseUrl}/consume-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const first = await consume();
  assert.equal(first.status, 200);
  assert.equal((await first.json()).user.document, "1036000000");
  assert.equal((await consume()).status, 401);
});

test("an expired code is rejected", async () => {
  const response = await exchange(await issueToken());
  const { code } = await response.json();
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const consumed = await fetch(`${baseUrl}/consume-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  assert.equal(consumed.status, 401);
});

test("an invalid token is rejected", async () => {
  assert.equal((await exchange("not-a-jwt")).status, 401);
});

test("dnn-test consumes its code and emits AUTH_SUCCESS without receiving the JWT", async () => {
  const exchangeResponse = await exchange(await issueToken());
  const { code } = await exchangeResponse.json();
  const response = await fetch(`${baseUrl}/dnn-test?code=${encodeURIComponent(code)}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /AUTH_SUCCESS/);
  assert.match(html, /Acceso correcto/);
  const reused = await fetch(`${baseUrl}/dnn-test?code=${encodeURIComponent(code)}`);
  assert.match(await reused.text(), /AUTH_ERROR/);
});
