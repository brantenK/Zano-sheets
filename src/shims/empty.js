// Browser shim for server-only Node.js built-ins (node:fs, node:os, node:path, etc.)
// These modules are imported by pi-ai's OAuth/streaming code that never runs in the browser.
// All exports are safe no-ops.
export default {};

// node:fs
export const existsSync = () => false;
export const readFileSync = () => "";
export const writeFileSync = () => {};
export const mkdirSync = () => {};
export const readdirSync = () => [];
export const statSync = () => ({});
export const unlinkSync = () => {};

// node:fs/promises
export const readFile = async () => "";
export const writeFile = async () => {};
export const mkdir = async () => {};
export const readdir = async () => [];
export const stat = async () => ({});
export const unlink = async () => {};

// node:os
export const homedir = () => "";
export const platform = () => "browser";
export const tmpdir = () => "";
export const EOL = "\n";

// node:module
export const createRequire = () => () => {
  throw new Error("createRequire is not available in the browser runtime");
};

// node:path
export const join = (...parts) => parts.filter(Boolean).join("/");
export const resolve = (...parts) => parts.filter(Boolean).join("/");
export const dirname = (p) => p.split("/").slice(0, -1).join("/");
export const basename = (p) => p.split("/").pop() ?? "";
export const isAbsolute = (p) => typeof p === "string" && p.startsWith("/");
export const relative = (_from, to) => to ?? "";
export const extname = (p) => {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i) : "";
};
export const sep = "/";

// node:url
export const fileURLToPath = (value) => {
  if (typeof value === "string") {
    return value.startsWith("file://") ? value.slice(7) : value;
  }
  return value?.pathname ?? "";
};
export const pathToFileURL = (value) => ({
  href: `file://${value}`,
  pathname: value,
});

// node:crypto
export const createHash = () => ({ update: () => ({ digest: () => "" }) });
export const randomBytes = (n) => new Uint8Array(n);
export const createHmac = () => ({ update: () => ({ digest: () => "" }) });

// node:http / http
export const Agent = class {};
export const globalAgent = new Agent();
export const request = () => ({ on: () => {}, end: () => {} });
export const get = () => ({ on: () => {}, end: () => {} });
export const createServer = () => ({ listen: () => {}, close: () => {} });
export const IncomingMessage = class {};
export const ServerResponse = class {};

// node:worker_threads
export const Worker = class {
  postMessage() {}
  terminate() {
    return Promise.resolve(0);
  }
  on() {
    return this;
  }
};
export const parentPort = null;
export const workerData = undefined;

// node:zlib
export const createGunzip = () => ({});
export const createGzip = () => ({});
export const createDeflate = () => ({});
export const createInflate = () => ({});
export const gzipSync = () => new Uint8Array();
export const gunzipSync = () => new Uint8Array();
export const deflateSync = () => new Uint8Array();
export const inflateSync = () => new Uint8Array();
export const constants = {
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  Z_VERSION_ERROR: -6,
  Z_DEFAULT_COMPRESSION: -1,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_NO_COMPRESSION: 0,
  Z_FIXED: 4,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_DEFAULT_STRATEGY: 0,
  DEFLATE: 1,
  INFLATE: 2,
  GZIP: 3,
  GUNZIP: 4,
  DEFLATERAW: 5,
  INFLATERAW: 6,
  UNZIP: 7,
};
