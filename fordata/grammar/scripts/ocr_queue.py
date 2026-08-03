#!/usr/bin/env python3
"""Run OCR queue for scanned Karakalpak textbooks."""
from __future__ import annotations

import datetime as dt
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "ocr"
SCRIPT = Path(__file__).resolve().parent / "ocr_pdf.py"
DL = Path("/home/azizbek/Downloads/Telegram Desktop")

JOBS = [
    (DL / "Qaraqalpaq Tili 10-klass (Mámleketlik tili)_compressed.pdf", "10-klass-basqa-tillerde-2019"),
    (DL / "КК тил 11-клас.pdf", "11-klass-basqa-tillerde-2019"),
    (DL / "Qaraqalpaq Tili 9-klass. (Mámleketlik tili)_compressed.pdf", "9-klass-basqa-tillerde-2019"),
    (DL / "КК тил 7-клас.pdf", "7-klass-kk-skaner"),
    (DL / "8-klass qaraqalpaq tili. 2025.pdf", "8-klass-2025"),
    (DL / "9-klass qaraqalpaq tili 2025.pdf", "9-klass-2025"),
]


def main() -> int:
    OCR.mkdir(parents=True, exist_ok=True)
    queue_log = OCR / "queue.log"
    with queue_log.open("a", encoding="utf-8") as ql:
        ql.write(f"[{dt.datetime.now().isoformat(timespec='seconds')}] QUEUE START\n")
        ql.flush()
        print(f"QUEUE START ({len(JOBS)} books)", flush=True)
        for pdf, slug in JOBS:
            msg = f">>> {slug}"
            print(msg, flush=True)
            ql.write(f"[{dt.datetime.now().isoformat(timespec='seconds')}] {msg}\n")
            ql.flush()
            if not pdf.is_file():
                print(f"MISSING {pdf}", flush=True)
                ql.write(f"MISSING {pdf}\n")
                continue
            rc = subprocess.call(
                [sys.executable, str(SCRIPT), str(pdf), slug, "--dpi", "220", "--jobs", "4"]
            )
            ql.write(f"[{dt.datetime.now().isoformat(timespec='seconds')}] rc={rc} {slug}\n")
            ql.flush()
            if rc != 0:
                print(f"FAILED {slug} rc={rc}", flush=True)
        done = f"[{dt.datetime.now().isoformat(timespec='seconds')}] QUEUE ALL DONE"
        print(done, flush=True)
        ql.write(done + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
