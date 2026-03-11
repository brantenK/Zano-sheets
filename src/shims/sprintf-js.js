import "../../node_modules/sprintf-js/src/sprintf.js";

const globalScope = globalThis;

export const sprintf = (...args) => {
  if (typeof globalScope.sprintf !== "function") {
    throw new Error("sprintf-js shim failed to initialize");
  }
  return globalScope.sprintf(...args);
};

export const vsprintf = (...args) => {
  if (typeof globalScope.vsprintf !== "function") {
    throw new Error("sprintf-js shim failed to initialize");
  }
  return globalScope.vsprintf(...args);
};

export default { sprintf, vsprintf };
