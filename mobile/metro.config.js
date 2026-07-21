const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// zustand v5 (and friends) ship ESM entries that use `import.meta`, which
// SDK 54's Metro can't transform — dropping the 'import' condition makes the
// exports map resolve to the CJS builds instead.
config.resolver.unstable_conditionNames = ["browser", "require", "react-native"];

module.exports = config;
