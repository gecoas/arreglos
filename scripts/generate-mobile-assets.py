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


og = Image.new("RGB", (1200, 630), "#fbf8f5")
draw = ImageDraw.Draw(og)
source_logo = Image.open(PUBLIC / "coas-logo.png").convert("RGB")
background = (252, 247, 243)
mark = Image.new("RGBA", source_logo.size, (0, 0, 0, 0))
source_pixels = source_logo.load()
pixels = mark.load()
for y in range(source_logo.height):
    for x in range(source_logo.width):
        red, green, blue = source_pixels[x, y]
        distance = max(abs(red - background[0]), abs(green - background[1]), abs(blue - background[2]))
        alpha = max(0, min(255, (distance - 7) * 10))
        pixels[x, y] = (red, green, blue, alpha)
mark = mark.resize((430, 430), Image.Resampling.LANCZOS)
og.paste(mark, (42, 100), mark)
draw = ImageDraw.Draw(og)
draw.rounded_rectangle((500, 104, 508, 526), radius=4, fill="#d3a12d")
draw.text((562, 125), "COLEGIOS COAS", font=font(22, bold=True), fill="#a77b18")
draw.text((558, 195), "Arreglos", font=font(76, bold=True), fill="#252221")
draw.text((562, 285), "del colegio", font=font(59, bold=True), fill=GREEN)
draw.text((564, 385), "Solicitud y seguimiento de", font=font(29), fill="#5c5753")
draw.text((564, 430), "reparaciones del centro", font=font(29), fill="#5c5753")
draw.rounded_rectangle((564, 507, 1100, 553), radius=20, fill="#f1e9df")
draw.text((586, 518), "GESTIÓN PARA LA COMUNIDAD EDUCATIVA", font=font(14, bold=True), fill="#6c514a")
og.save(PUBLIC / "og-image-coas.png", "PNG", optimize=True)
