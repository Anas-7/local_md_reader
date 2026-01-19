import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  FolderOpen,
  FilePlus,
  ChevronRight,
  ChevronDown,
  X,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
  Minus,
  Eye,
  Edit3,
  FileText,
  Save
} from 'lucide-react'

// =============================================================================
// Constants
// =============================================================================

const AUTOSAVE_DELAY = 2000 // Auto-save after 2 seconds of inactivity

const FORMAT_ACTIONS = [
  { icon: Heading1, label: 'Heading 1', before: '# ', after: '\n' },
  { icon: Heading2, label: 'Heading 2', before: '## ', after: '\n' },
  { icon: Heading3, label: 'Heading 3', before: '### ', after: '\n' },
  { divider: true },
  { icon: Bold, label: 'Bold', before: '**', after: '**' },
  { icon: Italic, label: 'Italic', before: '_', after: '_' },
  { icon: Code, label: 'Inline Code', before: '`', after: '`' },
  { divider: true },
  { icon: List, label: 'Bullet List', before: '- ', after: '\n' },
  { icon: ListOrdered, label: 'Numbered List', before: '1. ', after: '\n' },
  { icon: Quote, label: 'Quote', before: '> ', after: '\n' },
  { divider: true },
  { icon: Link, label: 'Link', before: '[', after: '](url)' },
  { icon: Image, label: 'Image', before: '![alt](', after: ')' },
  { icon: Minus, label: 'Horizontal Rule', before: '\n---\n', after: '' },
  { divider: true },
  { icon: Code, label: 'Code Block', before: '\n```\n', after: '\n```\n' },
]

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Builds a nested file tree structure from flat file entries
 */
function buildFileTree(entries, basePath = '') {
  const tree = []
  const folders = {}

  for (const entry of entries) {
    const parts = entry.path.split('/')
    if (parts.length === 1) {
      tree.push({ ...entry, type: 'file' })
    } else {
      const folderName = parts[0]
      if (!folders[folderName]) {
        folders[folderName] = []
      }
      folders[folderName].push({
        ...entry,
        path: parts.slice(1).join('/'),
        fullPath: entry.fullPath || entry.path
      })
    }
  }

  for (const [name, children] of Object.entries(folders)) {
    tree.unshift({
      type: 'folder',
      name,
      path: basePath ? `${basePath}/${name}` : name,
      children: buildFileTree(children, basePath ? `${basePath}/${name}` : name)
    })
  }

  return tree.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1
    return (a.name || a.path).localeCompare(b.name || b.path)
  })
}

/**
 * Resolves a relative path against a base path (handles ../ and ./)
 */
function resolvePath(basePath, relativePath) {
  const baseParts = basePath.split('/').slice(0, -1) // Remove filename
  const relativeParts = relativePath.split('/')
  const resultParts = [...baseParts]

  for (const part of relativeParts) {
    if (part === '..') {
      resultParts.pop()
    } else if (part !== '.' && part !== '') {
      resultParts.push(part)
    }
  }

  return resultParts.join('/')
}

// =============================================================================
// Main App Component
// =============================================================================

function App() {
  // ---------------------------------------------------------------------------
  // State - Files & Tabs
  // ---------------------------------------------------------------------------
  const [files, setFiles] = useState([])
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [fileContents, setFileContents] = useState({})
  const [unsavedChanges, setUnsavedChanges] = useState(new Set())
  const [folderName, setFolderName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState(new Set())

  // ---------------------------------------------------------------------------
  // State - Editor UI
  // ---------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState('split') // 'edit', 'preview', 'split'
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const [imageCache, setImageCache] = useState({})

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const textareaRef = useRef(null)
  const editorPanelsRef = useRef(null)
  const savedSplitRatio = useRef(0.5)
  const rootDirHandle = useRef(null)
  const autoSaveTimer = useRef(null)

  // ---------------------------------------------------------------------------
  // File System Operations
  // ---------------------------------------------------------------------------

  const handleOpenFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker()
      const entries = []

      async function processDirectory(handle, path = '') {
        for await (const entry of handle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            entries.push({
              name: entry.name,
              path: entryPath,
              fullPath: entryPath,
              handle: entry
            })
          } else if (entry.kind === 'directory') {
            await processDirectory(entry, entryPath)
          }
        }
      }

      await processDirectory(dirHandle)
      setFiles(entries)
      setFolderName(dirHandle.name)
      setExpandedFolders(new Set())
      rootDirHandle.current = dirHandle
      setImageCache({})
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error opening folder:', err)
      }
    }
  }

  const handleOpenFile = async () => {
    try {
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Markdown files',
          accept: { 'text/markdown': ['.md'] }
        }]
      })

      for (const fileHandle of fileHandles) {
        const file = await fileHandle.getFile()
        const content = await file.text()
        const standalonePath = `[standalone]/${file.name}`

        if (!openTabs.find(t => t.path === standalonePath)) {
          const fileEntry = {
            name: file.name,
            path: standalonePath,
            fullPath: standalonePath,
            handle: fileHandle,
            isStandalone: true
          }
          setOpenTabs(prev => [...prev, fileEntry])
          setFileContents(prev => ({ ...prev, [standalonePath]: content }))
        }
        setActiveTab(standalonePath)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error opening file:', err)
      }
    }
  }

  const handleFileClick = async (file) => {
    if (!openTabs.find(t => t.path === file.fullPath)) {
      setOpenTabs([...openTabs, { ...file, path: file.fullPath }])
    }
    setActiveTab(file.fullPath)

    if (!fileContents[file.fullPath]) {
      try {
        const fileData = await file.handle.getFile()
        const content = await fileData.text()

        // Check for unsaved draft in localStorage
        const draft = localStorage.getItem(`md_draft_${file.fullPath}`)
        if (draft && draft !== content) {
          setFileContents(prev => ({ ...prev, [file.fullPath]: draft }))
          setUnsavedChanges(prev => new Set(prev).add(file.fullPath))
        } else {
          setFileContents(prev => ({ ...prev, [file.fullPath]: content }))
          if (draft) localStorage.removeItem(`md_draft_${file.fullPath}`)
        }
      } catch (err) {
        console.error('Error reading file:', err)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tab Management
  // ---------------------------------------------------------------------------

  const handleCloseTab = (e, path) => {
    e.stopPropagation()
    const newTabs = openTabs.filter(t => t.path !== path)
    setOpenTabs(newTabs)
    if (activeTab === path) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null)
    }
    setUnsavedChanges(prev => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  const closeActiveTab = useCallback(() => {
    if (!activeTab) return
    const newTabs = openTabs.filter(t => t.path !== activeTab)
    setOpenTabs(newTabs)
    setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null)
    setUnsavedChanges(prev => {
      const next = new Set(prev)
      next.delete(activeTab)
      return next
    })
  }, [activeTab, openTabs])

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Content & Saving
  // ---------------------------------------------------------------------------

  const autoSaveToFile = async (path, content) => {
    const tab = openTabs.find(t => t.path === path)
    if (!tab?.handle) return

    try {
      const writable = await tab.handle.createWritable()
      await writable.write(content)
      await writable.close()
      setUnsavedChanges(prev => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
      localStorage.removeItem(`md_draft_${path}`)
    } catch (err) {
      console.warn('Auto-save failed:', err)
    }
  }

  const handleContentChange = (path, content) => {
    setFileContents(prev => ({ ...prev, [path]: content }))
    setUnsavedChanges(prev => new Set(prev).add(path))

    // Immediate localStorage backup
    try {
      localStorage.setItem(`md_draft_${path}`, content)
    } catch (err) {
      console.warn('Failed to save to localStorage:', err)
    }

    // Debounced file save
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
    }
    autoSaveTimer.current = setTimeout(() => {
      autoSaveToFile(path, content)
    }, AUTOSAVE_DELAY)
  }

  const handleSave = async () => {
    if (!activeTab) return
    const tab = openTabs.find(t => t.path === activeTab)
    if (!tab?.handle) return

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
    }

    try {
      const writable = await tab.handle.createWritable()
      await writable.write(fileContents[activeTab])
      await writable.close()
      setUnsavedChanges(prev => {
        const next = new Set(prev)
        next.delete(activeTab)
        return next
      })
      localStorage.removeItem(`md_draft_${activeTab}`)
    } catch (err) {
      console.error('Error saving file:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // View Mode & Split Handling
  // ---------------------------------------------------------------------------

  const handleViewModeChange = (newMode) => {
    if ((viewMode === 'split' && newMode !== 'split') ||
        (viewMode !== 'split' && newMode === 'split')) {
      if (viewMode === 'split') {
        savedSplitRatio.current = splitRatio
      } else {
        setSplitRatio(savedSplitRatio.current)
      }
    }
    setViewMode(newMode)
  }

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDrag = useCallback((e) => {
    if (!isDragging || !editorPanelsRef.current) return
    const container = editorPanelsRef.current
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newRatio = Math.min(Math.max(x / rect.width, 0.2), 0.8)
    setSplitRatio(newRatio)
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Editor Formatting
  // ---------------------------------------------------------------------------

  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current
    if (!textarea || !activeTab) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const content = fileContents[activeTab] || ''
    const selectedText = content.substring(start, end)

    const newContent =
      content.substring(0, start) + before + selectedText + after + content.substring(end)

    handleContentChange(activeTab, newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      )
    }, 0)
  }

  // ---------------------------------------------------------------------------
  // Image Loading (for relative paths in markdown)
  // ---------------------------------------------------------------------------

  const loadImage = useCallback(async (src, currentFilePath) => {
    const cacheKey = currentFilePath ? `${currentFilePath}:${src}` : src

    if (imageCache[cacheKey]) return imageCache[cacheKey]
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return src
    }
    if (!rootDirHandle.current) return src

    try {
      let resolvedPath = src
      if (currentFilePath && (src.startsWith('./') || src.startsWith('../') || !src.startsWith('/'))) {
        resolvedPath = resolvePath(currentFilePath, src)
      }

      const parts = resolvedPath.split('/').filter(p => p && p !== '.')
      let currentHandle = rootDirHandle.current

      for (let i = 0; i < parts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i])
      }

      const fileName = parts[parts.length - 1]
      const fileHandle = await currentHandle.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      const blobUrl = URL.createObjectURL(file)

      setImageCache(prev => ({ ...prev, [cacheKey]: blobUrl }))
      return blobUrl
    } catch (err) {
      console.warn('Failed to load image:', src, err)
      return src
    }
  }, [imageCache])

  // ---------------------------------------------------------------------------
  // Custom Markdown Components
  // ---------------------------------------------------------------------------

  const ImageComponent = useCallback(({ src, alt, ...props }) => {
    const cacheKey = activeTab ? `${activeTab}:${src}` : src
    const [imageSrc, setImageSrc] = useState(imageCache[cacheKey] || src)
    const [loading, setLoading] = useState(!imageCache[cacheKey] && !src?.startsWith('http'))

    useEffect(() => {
      if (imageCache[cacheKey]) {
        setImageSrc(imageCache[cacheKey])
        setLoading(false)
        return
      }

      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
        loadImage(src, activeTab).then(blobUrl => {
          setImageSrc(blobUrl)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }, [src, cacheKey])

    if (loading) {
      return <span className="image-loading">Loading image...</span>
    }
    return <img src={imageSrc} alt={alt} {...props} />
  }, [imageCache, loadImage, activeTab])

  const LinkComponent = useCallback(({ href, children, ...props }) => {
    const isExternal = href?.startsWith('http://') || href?.startsWith('https://')
    const isMdLink = href?.endsWith('.md')

    const handleMdClick = (e) => {
      e.preventDefault()
      if (!href || !activeTab) return

      const resolvedPath = resolvePath(activeTab, href)
      const targetFile = files.find(f => f.fullPath === resolvedPath || f.path === resolvedPath)

      if (targetFile) {
        handleFileClick(targetFile)
      } else {
        console.warn('Could not find linked file:', resolvedPath)
      }
    }

    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      )
    }

    if (isMdLink) {
      return (
        <a href={href} onClick={handleMdClick} style={{ cursor: 'pointer' }} {...props}>
          {children}
        </a>
      )
    }

    return <a href={href} {...props}>{children}</a>
  }, [activeTab, files])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault()
        handleSave()
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyW') {
        e.preventDefault()
        closeActiveTab()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeTab, openTabs, fileContents, closeActiveTab])

  // Drag events for split resizing
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('mouseup', handleDragEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleDrag, handleDragEnd])

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const fileTree = buildFileTree(files)
  const activeContent = activeTab ? fileContents[activeTab] || '' : ''

  const renderFileTree = (items, depth = 0) => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const isExpanded = expandedFolders.has(item.path)
        return (
          <div key={item.path}>
            <div
              className="file-item folder"
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => toggleFolder(item.path)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderOpen size={14} className="file-icon" />
              <span>{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div className="folder-children">
                {renderFileTree(item.children, depth + 1)}
              </div>
            )}
          </div>
        )
      }

      const originalFile = files.find(f => f.fullPath === item.fullPath || f.path === item.path)
      return (
        <div
          key={item.fullPath || item.path}
          className={`file-item ${activeTab === (item.fullPath || item.path) ? 'active' : ''}`}
          style={{ paddingLeft: `${28 + depth * 16}px` }}
          onClick={() => handleFileClick(originalFile || item)}
        >
          <FileText size={14} className="file-icon" />
          <span>{item.name || item.path.split('/').pop()}</span>
        </div>
      )
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-buttons">
            <button className="sidebar-btn" onClick={handleOpenFolder} title="Open Folder">
              <FolderOpen size={16} />
              <span>Folder</span>
            </button>
            <button className="sidebar-btn" onClick={handleOpenFile} title="Open File">
              <FilePlus size={16} />
              <span>File</span>
            </button>
          </div>
          <p className="sidebar-hint">Tip: Press Cmd+Shift+. in file picker to show hidden folders</p>
        </div>

        {folderName && <div className="folder-title">{folderName}</div>}

        <div className="file-tree">
          {fileTree.length > 0 ? (
            renderFileTree(fileTree)
          ) : (
            <div className="empty-state">
              <FileText size={32} strokeWidth={1} />
              <p>No folder open</p>
              <p className="hint">Open a folder to browse, or open individual files</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Tabs Bar */}
        <div className="tabs-bar">
          <div className="tabs">
            {openTabs.map(tab => (
              <div
                key={tab.path}
                className={`tab ${activeTab === tab.path ? 'active' : ''} ${unsavedChanges.has(tab.path) ? 'unsaved' : ''}`}
                onClick={() => setActiveTab(tab.path)}
              >
                <FileText size={14} />
                <span>{tab.name}</span>
                {unsavedChanges.has(tab.path) && <span className="unsaved-dot" />}
                <button className="close-tab" onClick={(e) => handleCloseTab(e, tab.path)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {activeTab && (
            <div className="view-toggle">
              <button
                className={viewMode === 'edit' ? 'active' : ''}
                onClick={() => handleViewModeChange('edit')}
                title="Edit only"
              >
                <Edit3 size={14} />
              </button>
              <button
                className={viewMode === 'split' ? 'active' : ''}
                onClick={() => handleViewModeChange('split')}
                title="Split view"
              >
                <span className="split-icon" />
              </button>
              <button
                className={viewMode === 'preview' ? 'active' : ''}
                onClick={() => handleViewModeChange('preview')}
                title="Preview only"
              >
                <Eye size={14} />
              </button>
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={!unsavedChanges.has(activeTab)}
                title="Save (Cmd+S)"
              >
                <Save size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Editor Area */}
        {activeTab ? (
          <div className={`editor-container ${viewMode}`}>
            {/* Formatting Toolbar */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className="format-toolbar">
                {FORMAT_ACTIONS.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="toolbar-divider" />
                  ) : (
                    <button
                      key={i}
                      className="format-btn"
                      onClick={() => insertFormatting(item.before, item.after)}
                      title={item.label}
                    >
                      <item.icon size={16} />
                    </button>
                  )
                )}
              </div>
            )}

            <div className="editor-panels" ref={editorPanelsRef}>
              {/* Edit Panel */}
              {(viewMode === 'edit' || viewMode === 'split') && (
                <div
                  className="editor-panel"
                  style={viewMode === 'split' ? { flex: `0 0 ${splitRatio * 100}%` } : undefined}
                >
                  <textarea
                    ref={textareaRef}
                    className="editor"
                    value={activeContent}
                    onChange={(e) => handleContentChange(activeTab, e.target.value)}
                    placeholder="Start writing..."
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Draggable Divider */}
              {viewMode === 'split' && (
                <div
                  className={`split-divider ${isDragging ? 'dragging' : ''}`}
                  onMouseDown={handleDragStart}
                >
                  <div className="divider-handle" />
                </div>
              )}

              {/* Preview Panel */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div
                  className="preview-panel"
                  style={viewMode === 'split' ? { flex: `0 0 ${(1 - splitRatio) * 100}%` } : undefined}
                >
                  <div className="preview">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{ img: ImageComponent, a: LinkComponent }}
                    >
                      {activeContent}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="welcome">
            <div className="welcome-content">
              <FileText size={64} strokeWidth={1} />
              <h1>MD Reader</h1>
              <p>A lightweight markdown editor</p>
              <div className="welcome-buttons">
                <button className="welcome-btn primary" onClick={handleOpenFolder}>
                  <FolderOpen size={18} />
                  <span>Open Folder</span>
                </button>
                <button className="welcome-btn" onClick={handleOpenFile}>
                  <FilePlus size={18} />
                  <span>Open File</span>
                </button>
              </div>
              <p className="welcome-hint">
                Tip: Press Cmd+Shift+. in file picker to show hidden folders like .claude
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
