// Public surface of the style feature (unit 3.4). Backdrop is imported directly from its module
// by src/router.tsx (it is not re-exported here); the store's deferred image helpers stay internal.
export { StyleStudio } from "./components/StyleStudio";
export { PageDoodle } from "./components/PageDoodle";
export { ThemeVars } from "./ThemeVars";
export { useStyleStore } from "./store";
