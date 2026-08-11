def resolve_vehicle_image_key(model: str, brand: str = "", category: str = "") -> str:
    m = (model or "").lower().strip()
    if "swift" in m:
        return "swift"
    elif "dzire" in m:
        return "dzire"
    elif "amaze" in m:
        return "amaze"
    elif "verna" in m:
        return "verna"
    elif "creta" in m:
        return "creta"
    elif "seltos" in m:
        return "seltos"
    elif "xuv700" in m or "xuv" in m:
        return "xuv700"
    elif "ertiga" in m:
        return "ertiga"
    elif "innova" in m or "crysta" in m:
        return "innova-crysta"
    elif "carens" in m:
        return "carens"
    elif "camry" in m:
        return "camry"
    elif "mercedes" in m or "e-class" in m:
        return "mercedes-e-class"
    elif "nexon" in m:
        return "nexon-ev"
    elif "activa" in m:
        return "activa"
    elif "i10" in m or "grand" in m:
        return "grand-i10"

    cat = (category or "").lower()
    if "suv" in cat:
        return "creta"
    elif "mpv" in cat or "xl" in cat:
        return "innova-crysta"
    elif "sedan" in cat:
        return "dzire"
    elif "luxury" in cat:
        return "mercedes-e-class"
    elif "ev" in cat:
        return "nexon-ev"
    elif "bike" in cat or "scooter" in cat:
        return "activa"
    return "swift"


def get_vehicle_image_url(image_key: str) -> str:
    return f"/assets/vehicles/{image_key}.webp"
