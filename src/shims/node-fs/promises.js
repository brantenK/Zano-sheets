// Browser shim for node:fs/promises in add-in runtime
export const readFile = async () => "";
export const writeFile = async () => {};
export const mkdir = async () => {};
export const readdir = async () => [];
export const stat = async () => ({});
export const unlink = async () => {};
export const open = async () => ({
  close: async () => {},
  read: async () => ({ bytesRead: 0, buffer: new Uint8Array() }),
  stat: async () => ({}),
});

export default {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  unlink,
  open,
};
