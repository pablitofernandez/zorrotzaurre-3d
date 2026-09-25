// Publishes dist/ to the gh-pages branch (served by GitHub Pages).
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();

if (!existsSync('dist/index.html')) throw new Error('dist/index.html not found: run the build first');
writeFileSync('dist/.nojekyll', '');
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run('git commit -q -m "Deploy"', 'dist');
run(`git push -f ${remote} gh-pages`, 'dist');
