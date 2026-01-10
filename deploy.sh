#!/bin/bash
# Deploy MaxSam V4 to Vercel

echo "🚀 Deploying MaxSam V4..."

# Stage all changes
git add .

# Commit with timestamp
git commit -m "Deploy: buyer intake form, deal blast, scrapers - $(date '+%Y-%m-%d %H:%M')"

# Push to main (Vercel auto-deploys)
git push origin main

echo "✅ Pushed to GitHub. Vercel will auto-deploy."
echo "📊 Check deployment at: https://vercel.com/dashboard"
echo "🌐 Live at: https://maxsam-v4-clean.vercel.app"
