import { TurboModule, TurboModuleRegistry } from "react-native";

export interface UnicoSpec extends TurboModule {
	openSelfieCamera(
		smartCamera: boolean,
		environment: string,
	): Promise<{
		base64: string;
		encrypted: string;
	}>;
}

const Unico = TurboModuleRegistry.get<UnicoSpec>("Unico");

export default Unico;
