import {
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

  const abrirFormulario =
    async () => {
      const cleanCuenta =
        cuenta.trim();

      const cleanProceso =
        proceso.trim();

      setError(undefined);

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

      setLoading(true);

      try {
        /*
         * 1. Generamos JWT.
         */
        const token =
          await getAccessToken(
            scenario
          );

        if (
          !token?.trim()
        ) {
          throw new Error(
            "No se recibió JWT"
          );
        }

        console.info(
          `[DNN] Usuario: ${scenario}`
        );

        console.info(
          `[DNN] Formulario: ${paso}`
        );

        /*
         * 2. Construimos:
         *
         * MobileAuth/Test
         * ?token=JWT
         * &cuenta=...
         * &proceso=...
         * &paso=...
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
         * 3. Esta URL es la que
         * recibirá DnnWebView.
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

  const retry = () => {
    setFormUrl(
      undefined
    );

    setTimeout(() => {
      void abrirFormulario();
    }, 0);
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
          "[DNN] Error transitorio recibido"
        );
      }
    };

  /*
   * WEBVIEW
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
                ? "Usuario autenticado"
                : "Usuario no autenticado"}
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
   * CONSULTA
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
          Consulta de estado
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Configura los datos
          de la prueba antes
          de abrir DNN.
        </Text>

        <View
          style={
            styles.section
          }
        >
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

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Formulario
          </Text>

          <Text
            style={
              styles.helpText
            }
          >
            Selecciona el
            formulario que
            deseas visualizar.
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

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Tipo de usuario
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
        </View>

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
            Token:{" "}
            {environment.useMock
              ? "Mock"
              : "Real"}
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
      padding: 20,
      justifyContent:
        "center",
    },

    content: {
      width: "100%",
      maxWidth: 560,
      alignSelf:
        "center",
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      padding: 22,
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
      marginBottom: 22,
    },

    label: {
      marginBottom: 8,
      fontSize: 15,
      fontWeight:
        "600",
      color:
        "#17212b",
    },

    helpText: {
      marginTop: -3,
      marginBottom: 12,
      fontSize: 13,
      color:
        "#64748b",
    },

    input: {
      minHeight: 50,
      marginBottom: 16,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 10,
      backgroundColor:
        "#ffffff",
      color:
        "#17212b",
      fontSize: 16,
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
    },

    openButton: {
      minHeight: 54,
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