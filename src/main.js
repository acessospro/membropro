import { app, BrowserWindow, ipcMain, Menu, shell, session } from 'electron';
import GoLogin from 'gologin';
import puppeteer from 'puppeteer-core';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';

const { updateElectronApp } = ('update-electron-app');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLOGIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzkyZTI5YjU0MzUzZTY1NGQ0ODg1ZDIiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2N2IwMjYxODljZTQzNzIzNGY4YmMzMGYifQ.whj_4HL_bJiR4TrzWrJfOOcCoHrMcjQRMGcgZUMSTyE";
const DASHBOARD_URL = "https://membro.pro/page/dashboard";
const APP_NAME = "MembroPro";
const desktopPath = path.join(os.homedir(), "Desktop");
const PORT = 8888;
let mainWindow;

// 🔹 Criação da Janela e Configuração do Electron
app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        }
    });

    mainWindow.loadURL(DASHBOARD_URL);

    // Ativa as atualizações automáticas
updateElectronApp({
    repo: 'acessospro/app-membropro', // Substitua pelo repositório correto
    updateInterval: '1 hour', // Verifica atualizações a cada 1 hora
    logger: console, // Exibe logs no console
  });

    configurarFirewall();
    criarMenuSuperior();
    createDesktopShortcut();
});

// 🔹 Menu personalizado em linha (horizontal)
const menuTemplate = [
    { label: 'Atualizar', accelerator: 'F5', click: () => mainWindow.reload() },
    { label: 'Reiniciar', accelerator: 'CmdOrCtrl+R', click: () => app.relaunch() || app.exit() },
    { label: 'Limpar Cache', click: limparCache },
    { label: 'Suporte', click: () => shell.openExternal('https://wa.me/message/GZXMOEPJE7EGC1') },
    { label: 'Sair', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);


// 🔹 Limpar Cache
async function limparCache() {
    try {
        await session.defaultSession.clearCache();
        await session.defaultSession.clearStorageData();
        console.log('[INFO] Cache do app limpo.');
        mainWindow.reload();
    } catch (error) {
        console.error('[ERRO] Falha ao limpar o cache:', error);
    }
}

// 🔹 Captura o `profileId` e Inicia o Perfil no Orbita
ipcMain.on('start-profile', async (_event, profileId) => {
    console.log("[INFO] Abrindo ferramenta...");

    const goLogin = new GoLogin({ token: GOLOGIN_TOKEN, profile_id: profileId });

    try {
        const { status, wsUrl } = await goLogin.start();
        if (status !== 'success' || !wsUrl) throw new Error("Erro ao obter WebSocket.");

        console.log("[SUCESSO] Perfil iniciado.");

        const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });

        monitorarFechamentoOrbita(goLogin, profileId);
    } catch (error) {
        console.error("[ERRO] Falha ao iniciar perfil:", error);
    }
});

// 🔹 Monitora o Fechamento do Orbita e Fecha o Perfil
function monitorarFechamentoOrbita(goLogin, profileId) {
    console.log("[INFO] Monitorando Orbita...");

    const checkProcessCmd = process.platform === 'win32'
        ? `tasklist | findstr /I "Orbita"`
        : process.platform === 'darwin'
            ? `pgrep -f "Orbita"`
            : `ps aux | grep -i "Orbita" | grep -v grep`;

    const interval = setInterval(() => {
        exec(checkProcessCmd, (err, stdout) => {
            if (!stdout.includes('Orbita')) {
                console.log("[INFO] Fechando perfil...");

                goLogin.stop({ profile_id: profileId }).then(() => {
                    console.log("[SUCESSO] Perfil encerrado.");
                }).catch((error) => {
                    console.error("[ERRO] Falha ao fechar perfil:", error);
                });

                clearInterval(interval);
            }
        });
    }, 5000);
}

// 🔹 Função para criar atalhos na área de trabalho
function createDesktopShortcut() {
    if (process.platform === 'win32') {
        createWindowsShortcut();
    } else if (process.platform === 'darwin') {
        createMacShortcut();
    } else if (process.platform === 'linux') {
        createLinuxShortcut();
    }
}

// 🔹 Criar atalho no Windows (corrigido)
function createWindowsShortcut() {
    const shortcutPath = path.join(desktopPath, `${APP_NAME}.lnk`);
    
    if (!fs.existsSync(shortcutPath)) {
        exec(`powershell.exe -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('${shortcutPath}');$s.TargetPath='${process.execPath}';$s.Save()"`,
        (error) => {
            if (error) console.error("[ERRO] Falha ao criar atalho no Windows:", error);
            else console.log("[SUCESSO] Atalho criado no Windows.");
        });
    } else {
        console.log("[INFO] O atalho já existe no Windows.");
    }
}

// 🔹 Criar atalho no macOS (corrigido)
function createMacShortcut() {
    const applicationsPath = "/Applications";
    const shortcutPath = path.join(applicationsPath, `${APP_NAME}.app`);

    if (!fs.existsSync(shortcutPath)) {
        exec(`ln -s "${process.execPath}" "${shortcutPath}"`, (error) => {
            if (error) console.error("[ERRO] Falha ao criar atalho no macOS:", error);
            else console.log("[SUCESSO] Atalho criado no macOS.");
        });
    } else {
        console.log("[INFO] O atalho já existe no macOS.");
    }
}

// 🔹 Criar atalho no Linux (corrigido)
function createLinuxShortcut() {
    const shortcutPath = path.join(desktopPath, `${APP_NAME}.desktop`);

    if (!fs.existsSync(shortcutPath)) {
        const shortcutContent = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Exec=${process.execPath}
Icon=${path.join(__dirname, "src/assets/icon.png")}
Terminal=false`;

        fs.writeFile(shortcutPath, shortcutContent, { mode: 0o755 }, (error) => {
            if (error) console.error("[ERRO] Falha ao criar atalho no Linux:", error);
            else console.log("[SUCESSO] Atalho criado no Linux.");
        });
    } else {
        console.log("[INFO] O atalho já existe no Linux.");
    }
}

// 🔹 Criar atalho após o app estar pronto
app.whenReady().then(() => {
    createDesktopShortcut();
});

// 🔹 Configuração de Firewall
function configurarFirewall() {
    if (process.platform === 'win32') {
        exec(`netsh advfirewall firewall show rule name="MembroPro"`, (err, stdout) => {
            if (!stdout.includes("MembroPro")) {
                console.log("[INFO] Criando regra de firewall no Windows...");
                exec(`netsh advfirewall firewall add rule name="MembroPro" dir=in action=allow protocol=TCP localport=${PORT}`);
            }
        });
    } else if (process.platform === 'darwin') {
        exec(`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps`, (err, stdout) => {
            if (!stdout.includes(APP_NAME)) {
                console.log("[INFO] Criando regra de firewall no macOS...");
                exec(`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add ${process.execPath}`);
            }
        });
    } else if (process.platform === 'linux') {
        exec(`sudo ufw status | grep "${PORT}"`, (err, stdout) => {
            if (!stdout.includes(`${PORT}`)) {
                console.log("[INFO] Criando regra de firewall no Linux...");
                exec(`sudo ufw allow ${PORT}/tcp`);
            }
        });
    }
}

// 🔹 Servidor Express para Status
const agentApp = express();
agentApp.use(cors());
agentApp.use(express.json());

agentApp.get('/status', (_req, res) => {
    res.json({ status: 'running' });
});

agentApp.listen(PORT, () => {
    console.log(`✅ Agente rodando em http://localhost:${PORT}`);
});

// 🔹 Fecha o App corretamente
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
