import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged; // ← dev or build の判定

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      // preload: path.join(__dirname, "preload.js")
    },
  });

  if (isDev) {
    // ▶️ Vite dev server に接続
    win.loadURL('http://localhost:5173/');
    win.webContents.openDevTools(); // optional
  } else {
    // ▶️ ビルド後の HTML 読み込み
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
});
