// Public surface of the auth feature (unit 3.2, ported from src-legacy/features/auth/index.ts).
// Unit 3.3 re-adds the `AccountPanel` + `AvatarDoodle` exports now that those components are
// ported (AvatarDoodle is render-only here; its editor half lands in 7.3).
export { initSession } from "./api";
export { SignInCard } from "./components/SignInCard";
export { AccountPanel } from "./components/AccountPanel";
export { AvatarDoodle } from "./components/AvatarDoodle";
