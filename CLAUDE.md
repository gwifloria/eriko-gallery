# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a photo gallery project called "floria-gallery" that focuses on automatic image optimization with pre-commit hooks. The project automatically converts images to AVIF format before commits, ensuring only optimized images are stored in version control.

## Project Structure

- `package.json` - Node.js project configuration with Sharp and Husky dependencies
- `scripts/optimize-images.js` - Automated image optimization script for pre-commit
- `opt-js` - Legacy manual image optimization script
- `origin/` - Contains source images (JPG/PNG files, excluded from Git)
- `images/` - Contains optimized AVIF files (committed to Git)
- `.husky/pre-commit` - Pre-commit hook that runs image optimization
- `.gitignore` - Excludes origin directory and other image formats

## Key Architecture

The project implements an automated image optimization workflow:

1. **Pre-commit Hook**: Husky automatically runs image optimization before each commit
2. **Image Processing**: `scripts/optimize-images.js` processes all images in `origin/` directory
3. **AVIF Conversion**: Uses Sharp library to convert JPG/PNG to AVIF format (quality: 65, effort: 6)
4. **Output Separation**: Converted AVIF files are saved to `images/` directory
5. **Git Integration**: Automatically stages converted AVIF files for commit
6. **Source Preservation**: Original images remain in `origin/` directory, excluded from version control

## Common Commands

- `npm install` - Install dependencies (Sharp, Husky)
- `npm run optimize` - Manually run image optimization
- `node scripts/optimize-images.js` - Direct script execution
- Commits automatically trigger image optimization via pre-commit hook

## Git Workflow

1. Add JPG/PNG images to `origin/` directory
2. Run `git add` and `git commit` as normal
3. Pre-commit hook automatically:
   - Converts images from `origin/` to AVIF format
   - Saves AVIF files to `images/` directory
   - Adds AVIF files to the commit
   - Original files in `origin/` remain local (excluded via .gitignore)
4. Only optimized AVIF files from `images/` directory are committed to the repository

## Development Notes

- Project uses ES modules (import/export syntax)
- Sharp library handles image processing with high-quality AVIF compression
- Pre-commit hook ensures no unoptimized images enter version control
- Original source files are preserved in `origin/` directory for editing
- Only AVIF format is used for version control (maximum compression)
- Clean separation: source files (`origin/`) vs. optimized files (`images/`)
- Husky manages Git hooks for consistent automation