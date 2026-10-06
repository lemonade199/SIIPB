"""Development entrypoint for SIIPB Backend API."""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n=======================================================")
    print(f"🚀 SIIPB Backend API running at http://localhost:{port}/api")
    print(f"📡 Health check: http://localhost:{port}/api/health")
    print(f"📦 Assets list : http://localhost:{port}/api/assets")
    print(f"=======================================================\n")
    app.run(host=host, port=port, debug=True)
