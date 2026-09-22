// Runs the LEGACY Apps Script source (../src/*.gs) in a Node vm over the snapshot, read-only.
// Source-side reconciliation numbers therefore come from the old system's own code, not from a
// re-implementation (Book 09 §34–§36: "same meaning and formula" as the legacy system).
// Any attempt to write to the fake spreadsheet throws — the snapshot is immutable (Book 09 §7).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type Snapshot = Record<string, { headers: string[]; rows: Record<string, unknown>[] }>;

const TZ = 'Asia/Jerusalem';

function formatDate(date: Date, _tz: string, pattern: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return pattern
    .replace("'T'", 'T')
    .replace('yyyy', parts.year ?? '')
    .replace('MM', parts.month ?? '')
    .replace('dd', parts.day ?? '')
    .replace('HH', parts.hour ?? '')
    .replace('mm', parts.minute ?? '')
    .replace('ss', parts.second ?? '');
}

export interface LegacyApi {
  call<T = unknown>(fn: string, ...args: unknown[]): T;
  global<T = unknown>(name: string): T;
}

export function loadLegacy(snapshot: Snapshot, legacyDir: string, now: Date): LegacyApi {
  const readOnly = () => { throw new Error('legacy sandbox is read-only'); };
  const sheet = (name: string) => {
    const tab = snapshot[name];
    if (!tab) return null;
    const values = [tab.headers, ...tab.rows.map((r) => tab.headers.map((h) => (r[h] === undefined ? '' : r[h])))];
    return {
      getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
      getLastColumn: () => tab.headers.length,
      getLastRow: () => values.length,
      getRange: () => ({ getValues: () => [tab.headers.slice()], setValues: readOnly, setNumberFormats: readOnly }),
      getName: () => name,
      appendRow: readOnly,
    };
  };
  const spreadsheet = { getSheetByName: sheet, getSheets: () => Object.keys(snapshot).map(sheet), insertSheet: readOnly };
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length === 0) super(now.getTime());
      else super(...(args as ConstructorParameters<typeof Date>));
    }
    static now() { return now.getTime(); }
  }

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Date: FixedDate,
    JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseFloat, parseInt, Set, Map,
    SpreadsheetApp: { openById: () => spreadsheet, getActiveSpreadsheet: () => spreadsheet, create: readOnly },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k.includes('SCHEMA') ? '999' : 'snapshot'), setProperty: readOnly }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => '' }) },
    Logger: { log() {} },
    Utilities: { formatDate, getUuid: readOnly },
    HtmlService: {},
  });

  const files = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.gs')).sort();
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(legacyDir, f), 'utf8'), context, { filename: f });

  return {
    global<T>(name: string): T {
      return JSON.parse(JSON.stringify(vm.runInContext(name, context))) as T;
    },
    call<T>(fn: string, ...args: unknown[]): T {
      const target = (context as Record<string, unknown>)[fn];
      if (typeof target !== 'function') throw new Error(`legacy function ${fn} not found`);
      // results cross the vm boundary as plain data
      return JSON.parse(JSON.stringify((target as (...a: unknown[]) => unknown)(...args))) as T;
    },
  };
}
