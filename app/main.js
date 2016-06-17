'use strict';
var app = require('app');
var BrowserWindow = require('browser-window');
var Menu = require("menu");
var env = require('./vendor/electron_boilerplate/env_config');
var menuTemplate = require('./menu_template')(app);
var windowStateKeeper = require('./vendor/electron_boilerplate/window_state');
var shell = require('shell');
var path = require('path');
var electron = require('electron');
var ipc = electron.ipcMain;
var autoUpdater = electron.autoUpdater;

var mainWindow;

// Preserver of the window size and position between app launches.
var mainWindowState = windowStateKeeper('main', {
    width: 1000,
    height: 600
});

app.on('ready', function () {
  mainWindow = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      "node-integration": false,
      "web-preferences": {
        "preload": path.join(__dirname, 'expose-window-apis.js')
      }
      });

  if (mainWindowState.isMaximized) {
      mainWindow.maximize();
  }
  mainWindow.log = function(text) {
    mainWindow.webContents.executeJavaScript('console.log("' + text + '");');
  }
  mainWindow.log("version: " + app.getVersion());

  mainWindow.webContents.on('did-finish-load', function(event) {
    this.executeJavaScript("s = document.createElement('script');s.setAttribute('src','localhax://slack-hacks-loader.js'); document.head.appendChild(s);");
  });

  mainWindow.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    if (url.indexOf("http") != 0) {
      return;
    }
    shell.openExternal(url);
  });

  mainWindow.loadURL('https://my.slack.com/ssb');

  var menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  var versionMenuItem = menu.items[0].submenu.items[1];
  mainWindow.log("hello from the master process");

  var auresponse = function(which, message) {
    return function(arg1) {
      mainWindow.log("au event: " + which);
      mainWindow.log(message);
    }
  }

  if (env.name != "development") {
    autoUpdater.setFeedURL("https://slacks-hacks.herokuapp.com/updates?version=" + app.getVersion());
    autoUpdater.on('error', auresponse("error", "update failed"));
    autoUpdater.on('checking-for-update', auresponse("checking-for-update", "looking for update"));
    autoUpdater.on('update-available', auresponse("update-available", "downloading update"));
    autoUpdater.on('update-not-available', auresponse("update-not-available", "latest"));
    autoUpdater.on('update-downloaded', auresponse("update-downloaded", "restart to update"));
    var fourHours = 1000 * 60 * 60 * 4
    var checkForUpdates = function() {
      mainWindow.log("Checking for updates...");
      autoUpdater.checkForUpdates()
    }
    setInterval(checkForUpdates, fourHours)
    checkForUpdates()
  }

  if (env.name === 'development') {
      mainWindow.openDevTools();
  }

  mainWindow.on('close', function () {
      mainWindowState.saveState(mainWindow);
  });

  ipc.on('bounce', function(event, arg) {
    app.dock.bounce(arg.type);
  });

  ipc.on('badge', function(event, arg) {
    if (process.platform === 'darwin') {
      app.dock.setBadge(arg.badge_text);
    }
  });

  app.on('zoom-in', function(event, arg) {
    mainWindow.webContents.executeJavaScript("host.zoom.increase();")
  });

  app.on('zoom-out', function(event, arg) {
    mainWindow.webContents.executeJavaScript("host.zoom.decrease();")
  });

  app.on('reset-zoom', function(event, arg) {
    mainWindow.webContents.executeJavaScript("host.zoom.reset();")
  });

  var httpHandler = function(protocol) {
    return function(request, callback) {
      var url = request.url.split("://", 2)[1]
      url = protocol + "://" + url
      return callback( {url: url} );
    }
  }

  electron.protocol.registerHttpProtocol('haxs', httpHandler("https"))
  electron.protocol.registerHttpProtocol('hax', httpHandler("http"))

  electron.protocol.registerFileProtocol('localhax', function(request, callback) {
    var url = request.url.split("://", 2)[1]
    callback({path: path.normalize(__dirname + '/localhax/' + url)});
  });
});

app.on('window-all-closed', function () {
    app.quit();
});
