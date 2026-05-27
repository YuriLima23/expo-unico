/**
 * Props accepted by the Unico config plugin.
 *
 * Only `sdkKey` is required. Everything else has a sensible default.
 */
export interface UnicoPluginProps {
	/** Unico host key (SDK key). Required. */
	sdkKey: string;
	/**
	 * Bundle identifier used by the iOS `UnicoConfig`.
	 * Defaults to `config.ios.bundleIdentifier` when omitted.
	 */
	iosBundleIdentifier?: string;
	/** Android `io.unico:capture` SDK version. Default: 5.51.0 */
	androidCaptureVersion?: string;
	/** iOS pod name. Default: unicocheck-ios */
	iosPodName?: string;
	/** Camera permission text (Android meta-data / iOS Info.plist). */
	cameraPermission?: string;
	/** Microphone permission text (iOS Info.plist). */
	microphonePermission?: string;
	/** Capture session timeout, in seconds. Default: 50 */
	timeoutSession?: number;
}

/** Props with defaults applied. */
export interface ResolvedUnicoOptions {
	sdkKey: string;
	iosBundleIdentifier?: string;
	androidCaptureVersion: string;
	iosPodName: string;
	cameraPermission: string;
	microphonePermission: string;
	timeoutSession: number;
}

const DEFAULTS = {
	androidCaptureVersion: "5.51.0",
	iosPodName: "unicocheck-ios",
	cameraPermission: "Camera access is required for identity verification",
	microphonePermission:
		"Microphone access is required for identity verification",
	timeoutSession: 50,
} as const;

export function resolveOptions(
	props?: UnicoPluginProps | null,
): ResolvedUnicoOptions {
	const p = props ?? ({} as Partial<UnicoPluginProps>);

	if (!p.sdkKey) {
		throw new Error(
			"[expo-unico] Missing `sdkKey`. Pass it via the plugin props, e.g. " +
				'["expo-unico", { sdkKey: process.env.UNICO_SDK_KEY }].',
		);
	}

	return {
		sdkKey: p.sdkKey,
		iosBundleIdentifier: p.iosBundleIdentifier,
		androidCaptureVersion:
			p.androidCaptureVersion ?? DEFAULTS.androidCaptureVersion,
		iosPodName: p.iosPodName ?? DEFAULTS.iosPodName,
		cameraPermission: p.cameraPermission ?? DEFAULTS.cameraPermission,
		microphonePermission:
			p.microphonePermission ?? DEFAULTS.microphonePermission,
		timeoutSession: p.timeoutSession ?? DEFAULTS.timeoutSession,
	};
}
