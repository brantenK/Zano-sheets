import argparse
import json
from typing import Any

import xlwings as xw


def normalize_value(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet", help="Worksheet name to inspect")
    parser.add_argument("--range", dest="range_address", help="A1-style range to inspect")
    parser.add_argument(
        "--used-range",
        action="store_true",
        help="Print the used range for the selected or active sheet",
    )
    args = parser.parse_args()

    app = xw.apps.active
    if app is None:
        raise SystemExit("No active Excel instance found.")

    workbook = app.books.active
    if workbook is None:
        raise SystemExit("No active workbook found.")

    sheet = workbook.sheets[args.sheet] if args.sheet else workbook.sheets.active

    payload = {
        "workbook": workbook.name,
        "sheet": sheet.name,
    }

    if args.used_range:
        used = sheet.used_range
        payload["used_range"] = {
            "address": used.address,
            "value": used.value,
        }

    if args.range_address:
        target = sheet.range(args.range_address)
        value = target.value
        if isinstance(value, list):
            value = [
                [normalize_value(cell) for cell in row] if isinstance(row, list) else normalize_value(row)
                for row in value
            ]
        else:
            value = normalize_value(value)
        payload["range"] = {
            "address": args.range_address,
            "value": value,
        }

    print(json.dumps(payload, indent=2, default=str))


if __name__ == "__main__":
    main()