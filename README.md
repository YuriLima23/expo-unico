# expo-unico

An [Expo config plugin](https://docs.expo.dev/config-plugins/introduction/) and
native module that integrates the **[Unico Check](https://docs.unico.io/)**
(selfie / biometrics / liveness) SDK into Expo apps using
[prebuild / Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/).

It generates the required native code for Android (Kotlin) and iOS
(Swift / Objective-C), wires up Gradle / Podfile / manifest / `Info.plist`, and
exposes a small `Unico` module to JavaScript.

> This is a community package and is not affiliated with Unico.

## Requirements

- Expo SDK 53+
- A bare or prebuild workflow (`expo prebuild` / `expo run:*`). It does **not**
  work in Expo Go, because it ships native code.
- A Unico SDK key (host key).

## Installation

```bash
npm install expo-unico
# or
yarn add expo-unico
```

## Usage

### 1. Register the config plugin

In `app.json` / `app.config.js` / `app.config.ts`:

```ts
export default {
  // ...
  plugins: [
    [
      "expo-unico",
      {
        sdkKey: process.env.UNICO_SDK_KEY, // required
      },
    ],
  ],
}
```

> If you reference the plugin by a **relative path** instead of the package
> name (e.g. a local copy), point it at the plugin entry file directly:
> `"./path/to/expo-unico/app.plugin.js"`. Expo only auto-resolves `app.plugin.js`
> for package-name references.

### 2. Rebuild native code

```bash
npx expo prebuild --clean
npx expo run:android   # or run:ios
```

### 3. Call it from JavaScript

```ts
import Unico from "expo-unico"

const { base64, encrypted } = await Unico.openSelfieCamera(true, "PROD")
```

`openSelfieCamera(smartCamera: boolean, environment: "PROD" | "UAT" | "DEV")`
resolves with the captured selfie or rejects with an error code/message.

## Plugin props

| Prop                    | Required | Default                       | Description                                       |
| ----------------------- | -------- | ----------------------------- | ------------------------------------------------- |
| `sdkKey`                | yes      | —                             | Unico host key (SDK key)                          |
| `iosBundleIdentifier`   | no       | `config.ios.bundleIdentifier` | Bundle id used by the iOS `UnicoConfig`           |
| `androidCaptureVersion` | no       | `5.51.0`                      | Version of `io.unico:capture`                     |
| `iosPodName`            | no       | `unicocheck-ios`              | iOS pod name                                      |
| `cameraPermission`      | no       | generic text                  | Camera permission text (manifest / `Info.plist`)  |
| `microphonePermission`  | no       | generic text                  | Microphone permission text (`Info.plist`)         |
| `timeoutSession`        | no       | `50`                          | Capture session timeout, in seconds               |

If `sdkKey` is missing the prebuild fails with an explicit error.

## Project structure

```
expo-unico/
├── app.plugin.js          # config plugin entry (points to plugin/build)
├── package.json           # main/react-native → src/index.ts (runtime module)
├── src/
│   └── index.ts           # TurboModule (JS access to Unico)
└── plugin/
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts            # withUnico (createRunOncePlugin) + props
    │   ├── types.ts            # UnicoPluginProps + default resolution
    │   ├── withUnicoAndroid.ts # manifest, gradle, Kotlin sources
    │   └── withUnicoIos.ts     # Info.plist, Podfile, Xcode, Swift sources
    └── build/                  # compiled output (built on prepare/publish)
```

## Development

After editing any file under `plugin/src/`, recompile:

```bash
npm run build      # tsc --project plugin/tsconfig.json
```

The `build/` output is produced automatically on `npm publish` (via the
`prepare` script) and is not committed.

## License

[MIT](./LICENSE)
