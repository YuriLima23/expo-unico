import { ConfigPlugin, createRunOncePlugin } from "expo/config-plugins";

import { withUnicoAndroid } from "./withUnicoAndroid";
import { withUnicoIos } from "./withUnicoIos";
import { resolveOptions, UnicoPluginProps } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../../package.json") as { name: string; version: string };

const withUnico: ConfigPlugin<UnicoPluginProps> = (config, props) => {
	const options = resolveOptions(props);

	config = withUnicoAndroid(config, options);
	config = withUnicoIos(config, options);

	return config;
};

export default createRunOncePlugin(withUnico, pkg.name, pkg.version);

export type { UnicoPluginProps } from "./types";
