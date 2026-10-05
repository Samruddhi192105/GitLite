const MAX_BATCH_FILES = 10_000;
const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_FILES = 100_000;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const DATABASE_NAME = "gitlite-browser-sync";
const STORE_NAME = "directories";
const BUNDLE_MAGIC = "GLB1";

interface LocalFileHandle extends FileSystemHandle {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>;
}

interface LocalDirectoryHandle extends FileSystemHandle {
  kind: "directory";
  values(): AsyncIterableIterator<LocalHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
}

type LocalHandle = LocalFileHandle | LocalDirectoryHandle;

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<LocalDirectoryHandle>;
}

interface SyncState {
  repositoryId: string;
  branch: string;
  head: string;
  hashes: Record<string, string>;
  directory: LocalDirectoryHandle;
}

interface ScannedFile {
  path: string;
  file: File;
  hash: string;
}

interface ManifestFile {
  path: string;
  size: number;
  hash: string;
}

interface Manifest {
  branch: string;
  head: string;
  files: ManifestFile[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "repositoryId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open browser sync storage."));
  });
}

async function loadState(repositoryId: string): Promise<SyncState | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(repositoryId);
      request.onsuccess = () => resolve((request.result as SyncState | undefined) || null);
      request.onerror = () => reject(request.error || new Error("Could not read browser sync state."));
    });
  } finally {
    database.close();
  }
}

async function saveState(state: SyncState): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not save browser sync state."));
    });
  } finally {
    database.close();
  }
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function chooseDirectory(): Promise<LocalDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error(
      "This browser does not support direct folder sync. Use Chrome or Edge on a desktop computer; otherwise use Add folder to upload and download files from the repository viewer."
    );
  }
  return picker({ mode: "readwrite" });
}

async function ensurePermission(directory: LocalDirectoryHandle): Promise<void> {
  let permission = await directory.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") permission = await directory.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("Read and write permission for the selected folder was not granted.");
}

async function hashFile(file: File): Promise<string> {
  return sha256(await file.arrayBuffer());
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function scanDirectory(directory: LocalDirectoryHandle): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  let totalBytes = 0;

  async function walk(current: LocalDirectoryHandle, prefix: string) {
    for await (const entry of current.values()) {
      if (entry.name.toLowerCase() === ".git" || entry.name.toLowerCase() === ".gitlite") continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        await walk(entry, relative);
      } else {
        const file = await entry.getFile();
        if (file.size > MAX_BATCH_BYTES) {
          throw new Error(`The file "${relative}" exceeds the 100 MB per-batch sync limit.`);
        }
        totalBytes += file.size;
        if (totalBytes > MAX_TOTAL_BYTES || files.length >= MAX_TOTAL_FILES) {
          throw new Error("The selected folder exceeds the browser sync limit of 100,000 files or 2 GB.");
        }
        files.push({ path: relative, file, hash: await hashFile(file) });
      }
    }
  }

  await walk(directory, "");
  return files.sort((first, second) => first.path.localeCompare(second.path));
}

function assertSameDirectory(state: SyncState, selected: LocalDirectoryHandle): Promise<boolean> {
  return state.directory.isSameEntry(selected);
}

async function postJson<T>(repositoryId: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}/browser-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Browser folder sync failed.");
  return result as T;
}

export function batchFiles(files: ManifestFile[]): ManifestFile[][] {
  const batches: ManifestFile[][] = [];
  let current: ManifestFile[] = [];
  let currentBytes = 8;
  for (const file of files) {
    const entryBytes = file.size + new TextEncoder().encode(file.path).length + 10;
    if (entryBytes + 8 > MAX_BATCH_BYTES) {
      throw new Error(`The file "${file.path}" exceeds the 100 MB per-batch sync limit.`);
    }
    if (current.length > 0 && (current.length >= MAX_BATCH_FILES || currentBytes + entryBytes > MAX_BATCH_BYTES)) {
      batches.push(current);
      current = [];
      currentBytes = 8;
    }
    current.push(file);
    currentBytes += entryBytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function decodeBundle(data: ArrayBuffer, expected: ManifestFile[]): Array<{ path: string; content: Uint8Array }> {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  if (bytes.byteLength < 8 || new TextDecoder().decode(bytes.subarray(0, 4)) !== BUNDLE_MAGIC) {
    throw new Error("The server returned an invalid file download.");
  }
  const count = view.getUint32(4);
  if (count !== expected.length) throw new Error("The server returned an incomplete file download.");
  let offset = 8;
  const files: Array<{ path: string; content: Uint8Array }> = [];
  for (let index = 0; index < count; index++) {
    if (offset + 2 > bytes.length) throw new Error("The server returned a truncated file download.");
    const nameLength = view.getUint16(offset);
    offset += 2;
    if (offset + nameLength + 8 > bytes.length) throw new Error("The server returned a truncated file download.");
    const name = new TextDecoder().decode(bytes.subarray(offset, offset + nameLength));
    offset += nameLength;
    const contentLength = Number(view.getBigUint64(offset));
    offset += 8;
    if (!Number.isSafeInteger(contentLength) || offset + contentLength > bytes.length) {
      throw new Error("The server returned a truncated file download.");
    }
    files.push({ path: name, content: bytes.slice(offset, offset + contentLength) });
    offset += contentLength;
  }
  if (offset !== bytes.length || files.some((file, index) => file.path !== expected[index].path)) {
    throw new Error("The server returned an inconsistent file download.");
  }
  return files;
}

async function downloadFiles(
  repositoryId: string,
  manifest: Manifest,
  onBatch: (files: Array<{ path: string; content: Uint8Array }>) => Promise<void>
): Promise<number> {
  let downloadedFiles = 0;
  for (const batch of batchFiles(manifest.files)) {
    const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}/browser-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "downloadFiles",
        branch: manifest.branch,
        head: manifest.head,
        paths: batch.map((file) => file.path),
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Could not download repository files.");
    }
    const files = decodeBundle(await response.arrayBuffer(), batch);
    for (let index = 0; index < files.length; index++) {
      if (await sha256(copyArrayBuffer(files[index].content)) !== batch[index].hash) {
        throw new Error(`The downloaded file "${files[index].path}" failed its integrity check.`);
      }
    }
    await onBatch(files);
    downloadedFiles += files.length;
  }
  return downloadedFiles;
}

async function writeFile(directory: LocalDirectoryHandle, relativePath: string, content: ArrayBuffer): Promise<void> {
  const segments = relativePath.split("/");
  const fileName = segments.pop();
  if (!fileName) throw new Error("Invalid file path in repository manifest.");
  let parent = directory;
  for (const segment of segments) parent = await parent.getDirectoryHandle(segment, { create: true });
  const handle = await parent.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

async function removeFile(directory: LocalDirectoryHandle, relativePath: string): Promise<void> {
  const segments = relativePath.split("/");
  const fileName = segments.pop();
  if (!fileName) return;
  let parent = directory;
  for (const segment of segments) {
    try {
      parent = await parent.getDirectoryHandle(segment);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return;
      throw error;
    }
  }
  try {
    await parent.removeEntry(fileName);
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error;
  }
}

function hashMap(files: ScannedFile[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file.path, file.hash]));
}

function mapsEqual(first: Record<string, string>, second: Record<string, string>): boolean {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => first[key] === second[key]);
}

async function getManifest(repositoryId: string): Promise<Manifest> {
  const manifest = await postJson<Manifest>(repositoryId, { action: "manifest" });
  if (manifest.files.length > MAX_TOTAL_FILES ||
      manifest.files.some((file) => !Number.isSafeInteger(file.size) || file.size < 0 ||
        !/^[a-f0-9]{64}$/i.test(file.hash)) ||
      manifest.files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    throw new Error("The repository exceeds the browser sync limit of 100,000 files or 2 GB.");
  }
  return manifest;
}

export function supportsBrowserFolderSync(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function cloneRepositoryToFolder(repositoryId: string): Promise<string> {
  const directory = await chooseDirectory();
  await ensurePermission(directory);
  if ((await scanDirectory(directory)).length > 0) {
    throw new Error("Choose an empty folder for the repository clone.");
  }
  const manifest = await getManifest(repositoryId);
  const hashes: Record<string, string> = {};
  const createdPaths: string[] = [];
  try {
    await downloadFiles(repositoryId, manifest, async (batch) => {
      for (const file of batch) {
        createdPaths.push(file.path);
        await writeFile(directory, file.path, copyArrayBuffer(file.content));
        hashes[file.path] = await sha256(copyArrayBuffer(file.content));
      }
    });
    await saveState({ repositoryId, branch: manifest.branch, head: manifest.head, hashes, directory });
  } catch (error) {
    for (const relative of createdPaths) {
      try {
        await removeFile(directory, relative);
      } catch (cleanupError) {
        console.error(`Could not remove partially cloned file "${relative}":`, cleanupError);
      }
    }
    throw error;
  }
  return `Cloned ${createdPaths.length} files from ${manifest.branch} into the selected folder.`;
}

export async function pushFolderToRepository(repositoryId: string): Promise<string> {
  const directory = await chooseDirectory();
  await ensurePermission(directory);
  const state = await loadState(repositoryId);
  if (!state || !(await assertSameDirectory(state, directory))) {
    throw new Error("This folder is not cloned for this repository in this browser. Choose Clone first.");
  }
  const files = await scanDirectory(directory);
  const currentHashes = hashMap(files);
  if (mapsEqual(currentHashes, state.hashes)) return "The selected folder has no changes to push.";
  if (state.head === "" && files.length === 0) {
    throw new Error("There are no files to push.");
  }

  const manifest = await getManifest(repositoryId);
  if (manifest.branch !== state.branch) {
    throw new Error("The hosted repository is on a different branch. Switch it back before pushing.");
  }
  if (manifest.head !== state.head) {
    const hostedHashes = Object.fromEntries(manifest.files.map((file) => [file.path, file.hash]));
    if (mapsEqual(currentHashes, hostedHashes)) {
      await saveState({ ...state, head: manifest.head, hashes: currentHashes });
      return "The selected folder already matches the hosted repository; sync state has been updated.";
    }
    throw new Error("The hosted repository has changed since this folder was cloned or last synced. Pull first.");
  }

  const { sessionId } = await postJson<{ sessionId: string }>(repositoryId, {
    action: "beginPush",
    branch: state.branch,
    baseHead: state.head,
  });
  try {
    let currentBatch: ScannedFile[] = [];
    let currentBytes = 0;
    const batches: ScannedFile[][] = [];
    for (const file of files) {
      if (file.file.size > MAX_BATCH_BYTES) throw new Error(`The file "${file.path}" exceeds the 100 MB batch limit.`);
      if (currentBatch.length > 0 &&
          (currentBatch.length >= MAX_BATCH_FILES || currentBytes + file.file.size > MAX_BATCH_BYTES)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBytes = 0;
      }
      currentBatch.push(file);
      currentBytes += file.file.size;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);
    for (const batch of batches) {
      const form = new FormData();
      form.set("action", "uploadBatch");
      form.set("sessionId", sessionId);
      form.set("paths", JSON.stringify(batch.map((file) => file.path)));
      batch.forEach((file) => form.append("files", file.file, file.path.split("/").pop() || file.path));
      const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}/browser-sync`, {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload a browser sync batch.");
    }
    const finished = await postJson<{ head: string; message: string }>(repositoryId, {
      action: "finishPush",
      sessionId,
    });
    await saveState({ ...state, head: finished.head, hashes: currentHashes });
    return finished.message;
  } catch (error) {
    await postJson(repositoryId, { action: "cancelPush", sessionId }).catch((cancelError) => {
      console.error("Could not cancel the incomplete browser push:", cancelError);
    });
    throw error;
  }
}

export async function pullRepositoryToFolder(repositoryId: string): Promise<string> {
  const directory = await chooseDirectory();
  await ensurePermission(directory);
  const state = await loadState(repositoryId);
  if (!state || !(await assertSameDirectory(state, directory))) {
    throw new Error("This folder is not cloned for this repository in this browser. Choose Clone first.");
  }
  const localFiles = await scanDirectory(directory);
  if (!mapsEqual(hashMap(localFiles), state.hashes)) {
    throw new Error("The selected folder has local changes. Push them first, or clone into a different folder.");
  }
  const manifest = await getManifest(repositoryId);
  if (manifest.branch !== state.branch) {
    throw new Error("The hosted repository is on a different branch. Switch it back before pulling into this folder.");
  }
  if (manifest.head === state.head) return "The selected folder is already up to date.";

  const remoteHashes: Record<string, string> = {};
  const currentHashes = { ...state.hashes };
  const remotePaths = new Set(manifest.files.map((file) => file.path));
  try {
    await downloadFiles(repositoryId, manifest, async (batch) => {
      for (const file of batch) {
        await writeFile(directory, file.path, copyArrayBuffer(file.content));
        const hash = await sha256(copyArrayBuffer(file.content));
        remoteHashes[file.path] = hash;
        currentHashes[file.path] = hash;
      }
      await saveState({ ...state, hashes: { ...currentHashes } });
    });
    for (const relative of Object.keys(state.hashes)) {
      if (!remotePaths.has(relative)) {
        await removeFile(directory, relative);
        delete currentHashes[relative];
        await saveState({ ...state, hashes: currentHashes });
      }
    }
  } catch (error) {
    try {
      await saveState({ ...state, hashes: hashMap(await scanDirectory(directory)) });
    } catch (baselineError) {
      throw new AggregateError([error, baselineError], "Pull failed and its partial local state could not be saved.");
    }
    throw error;
  }
  await saveState({ ...state, head: manifest.head, hashes: remoteHashes });
  return `Pulled ${manifest.files.length} files from ${manifest.branch} into the selected folder.`;
}
