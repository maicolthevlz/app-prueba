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

/**
 * Obtiene el JWT que posteriormente
 * será enviado a DNN.
 */
export async function getAccessToken(
  scenario: DnnScenario =
    environment.dnnScenario
): Promise<string> {
  /*
   * ==============================
   * MOCK
   * ==============================
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
      `[AUTH] Solicitando token: ${scenario}`
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
      data.access_token.trim();

    if (!token) {
      throw new Error(
        "El mock devolvió un JWT vacío"
      );
    }

    /*
     * Un JWT normal tiene:
     *
     * header.payload.signature
     */
    const parts =
      token.split(".");

    if (
      parts.length !==
      3
    ) {
      throw new Error(
        `El token recibido no tiene formato JWT válido (${parts.length} partes)`
      );
    }

    console.info(
      `[AUTH] Token generado: ${
        data.scenario ??
        scenario
      }`
    );

    console.info(
      `[AUTH] JWT length: ${token.length}`
    );

    console.info(
      `[AUTH] JWT partes: ${parts.length}`
    );

    return token;
  }

  /*
   * ==============================
   * TOKEN REAL
   * ==============================
   */

  const token =
    environment
      .dnnToken
      .trim();

  if (!token) {
    throw new Error(
      "Configura EXPO_PUBLIC_DNN_TOKEN"
    );
  }

  const parts =
    token.split(".");

  if (
    parts.length !==
    3
  ) {
    throw new Error(
      "EXPO_PUBLIC_DNN_TOKEN no tiene formato JWT válido"
    );
  }

  console.info(
    "[AUTH] Utilizando token real"
  );

  console.info(
    `[AUTH] JWT length: ${token.length}`
  );

  return token;
}