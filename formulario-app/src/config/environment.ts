export type DnnScenario =
  | "authenticated"
  | "anonymous";

const REAL_DNN_URL =
  "https://upgrade.essa.com.co/site/serviciosdigitales/DesktopModules/CREG001/api/MobileAuth/Test";

function withoutTrailingSlash(
  value: string
): string {
  let result = value.trim();

  while (result.endsWith("/")) {
    result = result.slice(0, -1);
  }

  return result;
}

function getScenario(
  value?: string
): DnnScenario {
  return value
    ?.trim()
    .toLowerCase() ===
    "anonymous"
    ? "anonymous"
    : "authenticated";
}

function getPaso(
  value?: string
): string {
  const paso =
    value?.trim();

  if (
    paso === "1" ||
    paso === "2" ||
    paso === "3" ||
    paso === "4"
  ) {
    return paso;
  }

  return "1";
}

export const environment =
  Object.freeze({
    useMock:
      process.env
        .EXPO_PUBLIC_USE_MOCK
        ?.trim()
        .toLowerCase() ===
      "true",

    mockBaseUrl:
      withoutTrailingSlash(
        process.env
          .EXPO_PUBLIC_MOCK_BASE_URL ??
          "http://10.0.2.2:5050"
      ),

    dnnScenario:
      getScenario(
        process.env
          .EXPO_PUBLIC_DNN_SCENARIO
      ),

    dnnUrl:
      process.env
        .EXPO_PUBLIC_DNN_URL
        ?.trim() ||
      REAL_DNN_URL,

    dnnToken:
      process.env
        .EXPO_PUBLIC_DNN_TOKEN
        ?.trim() ?? "",

    dnnCuenta:
      process.env
        .EXPO_PUBLIC_DNN_CUENTA
        ?.trim() ?? "",

    dnnProceso:
      process.env
        .EXPO_PUBLIC_DNN_PROCESO
        ?.trim() ?? "",

    dnnPaso:
      getPaso(
        process.env
          .EXPO_PUBLIC_DNN_PASO
      ),
  });