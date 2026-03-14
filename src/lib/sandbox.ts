import { ensureLockdown } from "../taskpane/lockdown";

/* global Compartment */

let lockdownWarningLogged = false;

function tryEnsureLockdown() {
  try {
    ensureLockdown();
  } catch (error) {
    const message = String(error);
    const unsupported =
      error instanceof TypeError &&
      message.includes(
        "Unexpected [[Prototype]] at intrinsics.ArrayBuffer.__proto__",
      );
    if (!unsupported) {
      throw error;
    }

    if (!lockdownWarningLogged) {
      lockdownWarningLogged = true;
      console.warn(
        "[sandbox] SES lockdown is incompatible with this runtime; continuing with compartment-only isolation.",
      );
    }
  }
}

export function sandboxedEval(
  code: string,
  globals: Record<string, unknown>,
): unknown {
  tryEnsureLockdown();
  const compartment = new Compartment({
    globals: {
      ...globals,
      console,
      Math,
      Date,
      Function: undefined,
      Reflect: undefined,
      Proxy: undefined,
      Compartment: undefined,
      harden: undefined,
      lockdown: undefined,
    },
    __options__: true,
  });
  return compartment.evaluate(`(async () => { ${code} })()`);
}
