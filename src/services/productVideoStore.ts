export type VideoStageKey = 'reveal' | 'action';

export interface StoredProductVideo {
  key: string;
  productId: string;
  stage: VideoStageKey;
  blob: Blob;
  fileName: string;
  updatedAt: number;
}

export interface ProductVideoPair {
  reveal: StoredProductVideo | null;
  action: StoredProductVideo | null;
}

const DB_NAME = 'new_chiko_interactive_videos_v1';
const STORE_NAME = 'product_videos';
const DB_VERSION = 1;

function makeRecordKey(productId: string, stage: VideoStageKey): string {
  return `${productId}::${stage}`;
}

function openVideoDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readStageVideo(
  db: IDBDatabase,
  productId: string,
  stage: VideoStageKey
): Promise<StoredProductVideo | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(makeRecordKey(productId, stage));
      req.onsuccess = () => {
        const result = req.result as StoredProductVideo | undefined;
        resolve(result && result.blob instanceof Blob ? result : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadProductVideos(productId: string): Promise<ProductVideoPair> {
  const db = await openVideoDb();
  if (!db) return { reveal: null, action: null };
  try {
    const [reveal, action] = await Promise.all([
      readStageVideo(db, productId, 'reveal'),
      readStageVideo(db, productId, 'action'),
    ]);
    return { reveal, action };
  } finally {
    db.close();
  }
}

export async function saveProductVideo(
  productId: string,
  stage: VideoStageKey,
  file: Blob,
  fileName: string
): Promise<StoredProductVideo | null> {
  const db = await openVideoDb();
  if (!db) return null;
  const record: StoredProductVideo = {
    key: makeRecordKey(productId, stage),
    productId,
    stage,
    blob: file,
    fileName,
    updatedAt: Date.now(),
  };

  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function removeProductVideo(
  productId: string,
  stage: VideoStageKey
): Promise<boolean> {
  const db = await openVideoDb();
  if (!db) return false;
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(makeRecordKey(productId, stage));
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  } finally {
    db.close();
  }
}
