import re

admin_src_path = "c:/Users/tanis/OneDrive/Desktop/Make My Trip/admin-console/src/App.tsx"
admin_dest_path = "c:/Users/tanis/OneDrive/Desktop/Make My Trip/frontend/src/AdminConsole.tsx"

with open(admin_src_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace imports and config resolvers at the top
top_repl = """import React, { useState, useEffect, useRef } from 'react'
import {
  Shield, Check, X, AlertTriangle, Clock, RefreshCw, LogOut, Search,
  Bell, BookOpen, CreditCard, Layers, Users, BarChart2,
  FileText, Trash2, Plus, DollarSign
} from 'lucide-react'
import { API_BASE, API_URL } from './config/api'

const WS_BASE = API_BASE.replace(/^http/, "ws")
"""

# Find the end of resolvePortalBase / PORTAL_BASE definitions and replace everything from top
pattern = r"import.*?const WS_BASE =.*?\n"
# Let's match from first line to "const WS_BASE = ..."
content_without_header = re.sub(r"^.*?const WS_BASE =.*?\n", "", content, flags=re.DOTALL)
content_new = top_repl + content_without_header

# 2. Refactor default App export to AdminConsole with props
old_app_declaration = """export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
  const [adminRole, setAdminRole] = useState<Role | null>(localStorage.getItem('admin_role') as Role)
  const [adminEmail, setAdminEmail] = useState<string | null>(localStorage.getItem('admin_email'))"""

new_app_declaration = """export default function AdminConsole({ token, adminRole, adminEmail, onLogout }: { token: string; adminRole: string; adminEmail: string; onLogout: () => void }) {"""

# Replace App function definition and its token state hooks
content_new = content_new.replace("export default function App() {", "export default function AdminConsole({ token, adminRole, adminEmail, onLogout }: { token: string; adminRole: string; adminEmail: string; onLogout: () => void }) {")
# Strip the local state hook lines for token, adminRole, adminEmail
content_new = re.sub(r"\s*const\s*\[token,\s*setToken\].*?\n", "\n", content_new)
content_new = re.sub(r"\s*const\s*\[adminRole,\s*setAdminRole\].*?\n", "\n", content_new)
content_new = re.sub(r"\s*const\s*\[adminEmail,\s*setAdminEmail\].*?\n", "\n", content_new)

# 3. Strip redundant route guards & token persistence effects inside AdminConsole
# We want to remove the useEffect for exchangeCode, allowed_roles check, token save, adminRole save, adminEmail save.
# Let's find those blocks and replace them.
# The exchange code useEffect:
content_new = re.sub(r"// 1\. Absorb session from query parameters.*?useEffect\(\(\) => \{.*?\}, \[\]\);", "", content_new, flags=re.DOTALL)
# Route Guard useEffect:
content_new = re.sub(r"// 2\. Route Guard for non-admin roles.*?useEffect\(\(\) => \{.*?\}, \[token, adminRole\]\);", "", content_new, flags=re.DOTALL)
# Token/Role/Email persistence hooks:
content_new = re.sub(r"useEffect\(\(\) => \{.*?admin_token.*?\}, \[token\]\);?", "", content_new, flags=re.DOTALL)
content_new = re.sub(r"useEffect\(\(\) => \{.*?admin_role.*?\}, \[adminRole\]\);?", "", content_new, flags=re.DOTALL)
content_new = re.sub(r"useEffect\(\(\) => \{.*?admin_email.*?\}, \[adminEmail\]\);?", "", content_new, flags=re.DOTALL)

# 4. Modify 'View Site ➔' button click handler
view_site_pattern = r"""onClick=\{async \(\) => \{.*?window\.location\.href = `\$\{PORTAL_BASE\}/`;.*?\}\}"""
new_view_site = """onClick={() => { window.location.href = "/"; }}"""
content_new = re.sub(r"onClick=\{async \(\) => \{.*?window\.location\.href = `\$\{PORTAL_BASE\}/`;.*?\}\}", new_view_site, content_new, flags=re.DOTALL)

# Also remove the handleLogin declaration and LoginScreen check, since it's redundant
content_new = re.sub(r"// Login handler.*?const handleLogin = async.*?if \(!token\) \{.*?return.*?\}\n\n", "", content_new, flags=re.DOTALL)

with open(admin_dest_path, "w", encoding="utf-8") as f:
    f.write(content_new)

print("Migration completed successfully!")
