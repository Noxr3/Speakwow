import sys
from pathlib import Path

# The agent runs as `uv run src/agent.py`, so its modules import each other
# as top-level names; tests do the same.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
