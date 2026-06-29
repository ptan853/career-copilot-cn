"""Message delivery interface — dev console sender, with future SMS/email provider plugs."""


def mask_destination(channel: str, destination: str) -> str:
    if channel == "phone" and len(destination) >= 8:
        return f"{destination[:3]}****{destination[-4:]}"
    if channel == "email" and "@" in destination:
        name, domain = destination.split("@", 1)
        prefix = name[:2] if len(name) > 2 else name[:1]
        return f"{prefix}***@{domain}"
    return "***"


def send_verification_code(channel: str, destination: str, code: str) -> None:
    # Development sender. Production providers should be added behind this function.
    print(f"[auth-code] channel={channel} destination={destination} code={code}")
