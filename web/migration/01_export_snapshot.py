"""DORON'S RAVE migration — step 01: immutable typed snapshot (Book 09 §6, §7).

Input : migration/snapshot/legacy.xlsx — an XLSX export of the legacy Google Sheet
        (XLSX keeps cell types; CSV would flatten dates, numbers and booleans).
Output: migration/snapshot/snapshot.json  — every tab, every row (archived included), typed
        migration/snapshot/manifest.json  — per-tab row count + sha256 of the source file

Typing rule = what the legacy code saw through getValues()/rowToObject_():
  * DATE_COLUMNS          -> 'yyyy-MM-dd'
  * other date-time cells -> 'yyyy-MM-ddTHH:mm:ss'
  * time-only cells       -> 'HH:mm'
  * numbers stay numbers, booleans stay booleans, empty -> ''
The snapshot is never edited by hand; a new export means a new snapshot.
"""
import datetime as dt
import hashlib
import json
import pathlib
import sys

import openpyxl

HERE = pathlib.Path(__file__).resolve().parent
SNAP = HERE / 'snapshot'
SOURCE = SNAP / 'legacy.xlsx'
DATE_COLUMNS = {'event_date', 'expense_date', 'due_date', 'paid_date', 'reminder_date'}


def typed(value, column):
    if value is None:
        return ''
    if isinstance(value, bool):
        return value
    if isinstance(value, dt.datetime):
        if column in DATE_COLUMNS:
            return value.strftime('%Y-%m-%d')
        if value.date() == dt.date(1899, 12, 30):  # time-only serial
            return value.strftime('%H:%M')
        return value.strftime('%Y-%m-%dT%H:%M:%S')
    if isinstance(value, dt.date):
        return value.strftime('%Y-%m-%d')
    if isinstance(value, dt.time):
        return value.strftime('%H:%M')
    if isinstance(value, (int, float)):
        return int(value) if isinstance(value, float) and value.is_integer() else value
    return str(value)


def main():
    if not SOURCE.exists():
        sys.exit(f'missing {SOURCE}')
    raw = SOURCE.read_bytes()
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    sheets = {}
    manifest = {
        'source_file': SOURCE.name,
        'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw),
        'exported_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'tabs': {},
    }
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        headers = [str(h).strip() if h is not None else '' for h in (rows[0] if rows else ())]
        out = []
        for index, row in enumerate(rows[1:], start=2):
            if not any(v not in (None, '') for v in row):
                continue
            record = {h: typed(row[i] if i < len(row) else None, h) for i, h in enumerate(headers) if h}
            record['__source_row'] = index
            out.append(record)
        sheets[ws.title] = {'headers': [h for h in headers if h], 'rows': out}
        manifest['tabs'][ws.title] = {'rows': len(out), 'headers': [h for h in headers if h]}
    (SNAP / 'snapshot.json').write_text(json.dumps(sheets, ensure_ascii=False, indent=1), encoding='utf-8')
    (SNAP / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({k: v['rows'] for k, v in manifest['tabs'].items()}, ensure_ascii=False))
    print('sha256', manifest['sha256'])


if __name__ == '__main__':
    main()
