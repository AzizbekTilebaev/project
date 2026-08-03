# Apertium-kaa morfologiya — WSL o‘rnatish (Windows)

Bu qadam **Administrator** PowerShell’da bajariladi.
O‘rnatishdan keyin kompyuter **qayta yuklanishi** mumkin.

## 1-qadam — Administrator PowerShell oching

1. Start menyuda `PowerShell` yozing
2. **Windows PowerShell** ustiga o‘ng tugma → **Run as administrator**
3. Quyidagi buyruqni ishga tushiring:

```powershell
wsl --install -d Ubuntu
```

Agar `wsl` topilmasa:

```powershell
# Virtual Machine Platform + WSL feature
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
# Keyin kompyuterni qayta yuklang, so‘ng:
wsl --install -d Ubuntu
```

## 2-qadam — Qayta yuklash + Ubuntu

1. Kompyuter qayta yuklansa — kuting
2. Ubuntu ochilganda **username** va **password** so‘raydi (password yozilganda ko‘rinmaydi — normal)
3. Tayyor bo‘lgach, Windows PowerShell’da (oddiy, admin emas) tekshiring:

```powershell
wsl -l -v
wsl -e bash -lc "uname -a && lsb_release -a"
```

`Ubuntu` Running ko‘rinsa — tayyor.

## 3-qadam — Loyihadagi skriptlarni ishga tushirish

Windows PowerShell’da (loyihaning `backend` papkasidan):

```powershell
cd "c:\Users\aziz\Desktop\projects 2\proyekt2\backend"
wsl -e bash scripts/apertium/00-install-deps.sh
wsl -e bash scripts/apertium/01-build-kaa.sh
node scripts/export-dict-for-apertium.mjs
wsl -e bash scripts/apertium/02-analyze-dict.sh
node scripts/import-apertium-morph.mjs
```

Natija:
- `kaa.automorf.hfst` — WSL’da qoladi (qayta ishlatiladi)
- `title_morphology` jadvali — MySQL’da (ilova apertiumsiz o‘qiydi)

## Muammolar

| Xato | Yechim |
|------|--------|
| «WSL o‘rnatilmagan» | 1-qadamni **Admin** PowerShell’da qayta |
| Virtualization disabled | BIOS’da VT-x / AMD-V yoqing |
| Ubuntu ochilmaydi | `wsl --update` keyin `wsl --set-default-version 2` |
| `hfst-lexc: command not found` | `00-install-deps.sh` ni qayta ishga tushiring |
