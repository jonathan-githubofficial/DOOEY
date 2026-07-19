import { pb } from "@/lib/pb";

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
