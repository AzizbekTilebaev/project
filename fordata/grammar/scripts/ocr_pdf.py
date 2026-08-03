#!/usr/bin/env python3
"""OCR a scanned PDF with Karakalpak (kaa) Tesseract model."""
from __future__ import annotations

import argparse
import datetime as dt
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TESSDATA = ROOT / "tessdata"


def log(msg: str, log_path: Path | None = None) -> None:
    line = f"[{dt.datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line, flush=True)
    if log_path is not None:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")


def pdf_pages(pdf: Path) -> int:
    out = subprocess.check_output(["pdfinfo", str(pdf)], text=True, errors="replace")
    for line in out.splitlines():
        if line.startswith("Pages:"):
            return int(line.split()[1])
    raise RuntimeError(f"Cannot read page count: {pdf}")


def ocr_page(
    pdf: Path,
    page: int,
    pages_dir: Path,
    png_dir: Path,
    dpi: int,
    log_path: Path,
    rotate: int = 0,
    force: bool = False,
) -> bool:
    pad = f"{page:03d}"
    txt = pages_dir / f"{pad}.txt"
    if not force and txt.exists() and txt.stat().st_size > 0:
        return True

    prefix = png_dir / f"p{pad}"
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), "-f", str(page), "-l", str(page), str(pdf), str(prefix)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    imgs = sorted(png_dir.glob(f"p{pad}*.png"))
    if not imgs:
        txt.write_text("", encoding="utf-8")
        log(f"WARN no image page {page}", log_path)
        return False

    img = imgs[0]
    if rotate:
        from PIL import Image

        with Image.open(img) as im:
            im.rotate(rotate, expand=True).save(img)

    subprocess.run(
        [
            "tesseract",
            str(img),
            str(pages_dir / pad),
            "-l",
            "kaa",
            "--psm",
            "6",
            "--tessdata-dir",
            str(TESSDATA),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    img.unlink(missing_ok=True)
    return True


def assemble(out: Path, pdf: Path, total: int, dpi: int) -> None:
    parts = [
        f"===== OCR {out.name} =====",
        f"Source: {pdf}",
        f"Lang: kaa | DPI: {dpi} | Pages: {total}",
        f"Date: {dt.datetime.now().isoformat(timespec='seconds')}",
        "",
    ]
    for page in range(1, total + 1):
        pad = f"{page:03d}"
        parts.append(f"\n----- PAGE {pad} -----")
        p = out / "pages" / f"{pad}.txt"
        parts.append(p.read_text(encoding="utf-8", errors="replace") if p.exists() else "")
    (out / "full.txt").write_text("\n".join(parts), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("slug")
    ap.add_argument("--dpi", type=int, default=220)
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument(
        "--rotate",
        type=int,
        default=0,
        help="PIL rotate degrees CCW after render (e.g. 90 for sideways scans)",
    )
    args = ap.parse_args()

    pdf = Path(args.pdf)
    if not pdf.is_file():
        print(f"PDF not found: {pdf}", file=sys.stderr)
        return 1
    if not (TESSDATA / "kaa.traineddata").is_file():
        print(f"Missing {TESSDATA / 'kaa.traineddata'}", file=sys.stderr)
        return 1

    out = ROOT / "ocr" / args.slug
    pages_dir = out / "pages"
    png_dir = out / "png"
    pages_dir.mkdir(parents=True, exist_ok=True)
    png_dir.mkdir(parents=True, exist_ok=True)
    log_path = out / "ocr.log"

    total = pdf_pages(pdf)
    (out / "total_pages.txt").write_text(str(total) + "\n", encoding="utf-8")
    (out / "source.txt").write_text(str(pdf) + "\n", encoding="utf-8")
    force = bool(args.rotate)  # rotated re-runs should overwrite
    if force:
        for old in pages_dir.glob("*.txt"):
            old.unlink(missing_ok=True)
        (out / "full.txt").unlink(missing_ok=True)

    log(
        f"START {args.slug} pages={total} dpi={args.dpi} jobs={args.jobs} rotate={args.rotate}",
        log_path,
    )

    ok = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as ex:
        futs = {
            ex.submit(
                ocr_page, pdf, page, pages_dir, png_dir, args.dpi, log_path, args.rotate, force
            ): page
            for page in range(1, total + 1)
        }
        for fut in as_completed(futs):
            page = futs[fut]
            try:
                if fut.result():
                    ok += 1
            except Exception as e:  # noqa: BLE001
                log(f"ERR page {page}: {e}", log_path)

    assemble(out, pdf, total, args.dpi)
    nonempty = sum(1 for p in pages_dir.glob("*.txt") if p.stat().st_size > 0)
    log(f"DONE {args.slug} nonempty={nonempty}/{total} ok_calls={ok} -> {out / 'full.txt'}", log_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
