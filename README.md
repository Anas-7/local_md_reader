# MD Reader

A lightweight, sleek markdown editor and reader built with React and Vite.

![MD Reader](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-purple)

## Features

- **Multi-tab interface** - Open and edit multiple markdown files simultaneously
- **Split view** - Edit and preview side-by-side with resizable panes
- **Folder browsing** - Open entire folders and navigate nested directory structures
- **Standalone files** - Open individual files from anywhere on your system
- **Auto-save** - Changes are automatically saved after 2 seconds of inactivity
- **Draft recovery** - Unsaved changes are backed up to localStorage for crash protection
- **Formatting toolbar** - Quick access to common markdown formatting (headers, bold, italic, lists, code blocks, etc.)
- **Relative image support** - Images with relative paths (including `../`) are resolved and displayed correctly
- **Internal link navigation** - Clicking `.md` links opens them as new tabs in the app
- **External links** - HTTP/HTTPS links open in new browser tabs
- **GitHub Flavored Markdown** - Full GFM support including tables, task lists, and strikethrough
- **Raw HTML rendering** - HTML embedded in markdown is rendered properly

## Getting Started

### Prerequisites

- Node.js 18+
- A modern browser with [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) support (Chrome, Edge, or Opera)

### Installation

```bash
# Clone or navigate to the project
cd md_reader

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000` (or the next available port).

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

### Opening Files

- **Open Folder**: Click "Folder" button or use the welcome screen to browse a directory. All `.md` files will be indexed.
- **Open File**: Click "File" button to open individual markdown files from anywhere.

> **Tip**: Press `Cmd+Shift+.` in the file picker to show hidden folders (like `.claude`).

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` / `Ctrl+S` | Save current file |
| `Option+W` / `Alt+W` | Close current tab |

### View Modes

Toggle between three view modes using the buttons in the top-right:

- **Edit only** - Full-width editor
- **Split view** - Side-by-side editor and preview (drag the divider to resize)
- **Preview only** - Full-width rendered preview

The split ratio is remembered when switching between modes.

### Formatting Toolbar

When in edit or split mode, use the toolbar to insert:

- Headers (H1, H2, H3)
- Bold, italic, inline code
- Bullet and numbered lists
- Blockquotes
- Links and images
- Horizontal rules
- Code blocks

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **react-markdown** - Markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support
- **rehype-raw** - Raw HTML in markdown
- **lucide-react** - Icons
- **File System Access API** - Native file system integration

## Browser Support

This app requires the File System Access API, which is currently supported in:

- Chrome 86+
- Edge 86+
- Opera 72+

Firefox and Safari do not yet support this API.

## Project Structure

```
md_reader/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx        # Entry point
    ├── App.jsx         # Main application component
    └── App.css         # Styles
```

## License

MIT
