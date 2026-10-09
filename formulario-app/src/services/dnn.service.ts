export function buildDnnUrl(
  baseUrl: string,
  token: string,
  cuenta: string,
  proceso: string,
  paso: string
): string {
  const cleanToken =
    token.trim();

  const cleanCuenta =
    cuenta.trim();

  const cleanProceso =
    proceso.trim();

  const cleanPaso =
    paso.trim();

  if (!cleanToken) {
    throw new Error(
      "JWT vacío"
    );
  }

  if (!cleanCuenta) {
    throw new Error(
      "La cuenta es obligatoria"
    );
  }

  if (!cleanProceso) {
    throw new Error(
      "El proceso es obligatorio"
    );
  }

  if (
    ![
      "1",
      "2",
      "3",
      "4",
    ].includes(
      cleanPaso
    )
  ) {
    throw new Error(
      "El formulario debe ser 1, 2, 3 o 4"
    );
  }

  /*
   * Verificamos rápidamente
   * que conserve formato JWT.
   */
  const jwtParts =
    cleanToken.split(".");

  if (
    jwtParts.length !==
    3
  ) {
    throw new Error(
      `JWT inválido: se esperaban 3 partes y llegaron ${jwtParts.length}`
    );
  }

  const url =
    new URL(
      baseUrl.trim()
    );

  /*
   * =================================
   * URL REAL ENVIADA A DNN
   * =================================
   *
   * MobileAuth/Test
   *
   * ?token=JWT
   * &cuenta=...
   * &proceso=...
   * &paso=...
   */

  url.searchParams.set(
    "token",
    cleanToken
  );

  url.searchParams.set(
    "cuenta",
    cleanCuenta
  );

  url.searchParams.set(
    "proceso",
    cleanProceso
  );

  url.searchParams.set(
    "paso",
    cleanPaso
  );

  const finalUrl =
    url.toString();

  console.info(
    "[DNN] JWT length:",
    cleanToken.length
  );

  console.info(
    "[DNN] JWT partes:",
    jwtParts.length
  );

  console.info(
    "[DNN] JWT inicio:",
    cleanToken.slice(
      0,
      20
    )
  );

  console.info(
    "[DNN] JWT fin:",
    cleanToken.slice(
      -20
    )
  );

  console.info(
    "[DNN] Cuenta:",
    cleanCuenta
  );

  console.info(
    "[DNN] Proceso:",
    cleanProceso
  );

  console.info(
    "[DNN] Formulario/paso:",
    cleanPaso
  );

  /*
   * =================================
   * LOG SEGURO
   * =================================
   *
   * Esta NO es la URL literal.
   *
   * El JWT está oculto solamente
   * para que el log sea legible.
   */

  console.info(
    "[DNN] URL resumen:",
    `${url.origin}${url.pathname}` +
      `?token=[JWT oculto: ${cleanToken.length} caracteres]` +
      `&cuenta=${encodeURIComponent(
        cleanCuenta
      )}` +
      `&proceso=${encodeURIComponent(
        cleanProceso
      )}` +
      `&paso=${encodeURIComponent(
        cleanPaso
      )}`
  );

  /*
   * =================================
   * DIAGNÓSTICO TEMPORAL
   * =================================
   *
   * Solo aparece durante desarrollo.
   *
   * Quitar cuando terminemos las
   * pruebas con Santi.
   */

  if (__DEV__) {
    console.info(
      "[DEBUG] JWT REAL ENVIADO:"
    );

    console.info(
      cleanToken
    );

    console.info(
      "[DEBUG] URL REAL ENVIADA:"
    );

    console.info(
      finalUrl
    );
  }

  return finalUrl;
}