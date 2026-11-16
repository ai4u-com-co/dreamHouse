#!/usr/bin/env python3
"""Pasa los PNG generados por generar.mjs a miniaturas webp (640x427) en public/vistas-ejemplos.

Uso: python3 scripts/vistas-ejemplos/convertir.py <carpeta-salida>/raw public/vistas-ejemplos
"""
import sys
from pathlib import Path

from PIL import Image

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for png in sorted(src.glob("*.png")):
    im = Image.open(png).convert("RGB")
    im = im.resize((640, 427), Image.LANCZOS)
    out = dst / f"{png.stem}.webp"
    im.save(out, "WEBP", quality=78, method=6)
    print(f"{out} {out.stat().st_size // 1024} KB")
