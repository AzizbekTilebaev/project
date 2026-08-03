# Fordata tools

Bir sahifa = bir JSON fayl. Bulk blind import yo‘q.

## Buyruqlar

```bash
cd fordata/tools

# Tekshirish
node validate-page.js dict_pages_v2/15_remaining_simple/togri/0001.json

# Transform (AJV-ready JSON chiqarish)
node transform-page.js dict_pages_v2/15_remaining_simple/togri/0001.json

# Dry-run import (yozmaydi)
node import-page.js dict_pages_v2/15_remaining_simple/togri/0001.json --dry-run

# Haqiqiy import (MySQL)
node import-page.js dict_pages_v2/15_remaining_simple/togri/0001.json

# Kategoriya bo‘yicha ketma-ket
node process-category.js dict_pages_v2/15_remaining_simple/togri
node process-category.js dict_pages_v2/15_remaining_simple/togri --dry-run --limit 5

# Shubhali tuzatish
node fix-shubhali.js --all
node fix-shubhali.js --all --write
```

Progress: `fordata/tools/progress.jsonl`
