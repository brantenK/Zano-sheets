// Browser shim for node:fs/promises in add-in runtime
export const readFile = async () => "";
export const writeFile = async () => {};
export const mkdir = async () => {};
export const readdir = async () => [];
export const stat = async () => ({});
export const unlink = async () => {};

export default {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  unlink,
};
