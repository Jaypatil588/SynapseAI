import { execSync } from 'child_process';

const projectPath = '/vercel/share/v0-project';

try {
  process.chdir(projectPath);
  
  // Configure git
  execSync('git config user.name "v0[bot]"', { stdio: 'inherit' });
  execSync('git config user.email "v0[bot]@users.noreply.github.com"', { stdio: 'inherit' });
  
  // Stage all changes
  execSync('git add -A', { stdio: 'inherit' });
  
  // Commit with descriptive message
  const commitMessage = `feat: Implement NovaMind-style UI redesign

- Complete visual overhaul matching premium dark theme design
- New Dashboard component with welcome view, chat input, and feature cards
- New TopNav component with navigation links, notification bell, and user avatar
- Redesigned HistorySidebar with logo, New Chat button, Features section, and Upgrade card
- Updated color palette with deep black background and amber accents
- Implemented glass-morphism design with radial gradient glows
- Updated App.tsx layout to integrate all new components`;
  
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  
  // Push to current branch
  execSync('git push origin dashboard-ui-design', { stdio: 'inherit' });
  
  console.log('✓ Changes pushed successfully to dashboard-ui-design branch');
} catch (error) {
  console.error('Error during git push:', error.message);
  process.exit(1);
}
