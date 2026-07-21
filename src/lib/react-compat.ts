// React-compat shim for the Rspack build (unit 3.1, SPEC step 2 "alias/shim").
//
// lynx.config.ts's `react$` alias points here instead of straight at @lynx-js/react/compat so
// the compat surface is COMPLETE for TanStack Router. Router 1.170's utils.js reads React 19's
// optional `use` via a namespace member (`React["use"]`); ReactLynx's compat layer is
// React-17/18-style and has no `use`, and Rspack's strict ESM linker turns that missing export
// into a hard "export 'use' was not found in 'react'" BUILD error (webpack only warns, hence
// TanStack's defensive dynamic lookup is not enough here). Re-exporting `use` as undefined
// satisfies the linker and matches TanStack's own runtime fallback comment: "React.use if
// available (React 19+), undefined otherwise." Everything else is a faithful pass-through of
// @lynx-js/react/compat (which itself is @lynx-js/react + startTransition/useTransition, the
// React-18 APIs the routing doc's alias recipe provides - crib "Framework").
export * from "@lynx-js/react/compat";
export { default } from "@lynx-js/react/compat";

// React 19 `use()` is absent on ReactLynx compat; expose it (undefined) so the linker resolves
// TanStack Router's optional `React["use"]` reference to its no-op fallback path.
export const use: undefined = undefined;
