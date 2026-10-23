import math


def calc_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # Approx 111 km per latitude degree, 85 km per longitude degree around 18-20 deg N
    d_lat = (lat2 - lat1) * 111.0
    d_lng = (lng2 - lng1) * 85.0
    dist = math.sqrt(d_lat * d_lat + d_lng * d_lng)
    return round(dist, 2)


def estimate_travel_time(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    dist = calc_distance_km(lat1, lat2, lng1, lng2)
    # Average scooter speed in urban traffic ~20 km/h -> 3 mins per km + 3 mins buffer
    minutes = int(dist * 3.0) + 3
    return max(5, minutes)


def check_spoilage_safe(eta_minutes: float, safe_minutes_left: float):
    # Rule 1: Delivery must reach before safe shelf life expires
    if eta_minutes >= safe_minutes_left:
        return False, f"Cargo will spoil before delivery (ETA {eta_minutes:.0f}m >= safe {safe_minutes_left:.0f}m)"
    return True, ""


def check_capacity(rider_capacity: int, shelter_space: int, qty: int):
    # Rule 2: Quantity must fit rider's carrying capacity and shelter space
    if qty > rider_capacity:
        return False, f"Exceeds rider capacity ({qty} > {rider_capacity})"
    if qty > shelter_space:
        return False, f"Exceeds shelter free space ({qty} > {shelter_space})"
    return True, ""


def check_shelter_compatibility(shelter_row, item_type: str, item_kind: str):
    # Rule 3: Shelter must be open and have required utilities for item
    if not bool(shelter_row["is_open"]):
        return False, "Shelter is currently closed"
    if item_kind == "ration" or "Ration" in item_type:
        if not bool(shelter_row["has_cooking_fuel"]):
            return False, "Shelter lacks cooking fuel for raw rations"
        if not bool(shelter_row["has_clean_water"]):
            return False, "Shelter lacks clean water"
    if "Formula" in item_type and not bool(shelter_row["has_clean_water"]):
        return False, "Shelter lacks clean water for baby formula"
    return True, ""


def check_rider_eligibility(rider_row, min_trust: float = 0.70):
    # Rule 4: Rider must be active, idle and meet trust threshold
    if int(rider_row["is_killed"]) == 1:
        return False, "Rider is offline / inactive"
    if rider_row["status"] not in ("idle",):
        return False, f"Rider is busy ({rider_row['status']})"
    if float(rider_row["trust_score"]) < min_trust:
        return False, f"Rider trust score too low ({rider_row['trust_score']:.2f} < {min_trust:.2f})"
    return True, ""
