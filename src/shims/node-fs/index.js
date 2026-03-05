// Browser shim for node:fs in add-in runtime
export default {};

export const existsSync = () => false;
export const readFileSync = () => "";
export const writeFileSync = () => {};
export const mkdirSync = () => {};
export const readdirSync = () => [];
export const statSync = () => ({});
export const unlinkSync = () => {};
