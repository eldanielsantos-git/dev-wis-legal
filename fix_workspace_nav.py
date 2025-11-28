#!/usr/bin/env python3
"""Script to add onNavigateToWorkspace to all pages."""
import re

FILES = [
    "src/pages/AdminForensicPromptsPage.tsx",
    "src/pages/AdminIntegrityPage.tsx",
    "src/pages/AdminQuotaManagementPage.tsx",
    "src/pages/AdminSettingsPage.tsx",
    "src/pages/AdminStripeDiagnosticPage.tsx",
    "src/pages/AdminSystemModelsPage.tsx",
    "src/pages/AdminTokenCreditsAuditPage.tsx",
    "src/pages/AdminUserDetailPage.tsx",
    "src/pages/AdminUserProcessesPage.tsx",
    "src/pages/AdminUsersPage.tsx",
    "src/pages/TokensPage.tsx",
    "src/pages/SubscriptionPage.tsx",
    "src/pages/NotificationsPage.tsx",
    "src/pages/ChatPage.tsx",
    "src/pages/ChatProcessSelectionPage.tsx",
    "src/pages/MyProcessDetailPage.tsx",
]

def fix_file(filepath):
    """Add onNavigateToWorkspace to a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changed = False

        # Step 1: Add to interface (after onNavigateToChat)
        pattern1 = r'(onNavigateToChat\?: \(\) => void;)(\n)'
        if re.search(pattern1, content) and 'onNavigateToWorkspace' not in content:
            content = re.sub(pattern1, r'\1\n  onNavigateToWorkspace?: () => void;\2', content, count=1)
            changed = True
            print(f"  ✓ Added to interface")

        # Step 2: Add to function params (find the destructuring in export function)
        # Look for patterns like: { onNavigateToApp, onNavigateToMyProcess, onNavigateToChat,
        pattern2 = r'(export function \w+\(\{\s*[^}]*onNavigateToChat,)'
        if re.search(pattern2, content, re.DOTALL):
            content = re.sub(pattern2, r'\1 onNavigateToWorkspace,', content, count=1, flags=re.DOTALL)
            changed = True
            print(f"  ✓ Added to function params")

        # Step 3: Add to all SidebarWis calls (after onNavigateToChat)
        pattern3 = r'(onNavigateToChat=\{onNavigateToChat\})(\n\s+)'
        matches = len(re.findall(pattern3, content))
        if matches > 0:
            content = re.sub(pattern3, r'\1\n          onNavigateToWorkspace={onNavigateToWorkspace}\2', content)
            changed = True
            print(f"  ✓ Added to {matches} SidebarWis component(s)")

        if changed:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        else:
            print(f"  - No changes needed")
            return False

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Process all files."""
    print("Adding onNavigateToWorkspace to pages...\n")

    success_count = 0
    for filepath in FILES:
        print(f"{filepath}:")
        if fix_file(filepath):
            success_count += 1
        print()

    print(f"\nCompleted: {success_count}/{len(FILES)} files updated")

if __name__ == "__main__":
    main()
