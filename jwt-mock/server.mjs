import cors from "cors";
import express from "express";

import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import {
  networkInterfaces,
} from "node:os";

import {
  dirname,
  resolve,
} from "node:path";

import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

import {
  randomBytes,
} from "node:crypto";

import {
  calculateJwkThumbprint,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
} from "jose";

const SERVER_DIRECTORY =
  dirname(
    fileURLToPath(
      import.meta.url
    )
  );

const DEFAULT_PORT = 5050;

const DEFAULT_AUDIENCE =
  "dnn-test-api";

const DEFAULT_CODE_TTL_MS =
  60_000;

const PRIVATE_KEY_FILE =
  "private-key.pem";

const PUBLIC_KEY_FILE =
  "public-key.pem";

/*
 * ======================================================
 * DATOS DE PRUEBA
 * ======================================================
 *
 * La estructura intenta replicar los claims relevantes
 * observados en el JWT entregado por el cliente.
 *
 * Especialmente:
 *
 * email
 * emails
 * given_name
 * family_name
 * name
 * phone_number
 * personalinformation
 *
 * El documento REALMENTE IMPORTANTE para DNN está en:
 *
 * personalinformation.numeroIdentificacion
 */

function createPersonalInformation({
  email,
  document,
  givenName,
  firstSurname,
  secondSurname = "",
  phone,
}) {
  return JSON.stringify({
    correoElectronico:
      email,

    numeroIdentificacion:
      document,

    nombres:
      givenName,

    primerApellido:
      firstSurname,

    segundoApellido:
      secondSurname,

    telefonoMovil:
      phone,

    codigoPais:
      "57",
  });
}

/*
 * ======================================================
 * USUARIO AUTENTICADO
 * ======================================================
 */

const AUTHENTICATED_USER =
  Object.freeze({
    oid:
      "react-user-001",

    sub:
      "react-user-001",

    email:
      "usuario.prueba@essa.com.co",

    emails: [
      "usuario.prueba@essa.com.co",
    ],

    given_name:
      "Usuario",

    family_name:
      "Prueba",

    name:
      "Usuario Prueba",

    phone_number:
      "+573001234567",

    /*
     * Compatibilidad adicional.
     *
     * El token del cliente maneja el documento
     * principalmente dentro de personalinformation,
     * pero dejamos document también para facilitar
     * pruebas en DNN.
     */
    document:
      "13844928",

    personalinformation:
      createPersonalInformation({
        email:
          "usuario.prueba@essa.com.co",

        document:
          "13844928",

        givenName:
          "Usuario",

        firstSurname:
          "Prueba",

        secondSurname:
          "",

        phone:
          "3001234567",
      }),

    authenticated:
      true,
  });

/*
 * ======================================================
 * USUARIO NO AUTENTICADO
 * ======================================================
 *
 * IMPORTANTE:
 *
 * Ya NO dejamos este JWT sin documento/correo.
 *
 * En nuestras pruebas anteriores eso provocaba que
 * DNN decodificara correctamente el JWT, pero al buscar
 * numeroIdentificacion/documento obtuviera null.
 *
 * Este escenario conserva una identidad de prueba,
 * pero authenticated = false.
 */

const ANONYMOUS_USER =
  Object.freeze({
    oid:
      "anonymous-user-001",

    sub:
      "anonymous-user-001",

    email:
      "usuario.anonimo@essa.com.co",

    emails: [
      "usuario.anonimo@essa.com.co",
    ],

    given_name:
      "Usuario",

    family_name:
      "Anonimo",

    name:
      "Usuario Anonimo",

    phone_number:
      "+573009876543",

    document:
      "1020304050",

    personalinformation:
      createPersonalInformation({
        email:
          "usuario.anonimo@essa.com.co",

        document:
          "1020304050",

        givenName:
          "Usuario",

        firstSurname:
          "Anonimo",

        secondSurname:
          "",

        phone:
          "3009876543",
      }),

    authenticated:
      false,
  });

function withoutTrailingSlash(
  value
) {
  let result =
    String(value ?? "");

  while (
    result.endsWith("/")
  ) {
    result =
      result.slice(
        0,
        -1
      );
  }

  return result;
}

function requestBaseUrl(
  request,
  configuredBaseUrl
) {
  if (
    configuredBaseUrl
  ) {
    return withoutTrailingSlash(
      configuredBaseUrl
    );
  }

  return (
    `${request.protocol}` +
    `://${request.get("host")}`
  );
}

function bearerToken(
  request
) {
  const authorization =
    request.get(
      "authorization"
    ) ?? "";

  const prefix =
    "Bearer ";

  if (
    !authorization
      .toLowerCase()
      .startsWith(
        prefix.toLowerCase()
      )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(
        prefix.length
      )
      .trim();

  return token || null;
}

function safeJsonForHtml(
  value
) {
  return JSON
    .stringify(value)
    .replaceAll(
      "<",
      String.raw`\u003c`
    );
}

function normalizeScenario(
  value
) {
  const scenario =
    String(
      value ??
        "authenticated"
    )
      .trim()
      .toLowerCase();

  if (
    scenario ===
      "anonymous" ||
    scenario ===
      "unauthenticated" ||
    scenario ===
      "no-auth" ||
    scenario ===
      "anonimo"
  ) {
    return "anonymous";
  }

  return "authenticated";
}

function userForScenario(
  scenario
) {
  return scenario ===
    "anonymous"
    ? ANONYMOUS_USER
    : AUTHENTICATED_USER;
}

/*
 * Convierte personalinformation
 * de string JSON a objeto.
 */
function parsePersonalInformation(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      parsed &&
      typeof parsed ===
        "object"
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/*
 * ======================================================
 * CLAVES RSA
 * ======================================================
 */

async function loadOrCreateKeyPair(
  keyDirectory
) {
  const privateKeyPath =
    resolve(
      keyDirectory,
      PRIVATE_KEY_FILE
    );

  const publicKeyPath =
    resolve(
      keyDirectory,
      PUBLIC_KEY_FILE
    );

  try {
    const [
      privatePem,
      publicPem,
    ] =
      await Promise.all([
        readFile(
          privateKeyPath,
          "utf8"
        ),

        readFile(
          publicKeyPath,
          "utf8"
        ),
      ]);

    return {
      privateKey:
        await importPKCS8(
          privatePem,
          "RS256"
        ),

      publicKey:
        await importSPKI(
          publicPem,
          "RS256"
        ),

      created:
        false,
    };
  } catch (error) {
    if (
      error?.code !==
      "ENOENT"
    ) {
      throw error;
    }
  }

  await mkdir(
    keyDirectory,
    {
      recursive:
        true,
    }
  );

  const {
    privateKey,
    publicKey,
  } =
    await generateKeyPair(
      "RS256",
      {
        extractable:
          true,

        modulusLength:
          2048,
      }
    );

  await Promise.all([
    writeFile(
      privateKeyPath,
      await exportPKCS8(
        privateKey
      ),
      {
        encoding:
          "utf8",

        mode:
          0o600,

        flag:
          "wx",
      }
    ),

    writeFile(
      publicKeyPath,
      await exportSPKI(
        publicKey
      ),
      {
        encoding:
          "utf8",

        mode:
          0o644,

        flag:
          "wx",
      }
    ),
  ]);

  return {
    privateKey,
    publicKey,
    created:
      true,
  };
}

/*
 * ======================================================
 * PÁGINA DNN LOCAL
 * ======================================================
 */

function dnnTestPage(
  result
) {
  const success =
    result.ok;

  const message =
    success
      ? "Sesión simulada iniciada correctamente."
      : result.error;

  const reactMessage = {
    type:
      success
        ? "AUTH_SUCCESS"
        : "AUTH_ERROR",

    payload:
      success
        ? {
            message,
            user:
              result.user,
          }
        : {
            message,
          },
  };

  const document =
    result.user?.document ??
    "No disponible";

  const email =
    result.user?.email ??
    "No disponible";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<title>DNN local de prueba</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: system-ui, sans-serif;
  background: #eef3f8;
  color: #17212b;
}

main {
  width: min(100%, 520px);
  padding: 28px;
  border-radius: 16px;
  background: white;
}

.status {
  font-weight: 700;
}
</style>
</head>

<body>

<main>

<h1>DNN local de prueba</h1>

<p class="status">
  ${
    success
      ? "Acceso correcto"
      : "Acceso rechazado"
  }
</p>

<p>${message}</p>

${
  success
    ? `
<p>
  Nombre:
  ${result.user.given_name ?? ""}
  ${result.user.family_name ?? ""}
</p>

<p>
  Documento:
  ${document}
</p>

<p>
  Correo:
  ${email}
</p>
`
    : ""
}

</main>

<script>
const message =
  ${safeJsonForHtml(
    reactMessage
  )};

if (
  window.ReactNativeWebView
) {
  window
    .ReactNativeWebView
    .postMessage(
      JSON.stringify(
        message
      )
    );
}
</script>

</body>
</html>`;
}

/*
 * ======================================================
 * MOCK
 * ======================================================
 */

export async function createJwtMock(
  options = {}
) {
  const audience =
    options.audience ??
    DEFAULT_AUDIENCE;

  const codeTtlMs =
    options.codeTtlMs ??
    DEFAULT_CODE_TTL_MS;

  const configuredBaseUrl =
    options.baseUrl
      ? withoutTrailingSlash(
          options.baseUrl
        )
      : null;

  const keyDirectory =
    options.keyDirectory ??
    resolve(
      SERVER_DIRECTORY,
      ".local-keys"
    );

  const logger =
    options.logger ??
    console;

  const {
    privateKey,
    publicKey,
    created,
  } =
    await loadOrCreateKeyPair(
      keyDirectory
    );

  const publicJwk =
    await exportJWK(
      publicKey
    );

  const kid =
    await calculateJwkThumbprint(
      publicJwk
    );

  Object.assign(
    publicJwk,
    {
      kid,
      use:
        "sig",
      alg:
        "RS256",
    }
  );

  const codes =
    new Map();

  const cleanupExpiredCodes =
    () => {
      const now =
        Date.now();

      for (
        const [
          code,
          entry,
        ] of codes
      ) {
        if (
          entry.expiresAt <=
          now
        ) {
          codes.delete(
            code
          );
        }
      }
    };

  const cleanupTimer =
    setInterval(
      cleanupExpiredCodes,
      Math.min(
        codeTtlMs,
        30_000
      )
    );

  cleanupTimer.unref();

  function consumeCode(
    code
  ) {
    if (
      typeof code !==
        "string" ||
      code.length ===
        0
    ) {
      return {
        ok:
          false,

        status:
          400,

        error:
          "Código no recibido",
      };
    }

    const entry =
      codes.get(
        code
      );

    if (!entry) {
      return {
        ok:
          false,

        status:
          401,

        error:
          "Código inválido o ya utilizado",
      };
    }

    codes.delete(
      code
    );

    if (
      entry.expiresAt <=
      Date.now()
    ) {
      return {
        ok:
          false,

        status:
          401,

        error:
          "Código vencido",
      };
    }

    return {
      ok:
        true,

      user:
        entry.user,
    };
  }

  const app =
    express();

  app.disable(
    "x-powered-by"
  );

  /*
   * Solo para el entorno de pruebas.
   */
  app.use(
    cors()
  );

  app.use(
    express.json({
      limit:
        "16kb",
    })
  );

  /*
   * ====================================================
   * HEALTH
   * ====================================================
   */

  app.get(
    "/health",
    (
      _request,
      response
    ) => {
      response.json({
        ok:
          true,

        service:
          "ESSA JWT Mock",
      });
    }
  );

  /*
   * ====================================================
   * OPENID
   * ====================================================
   */

  app.get(
    "/.well-known/openid-configuration",
    (
      request,
      response
    ) => {
      const issuer =
        requestBaseUrl(
          request,
          configuredBaseUrl
        );

      response.json({
        issuer,

        jwks_uri:
          `${issuer}/jwks.json`,

        token_endpoint:
          `${issuer}/token`,

        id_token_signing_alg_values_supported:
          [
            "RS256",
          ],
      });
    }
  );

  app.get(
    "/jwks.json",
    (
      _request,
      response
    ) => {
      response.json({
        keys: [
          publicJwk,
        ],
      });
    }
  );

  /*
   * ====================================================
   * GENERACIÓN JWT
   * ====================================================
   *
   * /token?scenario=authenticated
   *
   * /token?scenario=anonymous
   */

  const issueToken =
    async (
      request,
      response
    ) => {
      try {
        const issuer =
          requestBaseUrl(
            request,
            configuredBaseUrl
          );

        const scenario =
          normalizeScenario(
            request.query
              ?.scenario ??
              request.body
                ?.scenario
          );

        const user =
          userForScenario(
            scenario
          );

        /*
         * IMPORTANTE:
         *
         * SignJWT recibe TODO el objeto.
         *
         * Por lo tanto personalinformation,
         * email, emails, phone_number,
         * document, etc. quedan realmente
         * dentro del payload.
         */
        const token =
          await new SignJWT(
            {
              ...user,
            }
          )
            .setProtectedHeader({
              alg:
                "RS256",

              kid,

              typ:
                "JWT",
            })
            .setIssuer(
              issuer
            )
            .setAudience(
              audience
            )
            .setIssuedAt()
            .setNotBefore(
              "0s"
            )
            .setExpirationTime(
              "30m"
            )
            .sign(
              privateKey
            );

        /*
         * Diagnóstico del mock.
         *
         * No imprimimos el JWT completo
         * aquí.
         */
        logger.info(
          `[JWT-MOCK] Token generado: ${scenario}`
        );

        logger.info(
          `[JWT-MOCK] Usuario: ${user.given_name} ${user.family_name}`
        );

        logger.info(
          `[JWT-MOCK] Documento: ${user.document}`
        );

        logger.info(
          `[JWT-MOCK] Email: ${user.email}`
        );

        logger.info(
          `[JWT-MOCK] personalinformation: ${user.personalinformation}`
        );

        response
          .set(
            "cache-control",
            "no-store"
          )
          .json({
            access_token:
              token,

            token_type:
              "Bearer",

            expires_in:
              1800,

            scenario,
          });
      } catch (error) {
        logger.error(
          "No se pudo generar el JWT:",
          error
        );

        response
          .status(500)
          .json({
            error:
              "No se pudo generar el JWT",
          });
      }
    };

  app.get(
    "/token",
    issueToken
  );

  app.post(
    "/token",
    issueToken
  );

  /*
   * ====================================================
   * EXCHANGE CODE
   * ====================================================
   */

  app.post(
    "/exchange-code",
    async (
      request,
      response
    ) => {
      const token =
        bearerToken(
          request
        );

      if (!token) {
        return response
          .status(401)
          .json({
            error:
              "Bearer token no recibido",
          });
      }

      try {
        const issuer =
          requestBaseUrl(
            request,
            configuredBaseUrl
          );

        const {
          payload,
        } =
          await jwtVerify(
            token,
            publicKey,
            {
              issuer,
              audience,
              algorithms: [
                "RS256",
              ],
            }
          );

        /*
         * personalinformation llega como
         * string JSON.
         */
        const personalInfo =
          parsePersonalInformation(
            payload
              .personalinformation
          );

        /*
         * El documento se busca primero
         * donde viene en el token del cliente:
         *
         * personalinformation
         * .numeroIdentificacion
         *
         * Y dejamos payload.document
         * como fallback.
         */
        const document =
          personalInfo
            ?.numeroIdentificacion ??
          payload.document;

        const email =
          payload.email ??
          personalInfo
            ?.correoElectronico;

        const phone =
          payload
            .phone_number ??
          personalInfo
            ?.telefonoMovil;

        const user = {
          oid:
            payload.oid,

          sub:
            payload.sub,

          email,

          emails:
            payload.emails,

          document,

          given_name:
            payload.given_name,

          family_name:
            payload.family_name,

          name:
            payload.name,

          phone_number:
            phone,

          personalinformation:
            payload
              .personalinformation,

          authenticated:
            payload
              .authenticated,
        };

        logger.info(
          "[JWT-MOCK] JWT decodificado"
        );

        logger.info(
          `[JWT-MOCK] Documento decodificado: ${
            document ??
            "NULL"
          }`
        );

        logger.info(
          `[JWT-MOCK] Email decodificado: ${
            email ??
            "NULL"
          }`
        );

        const code =
          randomBytes(
            32
          )
            .toString(
              "base64url"
            );

        codes.set(
          code,
          {
            user,

            expiresAt:
              Date.now() +
              codeTtlMs,
          }
        );

        return response
          .set(
            "cache-control",
            "no-store"
          )
          .json({
            code,

            expires_in:
              Math.ceil(
                codeTtlMs /
                  1000
              ),
          });
      } catch (error) {
        logger.warn(
          "JWT rechazado en /exchange-code.",
          error
        );

        return response
          .status(401)
          .json({
            error:
              "JWT inválido o expirado",
          });
      }
    }
  );

  /*
   * ====================================================
   * CONSUME CODE
   * ====================================================
   */

  app.post(
    "/consume-code",
    (
      request,
      response
    ) => {
      const result =
        consumeCode(
          request.body
            ?.code
        );

      if (!result.ok) {
        return response
          .status(
            result.status
          )
          .json({
            error:
              result.error,
          });
      }

      return response
        .set(
          "cache-control",
          "no-store"
        )
        .json({
          user:
            result.user,
        });
    }
  );

  /*
   * ====================================================
   * DNN TEST
   * ====================================================
   */

  app.get(
    "/dnn-test",
    (
      request,
      response
    ) => {
      const result =
        consumeCode(
          request.query
            ?.code
        );

      response
        .set(
          "cache-control",
          "no-store"
        )
        .type("html")
        .send(
          dnnTestPage(
            result
          )
        );
    }
  );

  /*
   * ====================================================
   * MANEJO ERRORES
   * ====================================================
   */

  app.use(
    (
      error,
      _request,
      response,
      _next
    ) => {
      if (
        error instanceof
          SyntaxError
      ) {
        return response
          .status(400)
          .json({
            error:
              "JSON inválido",
          });
      }

      logger.error(
        "Error inesperado en jwt-mock:",
        error
      );

      return response
        .status(500)
        .json({
          error:
            "Error interno del mock",
        });
    }
  );

  return {
    app,

    keyDirectory,

    keysCreated:
      created,

    stopCleanup:
      () =>
        clearInterval(
          cleanupTimer
        ),
  };
}

/*
 * ======================================================
 * DIRECCIONES LAN
 * ======================================================
 */

function lanUrls(
  port
) {
  const urls = [];

  for (
    const addresses
    of Object.values(
      networkInterfaces()
    )
  ) {
    for (
      const address
      of addresses ??
      []
    ) {
      if (
        address.family ===
          "IPv4" &&
        !address.internal
      ) {
        urls.push(
          `http://${address.address}:${port}`
        );
      }
    }
  }

  return [
    ...new Set(
      urls
    ),
  ];
}

/*
 * ======================================================
 * START SERVER
 * ======================================================
 */

export async function startServer() {
  const port =
    Number.parseInt(
      process.env.PORT ??
        `${DEFAULT_PORT}`,
      10
    );

  const codeTtlSeconds =
    Number.parseInt(
      process.env
        .JWT_MOCK_CODE_TTL_SECONDS ??
        "60",
      10
    );

  const keyDirectory =
    process.env
      .JWT_MOCK_KEY_DIR
      ? resolve(
          process.env
            .JWT_MOCK_KEY_DIR
        )
      : undefined;

  const mock =
    await createJwtMock({
      baseUrl:
        process.env
          .JWT_MOCK_BASE_URL,

      audience:
        process.env
          .JWT_MOCK_AUDIENCE,

      codeTtlMs:
        codeTtlSeconds *
        1000,

      keyDirectory,
    });

  return mock.app.listen(
    port,
    "0.0.0.0",
    () => {
      console.log(
        `\nJWT mock escuchando en 0.0.0.0:${port}`
      );

      console.log(
        `Claves ${
          mock.keysCreated
            ? "creadas"
            : "cargadas"
        } en ${mock.keyDirectory}`
      );

      console.log(
        `Local: http://localhost:${port}/health`
      );

      for (
        const url
        of lanUrls(
          port
        )
      ) {
        console.log(
          `LAN: ${url}/health`
        );
      }

      console.log(
        "Tokens disponibles:"
      );

      console.log(
        `  http://localhost:${port}/token?scenario=authenticated`
      );

      console.log(
        `  http://localhost:${port}/token?scenario=anonymous`
      );

      console.log("");
    }
  );
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      resolve(
        process.argv[1]
      )
    ).href;

if (isEntryPoint) {
  try {
    await startServer();
  } catch (error) {
    console.error(
      "No se pudo iniciar jwt-mock:",
      error
    );

    process.exitCode =
      1;
  }
}