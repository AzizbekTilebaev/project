#!/usr/bin/env bash
# OCR a scanned PDF with Karakalpak (kaa) Tesseract model.
# Usage: ocr_pdf.sh <pdf> <slug> [dpi=220] [jobs=4]
set -euo pipefail

PDF="${1:?pdf path}"
SLUG="${2:?output slug}"
DPI="${3:-220}"
JOBS="${4:-4}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TESSDATA="$ROOT/tessdata"
OUT="$ROOT/ocr/$SLUG"
PAGES_DIR="$OUT/pages"
PNG_DIR="$OUT/png"
LOG="$OUT/ocr.log"

mkdir -p "$PAGES_DIR" "$PNG_DIR"
export TESSDATA_PREFIX="$TESSDATA"

if [[ ! -f "$TESSDATA/kaa.traineddata" ]]; then
  echo "Missing $TESSDATA/kaa.traineddata" >&2
  exit 1
fi

TOTAL="$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')"
echo "[$(date -Iseconds)] START $SLUG pages=$TOTAL dpi=$DPI jobs=$JOBS" | tee -a "$LOG"
echo "$TOTAL" > "$OUT/total_pages.txt"
printf '%s\n' "$PDF" > "$OUT/source.txt"

ocr_page() {
  local i="$1"
  local pad
  pad="$(printf '%03d' "$i")"
  local txt="$PAGES_DIR/${pad}.txt"
  [[ -s "$txt" ]] && return 0

  local prefix="$PNG_DIR/p${pad}"
  pdftoppm -png -r "$DPI" -f "$i" -l "$i" "$PDF" "$prefix"
  local img
  img="$(ls -1 "${prefix}"*.png 2>/dev/null | head -1)"
  if [[ -z "${img:-}" ]]; then
    echo "[WARN] no image page $i" >> "$LOG"
    : > "$txt"
    return 0
  fi
  tesseract "$img" "$PAGES_DIR/$pad" -l kaa --psm 6 \
    --tessdata-dir "$TESSDATA" 2>>"$LOG"
  rm -f "$img"
  echo "ok $pad" >> "$LOG"
}

export -f ocr_page
export PDF DPI PAGES_DIR PNG_DIR LOG TESSDATA

seq 1 "$TOTAL" | xargs -P "$JOBS" -I{} bash -c 'ocr_page "$@"' _ {}

{
  echo "===== OCR $SLUG ====="
  echo "Source: $PDF"
  echo "Lang: kaa | DPI: $DPI | Pages: $TOTAL"
  echo "Date: $(date -Iseconds)"
  echo
  for f in "$PAGES_DIR"/*.txt; do
    bn="$(basename "$f" .txt)"
    echo
    echo "----- PAGE $bn -----"
    cat "$f"
  done
} > "$OUT/full.txt"

DONE="$(find "$PAGES_DIR" -name '*.txt' -size +0 | wc -l)"
echo "[$(date -Iseconds)] DONE $SLUG nonempty=$DONE/$TOTAL -> $OUT/full.txt" | tee -a "$LOG"
