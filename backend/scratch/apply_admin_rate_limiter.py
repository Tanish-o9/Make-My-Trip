import re

file_path = r"c:\Users\tanis\OneDrive\Desktop\Make My Trip\backend\app\routes\admin_panel.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
import_str = "\nfrom app.utils.rate_limiter import RateLimiter\nadmin_write_limiter = RateLimiter(max_requests=30, window_seconds=60, scope=\"admin_write\")\n"
if "admin_write_limiter" not in content:
    # Insert right after the router definition
    router_idx = content.find("router = APIRouter")
    newline_idx = content.find("\n", router_idx)
    content = content[:newline_idx+1] + import_str + content[newline_idx+1:]

# Match @router.post/put/delete/patch("path", ...)
# Group 1: post|put|delete|patch
# Group 2: the path string (e.g., "/claims/{claim_id}/resolve" or '/offers')
# Group 3: rest of the arguments (if any)
pattern = r"@router\.(post|put|delete|patch)\((['\"][^'\"]+['\"])([^)]*)\)"

def replacer(match):
    method = match.group(1)
    path = match.group(2)
    rest = match.group(3).strip()
    
    # If rest of args starts with comma, we strip it and format cleanly
    if rest.startswith(","):
        rest_args = rest[1:].strip()
        # Check if dependencies is already there
        if "dependencies=" in rest_args:
            dep_match = re.search(r"dependencies\s*=\s*\[([^\]]*)\]", rest_args)
            if dep_match:
                existing = dep_match.group(1).strip()
                new_deps = f"{existing}, Depends(admin_write_limiter)" if existing else "Depends(admin_write_limiter)"
                rest_args = rest_args.replace(dep_match.group(0), f"dependencies=[{new_deps}]")
            return f"@router.{method}({path}, {rest_args})"
        else:
            return f"@router.{method}({path}, dependencies=[Depends(admin_write_limiter)], {rest_args})"
    else:
        return f"@router.{method}({path}, dependencies=[Depends(admin_write_limiter)])"

new_content = re.sub(pattern, replacer, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully injected admin rate limiter on write routes (correct syntax)!")
