"""Development entrypoint for SIIPB Backend API."""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app

app = create_app()

def get_local_ip() -> str:
    """Detect primary LAN IPv4 address."""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    local_ip = get_local_ip()

    print(f"\n=======================================================")
    print(f"[SIIPB REST API v1 Server]")
    print(f"   * Localhost (Komputer ini) : http://localhost:{port}/api/v1")
    print(f"   * LAN IP (Device lain)     : http://{local_ip}:{port}/api/v1")
    print(f"   * Swagger Documentation    : http://{local_ip}:{port}/api/docs")
    print(f"   * Health Check             : http://{local_ip}:{port}/api/health")
    print(f"=======================================================\n")
    app.run(host=host, port=port, debug=True)
