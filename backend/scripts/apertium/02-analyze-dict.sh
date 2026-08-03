#!/usr/bin/env bash
# Lug‘at so‘zlarini (latin) apertium-kaa bilan analiz qiladi.
# Kirish:  backend/tmp/apertium/dict-words.lat.txt   (export-dict-for-apertium.mjs)
# Chiqish: backend/tmp/apertium/dict-morph.raw.txt
# Ishlatish: wsl -e bash scripts/apertium/02-analyze-dict.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$BACKEND_DIR/tmp/apertium"
WORDS="$OUT_DIR/dict-words.lat.txt"
RAW="$OUT_DIR/dict-morph.raw.txt"
HFST="$OUT_DIR/kaa.automorf.hfst"
BIN="$OUT_DIR/kaa.automorf.bin"

if [[ ! -f "$WORDS" ]]; then
  echo "ERROR: $WORDS yo‘q. Avval: node scripts/export-dict-for-apertium.mjs"
  exit 1
fi

if [[ ! -f "$HFST" && ! -f "$BIN" ]]; then
  echo "ERROR: transducer yo‘q. Avval: bash scripts/apertium/01-build-kaa.sh"
  exit 1
fi

# Bo‘sh / maxsus belgili qatorlarni filtrlash (hfst-proc stream xavfsizligi)
SAFE="$OUT_DIR/dict-words.safe.txt"
# ı, ǵ, ń, á... — qaraqalpaq latin; faqat stream-xavfli belgilarni chiqaramiz
grep -vE '[/\\^$*[:space:]]' "$WORDS" | grep -E '^.{2,}$' > "$SAFE" || true
N=$(wc -l < "$SAFE" | tr -d ' ')
echo "==> analyzing $N safe words → $RAW"

# hfst-proc tezroq batch uchun; yo‘q bo‘lsa lt-proc
# EXIT trap: stream xatosida ham qisman RAW saqlansin
set +e
if [[ -f "$HFST" ]] && command -v hfst-proc >/dev/null 2>&1; then
  hfst-proc -w "$HFST" < "$SAFE" > "$RAW"
  RC=$?
elif [[ -f "$BIN" ]]; then
  lt-proc -w "$BIN" < "$SAFE" > "$RAW"
  RC=$?
else
  echo "ERROR: hfst-proc/lt-proc topilmadi"
  exit 1
fi
set -e

OUTN=$(wc -l < "$RAW" | tr -d ' ')
echo "==> lines out: $OUTN (rc=$RC)"
if [[ "$OUTN" -ne "$N" ]]; then
  echo "WARN: input/output mismatch ($N vs $OUTN) — qisman natija"
fi
echo "==> sample:"
head -n 8 "$RAW" || true
# Import uchun so‘zlar ro‘yxatini safe bilan sync qilamiz
cp -f "$SAFE" "$OUT_DIR/dict-words.analyzed.txt"
echo "==> DONE"
