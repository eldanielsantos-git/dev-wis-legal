#!/usr/bin/env python3
import re
import sys

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Pattern 1: Add to interface
    interface_pattern = r'(interface \w+PageProps \{[^}]*onNavigateToChat\?: \(\) => void;)'
    if re.search(interface_pattern, content):
        content = re.sub(
            interface_pattern,
            r'\1\n  onNavigateToWorkspace?: () => void;',
            content
        )

    # Pattern 2: Add to function parameters (single line)
    func_pattern = r'(export function \w+\(\{[^}]*onNavigateToChat,)'
    if re.search(func_pattern, content):
        content = re.sub(
            func_pattern,
            r'\1 onNavigateToWorkspace,',
            content
        )

    # Pattern 3: Add to SidebarWis component calls
    sidebar_pattern = r'(<SidebarWis\s+[^>]*onNavigateToChat=\{onNavigateToChat\})'
    if re.search(sidebar_pattern, content, re.DOTALL):
        content = re.sub(
            sidebar_pattern,
            r'\1\n        onNavigateToWorkspace={onNavigateToWorkspace}',
            content,
            flags=re.DOTALL
        )

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

if __name__ == '__main__':
    files = [
        'src/pages/AdminForensicPromptsPage.tsx',
        'src/pages/AdminIntegrityPage.tsx',
        'src/pages/AdminQuotaManagementPage.tsx',
        'src/pages/AdminSettingsPage.tsx',
        'src/pages/AdminStripeDiagnosticPage.tsx',
        'src/pages/AdminSystemModelsPage.tsx',
        'src/pages/AdminTokenCreditsAuditPage.tsx',
        'src/pages/AdminUserDetailPage.tsx',
        'src/pages/AdminUserProcessesPage.tsx',
        'src/pages/AdminUsersPage.tsx',
        'src/pages/ProfilePage.tsx',
        'src/pages/TokensPage.tsx',
        'src/pages/SubscriptionPage.tsx',
        'src/pages/NotificationsPage.tsx',
        'src/pages/ChatPage.tsx',
        'src/pages/ChatProcessSelectionPage.tsx',
        'src/pages/MyProcessDetailPage.tsx',
    ]

    for filepath in files:
        try:
            if process_file(filepath):
                print(f'✓ Updated {filepath}')
            else:
                print(f'- Skipped {filepath} (no changes)')
        except Exception as e:
            print(f'✗ Error processing {filepath}: {e}')
