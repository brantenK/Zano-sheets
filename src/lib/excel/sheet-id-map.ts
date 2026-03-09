/* global Office */

const SETTINGS_KEY_MAP = "zanosheets-sheet-id-map";
const SETTINGS_KEY_COUNTER = "zanosheets-sheet-id-counter";
const LEGACY_SETTINGS_KEY_MAP = "openexcel-sheet-id-map";
const LEGACY_SETTINGS_KEY_COUNTER = "openexcel-sheet-id-counter";
const WORKBOOK_ID_KEY = "zanosheets-workbook-id";
const LEGACY_WORKBOOK_ID_KEY = "openexcel-workbook-id";

interface SheetIdMap {
  [guid: string]: number;
}

let cachedMap: SheetIdMap | null = null;
let cachedCounter: number | null = null;
let cachedWorkbookMarker: string | null = null;
let isDirty = false;

function getCurrentWorkbookMarker(): string {
  const settings = Office.context.document.settings;
  const workbookId =
    (settings.get(WORKBOOK_ID_KEY) as string | undefined) ||
    (settings.get(LEGACY_WORKBOOK_ID_KEY) as string | undefined) ||
    "";
  const documentUrl =
    typeof Office.context.document.url === "string"
      ? Office.context.document.url
      : "";
  return `${workbookId}::${documentUrl}`;
}

async function ensureWorkbookCache(): Promise<void> {
  const currentMarker = getCurrentWorkbookMarker();
  if (cachedMap === null || cachedWorkbookMarker !== currentMarker) {
    cachedMap = null;
    cachedCounter = null;
    isDirty = false;
    await loadFromSettings();
  }
}

async function loadFromSettings(): Promise<void> {
  return new Promise((resolve) => {
    Office.context.document.settings.refreshAsync(() => {
      const settings = Office.context.document.settings;
      cachedWorkbookMarker = getCurrentWorkbookMarker();
      const map = settings.get(SETTINGS_KEY_MAP) as SheetIdMap | undefined;
      const counter = settings.get(SETTINGS_KEY_COUNTER) as number | undefined;

      if (map && typeof counter === "number") {
        cachedMap = map;
        cachedCounter = counter;
        resolve();
        return;
      }

      const legacyMap =
        (settings.get(LEGACY_SETTINGS_KEY_MAP) as SheetIdMap | undefined) || {};
      const legacyCounter =
        (settings.get(LEGACY_SETTINGS_KEY_COUNTER) as number | undefined) || 0;

      cachedMap = legacyMap;
      cachedCounter = legacyCounter;

      if (
        Object.keys(legacyMap).length > 0 ||
        (typeof legacyCounter === "number" && legacyCounter > 0)
      ) {
        settings.set(SETTINGS_KEY_MAP, legacyMap);
        settings.set(SETTINGS_KEY_COUNTER, legacyCounter);
        settings.remove(LEGACY_SETTINGS_KEY_MAP);
        settings.remove(LEGACY_SETTINGS_KEY_COUNTER);
        settings.saveAsync(() => resolve());
        return;
      }

      resolve();
    });
  });
}

async function saveToSettings(): Promise<void> {
  if (!isDirty) return;

  return new Promise((resolve) => {
    Office.context.document.settings.set(SETTINGS_KEY_MAP, cachedMap);
    Office.context.document.settings.set(SETTINGS_KEY_COUNTER, cachedCounter);
    Office.context.document.settings.saveAsync(() => {
      isDirty = false;
      resolve();
    });
  });
}

export async function getStableSheetId(guid: string): Promise<number> {
  await ensureWorkbookCache();

  const map = cachedMap ?? {};
  cachedMap = map;

  if (map[guid]) {
    return map[guid];
  }

  cachedCounter = (cachedCounter || 0) + 1;
  map[guid] = cachedCounter;
  isDirty = true;
  await saveToSettings();

  return cachedCounter;
}

export function getExistingSheetId(guid: string): number | null {
  if (cachedMap === null) return null;
  return cachedMap[guid] || null;
}

export async function getAllSheetIds(): Promise<SheetIdMap> {
  await ensureWorkbookCache();
  return { ...(cachedMap ?? {}) };
}

export async function clearSheetIds(): Promise<void> {
  cachedMap = {};
  cachedCounter = 0;
  isDirty = true;
  await saveToSettings();
}

export async function preloadSheetIds(
  worksheets: Excel.Worksheet[],
): Promise<Map<string, number>> {
  await ensureWorkbookCache();

  const map = cachedMap ?? {};
  cachedMap = map;

  const result = new Map<string, number>();
  let needsSave = false;

  for (const sheet of worksheets) {
    const guid = sheet.id;

    if (map[guid]) {
      result.set(guid, map[guid]);
    } else {
      cachedCounter = (cachedCounter || 0) + 1;
      map[guid] = cachedCounter;
      result.set(guid, cachedCounter);
      needsSave = true;
    }
  }

  if (needsSave) {
    isDirty = true;
    await saveToSettings();
  }

  return result;
}
