#!/bin/bash
cd /vercel/share/v0-project
git config user.name "v0[bot]"
git config user.email "v0[bot]@users.noreply.github.com"
git add -A
git commit -m "feat: Implement NovaMind-style UI redesign

- Complete visual overhaul matching premium dark theme design
- New Dashboard component with welcome view, chat input, and feature cards
- New TopNav component with navigation links, notification bell, and user avatar
- Redesigned HistorySidebar with logo, New Chat button, Features section, and Upgrade card
- Updated color palette with deep black background and amber accents
- Implemented glass-morphism design with radial gradient glows
- Updated App.tsx layout to integrate all new components"
git push origin dashboard-ui-design
