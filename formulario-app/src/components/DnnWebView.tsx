import {
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  WebView,
  type WebViewMessageEvent,
} from "react-native-webview";

import type {
  DnnMessage,
  DnnMessageType,
} from "@/types/dnn";

const DNN_HOST =
  "upgrade.essa.com.co";

const MESSAGE_TYPES =
  new Set<DnnMessageType>([
    "AUTH_SUCCESS",
    "AUTH_ERROR",
    "NAVIGATE",
    "ACTION_DONE",
    "ERROR",
  ]);

type Props = {
  url: string;

  onMessage?: (
    message: DnnMessage
  ) => void;

  onRetry: () => void;
};

/**
 * Obtiene el token que realmente
 * quedó dentro de la URL inicial
 * enviada al WebView.
 */
function getTokenFromUrl(
  rawUrl: string
): string {
  try {
    const parsed =
      new URL(rawUrl);

    return (
      parsed.searchParams.get(
        "token"
      ) ?? ""
    );
  } catch {
    return "";
  }
}

/**
 * Log seguro:
 * oculta el token completo,
 * pero mantiene los demás
 * parámetros visibles.
 */
function safeNavigationLabel(
  rawUrl: string
): string {
  if (
    rawUrl ===
    "about:blank"
  ) {
    return rawUrl;
  }

  try {
    const parsed =
      new URL(rawUrl);

    const parameters =
      Array.from(
        parsed.searchParams.entries()
      ).map(
        ([
          key,
          value,
        ]) => {
          if (
            key.toLowerCase() ===
            "token"
          ) {
            return (
              `${key}=` +
              `[oculto: ${value.length} caracteres]`
            );
          }

          return `${key}=${value}`;
        }
      );

    const query =
      parameters.length
        ? `?${parameters.join(
            "&"
          )}`
        : "";

    return (
      `${parsed.origin}` +
      `${parsed.pathname}` +
      query
    );
  } catch {
    return "URL no válida";
  }
}

function isAllowedNavigation(
  rawUrl: string
): boolean {
  if (
    rawUrl ===
    "about:blank"
  ) {
    return true;
  }

  try {
    const requested =
      new URL(rawUrl);

    return (
      requested.protocol ===
        "https:" &&
      requested.hostname ===
        DNN_HOST
    );
  } catch {
    return false;
  }
}

function parseMessage(
  event: WebViewMessageEvent
): DnnMessage | null {
  try {
    const value: unknown =
      JSON.parse(
        event.nativeEvent.data
      );

    if (
      !value ||
      typeof value !==
        "object"
    ) {
      return null;
    }

    const candidate =
      value as Partial<DnnMessage>;

    if (
      typeof candidate.type !==
        "string" ||
      !MESSAGE_TYPES.has(
        candidate.type as
          DnnMessageType
      )
    ) {
      return null;
    }

    return candidate as
      DnnMessage;
  } catch {
    return null;
  }
}

export function DnnWebView({
  url,
  onMessage,
  onRetry,
}: Props) {
  const [
    error,
    setError,
  ] =
    useState<string>();

  const [
    showDebug,
    setShowDebug,
  ] =
    useState(false);

  const [
    showFullToken,
    setShowFullToken,
  ] =
    useState(false);

  /*
   * IMPORTANTE:
   *
   * Este token se extrae de la
   * URL que recibe el WebView.
   *
   * Por lo tanto nos permite
   * verificar qué token realmente
   * estamos entregándole.
   */
  const initialToken =
    getTokenFromUrl(url);

  const retry = () => {
    setError(undefined);
    onRetry();
  };

  if (error) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.title
          }
        >
          No se pudo abrir
          Servicios Digitales
        </Text>

        <Text
          style={
            styles.message
          }
        >
          {error}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={
            styles.button
          }
          onPress={
            retry
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            Reintentar
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      {__DEV__ && (
        <View
          style={
            styles.debugBar
          }
        >
          <View
            style={
              styles.debugHeader
            }
          >
            <View
              style={
                styles.debugHeaderText
              }
            >
              <Text
                style={
                  styles.debugTitle
                }
              >
                DEBUG JWT
              </Text>

              <Text
                style={
                  styles.debugSubtitle
                }
              >
                Token enviado al
                WebView:{" "}
                {initialToken.length}{" "}
                caracteres
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              style={
                styles.debugButton
              }
              onPress={() =>
                setShowDebug(
                  (current) =>
                    !current
                )
              }
            >
              <Text
                style={
                  styles.debugButtonText
                }
              >
                {showDebug
                  ? "Ocultar"
                  : "Ver"}
              </Text>
            </Pressable>
          </View>

          {showDebug && (
            <View
              style={
                styles.debugContent
              }
            >
              <Text
                style={
                  styles.debugLabel
                }
              >
                Longitud
              </Text>

              <Text
                selectable
                style={
                  styles.debugValue
                }
              >
                {initialToken.length}
              </Text>

              <Text
                style={
                  styles.debugLabel
                }
              >
                Inicio
              </Text>

              <Text
                selectable
                style={
                  styles.debugValue
                }
              >
                {initialToken.slice(
                  0,
                  40
                )}
              </Text>

              <Text
                style={
                  styles.debugLabel
                }
              >
                Final
              </Text>

              <Text
                selectable
                style={
                  styles.debugValue
                }
              >
                {initialToken.slice(
                  -40
                )}
              </Text>

              <Pressable
                accessibilityRole="button"
                style={
                  styles.fullTokenButton
                }
                onPress={() =>
                  setShowFullToken(
                    (current) =>
                      !current
                  )
                }
              >
                <Text
                  style={
                    styles.fullTokenButtonText
                  }
                >
                  {showFullToken
                    ? "Ocultar JWT completo"
                    : "Mostrar JWT completo"}
                </Text>
              </Pressable>

              {showFullToken && (
                <ScrollView
                  style={
                    styles.tokenScroll
                  }
                  nestedScrollEnabled
                >
                  <Text
                    selectable
                    style={
                      styles.fullToken
                    }
                  >
                    {initialToken}
                  </Text>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      )}

      <WebView
        source={{
          uri: url,
        }}
        style={
          styles.webView
        }
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
        thirdPartyCookiesEnabled

        onMessage={(
          event
        ) => {
          const message =
            parseMessage(
              event
            );

          if (message) {
            onMessage?.(
              message
            );
          } else {
            console.warn(
              "[DNN] Mensaje ignorado: formato o tipo no reconocido"
            );
          }
        }}

        onShouldStartLoadWithRequest={(
          request
        ) => {
          const allowed =
            isAllowedNavigation(
              request.url
            );

          console.info(
            `[DNN] Navegación ${
              allowed
                ? "permitida"
                : "bloqueada"
            }: ${safeNavigationLabel(
              request.url
            )}`
          );

          /*
           * Durante desarrollo
           * imprimimos también la
           * URL real de navegación.
           */
          if (__DEV__) {
            console.info(
              "[DEBUG] Navegación REAL:",
              request.url
            );
          }

          return allowed;
        }}

        onLoadStart={(
          event
        ) => {
          console.info(
            `[DNN] Iniciando navegación GET: ${safeNavigationLabel(
              event.nativeEvent
                .url
            )}`
          );
        }}

        onLoad={(
          event
        ) => {
          console.info(
            `[DNN] WebView cargada: ${safeNavigationLabel(
              event.nativeEvent
                .url
            )}`
          );

          if (__DEV__) {
            console.info(
              "[DEBUG] URL REAL cargada:",
              event.nativeEvent
                .url
            );
          }
        }}

        onError={(
          event
        ) => {
          console.warn(
            `[DNN] Error de carga: ${event.nativeEvent.code}`
          );

          setError(
            event.nativeEvent
              .description ||
              "No se pudo cargar DNN"
          );
        }}

        onHttpError={(
          event
        ) => {
          console.warn(
            `[DNN] Error HTTP: ${event.nativeEvent.statusCode}`
          );

          setError(
            `DNN respondió con HTTP ${event.nativeEvent.statusCode}`
          );
        }}

        renderLoading={() => (
          <View
            style={
              styles.center
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.message
              }
            >
              Cargando formulario
              DNN...
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#ffffff",
    },

    webView: {
      flex: 1,
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 24,
      backgroundColor:
        "#f7f9fb",
    },

    title: {
      fontSize: 18,
      fontWeight:
        "600",
      textAlign:
        "center",
    },

    message: {
      marginTop: 12,
      textAlign:
        "center",
      color:
        "#354052",
    },

    button: {
      marginTop: 22,
      paddingHorizontal:
        24,
      paddingVertical:
        12,
      borderRadius: 8,
      backgroundColor:
        "#208aef",
    },

    buttonText: {
      color:
        "#fff",
      fontWeight:
        "600",
    },

    debugBar: {
      borderBottomWidth: 1,
      borderBottomColor:
        "#d8dee8",
      backgroundColor:
        "#f8fafc",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },

    debugHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    debugHeaderText: {
      flex: 1,
    },

    debugTitle: {
      fontSize: 12,
      fontWeight:
        "700",
      color:
        "#17212b",
    },

    debugSubtitle: {
      marginTop: 2,
      fontSize: 11,
      color:
        "#64748b",
    },

    debugButton: {
      minHeight: 36,
      justifyContent:
        "center",
      paddingHorizontal: 14,
      borderRadius: 7,
      backgroundColor:
        "#208aef",
    },

    debugButtonText: {
      color:
        "#ffffff",
      fontSize: 12,
      fontWeight:
        "600",
    },

    debugContent: {
      marginTop: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor:
        "#eef2f7",
    },

    debugLabel: {
      marginTop: 6,
      fontSize: 11,
      fontWeight:
        "700",
      color:
        "#475569",
    },

    debugValue: {
      marginTop: 2,
      fontSize: 11,
      color:
        "#17212b",
    },

    fullTokenButton: {
      marginTop: 12,
      minHeight: 38,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#208aef",
      borderRadius: 7,
    },

    fullTokenButtonText: {
      color:
        "#208aef",
      fontSize: 12,
      fontWeight:
        "600",
    },

    tokenScroll: {
      maxHeight: 160,
      marginTop: 10,
      padding: 8,
      borderRadius: 6,
      backgroundColor:
        "#ffffff",
    },

    fullToken: {
      fontSize: 10,
      lineHeight: 15,
      color:
        "#17212b",
    },
  });