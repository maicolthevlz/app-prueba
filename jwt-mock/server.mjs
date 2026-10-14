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

/*
 * ======================================================
 * CONFIGURACIÓN
 * ======================================================
 */

const SERVER_DIRECTORY =
  dirname(
    fileURLToPath(
      import.meta.url
    )
  );

const DEFAULT_PORT = 5050;

/*
 * Audience observado en el token real.
 */
const DEFAULT_AUDIENCE =
  "de60c92e-c254-401d-8b76-276fb37e50b5";

const DEFAULT_CODE_TTL_MS =
  60_000;

/*
 * El JWT dura 8 horas para facilitar
 * las pruebas manuales.
 */
const TOKEN_TTL = "8h";

const TOKEN_TTL_SECONDS =
  8 * 60 * 60;

const PRIVATE_KEY_FILE =
  "private-key.pem";

const PUBLIC_KEY_FILE =
  "public-key.pem";

/*
 * ======================================================
 * PERSONAL INFORMATION
 * ======================================================
 *
 * IMPORTANTE:
 *
 * En el JWT real `personalinformation`
 * NO es un objeto.
 *
 * Es un STRING que internamente contiene JSON.
 *
 * Ejemplo:
 *
 * "personalinformation":
 * "{\"correoElectronico\":\"...\",...}"
 */

function createPersonalInformation({
  email,
  document,
  givenName,
  surname,
  displayName,
  phone,
}) {
  return JSON.stringify({
    /*
     * Correo del usuario.
     */
    correoElectronico:
      email,

    /*
     * Según el token real.
     */
    idTipoIdentificacion:
      "1",

    /*
     * Documento.
     */
    numeroIdentificacion:
      document,

    /*
     * Nombre.
     */
    nombres:
      givenName,

    /*
     * IMPORTANTE:
     *
     * El token real usa:
     *
     * apellidos
     *
     * NO:
     *
     * primerApellido
     * segundoApellido
     */
    apellidos:
      surname,

    /*
     * Nombre mostrado.
     */
    nombreParaMostrar:
      displayName ??
      givenName,

    /*
     * Teléfono sin +57 porque
     * codigoPais viene separado.
     */
    telefonoMovil:
      phone,

    /*
     * El token real usa +57.
     */
    codigoPais:
      "+57",

    /*
     * Claims adicionales presentes
     * en personalinformation real.
     */
    aceptaTerminosYCondiciones:
      "SI",

    aceptaPoliticaPrivacidad:
      "SI",

    fechaAceptacionTerminosDatos:
      "2026-05-20T22:16:41.6282143+00:00",

    estadoRegistro:
      "Activo",
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

    family_name:
      "Prueba",

    given_name:
      "Usuario",

    name:
      "Usuario Prueba",

    phone_number:
      "3001234567",

    /*
     * Lo dejamos también en raíz
     * como compatibilidad.
     *
     * El dato importante para DNN
     * está en:
     *
     * personalinformation
     *   .numeroIdentificacion
     */
    document:
      "13844928",

    /*
     * MISMA ESTRUCTURA DEL TOKEN REAL.
     */
    personalinformation:
      createPersonalInformation({
        email:
          "usuario.prueba@essa.com.co",

        document:
          "13844928",

        givenName:
          "Usuario",

        surname:
          "Prueba",

        displayName:
          "Usuario",

        phone:
          "3001234567",
      }),

    /*
     * Claims observados en el JWT
     * real de Azure B2C.
     */
    tfp:
      "B2C_1A_signup_signin",

    nonce:
      "mock-nonce-authenticated",

    azp:
      "de60c92e-c254-401d-8b76-276fb37e50b5",

    ver:
      "1.0",

    /*
     * Claim auxiliar de nuestro mock.
     */
    authenticated:
      true,
  });

/*
 * ======================================================
 * USUARIO NO AUTENTICADO
 * ======================================================
 *
 * Lo dejamos con la misma estructura completa
 * para poder probar:
 *
 * Formulario 1 anónimo
 * Formulario 2 anónimo
 * Formulario 3 anónimo
 * Formulario 4 anónimo
 *
 * La diferencia principal será:
 *
 * authenticated = false
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

    family_name:
      "Anonimo",

    given_name:
      "Usuario",

    name:
      "Usuario Anonimo",

    phone_number:
      "3009876543",

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

        surname:
          "Anonimo",

        displayName:
          "Usuario",

        phone:
          "3009876543",
      }),

    tfp:
      "B2C_1A_signup_signin",

    nonce:
      "mock-nonce-anonymous",

    azp:
      "de60c92e-c254-401d-8b76-276fb37e50b5",

    ver:
      "1.0",

    authenticated:
      false,
  });

/*
 * ======================================================
 * HELPERS
 * ======================================================
 */

function withoutTrailingSlash(
  value
) {
  let result =
    String(
      value ?? ""
    );

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

  /*
   * IMPORTANTE:
   *
   * Dejamos el issuer apuntando al mock.
   *
   * NO fingimos que somos directamente
   * el issuer real de EPM porque nuestro
   * JWT está firmado con nuestras propias
   * claves RSA locales.
   */
  return (
    `${request.protocol}` +
    `://${request.get("host")}`
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
    .stringify(
      value
    )
    .replaceAll(
      "<",
      String.raw`\u003c`
    );
}

/*
 * Convierte personalinformation
 * desde string JSON a objeto.
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
      JSON.parse(
        value
      );

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
 * RSA
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
 * PÁGINA LOCAL DE PRUEBA
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
    result.user
      ?.document ??
    "No disponible";

  const email =
    result.user
      ?.email ??
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

<p>
${message}
</p>

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
 * JWT MOCK
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

  /*
   * ====================================================
   * CLAVES
   * ====================================================
   */

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

  /*
   * Códigos temporales.
   */
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

  /*
   * ====================================================
   * EXPRESS
   * ====================================================
   */

  const app =
    express();

  app.disable(
    "x-powered-by"
  );

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
   * ROOT
   * ====================================================
   */

  app.get(
    "/",
    (
      _request,
      response
    ) => {
      response.json({
        ok:
          true,

        service:
          "ESSA JWT Mock",

        token_ttl:
          TOKEN_TTL,

        audience,

        endpoints: {
          health:
            "/health",

          authenticated:
            "/token?scenario=authenticated",

          anonymous:
            "/token?scenario=anonymous",

          jwks:
            "/jwks.json",
        },
      });
    }
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

        token_ttl:
          TOKEN_TTL,

        audience,
      });
    }
  );

  /*
   * ====================================================
   * OPENID CONFIG
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

  /*
   * ====================================================
   * JWKS
   * ====================================================
   */

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
   * GENERACIÓN DE JWT
   * ====================================================
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
         * TODO el objeto user pasa al payload.
         *
         * Por lo tanto:
         *
         * email
         * emails
         * oid
         * sub
         * name
         * given_name
         * family_name
         * phone_number
         * personalinformation
         * tfp
         * nonce
         * azp
         * ver
         * authenticated
         *
         * terminan realmente dentro del JWT.
         */
        const token =
          await new SignJWT({
            ...user,
          })

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
              TOKEN_TTL
            )

            .sign(
              privateKey
            );

        /*
         * Diagnóstico.
         */
        logger.info(
          `[JWT-MOCK] Token generado: ${scenario}`
        );

        logger.info(
          `[JWT-MOCK] Usuario: ${user.given_name} ${user.family_name}`
        );

        logger.info(
          `[JWT-MOCK] Documento: ${
            user.document ??
            "NULL"
          }`
        );

        logger.info(
          `[JWT-MOCK] Email: ${
            user.email ??
            "NULL"
          }`
        );

        logger.info(
          `[JWT-MOCK] personalinformation: ${user.personalinformation}`
        );

        logger.info(
          `[JWT-MOCK] Audience: ${audience}`
        );

        logger.info(
          `[JWT-MOCK] Issuer: ${issuer}`
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
              TOKEN_TTL_SECONDS,

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
         * JSON serializado.
         */
        const personalInfo =
          parsePersonalInformation(
            payload
              .personalinformation
          );

        /*
         * Documento.
         */
        const document =
          personalInfo
            ?.numeroIdentificacion ??
          payload.document;

        /*
         * Correo.
         */
        const email =
          payload.email ??
          personalInfo
            ?.correoElectronico;

        /*
         * Teléfono.
         */
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

          tfp:
            payload.tfp,

          nonce:
            payload.nonce,

          azp:
            payload.azp,

          ver:
            payload.ver,

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

        logger.info(
          `[JWT-MOCK] PersonalInformation: ${
            payload.personalinformation ??
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
   * DNN LOCAL TEST
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
        .type(
          "html"
        )
        .send(
          dnnTestPage(
            result
          )
        );
    }
  );

  /*
   * ====================================================
   * ERROR HANDLER
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

  const server =
    mock.app.listen(
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
          `JWT TTL: ${TOKEN_TTL}`
        );

        console.log(
          `Audience: ${process.env.JWT_MOCK_AUDIENCE ?? DEFAULT_AUDIENCE}`
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
          "\nTokens:"
        );

        console.log(
          `  Autenticado: http://localhost:${port}/token?scenario=authenticated`
        );

        console.log(
          `  Anónimo:     http://localhost:${port}/token?scenario=anonymous`
        );

        console.log(
          "\nServidor activo. Ctrl+C para detenerlo.\n"
        );
      }
    );

  server.on(
    "error",
    (
      error
    ) => {
      console.error(
        "[JWT-MOCK] Error del servidor:",
        error
      );
    }
  );

  return server;
}

/*
 * ======================================================
 * ENTRY POINT
 * ======================================================
 */

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
    const server =
      await startServer();

    /*
     * Cierre controlado.
     */
    process.on(
      "SIGINT",
      () => {
        console.log(
          "\n[JWT-MOCK] Cerrando servidor..."
        );

        server.close(
          () => {
            process.exit(
              0
            );
          }
        );
      }
    );
  } catch (error) {
    console.error(
      "No se pudo iniciar jwt-mock:",
      error
    );

    process.exitCode =
      1;
  }
}