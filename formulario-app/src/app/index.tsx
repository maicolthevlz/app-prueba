import {
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  DnnWebView,
} from "@/components/DnnWebView";

import {
  environment,
  type DnnScenario,
} from "@/config/environment";

import {
  getAccessToken,
} from "@/services/auth.service";

import {
  buildDnnUrl,
} from "@/services/dnn.service";

import type {
  DnnMessage,
} from "@/types/dnn";

type Paso =
  | "1"
  | "2"
  | "3"
  | "4";

const PASOS: Paso[] = [
  "1",
  "2",
  "3",
  "4",
];

function normalizePreviewToken(
  value: string
): string {
  const clean =
    value.trim();

  if (
    clean
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return clean
      .slice(7)
      .trim();
  }

  return clean;
}

export default function HomeScreen() {
  const [
    cuenta,
    setCuenta,
  ] = useState(
    environment.dnnCuenta
  );

  const [
    proceso,
    setProceso,
  ] = useState(
    environment.dnnProceso
  );

  const [
    paso,
    setPaso,
  ] =
    useState<Paso>(
      environment.dnnPaso as Paso
    );

  const [
    scenario,
    setScenario,
  ] =
    useState<DnnScenario>(
      environment.dnnScenario
    );

  /*
   * JWT PEGADO MANUALMENTE.
   */
  const [
    manualToken,
    setManualToken,
  ] =
    useState("");

  const [
    formUrl,
    setFormUrl,
  ] =
    useState<string>();

  const [
    error,
    setError,
  ] =
    useState<string>();

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const tokenPreview =
    useMemo(
      () =>
        normalizePreviewToken(
          manualToken
        ),
      [
        manualToken,
      ]
    );

  const tokenParts =
    useMemo(
      () =>
        tokenPreview
          ? tokenPreview.split(
              "."
            ).length
          : 0,
      [
        tokenPreview,
      ]
    );

  const tokenLooksValid =
    tokenPreview.length >
      0 &&
    tokenParts === 3;

  const abrirFormulario =
    async () => {
      const cleanCuenta =
        cuenta.trim();

      const cleanProceso =
        proceso.trim();

      const cleanManualToken =
        manualToken.trim();

      setError(
        undefined
      );

      if (!cleanCuenta) {
        setError(
          "Ingresa la cuenta."
        );
        return;
      }

      if (!cleanProceso) {
        setError(
          "Ingresa el proceso."
        );
        return;
      }

      /*
       * Para esta prueba definitiva
       * exigimos JWT manual.
       *
       * Así NO dependemos de:
       * Cloudflare,
       * localhost,
       * VPN para el mock,
       * ni fetch externo.
       */
      if (
        !cleanManualToken
      ) {
        setError(
          "Pega el JWT que deseas probar."
        );
        return;
      }

      if (
        tokenParts !== 3
      ) {
        setError(
          "El JWT pegado no parece válido. Debe contener 3 partes separadas por puntos."
        );
        return;
      }

      setLoading(
        true
      );

      try {
        /*
         * =================================
         * 1. TOKEN
         * =================================
         *
         * Al enviar manualToken,
         * auth.service NO hace fetch.
         */

        const token =
          await getAccessToken(
            scenario,
            cleanManualToken
          );

        console.info(
          `[DNN] Usuario seleccionado: ${scenario}`
        );

        console.info(
          `[DNN] Formulario: ${paso}`
        );

        console.info(
          "[DNN] Fuente del token: MANUAL"
        );

        /*
         * =================================
         * 2. URL DNN
         * =================================
         */

        const url =
          buildDnnUrl(
            environment.dnnUrl,
            token,
            cleanCuenta,
            cleanProceso,
            paso
          );

        /*
         * =================================
         * 3. WEBVIEW
         * =================================
         */

        setFormUrl(
          url
        );
      } catch (
        cause: unknown
      ) {
        const message =
          cause instanceof
          Error
            ? cause.message
            : "No se pudo preparar DNN";

        console.warn(
          `[DNN] ${message}`
        );

        setError(
          message
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const volverAConsulta =
    () => {
      setFormUrl(
        undefined
      );

      setError(
        undefined
      );
    };

  const retry =
    () => {
      setFormUrl(
        undefined
      );

      setTimeout(
        () => {
          void abrirFormulario();
        },
        0
      );
    };

  const handleDnnMessage =
    (
      message: DnnMessage
    ) => {
      console.info(
        `[DNN] Mensaje recibido: ${message.type}`
      );

      if (
        message.type ===
        "AUTH_ERROR"
      ) {
        const messageText =
          typeof message
            .payload
            ?.message ===
          "string"
            ? message
                .payload
                .message
            : "DNN informó un error de autenticación";

        setError(
          messageText
        );

        setFormUrl(
          undefined
        );
      }

      if (
        message.type ===
        "ERROR"
      ) {
        console.warn(
          "[DNN] Error informado por DNN"
        );
      }
    };

  /*
   * =================================
   * WEBVIEW
   * =================================
   */

  if (formUrl) {
    return (
      <View
        style={
          styles.webContainer
        }
      >
        <View
          style={
            styles.webHeader
          }
        >
          <Pressable
            accessibilityRole="button"
            style={
              styles.backButton
            }
            onPress={
              volverAConsulta
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ← Volver
            </Text>
          </Pressable>

          <View
            style={
              styles.webHeaderInfo
            }
          >
            <Text
              style={
                styles.webHeaderTitle
              }
            >
              Formulario {paso}
            </Text>

            <Text
              style={
                styles.webHeaderSubtitle
              }
            >
              {scenario ===
              "authenticated"
                ? "Autenticado"
                : "No autenticado"}
              {" · "}
              JWT manual
            </Text>
          </View>
        </View>

        <View
          style={
            styles.webView
          }
        >
          <DnnWebView
            url={
              formUrl
            }
            onMessage={
              handleDnnMessage
            }
            onRetry={
              retry
            }
          />
        </View>
      </View>
    );
  }

  /*
   * =================================
   * CONFIGURACIÓN DE PRUEBA
   * =================================
   */

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={
          styles.content
        }
      >
        <Text
          style={
            styles.title
          }
        >
          Prueba DNN CREG001
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Configura la prueba,
          pega el JWT y abre
          directamente el
          formulario DNN.
        </Text>

        {/*
         * =============================
         * CUENTA / PROCESO
         * =============================
         */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            1. Datos de la solicitud
          </Text>

          <Text
            style={
              styles.label
            }
          >
            Cuenta
          </Text>

          <TextInput
            value={
              cuenta
            }
            onChangeText={
              setCuenta
            }
            placeholder="Ej: 123456"
            autoCapitalize="none"
            autoCorrect={
              false
            }
            style={
              styles.input
            }
          />

          <Text
            style={
              styles.label
            }
          >
            Proceso
          </Text>

          <TextInput
            value={
              proceso
            }
            onChangeText={
              setProceso
            }
            placeholder="Ej: 123456"
            autoCapitalize="none"
            autoCorrect={
              false
            }
            style={
              styles.input
            }
          />
        </View>

        {/*
         * =============================
         * FORMULARIO
         * =============================
         */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            2. Formulario
          </Text>

          <Text
            style={
              styles.helpText
            }
          >
            El valor seleccionado
            se envía como parámetro
            paso.
          </Text>

          <View
            style={
              styles.optionRow
            }
          >
            {PASOS.map(
              (item) => {
                const selected =
                  paso ===
                  item;

                return (
                  <Pressable
                    key={
                      item
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                    }}
                    onPress={() =>
                      setPaso(
                        item
                      )
                    }
                    style={[
                      styles.formButton,
                      selected &&
                        styles.selectedButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.formButtonText,
                        selected &&
                          styles.selectedButtonText,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

        {/*
         * =============================
         * ESCENARIO
         * =============================
         */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            3. Tipo de usuario
          </Text>

          <View
            style={
              styles.scenarioRow
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected:
                  scenario ===
                  "authenticated",
              }}
              style={[
                styles.scenarioButton,
                scenario ===
                  "authenticated" &&
                  styles.selectedButton,
              ]}
              onPress={() =>
                setScenario(
                  "authenticated"
                )
              }
            >
              <Text
                style={[
                  styles.scenarioButtonText,
                  scenario ===
                    "authenticated" &&
                    styles.selectedButtonText,
                ]}
              >
                Autenticado
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected:
                  scenario ===
                  "anonymous",
              }}
              style={[
                styles.scenarioButton,
                scenario ===
                  "anonymous" &&
                  styles.selectedButton,
              ]}
              onPress={() =>
                setScenario(
                  "anonymous"
                )
              }
            >
              <Text
                style={[
                  styles.scenarioButtonText,
                  scenario ===
                    "anonymous" &&
                    styles.selectedButtonText,
                ]}
              >
                No autenticado
              </Text>
            </Pressable>
          </View>

          <Text
            style={
              styles.warningText
            }
          >
            Importante: este selector
            identifica la prueba, pero
            no modifica un JWT pegado.
            Pega el token correspondiente
            al escenario seleccionado.
          </Text>
        </View>

        {/*
         * =============================
         * TOKEN MANUAL
         * =============================
         */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            4. Token JWT
          </Text>

          <Text
            style={
              styles.helpText
            }
          >
            Pega el JWT completo.
            También puedes pegarlo
            empezando por "Bearer ".
          </Text>

          <TextInput
            value={
              manualToken
            }
            onChangeText={
              setManualToken
            }
            placeholder="eyJhbGciOiJSUzI1NiIs..."
            autoCapitalize="none"
            autoCorrect={
              false
            }
            multiline
            numberOfLines={
              7
            }
            textAlignVertical="top"
            style={[
              styles.input,
              styles.tokenInput,
            ]}
          />

          <View
            style={
              styles.tokenStatusRow
            }
          >
            <View
              style={
                styles.tokenStatusInfo
              }
            >
              <Text
                style={
                  styles.tokenMeta
                }
              >
                Longitud:{" "}
                {tokenPreview.length}
              </Text>

              <Text
                style={
                  styles.tokenMeta
                }
              >
                Partes JWT:{" "}
                {tokenParts}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                tokenLooksValid
                  ? styles.statusOk
                  : styles.statusPending,
              ]}
            >
              <Text
                style={
                  styles.statusBadgeText
                }
              >
                {tokenLooksValid
                  ? "Formato válido"
                  : "Sin validar"}
              </Text>
            </View>
          </View>

          {tokenPreview && (
            <View
              style={
                styles.tokenPreview
              }
            >
              <Text
                style={
                  styles.tokenPreviewLabel
                }
              >
                Inicio
              </Text>

              <Text
                selectable
                style={
                  styles.tokenPreviewValue
                }
              >
                {tokenPreview.slice(
                  0,
                  32
                )}
                ...
              </Text>

              <Text
                style={
                  styles.tokenPreviewLabel
                }
              >
                Final
              </Text>

              <Text
                selectable
                style={
                  styles.tokenPreviewValue
                }
              >
                ...
                {tokenPreview.slice(
                  -32
                )}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setManualToken(
                ""
              );
              setError(
                undefined
              );
            }}
            style={
              styles.clearButton
            }
          >
            <Text
              style={
                styles.clearButtonText
              }
            >
              Limpiar token
            </Text>
          </Pressable>
        </View>

        {/*
         * =============================
         * RESUMEN
         * =============================
         */}

        <View
          style={
            styles.summary
          }
        >
          <Text
            style={
              styles.summaryTitle
            }
          >
            Prueba actual
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            Cuenta:{" "}
            {cuenta ||
              "Sin definir"}
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            Proceso:{" "}
            {proceso ||
              "Sin definir"}
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            Formulario:{" "}
            {paso}
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            Usuario:{" "}
            {scenario ===
            "authenticated"
              ? "Autenticado"
              : "No autenticado"}
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            Token: Manual
          </Text>

          <Text
            style={
              styles.summaryText
            }
          >
            JWT:{" "}
            {tokenLooksValid
              ? `${tokenPreview.length} caracteres`
              : "Pendiente"}
          </Text>
        </View>

        {error && (
          <View
            style={
              styles.errorBox
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={
            loading
          }
          style={[
            styles.openButton,
            loading &&
              styles.disabledButton,
          ]}
          onPress={() =>
            void abrirFormulario()
          }
        >
          {loading ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text
              style={
                styles.openButtonText
              }
            >
              Abrir formulario{" "}
              {paso}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor:
        "#f4f7fa",
      padding: 18,
    },

    content: {
      width: "100%",
      maxWidth: 620,
      alignSelf:
        "center",
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      padding: 20,
    },

    title: {
      fontSize: 26,
      fontWeight:
        "700",
      color:
        "#17212b",
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 24,
      fontSize: 15,
      lineHeight: 21,
      color:
        "#64748b",
    },

    section: {
      marginBottom: 24,
    },

    sectionTitle: {
      marginBottom: 12,
      fontSize: 17,
      fontWeight:
        "700",
      color:
        "#17212b",
    },

    label: {
      marginBottom: 8,
      fontSize: 14,
      fontWeight:
        "600",
      color:
        "#334155",
    },

    helpText: {
      marginBottom: 12,
      fontSize: 13,
      lineHeight: 18,
      color:
        "#64748b",
    },

    warningText: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 18,
      color:
        "#92400e",
    },

    input: {
      minHeight: 50,
      marginBottom: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 10,
      backgroundColor:
        "#ffffff",
      color:
        "#17212b",
      fontSize: 15,
    },

    tokenInput: {
      minHeight: 150,
      fontSize: 12,
      lineHeight: 18,
    },

    optionRow: {
      flexDirection:
        "row",
      gap: 10,
    },

    formButton: {
      flex: 1,
      minHeight: 48,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 10,
      backgroundColor:
        "#ffffff",
    },

    formButtonText: {
      fontSize: 16,
      fontWeight:
        "600",
      color:
        "#334155",
    },

    scenarioRow: {
      flexDirection:
        "row",
      gap: 10,
    },

    scenarioButton: {
      flex: 1,
      minHeight: 50,
      paddingHorizontal: 10,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 10,
      backgroundColor:
        "#ffffff",
    },

    scenarioButtonText: {
      textAlign:
        "center",
      fontSize: 14,
      fontWeight:
        "600",
      color:
        "#334155",
    },

    selectedButton: {
      borderColor:
        "#208aef",
      backgroundColor:
        "#208aef",
    },

    selectedButtonText: {
      color:
        "#ffffff",
    },

    tokenStatusRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap: 12,
    },

    tokenStatusInfo: {
      flex: 1,
    },

    tokenMeta: {
      fontSize: 12,
      color:
        "#64748b",
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },

    statusOk: {
      backgroundColor:
        "#dcfce7",
    },

    statusPending: {
      backgroundColor:
        "#e2e8f0",
    },

    statusBadgeText: {
      fontSize: 11,
      fontWeight:
        "700",
      color:
        "#334155",
    },

    tokenPreview: {
      marginTop: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor:
        "#f8fafc",
    },

    tokenPreviewLabel: {
      marginTop: 4,
      fontSize: 11,
      fontWeight:
        "700",
      color:
        "#64748b",
    },

    tokenPreviewValue: {
      marginTop: 2,
      fontSize: 11,
      color:
        "#17212b",
    },

    clearButton: {
      alignSelf:
        "flex-start",
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 8,
    },

    clearButtonText: {
      fontSize: 12,
      fontWeight:
        "600",
      color:
        "#475569",
    },

    summary: {
      marginBottom: 20,
      padding: 16,
      borderRadius: 10,
      backgroundColor:
        "#f1f5f9",
    },

    summaryTitle: {
      marginBottom: 8,
      fontSize: 15,
      fontWeight:
        "700",
      color:
        "#17212b",
    },

    summaryText: {
      marginTop: 3,
      fontSize: 14,
      color:
        "#475569",
    },

    errorBox: {
      marginBottom: 18,
      padding: 14,
      borderRadius: 10,
      backgroundColor:
        "#fee2e2",
    },

    errorText: {
      color:
        "#991b1b",
      fontSize: 14,
      lineHeight: 19,
    },

    openButton: {
      minHeight: 56,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor:
        "#208aef",
    },

    openButtonText: {
      color:
        "#ffffff",
      fontSize: 16,
      fontWeight:
        "700",
    },

    disabledButton: {
      opacity: 0.6,
    },

    webContainer: {
      flex: 1,
      backgroundColor:
        "#ffffff",
    },

    webHeader: {
      minHeight: 64,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor:
        "#e2e8f0",
      backgroundColor:
        "#ffffff",
    },

    backButton: {
      minHeight: 44,
      justifyContent:
        "center",
      paddingHorizontal: 10,
    },

    backButtonText: {
      color:
        "#208aef",
      fontSize: 15,
      fontWeight:
        "600",
    },

    webHeaderInfo: {
      flex: 1,
      marginLeft: 8,
    },

    webHeaderTitle: {
      fontSize: 16,
      fontWeight:
        "700",
      color:
        "#17212b",
    },

    webHeaderSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color:
        "#64748b",
    },

    webView: {
      flex: 1,
    },
  });