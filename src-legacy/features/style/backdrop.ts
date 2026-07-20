/** Local persistence for the backdrop photo. The image lives in IndexedDB —
 * far too big for the localStorage the rest of the style settings use. */

const DB_NAME = "dooey-style";
const STORE = "backdrop";
const KEY = "image";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const loadStoredBackdrop = () => withStore<Blob | undefined>("readonly", (s) => s.get(KEY));
export const storeBackdrop = (blob: Blob) => withStore("readwrite", (s) => s.put(blob, KEY));
export const deleteStoredBackdrop = () => withStore("readwrite", (s) => s.delete(KEY));

/** Downscale + re-encode the picked photo so what we store stays a few
 * hundred KB, whatever the camera produced. */
export async function processBackdropFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.85,
    ),
  );
}
