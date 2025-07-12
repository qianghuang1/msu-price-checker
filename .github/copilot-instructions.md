<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Maple Inspector Chrome Extension

This is a Chrome extension project for MapleStory item search and pricing using the MSU Navigator API.

## Project Structure
- `manifest.json` - Chrome extension manifest file
- `background.js` - Service worker for API calls and context menu handling
- `content.js` - Content script for text selection
- `popup.html/popup.js` - Extension popup interface
- `icons/` - Extension icons

## API Integration
The extension integrates with MSU Navigator API endpoints:
- Search: `https://msu.io/navigator/api/navigator/search`
- Metadata: `https://msu.io/navigator/api/navigator/metadata/items/{id}/info`
- Pricing: `https://msu.io/navigator/api/navigator/msu-stats/dynamic-pricing/enhance-price/history`

## Features
- Right-click context menu search on selected text
- Item search and metadata display
- Starforce enhancement pricing
- Potential enhancement pricing with cube types
- Modern gradient UI design

## Development Notes
- Uses Manifest V3 for Chrome extensions
- Requires host permissions for msu.io domain
- Uses Chrome storage API for caching search results
- Implements async/await for API calls
