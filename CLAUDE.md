# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a photo gallery project called "floria-gallery" that focuses on automatic image optimization with pre-commit hooks. The project automatically converts images to AVIF format before commits, ensuring only optimized images are stored in version control.

## Project Structure

- `package.json` - Node.js project configuration with Sharp and Husky dependencies
- `scripts/optimize-images.js` - Automated image optimization script for pre-commit
- `opt-js` - Legacy manual image optimization script
- `images/` - Contains source images (JPG/PNG files, excluded from Git)
- `.husky/pre-commit` - Pre-commit hook that runs image optimization
- `.gitignore` - Excludes original image formats, only AVIF files are committed

## Key Architecture

The project implements an automated image optimization workflow:

1. **Pre-commit Hook**: Husky automatically runs image optimization before each commit
2. **Image Processing**: `scripts/optimize-images.js` processes all images in `images/` directory
3. **AVIF Conversion**: Uses Sharp library to convert JPG/PNG to AVIF format (quality: 65, effort: 6)
4. **Git Integration**: Automatically stages converted AVIF files for commit
5. **Source Preservation**: Original images remain locally but are excluded from version control

## Common Commands

- `npm install` - Install dependencies (Sharp, Husky)
- `npm run optimize` - Manually run image optimization
- `node scripts/optimize-images.js` - Direct script execution
- Commits automatically trigger image optimization via pre-commit hook

## Git Workflow

1. Add JPG/PNG images to `images/` directory
2. Run `git add` and `git commit` as normal
3. Pre-commit hook automatically:
   - Converts new/modified images to AVIF
   - Adds AVIF files to the commit
   - Excludes original formats via .gitignore
4. Only optimized AVIF files are committed to the repository

## Development Notes

- Project uses ES modules (import/export syntax)
- Sharp library handles image processing with high-quality AVIF compression
- Pre-commit hook ensures no unoptimized images enter version control
- Original source files are preserved locally for editing
- Husky manages Git hooks for consistent automation