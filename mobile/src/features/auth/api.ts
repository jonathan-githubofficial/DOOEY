import { ClientResponseError } from "pocketbase";
import { authLoaded, pb } from "@/lib/pb";

/** Validate the persisted session on boot. A successful refresh also brings
 * the cached user record (avatar doodle) up to date. Only a definitive server
 * rejection drops the session — a network failure or a 5xx must not sign you
 * out of an offline or flaky boot. */
export async function initSession() {
  await authLoaded;
  if (!pb.authStore.isValid) return;
  try {
    await pb.collection("users").authRefresh();
  } catch (e) {
    if (e instanceof ClientResponseError && e.status >= 400 && e.status < 500) {
      pb.authStore.clear();
    }
  }
}

/** Sign in with email + password. */
export async function signIn(email: string, password: string) {
  return pb.collection("users").authWithPassword(email, password);
}

/** Create an account, then sign in. */
export async function signUp(email: string, password: string) {
  await pb.collection("users").create({
    email,
    password,
    passwordConfirm: password,
  });
  return signIn(email, password);
}

export function signOut() {
  pb.authStore.clear();
}
