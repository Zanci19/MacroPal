#!/usr/bin/env python3
"""Import the Open Food Facts CSV dump into a SQLite database.

This script is designed for very large CSV files (like the OFF full products dump)
and processes rows in batches to keep memory usage stable.

Default source:
  https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz

Usage examples:
  python3 scripts/import_openfoodfacts_to_sqlite.py
  python3 scripts/import_openfoodfacts_to_sqlite.py --db-path data/openfoodfacts.sqlite
  python3 scripts/import_openfoodfacts_to_sqlite.py --batch-size 1000 --limit 50000
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable
from urllib.request import urlopen

DEFAULT_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
DEFAULT_TABLE = "openfoodfacts_products"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import Open Food Facts CSV(.gz) into SQLite with all columns."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="HTTP(S) URL to the CSV or CSV.GZ file.",
    )
    parser.add_argument(
        "--db-path",
        default="data/openfoodfacts.sqlite",
        help="Output SQLite file path.",
    )
    parser.add_argument(
        "--table",
        default=DEFAULT_TABLE,
        help="Destination table name.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2500,
        help="Rows inserted per batch commit.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional row limit (0 = no limit). Useful for quick dry-runs.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append to an existing table. By default the table is dropped/recreated.",
    )
    return parser.parse_args()


def quote_ident(identifier: str) -> str:
    """Safely quote a SQLite identifier."""
    return '"' + identifier.replace('"', '""') + '"'


def chunked(iterable: Iterable[tuple[str, ...]], chunk_size: int) -> Iterable[list[tuple[str, ...]]]:
    batch: list[tuple[str, ...]] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= chunk_size:
            yield batch
            batch = []
    if batch:
        yield batch


def open_csv_reader(url: str) -> csv.DictReader:
    response = urlopen(url)
    lower_url = url.lower()

    if lower_url.endswith(".gz"):
        file_obj: io.TextIOBase = io.TextIOWrapper(
            gzip.GzipFile(fileobj=response),
            encoding="utf-8",
            errors="replace",
            newline="",
        )
    else:
        file_obj = io.TextIOWrapper(response, encoding="utf-8", errors="replace", newline="")

    return csv.DictReader(file_obj)


def main() -> int:
    args = parse_args()

    if args.batch_size <= 0:
        print("Error: --batch-size must be > 0", file=sys.stderr)
        return 2

    db_path = Path(args.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    started = time.time()
    print(f"Opening CSV stream: {args.url}")
    reader = open_csv_reader(args.url)

    if not reader.fieldnames:
        print("Error: CSV appears to have no headers.", file=sys.stderr)
        return 2

    columns = reader.fieldnames
    quoted_table = quote_ident(args.table)
    quoted_columns = [quote_ident(col) for col in columns]

    create_sql = (
        f"CREATE TABLE IF NOT EXISTS {quoted_table} ("
        + ", ".join(f"{col} TEXT" for col in quoted_columns)
        + ")"
    )

    placeholders = ", ".join("?" for _ in columns)
    insert_sql = (
        f"INSERT INTO {quoted_table} ("
        + ", ".join(quoted_columns)
        + f") VALUES ({placeholders})"
    )

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA cache_size = -200000")

    try:
        if not args.append:
            print(f"Recreating table {args.table} in {db_path}...")
            conn.execute(f"DROP TABLE IF EXISTS {quoted_table}")

        conn.execute(create_sql)

        def row_values() -> Iterable[tuple[str, ...]]:
            for row in reader:
                yield tuple(row.get(col, "") for col in columns)

        total_rows = 0
        with conn:
            for batch in chunked(row_values(), args.batch_size):
                if args.limit and total_rows + len(batch) > args.limit:
                    batch = batch[: args.limit - total_rows]
                    if not batch:
                        break

                conn.executemany(insert_sql, batch)
                total_rows += len(batch)

                if total_rows % 100000 == 0:
                    elapsed = time.time() - started
                    print(f"Inserted {total_rows:,} rows in {elapsed:.1f}s")

                if args.limit and total_rows >= args.limit:
                    break

        elapsed = time.time() - started
        print(f"Done. Inserted {total_rows:,} rows into {db_path} ({args.table}) in {elapsed:.1f}s")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
