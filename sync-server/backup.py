"""Consistent SQLite backup for Pink Live. Python standard library only."""
import datetime, os, sqlite3
from pathlib import Path

DB=Path(os.environ.get("PINK_LIVE_DB",r"D:\PinkLive\pink_live.sqlite3"))
BACKUPS=DB.parent/"backups"
KEEP=30

def main():
    if not DB.is_file():
        raise SystemExit(f"Database not found: {DB}. Nothing to back up.")
    BACKUPS.mkdir(parents=True,exist_ok=True)
    stamp=datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    dest=BACKUPS/f"pink_live_{stamp}.sqlite3"
    with sqlite3.connect(str(DB)) as src, sqlite3.connect(str(dest)) as dst:
        src.backup(dst)
    with sqlite3.connect(str(dest)) as verify:
        result=verify.execute("PRAGMA integrity_check").fetchone()[0]
    if result!="ok":
        dest.unlink(missing_ok=True)
        raise SystemExit(f"Backup integrity check failed: {result}")
    print(f"Verified backup: {dest}")
    backups=sorted(BACKUPS.glob("pink_live_*.sqlite3"),reverse=True)
    for old in backups[KEEP:]:
        old.unlink()
if __name__=="__main__":
    main()
