// Browser shim for node:fs in add-in runtime
export default {};

import promises from "./promises.js";

export const existsSync = () => false;
export const readFileSync = () => "";
export const writeFileSync = () => {};
export const mkdirSync = () => {};
export const readdirSync = () => [];
export const statSync = () => ({});
export const lstatSync = () => ({});
export const readlinkSync = () => "";
export const realpathSync = (value) => value;
export const unlinkSync = () => {};
export { promises };
