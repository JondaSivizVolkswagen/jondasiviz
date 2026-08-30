"""
Genera el icono de la aplicacion de escritorio en todos los tamaños que pide
Tauri, a partir de la misma marca que lleva la barra superior de la web: la
cuña roja inclinada, con dos estelas detras.

Se dibuja a 1024 y se reduce con Lanczos, que es lo que hace que a 32 px se
siga leyendo. Nada de reescalar un PNG pequeño hacia arriba.

    python3 herramientas/generar-iconos.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
ICONOS = RAIZ / "src-tauri" / "icons"
PUBLICO = RAIZ / "public"

LIENZO = 1024
ESCALA = 4  # se dibuja a 4x y se baja, para que los bordes inclinados no dentelleen

FONDO_ARRIBA = (20, 23, 27)
FONDO_ABAJO = (8, 9, 11)
ROJO = (227, 18, 28)
CLARO = (238, 240, 243)


def cuna(dib, cx, ancho, alto, color, sesgo=0.32):
    """Paralelogramo vertical inclinado, centrado en cy del lienzo."""
    cy = LIENZO * ESCALA / 2
    dx = alto * sesgo / 2
    dib.polygon(
        [
            (cx - ancho / 2 + dx, cy - alto / 2),
            (cx + ancho / 2 + dx, cy - alto / 2),
            (cx + ancho / 2 - dx, cy + alto / 2),
            (cx - ancho / 2 - dx, cy + alto / 2),
        ],
        fill=color,
    )


def marca():
    lado = LIENZO * ESCALA
    base = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))

    # Fondo: cuadrado redondeado con un degradado muy corto, de arriba a abajo.
    degradado = Image.new("RGBA", (1, lado))
    pix = degradado.load()
    for y in range(lado):
        t = y / (lado - 1)
        pix[0, y] = (
            round(FONDO_ARRIBA[0] + (FONDO_ABAJO[0] - FONDO_ARRIBA[0]) * t),
            round(FONDO_ARRIBA[1] + (FONDO_ABAJO[1] - FONDO_ARRIBA[1]) * t),
            round(FONDO_ARRIBA[2] + (FONDO_ABAJO[2] - FONDO_ARRIBA[2]) * t),
            255,
        )
    degradado = degradado.resize((lado, lado))

    mascara = Image.new("L", (lado, lado), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [0, 0, lado - 1, lado - 1], radius=int(lado * 0.205), fill=255
    )
    base.paste(degradado, (0, 0), mascara)

    # Halo rojo detras de la cuña. Es lo que le da profundidad al icono grande
    # y a 32 px se convierte en un tinte, que tampoco molesta.
    halo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(halo)
    cuna(d, lado * 0.60, lado * 0.30, lado * 0.62, ROJO + (150,))
    halo = halo.filter(ImageFilter.GaussianBlur(lado * 0.055))
    base.alpha_composite(halo)

    # Las tres cuñas: la roja delante y dos estelas claras detras.
    capa = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    cuna(d, lado * 0.325, lado * 0.042, lado * 0.40, CLARO + (90,))
    cuna(d, lado * 0.425, lado * 0.072, lado * 0.50, CLARO + (190,))
    cuna(d, lado * 0.605, lado * 0.175, lado * 0.585, ROJO + (255,))
    base.alpha_composite(capa)

    # Filo interior: una hairline, la misma que separa los paneles en la web.
    borde = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    inset = int(lado * 0.022)
    ImageDraw.Draw(borde).rounded_rectangle(
        [inset, inset, lado - 1 - inset, lado - 1 - inset],
        radius=int(lado * 0.185),
        outline=(255, 255, 255, 26),
        width=max(2, int(lado * 0.004)),
    )
    base.alpha_composite(borde)

    # Recorte final, para que el antialias del borde no arrastre fondo.
    salida = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    salida.paste(base, (0, 0), mascara)
    return salida.resize((LIENZO, LIENZO), Image.LANCZOS)


PNGS = {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}


def main():
    ICONOS.mkdir(parents=True, exist_ok=True)
    original = marca()

    for nombre, medida in PNGS.items():
        original.resize((medida, medida), Image.LANCZOS).save(ICONOS / nombre)

    # Icono de pantalla de inicio en iOS, que no entiende SVG.
    original.resize((180, 180), Image.LANCZOS).save(PUBLICO / "logo-180.png")

    original.resize((256, 256), Image.LANCZOS).save(
        ICONOS / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # ICNS lo escribimos a mano: es una cabecera y bloques PNG con su codigo de
    # tamaño. Pillow no siempre puede guardarlo fuera de macOS.
    import io
    import struct

    tipos = [(b"ic07", 128), (b"ic08", 256), (b"ic09", 512), (b"ic11", 32), (b"ic12", 64), (b"ic13", 256), (b"ic14", 512)]
    bloques = b""
    for codigo, medida in tipos:
        buf = io.BytesIO()
        original.resize((medida, medida), Image.LANCZOS).save(buf, format="PNG")
        datos = buf.getvalue()
        bloques += codigo + struct.pack(">I", len(datos) + 8) + datos
    (ICONOS / "icon.icns").write_bytes(b"icns" + struct.pack(">I", len(bloques) + 8) + bloques)

    print(f"{len(PNGS)} PNG + icon.ico + icon.icns en {ICONOS}")
    print(f"logo-180.png en {PUBLICO}")


if __name__ == "__main__":
    main()
