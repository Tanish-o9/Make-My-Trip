import os
import re

SECRETS_PATTERN = re.compile(
    r"(secret_key|api_key|jwt_secret|database_url|razorpay_secret|stripe_secret|resend_api_key)\s*=\s*['\"][a-zA-Z0-9_/+=]{16,}['\"]",
    re.IGNORECASE
)

EXCLUDED_DIRS = {".git", "node_modules", "dist", ".venv", "venv", "env", "chromadb_data", ".gemini", "brain"}

def scan_for_secrets():
    print("=======================================================")
    print("TRAVEL OS - SECURITY HARDENING SECRET SCANNER")
    print("=======================================================")
    
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    print(f"Scanning workspace root: {workspace_root}")
    
    findings = []
    
    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".")]
        
        for file in files:
            if file.endswith((".py", ".ts", ".tsx", ".js", ".json", ".yml", ".yaml")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        for line_num, line in enumerate(f, 1):
                            if SECRETS_PATTERN.search(line):
                                findings.append(f"{os.path.relpath(filepath, workspace_root)}:L{line_num}")
                except Exception:
                    pass

    print(f"Scan complete. Found {len(findings)} potential hardcoded secrets.")
    if findings:
        print("\nFindings:")
        for idx, f in enumerate(findings, 1):
            print(f"  {idx}. {f}")
    else:
        print("🟢 No hardcoded secrets found in tracked source files.")
    print("=======================================================")

if __name__ == "__main__":
    scan_for_secrets()
