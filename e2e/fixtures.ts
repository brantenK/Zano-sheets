import { test as base, Page } from '@playwright/test';

// Mock Office.js since we're testing in browser without Excel
export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject Office.js mock before page loads
    await page.addInitScript(() => {
      const makeRange = (address = 'A1') => {
        const fmt = {
          load: () => {},
          columnWidth: 64,
          rowHeight: 20,
          useStandardWidth: true,
          font: {
            load: () => {},
            name: 'Calibri',
            size: 11,
            color: '#000000',
            bold: false,
            italic: false,
            underline: 'None',
            strikethrough: false,
          },
          fill: { load: () => {}, color: '#ffffff' },
          borders: { getItem: () => ({ style: 'Continuous', weight: 'Thin', color: '#000000' }) },
        };

        const range: any = {
          load: () => {},
          address,
          rowCount: 1,
          columnCount: 1,
          values: [['']],
          formulas: [['']],
          rowHidden: [[false]],
          columnHidden: [[false]],
          isNullObject: false,
          clear: () => {},
          select: () => {},
          setData: () => {},
          setPosition: () => {},
          copyFrom: () => {},
          getImage: () => ({ value: '' }),
          getColumn: () => makeRange(address),
          getRow: () => makeRange(address),
          getCell: () => makeRange(address),
          getEntireColumn: () => ({ format: fmt }),
          getEntireRow: () => ({ format: fmt }),
          format: fmt,
          areas: { items: [] },
        };

        range.areas = { items: [range] };
        return range;
      };

      const sheet = {
        id: 'sheet-1',
        name: 'Sheet1',
        load: () => {},
        activate: () => {},
        tabColor: '#4f46e5',
        getRange: (addr?: string) => makeRange(addr || 'A1'),
        getUsedRangeOrNullObject: () => ({ ...makeRange('A1'), address: 'Sheet1!A1' }),
        getRanges: () => ({ format: makeRange().format, load: () => {}, areas: { items: [makeRange()] } }),
        freezePanes: {
          freezeAt: () => {},
          unfreeze: () => {},
          getLocationOrNullObject: () => ({ isNullObject: true, rowCount: 0, columnCount: 0, load: () => {} }),
        },
        charts: { items: [], load: () => {}, add: () => ({ load: () => {}, id: 'chart-1', title: { text: '' }, setPosition: () => {} }), getItem: () => ({ delete: () => {}, title: { text: '' }, setData: () => {}, setPosition: () => {} }) },
        pivotTables: { items: [], load: () => {}, add: () => ({ load: () => {}, id: 'pivot-1', hierarchies: { getItem: () => ({}) }, rowHierarchies: { add: () => {}, items: [], load: () => {}, remove: () => {} }, columnHierarchies: { add: () => {}, items: [], load: () => {}, remove: () => {} }, dataHierarchies: { add: () => ({ summarizeBy: 'sum' }), items: [], load: () => {}, remove: () => {} } }), getItem: () => ({ delete: () => {}, name: 'Pivot' }) },
        notes: { add: () => {}, load: () => {} },
        copy: () => ({ ...sheet, id: 'sheet-copy' }),
        delete: () => {},
      };

      const settingsStore: Record<string, unknown> = {};
      const settingsApi = {
        get: (key: string) => settingsStore[key] ?? null,
        set: (key: string, value: unknown) => {
          settingsStore[key] = value;
        },
        remove: (key: string) => {
          delete settingsStore[key];
        },
        saveAsync: (cb?: (result: { status: string }) => void) => {
          cb?.({ status: 'succeeded' });
        },
      };

      // Prevent onboarding modal from intercepting clicks in deterministic E2E runs.
      // This can throw in opaque-origin contexts before navigation.
      try {
        localStorage.setItem('zanosheets-onboarding-complete', '2');
      } catch {}

      (window as any).Office = {
        onReady: (cb: (info: any) => void) => cb({ host: 'Excel', platform: 'PC' }),
        context: { document: { url: 'test.xlsx', settings: settingsApi } },
        actions: { associate: () => {} },
        AsyncResultStatus: { Succeeded: 'succeeded', Failed: 'failed' },
        HostType: { Excel: 'Excel' },
        PlatformType: { PC: 'PC' },
      };
      (window as any).Excel = {
        run: async (cb: (context: any) => Promise<void>) => {
          const mockContext = {
            workbook: {
              id: 'workbook-1',
              name: 'test.xlsx',
              application: {
                load: () => {},
                calculationMode: 'automatic',
                calculate: () => {},
              },
              worksheets: {
                items: [sheet],
                load: () => {},
                add: () => ({ ...sheet, id: 'sheet-new' }),
                getItem: () => sheet,
                getActiveWorksheet: () => sheet,
              },
              getSelectedRange: () => makeRange('A1'),
              load: () => {},
            },
            sync: async () => {},
          };
          await cb(mockContext);
        },
        CalculationMode: { manual: 'manual' },
        CalculationType: { full: 'full' },
        InsertShiftDirection: { down: 'down', right: 'right' },
        DeleteShiftDirection: { up: 'up', left: 'left' },
        RangeCopyType: { all: 'all' },
        ClearApplyTo: { all: 'all', contents: 'contents', formats: 'formats' },
        BorderIndex: {
          edgeTop: 'edgeTop',
          edgeBottom: 'edgeBottom',
          edgeLeft: 'edgeLeft',
          edgeRight: 'edgeRight',
        },
        BorderLineStyle: {
          continuous: 'continuous',
          dash: 'dash',
          dot: 'dot',
          double: 'double',
        },
        BorderWeight: { thin: 'thin', medium: 'medium', thick: 'thick' },
        ChartSeriesBy: { auto: 'auto' },
        AggregationFunction: {
          sum: 'sum',
          count: 'count',
          average: 'average',
          max: 'max',
          min: 'min',
        },
      };
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
