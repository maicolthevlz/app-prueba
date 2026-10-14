import {
  environment,
  type DnnScenario,
} from "@/config/environment";

type MockTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scenario?: string;
  error?: string;
};

function normalizeToken(
  value?: string
): string {
  const token =
    value?.trim() ?? "";

  if (
    token
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return token
      .slice(7)
      .trim();
  }

  return token;
}

export function validateJwt(
  rawToken: string
): string {
  const token =
    normalizeToken(
      rawToken
    );

  if (!token) {
    throw new Error(
      "El JWT está vacío"
    );
  }

  const parts =
    token.split(".");

  if (
    parts.length !== 3 ||
    parts.some(
      (part) =>
        part.length === 0
    )
  ) {
    throw new Error(
      "El token no tiene formato JWT válido. Debe tener header.payload.signature"
    );
  }

  return token;
}

/**
 * Obtiene el JWT que se enviará a DNN.
 *
 * Prioridad:
 *
 * 1. JWT pegado manualmente.
 * 2. EXPO_PUBLIC_DNN_TOKEN.
 * 3. Mock remoto/local, únicamente
 *    si EXPO_PUBLIC_USE_MOCK=true.
 */
export async function getAccessToken(
  scenario: DnnScenario =
    environment.dnnScenario,
  manualToken?: string
): Promise<string> {
  /*
   * =================================
   * TOKEN MANUAL
   * =================================
   */

  const manual =
    normalizeToken(
      manualToken
    );

  if (manual) {
    const token =
      validateJwt(
        manual
      );

    console.info(
      "[AUTH] Utilizando JWT manual"
    );

    console.info(
      `[AUTH] Escenario visual: ${scenario}`
    );

    console.info(
      `[AUTH] JWT length: ${token.length}`
    );

    console.info(
      `[AUTH] JWT partes: ${token.split(".").length}`
    );

    return token;
  }

  /*
   * =================================
   * TOKEN CONFIGURADO EN .ENV
   * =================================
   */

  const configuredToken =
    normalizeToken(
      environment.dnnToken
    );

  if (configuredToken) {
    const token =
      validateJwt(
        configuredToken
      );

    console.info(
      "[AUTH] Utilizando EXPO_PUBLIC_DNN_TOKEN"
    );

    console.info(
      `[AUTH] JWT length: ${token.length}`
    );

    return token;
  }

  /*
   * =================================
   * MOCK
   * =================================
   */

  if (
    environment.useMock
  ) {
    const url =
      `${environment.mockBaseUrl}` +
      `/token?scenario=` +
      encodeURIComponent(
        scenario
      );

    console.info(
      `[AUTH] Solicitando token al mock: ${scenario}`
    );

    const response =
      await fetch(
        url,
        {
          headers: {
            accept:
              "application/json",
          },
        }
      );

    let data:
      MockTokenResponse;

    try {
      data =
        (await response.json()) as
          MockTokenResponse;
    } catch {
      throw new Error(
        `El mock JWT respondió con contenido inválido (${response.status})`
      );
    }

    if (
      !response.ok ||
      !data.access_token
    ) {
      throw new Error(
        data.error ??
          `No se pudo generar JWT (${response.status})`
      );
    }

    const token =
      validateJwt(
        data.access_token
      );

    console.info(
      `[AUTH] Token generado por mock: ${
        data.scenario ??
        scenario
      }`
    );

    console.info(
      `[AUTH] JWT length: ${token.length}`
    );

    return token;
  }

  throw new Error(
    "Pega un JWT en el campo Token JWT antes de abrir el formulario"
  );
}