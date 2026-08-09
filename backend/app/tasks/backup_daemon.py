import os
import json
import zipfile
import logging
import datetime
from typing import Dict, Any
from sqlalchemy import text
from app.database import SessionLocal

logger = logging.getLogger(__name__)

BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

def backup_database() -> str:
    """
    Dumps critical database tables to a single structured JSON file.
    Does not require external pg_dump binaries, making it highly portable.
    """
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"db_backup_{timestamp}.json")
    
    db = SessionLocal()
    tables = [
        "users", "user_profiles", "travel_preferences", "saved_travelers",
        "flight_bookings", "hotel_bookings", "cab_bookings", "train_bookings",
        "bus_bookings", "holiday_package_bookings", "villa_bookings",
        "wallet_accounts", "wallet_transactions", "loyalty_accounts",
        "loyalty_transactions", "user_preference_embeddings",
        "agent_execution_logs", "llm_router_decision_logs", "payment_attempts"
    ]
    
    # BUG-007 FIX: Avoid leaking DB credentials — show only the database name
    try:
        db_url = str(db.bind.url)
        safe_url = db_url.split("@")[-1] if "@" in db_url else "<configured>"
    except Exception:
        safe_url = "<configured>"

    backup_data = {
        "timestamp": timestamp,
        "database": safe_url,
        "tables": {}
    }
    
    # BUG-006 FIX: Validate table name against whitelist before interpolating into SQL
    ALLOWED_TABLES = set(tables)
    try:
        for table in tables:
            if table not in ALLOWED_TABLES or not table.replace("_", "").isalnum():
                logger.warning(f"Skipping table '{table}': not in allowed whitelist.")
                continue
            try:
                # Query table rows dynamically — table name validated against whitelist above
                result = db.execute(text(f"SELECT * FROM {table}"))
                cols = list(result.keys())
                rows = [dict(zip(cols, row)) for row in result.fetchall()]
                
                # Convert dates/decimals to strings for JSON
                for r in rows:
                    for k, v in r.items():
                        if isinstance(v, (datetime.datetime, datetime.date)):
                            r[k] = v.isoformat()
                        elif hasattr(v, "__str__") and type(v).__name__ == "Decimal":
                            r[k] = str(v)
                            
                backup_data["tables"][table] = rows
                logger.info(f"Backed up table '{table}': {len(rows)} rows.")
            except Exception as table_err:
                logger.warning(f"Skipping table '{table}' during backup: {table_err}")
                
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2, default=str)
            
        logger.info(f"Database backup completed successfully: {backup_file}")
        return backup_file
    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        raise e
    finally:
        db.close()


def backup_documents() -> str:
    """
    Creates a zip archive of all tickets, invoices, and QR codes.
    """
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = os.path.join(BACKUP_DIR, f"docs_backup_{timestamp}.zip")
    
    directories_to_backup = {
        "tickets": "static/tickets",
        "qrcodes": "static/qrcodes"
    }
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
            for name, path in directories_to_backup.items():
                if os.path.exists(path):
                    for root, _, files in os.walk(path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, os.path.dirname(path))
                            zipf.write(file_path, arcname)
                            
        logger.info(f"Document/PDF backup completed successfully: {zip_filename}")
        return zip_filename
    except Exception as e:
        logger.error(f"Failed to create document backup: {e}")
        raise e


def purge_old_backups(retention_days: int = 7):
    """
    Cleans up backups older than retention_days.
    """
    now = time.time()
    cutoff = now - (retention_days * 86400)
    
    try:
        count = 0
        for f in os.listdir(BACKUP_DIR):
            file_path = os.path.join(BACKUP_DIR, f)
            if os.path.isfile(file_path):
                mtime = os.path.getmtime(file_path)
                if mtime < cutoff:
                    os.remove(file_path)
                    count += 1
        logger.info(f"Purged {count} old backup files older than {retention_days} days.")
    except Exception as e:
        logger.error(f"Error purging old backups: {e}")


def run_full_backup() -> Dict[str, Any]:
    logger.info("Starting scheduled full backup job...")
    db_file = None
    docs_file = None
    
    try:
        db_file = backup_database()
        docs_file = backup_documents()
        purge_old_backups(retention_days=7)
        return {
            "success": True,
            "db_backup": db_file,
            "docs_backup": docs_file,
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Full backup job failed: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import time
    logging.basicConfig(level=logging.INFO)
    run_full_backup()
