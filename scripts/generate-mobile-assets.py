from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)
GREEN = "#811a1d"
GREEN_LIGHT = "#a13232"
INK = "#20302d"
MUTED = "#647570"
WHITE = "#ffffff"


def rounded_icon(size):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=GREEN)
    draw.ellipse((size * 0.08, size * 0.08, size * 0.92, size * 0.92), fill=GREEN_LIGHT)

    scale = size / 512
    def points(values):
        return [(int(x * scale), int(y * scale)) for x, y in values]

    # A simple white hammer mark, consistent with the app's existing logo.
    draw.polygon(points([(302, 86), (423, 86), (423, 155), (361, 155), (361, 188), (315, 188), (315, 155), (254, 155), (254, 119)]), fill=WHITE)
    draw.polygon(points([(305, 164), (348, 195), (196, 386), (151, 351)]), fill=WHITE)
    draw.ellipse((int(133 * scale), int(341 * scale), int(209 * scale), int(417 * scale)), fill=WHITE)
    return image


for output, size in (("icon-192.png", 192), ("icon-512.png", 512), ("icon-maskable-512.png", 512), ("apple-touch-icon.png", 180)):
    rounded_icon(size).convert("RGB").save(PUBLIC / output, "PNG", optimize=True)


def font(size, bold=False):
    base = Path("/usr/share/fonts/truetype/dejavu")
    filename = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(base / filename), size)


og = Image.new("RGB", (1200, 630), "#f4f7f5")
draw = ImageDraw.Draw(og)
draw.rounded_rectangle((44, 44, 516, 586), radius=42, fill=GREEN)
mark = rounded_icon(316)
og.paste(mark.convert("RGB"), (122, 155))
draw.text((584, 128), "Arreglos", font=font(70, bold=True), fill=INK)
draw.text((584, 218), "del colegio", font=font(58, bold=True), fill=GREEN)
draw.rounded_rectangle((586, 319, 714, 327), radius=4, fill="#c4d7d0")
draw.text((584, 361), "Solicita, asigna y sigue", font=font(30), fill=MUTED)
draw.text((584, 406), "las reparaciones del centro.", font=font(30), fill=MUTED)
draw.text((584, 520), "GESTIÓN ESCOLAR", font=font(18, bold=True), fill="#84938e")
og.save(PUBLIC / "og-image.png", "PNG", optimize=True)
