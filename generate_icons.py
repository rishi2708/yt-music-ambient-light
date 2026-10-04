import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def generate_icon(size):
    # Create canvas with supersampling for crisp edges
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer ambient light glow (radial gradient)
    center = s / 2
    max_radius = s * 0.46
    
    # Glow layers
    for r in range(int(max_radius), 0, -scale * 2):
        progress = r / max_radius
        # Vibrant ambient gradient: Red/Pink (#FF0055) to Violet (#7928CA) to Cyan (#00DFD8)
        red = int(255 * (1 - progress * 0.5))
        green = int(50 + 150 * math.sin(progress * math.pi))
        blue = int(120 + 135 * progress)
        alpha = int(220 * (1 - progress ** 1.5))
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            fill=(red, green, blue, alpha)
        )
    
    # 2. Inner dark glass disc
    disc_radius = s * 0.38
    disc_box = [center - disc_radius, center - disc_radius, center + disc_radius, center + disc_radius]
    draw.ellipse(disc_box, fill=(18, 18, 24, 240), outline=(255, 255, 255, 80), width=int(scale * 1.5))

    # 3. Ambient Light "AL" Monogram
    try:
        font = ImageFont.truetype("arialbd.ttf", int(s * 0.34))
    except Exception:
        font = ImageFont.load_default()

    text = "AL"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = center - text_w / 2 - bbox[0]
    text_y = center - text_h / 2 - bbox[1]

    # Shadow/Glow behind text
    draw.text((text_x + scale, text_y + scale), text, fill=(255, 40, 100, 160), font=font)
    # Bright main text
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    # Downsample with Lanczos for anti-aliasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

sizes = [16, 32, 48, 128]
for sz in sizes:
    icon = generate_icon(sz)
    icon.save(f"yt-music-ambient-light/icons/icon{sz}.png", "PNG")
    print(f"Generated icon{sz}.png")
