// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const reactHooks = require("eslint-plugin-react-hooks");

// eslint-config-expo bundles its own react-hooks v5, which predates the React
// Compiler rules. This app runs the compiler (`app.json` →
// experiments.reactCompiler), so it wants v7's checks: immutability, refs,
// set-state-in-effect.
//
// Two versions cannot both claim the `react-hooks` namespace, so expo's
// registration is lifted out and v7 takes it. Worth stating plainly: until
// 2026-07-25 these rules only reached this app because the deleted web app's
// node_modules happened to hoist v7 above expo's copy. That was luck, and it
// stopped working the moment that app went away.
const expoWithoutReactHooks = [expoConfig].flat().map((block) => {
  if (!block?.plugins?.["react-hooks"]) return block;
  const plugins = { ...block.plugins };
  delete plugins["react-hooks"];
  const rules = Object.fromEntries(
    Object.entries(block.rules ?? {}).filter(([rule]) => !rule.startsWith("react-hooks/")),
  );
  return { ...block, plugins, rules };
});

module.exports = defineConfig([
  ...expoWithoutReactHooks,
  reactHooks.configs.flat.recommended,
  {
    ignores: ["dist/*"],
  },
]);
