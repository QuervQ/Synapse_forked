import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC || '', 'images/favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            // Security: Enable contextIsolation and disable nodeIntegration
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
            webSecurity: true,
        },
    })
    console.log(process.env.VITE_PUBLIC)
    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        console.log('Loading dev server:', VITE_DEV_SERVER_URL)
        win.loadURL(VITE_DEV_SERVER_URL).catch(err => {
            console.error('Failed to load URL:', err)
        })
    } else {
        console.log('Loading file:', path.join(RENDERER_DIST, 'index.html'))
        win.loadFile(path.join(RENDERER_DIST, 'index.html')).catch(err => {
            console.error('Failed to load file:', err)
        })
    }

    // Open DevTools in development
    if (VITE_DEV_SERVER_URL) {
        win.webContents.openDevTools()
    }
}

app.on('window-all-closed', () => {
    console.log('All windows closed')
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    console.log('App activated')
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady()
    .then(() => {
        console.log('App is ready, creating window...')
        createWindow()
    })
    .catch(err => {
        console.error('App failed to start:', err)
        process.exit(1)
    })

// Catch unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason)
})
