#!/bin/sh
# Builds the app and publishes it to the gh-pages branch (GitHub Pages).
# The API URL comes from backend/deployment.json, written by backend:deploy.
set -e
cd "$(dirname "$0")"
ID=$(node -e "console.log(require('./backend/deployment.json').deploymentId)")
export VITE_API_URL="https://script.google.com/macros/s/$ID/exec"
npm test
npm run build
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(git -C .. rev-parse --short HEAD)"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Published to GitHub Pages (live in about a minute)."
