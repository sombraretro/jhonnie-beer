#!/usr/bin/env python3
"""Generate the Jhonnie Beer Windows icon from the official wordmark."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "Logo-Jhonnie-Beer.jpeg"
target = ROOT / "icon.ico"

logo = Image.open(source).convert("RGB")
# Crop empty black margins while retaining the complete gold wordmark.
gray = logo.convert("L")
mask = gray.point(lambda p: 255 if p > 18 else 0)
bbox = mask.getbbox()
if not bbox:
    raise SystemExit("A logo Jhonnie Beer não contém conteúdo visível.")
logo = logo.crop(bbox)

canvas = Image.new("RGBA", (256, 256), (23, 21, 19, 255))
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((5, 5, 250, 250), radius=34, outline=(174, 125, 54, 255), width=5)
# Preserve the original aspect ratio and center the wordmark in the icon.
logo.thumbnail((224, 142), Image.Resampling.LANCZOS)
canvas.alpha_composite(logo.convert("RGBA"), ((256-logo.width)//2, (256-logo.height)//2))
canvas.save(target, format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(f"Ícone gerado: {target}")
