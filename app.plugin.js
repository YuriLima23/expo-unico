// Config plugin entry point (Expo convention).
// Points to the compiled TypeScript output in ./plugin/build.
const mod = require("./plugin/build");

module.exports = mod.default ?? mod;
