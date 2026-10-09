# Integración React Native + DNN (entorno de prueba)

Este workspace contiene una app Expo y un servidor local. El flujo de prueba es:

```text
Expo -> Access Token -> POST al endpoint de prueba DNN
     -> success: true -> WebView del formulario DNN
```

El Access Token nunca se envía al WebView. Las claves privadas y los tokens tampoco se guardan en el repositorio.

## Inicio rápido

Se necesita Node.js 22.13 o posterior (requisito de Expo SDK 57).

Terminal 1:

```powershell
cd jwt-mock
npm install
npm start
```

Terminal 2:

```powershell
cd formulario-app
npm install
npm start
```

En un celular físico, ambos dispositivos deben estar en la misma red y Windows Firewall debe permitir el puerto 5050. El mock imprime sus URL LAN al iniciar. Expo intenta usar automáticamente el host de desarrollo; si no coincide, copia `formulario-app/.env.example` como `.env` y configura una sola vez `EXPO_PUBLIC_MOCK_BASE_URL`.

## Variables de Expo

- `EXPO_PUBLIC_USE_MOCK=true`: obtiene el Access Token desde el mock local.
- `EXPO_PUBLIC_MOCK_BASE_URL`: override opcional, por ejemplo `http://192.168.1.100:5050`.
- `EXPO_PUBLIC_DNN_URL`: página DNN real. Ya tiene la URL conocida como valor predeterminado.
- `EXPO_PUBLIC_DNN_AUTH_URL`: URL completa pendiente del endpoint DNN que recibe el Bearer token.

Las variables `EXPO_PUBLIC_*` son visibles en el bundle; nunca se debe colocar allí un Access Token ni un secreto.

## Variables opcionales del mock

Consulta `jwt-mock/.env.example`. La configuración predeterminada escucha en `0.0.0.0:5050`, usa audiencia `dnn-test-api`, conserva claves en `jwt-mock/.local-keys` y hace vencer los códigos a los 60 segundos.

Si `JWT_MOCK_BASE_URL` no se configura, el issuer y las URL OpenID se derivan del host con el que se hace cada petición. Así no existe una IP fija en el código.

## Verificación

```powershell
cd jwt-mock
npm test

cd ../formulario-app
npx tsc --noEmit
npx expo export --platform android
```

La prueba manual es exitosa cuando DNN devuelve `success: true`, la consola registra la integración exitosa y se abre el formulario. Las pruebas automatizadas del mock siguen comprobando health, emisión RS256, OpenID, JWKS, intercambio, uso único, vencimiento, token inválido y la página DNN local.

## Pendiente del API real

No se ha inventado ningún endpoint ni mecanismo de login. Para activar modo real faltan dos datos externos:

1. Entregar a `getAccessToken(realAccessToken)` el token que ya tenga la aplicación.
2. Configurar `EXPO_PUBLIC_DNN_AUTH_URL` con la URL completa del endpoint DNN de prueba.
# app-prueba
