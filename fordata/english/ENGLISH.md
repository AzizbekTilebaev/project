# Ingliz tili — maktab sabaqlıqları (1–11)

> Qaraqalpaq / Ózbekstan maktab seriyaları: **Kids’ English**, **New Fly High**, **Teens’ English**, **English 10–11**.  
> QQ til qoidaları (`fordata/grammar/`) menen **aralastırılmaydı**.  
> Sayt: `/english` · indeks: [docs/INDEX.md](../../docs/INDEX.md) · [fordata/README.md](../README.md).  
> PDF/OCR/extract **trash**da: `/home/azizbek/proyekt2-trash-20260807/fordata/english/` (bazaga / MD ga o‘tkazilgan).

## Derekler

| # | Klass | Seriya | Túri | PDF slug | Matn | MD |
|--:|------:|--------|------|----------|------|-----|
| 1 | 1 | Kids’ English | oqıwshı | `1-kids-english` | pdftotext ✅ | `english-1-4-kids.md` |
| 2 | 2 | Kids’ English | oqıwshı | `2-kids-english` | OCR eng ✅ | `english-1-4-kids.md` |
| 3 | 3 | Kids’ English | oqıwshı | `3-kids-english` | OCR eng ✅ | `english-1-4-kids.md` |
| 4 | 4 | Kids’ English | oqıwshı | `4-kids-english` | OCR eng ✅ | `english-1-4-kids.md` |
| 5 | 5 | New Fly High English | oqıwshı | `5-fly-high-english` | pdftotext ✅ | `5-klass-fly-high-grammatika.md` |
| 6 | 5 | Fly High Workbook | metodika | `5-fly-high-workbook-metodika` | pdftotext ✅ | oqıtıwshı |
| 7 | 6 | Teens’ English | oqıwshı | `6-teens-english` | pdftotext ✅ | `6-klass-teens-grammatika.md` |
| 8 | 6 | Teens’ English | oqıtıwshı | `6-teens-english-teachers` | pdftotext ✅ | metodika |
| 9 | 7 | Teens’ English | oqıtıwshı | `7-teens-english-teachers` | pdftotext ✅ | oqıwshı PDF joq · fraza `english-7-9.md` |
| 10 | 8 | Teens’ English 2020 | oqıwshı | `8-teens-english-2020` | pdftotext ✅ | `english-7-9.md` |
| 11 | 9 | Fly High English | oqıtıwshı | `9-fly-high-teachers` | pdftotext ✅ | oqıwshı PDF joq · fraza `english-7-9.md` |
| 12 | 10 | English | oqıwshı | `10-english` | pdftotext ✅ | `10-klass-english-grammar-guide.md` |
| 13 | 11 | English | oqıwshı | `11-english` | OCR eng ✅ | `english-10-11.md` |

## Jamlangan MD (sayt `/english`)

> Unit atları emes — **sóz / fraza / mashq**. Grammatika — ayrı tablar.

- `english-tolıq.md` — ne úyrenemiz + kúnlik reja
- `english-1-4-kids.md` — sálem, shańaraq, mektep, bazar
- `english-5-6.md` — ómir fraza + grammar qısqasha
- `english-7-9.md` — pikir, media, jumıs dialogı
- `english-10-11.md` — B1 fraza, Passive, conditionals
- `5-klass-fly-high-grammatika.md` — QQ grammatika
- `6-klass-teens-grammatika.md` — QQ grammatika
- `10-klass-english-grammar-guide.md` — Grammar Guide EN

## OCR

```bash
python3 fordata/english/scripts/ocr_pdf_eng.py fordata/english/pdfs/<slug>.pdf <slug> --dpi 180 --jobs 8
```

Lang: `eng` · tessdata: `fordata/grammar/tessdata/`.

## Prioritet

1. ~~Registry + PDF nusxa~~ ✅  
2. ~~5 / 6 / 10 grammar MD~~ ✅  
3. ~~Sayt `/english`~~ ✅  
4. ~~2–4 OCR + unit tolıqlaw~~ ✅  
5. ~~11 OCR + unitlar~~ ✅  
6. 7 / 9 oqıwshı PDF tapılsa — qosıw  

## Nege ońayraq?

Ingliz tili sabaqlıqlarında kóplegen kitaplardıń **sońında grammatika QQ tilinde** berilgen (5–6).  
Sonlıqtan qoida+úlgi jamlaw QQ ana tili OCR-inen jeńilirek — matnlı PDF da `pdftotext` jetedi.
