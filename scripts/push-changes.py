#!/usr/bin/env python3
import subprocess
import os

os.chdir('/vercel/share/v0-project')

try:
    # Configure git
    subprocess.run(['git', 'config', 'user.name', 'v0[bot]'], check=True)
    subprocess.run(['git', 'config', 'user.email', 'v0[bot]@users.noreply.github.com'], check=True)
    
    # Stage all changes
    subprocess.run(['git', 'add', '-A'], check=True)
    
    # Commit with descriptive message
    commit_message = """feat: Implement NovaMind-style UI redesign

- Complete visual overhaul matching premium dark theme design
- New Dashboard component with welcome view, chat input, and feature cards
- New TopNav component with navigation links, notification bell, and user avatar
- Redesigned HistorySidebar with logo, New Chat button, Features section, and Upgrade card
- Updated color palette with deep black background and amber accents
- Implemented glass-morphism design with radial gradient glows
- Updated App.tsx layout to integrate all new components"""
    
    subprocess.run(['git', 'commit', '-m', commit_message], check=True)
    
    # Push to current branch
    subprocess.run(['git', 'push', 'origin', 'dashboard-ui-design'], check=True)
    
    print('✓ Changes pushed successfully to dashboard-ui-design branch')
    
except subprocess.CalledProcessError as e:
    print(f'Error during git push: {e}')
    exit(1)
