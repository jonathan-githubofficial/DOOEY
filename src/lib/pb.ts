// MINIMAL - unit 1.4 replaces host resolution (rspeedy env) and backs authStore
// with the storage adapter.
import PocketBase from "pocketbase";

export const pb = new PocketBase(import.meta.env.PUBLIC_PB_URL || "http://127.0.0.1:8090");
