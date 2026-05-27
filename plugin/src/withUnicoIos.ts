import {
	ConfigPlugin,
	IOSConfig,
	withDangerousMod,
	withInfoPlist,
	withPodfile,
	withXcodeProject,
} from "expo/config-plugins";
import fs from "fs";
import path from "path";

import { ResolvedUnicoOptions } from "./types";

const SOURCE_FILES = [
	"UnicoModule.swift",
	"UnicoTheme.swift",
	"UnicoSelfieService.swift",
	"UnicoConfig.swift",
	"Unico.m",
];

export const withUnicoIos: ConfigPlugin<ResolvedUnicoOptions> = (
	config,
	options,
) => {
	config = withPermissions(config, options);
	config = withNativeSources(config, options);
	config = withSourcesInXcode(config);
	config = withPod(config, options);
	return config;
};

const withPermissions: ConfigPlugin<ResolvedUnicoOptions> = (config, options) =>
	withInfoPlist(config, (config) => {
		config.modResults.NSCameraUsageDescription = options.cameraPermission;
		config.modResults.NSMicrophoneUsageDescription =
			options.microphonePermission;
		return config;
	});

const withNativeSources: ConfigPlugin<ResolvedUnicoOptions> = (
	config,
	options,
) =>
	withDangerousMod(config, [
		"ios",
		async (config) => {
			const iosRoot = path.join(config.modRequest.projectRoot, "ios");
			const appName = config.modRequest.projectName!;
			const iosAppDir = path.join(iosRoot, appName);
			if (!fs.existsSync(iosAppDir)) fs.mkdirSync(iosAppDir);

			const bundleId =
				config.ios?.bundleIdentifier ??
				options.iosBundleIdentifier ??
				"";

			const files: Record<string, string> = {
				"UnicoModule.swift": generateUnicoModuleSwift(),
				"UnicoTheme.swift": generateUnicoThemeSwift(),
				"UnicoSelfieService.swift": generateUnicoSelfieServiceSwift(),
				"UnicoConfig.swift": generateUnicoConfigSwift(bundleId, options),
				"Unico.m": generateUnicoBridge(),
			};

			for (const [filename, content] of Object.entries(files)) {
				fs.writeFileSync(path.join(iosAppDir, filename), content);
			}

			return config;
		},
	]);

const withSourcesInXcode: ConfigPlugin = (config) =>
	withXcodeProject(config, (config) => {
		const project = config.modResults;
		const appName = config.modRequest.projectName!;
		const iosRoot = path.join(config.modRequest.projectRoot, "ios");
		const iosAppDir = path.join(iosRoot, appName);

		const target = project.getFirstTarget();
		if (!target) throw new Error("Main target not found");

		const appGroup = getAppGroup(project, appName);

		SOURCE_FILES.forEach((file) => {
			const filePath = path.join(iosAppDir, file);
			if (!fs.existsSync(filePath)) return;

			const relativePath = path.relative(iosRoot, filePath);
			const fileRef = project.addFile(relativePath, appGroup);
			if (!fileRef) return;

			IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
				filepath: filePath,
				groupName: "Sources",
				project,
				isBuildFile: true,
				verbose: true,
			} as Parameters<typeof IOSConfig.XcodeUtils.addBuildSourceFileToGroup>[0]);
		});

		return config;
	});

const withPod: ConfigPlugin<ResolvedUnicoOptions> = (config, options) =>
	withPodfile(config, (config) => {
		let contents = config.modResults.contents;
		contents = contents.replace(
			/use_frameworks!.*\n/,
			(match) => `${match}\n  pod '${options.iosPodName}' \n`,
		);
		config.modResults.contents = contents;
		return config;
	});

function getAppGroup(project: any, appName: string): string {
	const groups = project.hash.project.objects.PBXGroup;

	for (const key in groups) {
		const group = groups[key];
		if (group && (group.name === appName || group.path === appName)) {
			return key;
		}
	}

	const newGroup = project.addPbxGroup([], appName, appName);
	project.addToPbxGroup(
		newGroup.uuid,
		project.getFirstProject().firstProject.mainGroup,
	);

	return newGroup.uuid;
}

// ---------------------------------------------------------------------------
// Native source generators (Swift / Objective-C)
// ---------------------------------------------------------------------------

function generateUnicoModuleSwift() {
	return `


import Foundation
import UIKit
import AcessoBio
import React

@objc(Unico)
class Unico: NSObject {
    private var selfieService: UnicoSelfieService?

    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }

  @objc func openSelfieCamera(
    _ isSmartCamera: Bool,
    environment: String? = "",
                          resolver: @escaping RCTPromiseResolveBlock,
                          rejecter: @escaping RCTPromiseRejectBlock) {

      let workItem = DispatchWorkItem {

          guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }),
                let rootVC = window.rootViewController else {
              rejecter("ERROR_VC", "Could not find the root ViewController", nil)
              return
          }
        let safeEnvironment = (environment?.isEmpty == false)
             ? environment!
             : "PROD"   // default value

        self.selfieService = UnicoSelfieService()
        self.selfieService?.startSelfie(
              isSmartCamera: isSmartCamera,
              environment: safeEnvironment,
              onSuccess: { result in

                  let response: [String: Any] = [
                      "success": true,
                      "base64": result["base64"] as? String ?? "",
                      "encrypted": result["encrypted"] as? String ?? ""
                  ]

                  resolver(response)
                self.selfieService = nil

              },
              onError: { code, message in
                  rejecter(
                      "SELFIE_ERROR",
                      message,
                      NSError(domain: "UNICO_SELFIE", code: Int(code) ?? -1)
                  )
                self.selfieService = nil

              }
          )
      }

      DispatchQueue.main.async(execute: workItem)
  }

}


`;
}

function generateUnicoThemeSwift() {
	return `

import UIKit
import AcessoBio

final class UnicoTheme: AcessoBioThemeDelegate {

  func getColorBackground() -> Any! { UIColor.white }
  func getColorBoxMessage() -> Any! { UIColor.systemBlue.withAlphaComponent(0.1) }
  func getColorTextMessage() -> Any! { UIColor.systemBlue }
  func getColorBackgroundPopupError() -> Any! { UIColor.white }
  func getColorTextPopupError() -> Any! { UIColor.systemBlue }
  func getColorBackgroundButtonPopupError() -> Any! { UIColor.systemBlue }
  func getColorTextButtonPopupError() -> Any! { UIColor.white }
  func getColorBackgroundTakePictureButton() -> Any! { UIColor.systemBlue }
  func getColorIconTakePictureButton() -> Any! { UIColor.white }
  func getColorBackgroundBottomDocument() -> Any! { UIColor.white }
  func getColorTextBottomDocument() -> Any! { UIColor.white }
  func getColorSilhouetteSuccess() -> Any! { UIColor.systemBlue }
  func getColorSilhouetteError() -> Any! { UIColor.systemRed }
  func getColorSilhouetteNeutral() -> Any! { UIColor.lightGray }
}

`;
}

function generateUnicoSelfieServiceSwift() {
	return `
import UIKit
import AcessoBio

final class UnicoSelfieService: NSObject {

    // MARK: - Properties

    private var manager: AcessoBioManager?
    private var onSuccess: (([String: Any]) -> Void)?
    private var onError: ((String, String) -> Void)?
    private var didFinish: Bool = false
    private var isSmartCamera: Bool = true

    // MARK: - Public API

    func startSelfie(
        isSmartCamera: Bool = true,
        environment: String,
        onSuccess: @escaping ([String: Any]) -> Void,
        onError: @escaping (String, String) -> Void
    ) {
        self.isSmartCamera = isSmartCamera
        self.onSuccess = onSuccess
        self.onError = onError
        self.didFinish = false

        guard let topVC = UIApplication.topViewController() else {
            onError("NO_VIEW_CONTROLLER", "Could not find an active ViewController")
            return
        }

        manager = AcessoBioManager(viewController: topVC, delegate: self)
        manager?.setEnvironment(parseEnvironment(environment))
        manager?.setSmartFrame(isSmartCamera)
        manager?.setTheme(UnicoTheme())

      manager?.build().prepareSelfieCamera(self, config: UnicoConfig())
    }

    private func parseEnvironment(_ env: String) -> EnvironmentEnum {
        switch env.uppercased() {
        case "PROD":
            return .PROD
        case "UAT":
            return .UAT
        case "DEV":
            return .DEV
        default:
            return .PROD
        }
    }

    // MARK: - Finish Flow

    private func finishFlow() {
        guard !didFinish else { return }
        didFinish = true
    }
}

extension UnicoSelfieService: AcessoBioManagerDelegate {

    func onErrorAcessoBioManager(_ error: ErrorBio!) {
        let message = error?.desc ?? "Unknown SDK error"
        onError?("MANAGER_ERROR", message)
        finishFlow()
    }

    func onUserClosedCameraManually() {
        onError?("USER_CANCELLED", "User closed the camera manually")
        finishFlow()
    }

    func onSystemClosedCameraTimeoutSession() {
        onError?("TIMEOUT_SESSION", "Session timed out")
        finishFlow()
    }

    func onSystemChangedTypeCameraTimeoutFaceInference() {
            finishFlow()
    }
}

extension UnicoSelfieService: SelfieCameraDelegate {

    func onCameraReady(_ cameraOpener: AcessoBioCameraOpenerDelegate!) {
      cameraOpener.open(self)
    }

    func onCameraFailed(_ error: ErrorPrepare!) {
        let message = error?.desc ?? "Failed to prepare the camera"
        onError?("PREPARE_ERROR", message)
        finishFlow()
    }
}

extension UnicoSelfieService: AcessoBioSelfieDelegate {

    func onSuccessSelfie(_ result: SelfieResult!) {
        let response: [String: Any] = [
            "base64": result?.base64 ?? "",
            "encrypted": result?.encrypted ?? ""
        ]

        onSuccess?(response)
        finishFlow()
    }

    func onErrorSelfie(_ errorBio: ErrorBio!) {
        let message = errorBio?.desc ?? "Failed to process the selfie"
        onError?("SELFIE_ERROR", message)
        finishFlow()
    }
}

extension UIApplication {

    static func topViewController(
        controller: UIViewController? = UIApplication.shared
            .connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?
            .rootViewController
    ) -> UIViewController? {

        if let navigationController = controller as? UINavigationController {
            return topViewController(controller: navigationController.visibleViewController)
        }

        if let tabController = controller as? UITabBarController {
            return topViewController(controller: tabController.selectedViewController)
        }

        if let presented = controller?.presentedViewController {
            return topViewController(controller: presented)
        }

        return controller
    }
}

`;
}

function generateUnicoConfigSwift(
	bundleId: string,
	options: ResolvedUnicoOptions,
) {
	return `
import Foundation
import AcessoBio

final class UnicoConfig: AcessoBioConfigDataSource {

    func getBundleIdentifier() -> String {
      return "${bundleId}"
    }

    func getHostKey() -> String {
       return "${options.sdkKey}"
    }
}

`;
}

function generateUnicoBridge() {
	return `

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(Unico, NSObject)

RCT_EXTERN_METHOD(openSelfieCamera:(BOOL)isSmartCamera
                  environment:(NSString *)environment
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end

`;
}
