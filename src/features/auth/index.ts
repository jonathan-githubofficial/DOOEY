// Public surface of the auth feature (unit 3.2, ported from src-legacy/features/auth/index.ts).
// `AccountPanel` and `AvatarDoodle` are re-added by unit 3.3, which ports those components; they
// do not exist in the new tree yet, so they are intentionally NOT exported here.
export { initSession } from "./api";
export { SignInCard } from "./components/SignInCard";
