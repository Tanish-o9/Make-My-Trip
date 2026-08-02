import json
import logging
import time
from contextvars import ContextVar

# Context variables for tracing across async tasks and threads
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_ctx_var: ContextVar[str] = ContextVar("user_id", default="")

class JSONLogFormatter(logging.Formatter):
    """
    Structured JSON log formatter for Travel OS.
    Standardizes log formats across services to include request_id and user_id context.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "service_name": "travel_os",
            "request_id": request_id_ctx_var.get() or "system",
            "user_id": user_id_ctx_var.get() or "anonymous",
            "message": record.getMessage()
        }
        
        # Include exception information if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry)

def setup_structured_logging():
    """Configure the root logger to output structured JSON logs"""
    root_logger = logging.getLogger()
    
    # Avoid adding duplicate handlers if already configured
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        formatter = JSONLogFormatter()
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
    else:
        for handler in root_logger.handlers:
            handler.setFormatter(JSONLogFormatter())
