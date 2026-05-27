import {
	ConfigPlugin,
	withAndroidManifest,
	withAppBuildGradle,
	withDangerousMod,
	withMainApplication,
	withProjectBuildGradle,
} from "expo/config-plugins";
import fs from "fs";
import path from "path";

import { ResolvedUnicoOptions } from "./types";

const CAMERA_PERMISSIONS = [
	"android.permission.CAMERA",
	"android.permission.RECORD_AUDIO",
	"android.permission.WRITE_EXTERNAL_STORAGE",
	"android.permission.READ_EXTERNAL_STORAGE",
];

const MLKIT_META = "com.google.mlkit.vision.DEPENDENCIES";

export const withUnicoAndroid: ConfigPlugin<ResolvedUnicoOptions> = (
	config,
	options,
) => {
	config = withManifest(config);
	config = withDependency(config, options);
	config = withRepositories(config);
	config = withNativeSources(config, options);
	config = withPackageRegistration(config);
	return config;
};

const withManifest: ConfigPlugin = (config) =>
	withAndroidManifest(config, (config) => {
		const manifest = config.modResults;

		manifest.manifest.$ = manifest.manifest.$ || {};
		if (!manifest.manifest.$["xmlns:tools"]) {
			manifest.manifest.$["xmlns:tools"] =
				"http://schemas.android.com/tools";
		}

		CAMERA_PERMISSIONS.forEach((p) => {
			manifest.manifest["uses-permission"] =
				manifest.manifest["uses-permission"] || [];
			if (
				!manifest.manifest["uses-permission"].some(
					(x) => x.$["android:name"] === p,
				)
			) {
				manifest.manifest["uses-permission"].push({
					$: { "android:name": p },
				});
			}
		});

		const application = manifest.manifest.application?.[0];
		if (application) {
			application["meta-data"] = application["meta-data"] || [];
			const existing = application["meta-data"].find(
				(m) => m.$?.["android:name"] === MLKIT_META,
			);
			if (existing) {
				const attrs = existing.$ as Record<string, string>;
				attrs["android:value"] = "barcode_ui,face";
				attrs["tools:replace"] = "android:value";
			} else {
				const metaData: { $: Record<string, string> } = {
					$: {
						"android:name": MLKIT_META,
						"android:value": "barcode_ui,face",
						"tools:replace": "android:value",
					},
				};
				application["meta-data"].push(metaData as never);
			}
		}

		return config;
	});

const withDependency: ConfigPlugin<ResolvedUnicoOptions> = (config, options) =>
	withAppBuildGradle(config, (config) => {
		let contents = config.modResults.contents;

		if (!contents.includes("io.unico:capture")) {
			contents = contents.replace(
				/dependencies\s?{/,
				`dependencies {\n    implementation 'io.unico:capture:${options.androidCaptureVersion}'`,
			);
		}

		const resolutionBlock = `
configurations.all { c ->
    c.resolutionStrategy.eachDependency { DependencyResolveDetails dependency ->
        if (dependency.requested.group == 'org.bouncycastle') {
            dependency.useTarget('org.bouncycastle:bcprov-jdk15to18:1.68')
        }
    }
}
`;

		if (
			!contents.includes(
				"dependency.useTarget('org.bouncycastle:bcprov-jdk15to18:1.68'",
			)
		) {
			contents += `\n${resolutionBlock}\n`;
		}

		config.modResults.contents = contents;
		return config;
	});

const withRepositories: ConfigPlugin = (config) =>
	withProjectBuildGradle(config, (config) => {
		let contents = config.modResults.contents;

		const repoLine = `maven { url "https://maven-sdk.unico.run/sdk-mobile" }`;

		if (contents.includes("dependencyResolutionManagement")) {
			contents = contents.replace(
				/repositories\s*{/,
				`repositories {\n        ${repoLine}`,
			);
		}

		contents = contents.replace(
			/buildscript\s*{\s*repositories\s*{/,
			`buildscript {\n    repositories {\n        ${repoLine}`,
		);

		contents = contents.replace(
			/allprojects\s*{\s*repositories\s*{/,
			`allprojects {\n    repositories {\n        ${repoLine}`,
		);

		config.modResults.contents = contents;
		return config;
	});

const withNativeSources: ConfigPlugin<ResolvedUnicoOptions> = (
	config,
	options,
) =>
	withDangerousMod(config, [
		"android",
		async (config) => {
			const pkg = config.android?.package || "com.unico";
			const pkgPath = pkg.replace(/\./g, "/");

			const baseDir = path.join(
				config.modRequest.projectRoot,
				"android/app/src/main/java",
				pkgPath,
			);

			if (!fs.existsSync(baseDir))
				fs.mkdirSync(baseDir, { recursive: true });

			fs.writeFileSync(
				path.join(baseDir, "UnicoModule.kt"),
				generateUnicoModule(pkg, options),
			);
			fs.writeFileSync(
				path.join(baseDir, "UnicoPackage.kt"),
				generateUnicoPackage(pkg),
			);
			fs.writeFileSync(
				path.join(baseDir, "UnicoConfig.kt"),
				generateUnicoConfig(pkg, options),
			);
			fs.writeFileSync(
				path.join(baseDir, "UnicoTheme.kt"),
				generateUnicoTheme(pkg),
			);

			return config;
		},
	]);

const withPackageRegistration: ConfigPlugin = (config) =>
	withMainApplication(config, (config) => {
		let contents = config.modResults.contents;
		const pkg = config.android!.package!;

		if (!contents.includes(`import ${pkg}.UnicoPackage`)) {
			contents = contents.replace(
				/package\s+[\w.]+/,
				(match) => `${match}\nimport ${pkg}.UnicoPackage`,
			);
		}

		if (!contents.includes("UnicoPackage()")) {
			contents = contents.replace(
				/val packages = PackageList\(this\)\.packages([\s\S]*?)(return packages)/,
				(_match, codeBeforeReturn, returnLine) =>
					`val packages = PackageList(this).packages${codeBeforeReturn}    packages.add(UnicoPackage())\n    ${returnLine}`,
			);
		}

		config.modResults.contents = contents;
		return config;
	});

// ---------------------------------------------------------------------------
// Native source generators (Kotlin)
// ---------------------------------------------------------------------------

function generateUnicoModule(pkg: string, options: ResolvedUnicoOptions) {
	return `
package ${pkg}

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.acesso.acessobio_android.*
import com.acesso.acessobio_android.onboarding.AcessoBio
import com.acesso.acessobio_android.onboarding.camera.CameraListener
import com.acesso.acessobio_android.onboarding.camera.UnicoCheckCameraOpener
import com.acesso.acessobio_android.services.dto.ErrorBio
import com.acesso.acessobio_android.services.dto.ResultCamera
import com.acesso.acessobio_android.onboarding.models.Environment
import com.facebook.react.bridge.*
import com.facebook.react.bridge.UiThreadUtil

class UnicoModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext),
    AcessoBioListener,
    iAcessoBioSelfie,
    CameraListener {

    private var currentPromise: Promise? = null
    private val unicoTheme = UnicoTheme()
    private val timeout = ${options.timeoutSession.toFixed(1)}

    override fun getName(): String = "Unico"

    @ReactMethod
    fun openSelfieCamera(
        isSmartCamera: Boolean,
        environment: String,
        promise: Promise
    ) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No Activity available")
            return
        }

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.CAMERA),
                1001
            )
            promise.reject("PERMISSION_DENIED", "Camera permission required")
            return
        }

        currentPromise = promise

        UiThreadUtil.runOnUiThread {
            try {
                AcessoBio(activity, this)
                    .setTheme(unicoTheme)
                    .setTimeoutSession(timeout)
                    .setSmartFrame(isSmartCamera)
                    .setEnvironment(parseEnvironment(environment))
                    .build()
                    .prepareCamera(UnicoConfig(), this)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message)
            }
        }
    }

    private fun parseEnvironment(env: String): Environment {
        return when (env.uppercase()) {
            "PROD" -> Environment.PROD
            "UAT" -> Environment.UAT
            else -> Environment.PROD
        }
    }

    override fun onSuccessSelfie(result: ResultCamera) {
        UiThreadUtil.runOnUiThread {
            try {
                val map = Arguments.createMap()
                map.putString("base64", result.base64)
                map.putString("encrypted", result.encrypted)
                currentPromise?.resolve(map)
            } catch (e: Exception) {
                currentPromise?.reject("PARSE_ERROR", e)
            } finally {
                currentPromise = null
            }
        }
    }

    override fun onErrorSelfie(error: ErrorBio?) {
        currentPromise?.reject("SELFIE_ERROR", error?.toString() ?: "Unknown error")
        currentPromise = null
    }

    override fun onUserClosedCameraManually() {
        currentPromise?.reject("CLOSED", "User closed the camera.")
        currentPromise = null
    }

    override fun onCameraFailed(error: String?) {
        currentPromise?.reject("FAILED", error ?: "Unknown failure")
        currentPromise = null
    }

    override fun onErrorAcessoBio(error: ErrorBio?) {
        currentPromise?.reject("ACESSO_BIO_ERROR", error?.toString() ?: "Unknown error")
        currentPromise = null
    }

    override fun onCameraReady(cameraOpener: UnicoCheckCameraOpener.Camera) {
        cameraOpener.open(this)
    }

    override fun onSystemClosedCameraTimeoutSession() {}
    override fun onSystemChangedTypeCameraTimeoutFaceInference() {}
}
`;
}

function generateUnicoPackage(pkg: string) {
	return `
package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class UnicoPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(UnicoModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

`;
}

function generateUnicoConfig(pkg: string, options: ResolvedUnicoOptions) {
	return `
package ${pkg}

import com.acesso.acessobio_android.onboarding.AcessoBioConfigDataSource

class UnicoConfig : AcessoBioConfigDataSource {

    override fun getBundleIdentifier(): String {
        return "${pkg}"
    }

    override fun getHostKey(): String {
        return "${options.sdkKey}"
    }

}

`;
}

function generateUnicoTheme(pkg: string) {
	return `
package ${pkg}

import android.graphics.Color
import com.acesso.acessobio_android.onboarding.IAcessoBioTheme

class UnicoTheme: IAcessoBioTheme {
    override fun getColorBackground(): Any {
        return ""
    }

    override fun getColorBoxMessage(): Any {
        return ""
    }

    override fun getColorTextMessage(): Any {
        return ""
    }

    override fun getColorBackgroundPopupError(): Any {
        return ""
    }

    override fun getColorTextPopupError(): Any {
        return ""
    }

    override fun getColorBackgroundButtonPopupError(): Any {
        return ""
    }

    override fun getColorTextButtonPopupError(): Any {
        return ""
    }

    override fun getColorBackgroundTakePictureButton(): Any {
        return ""
    }

    override fun getColorIconTakePictureButton(): Any {
        return ""
    }

    override fun getColorBackgroundBottomDocument(): Any {
        return ""
    }

    override fun getColorTextBottomDocument(): Any {
        return ""
    }

    override fun getColorSilhouetteSuccess(): Any {
        return ""
    }

    override fun getColorSilhouetteError(): Any {
        return ""
    }

    override fun getColorSilhouetteNeutral(): Any {
        return ""
    }
}

`;
}
