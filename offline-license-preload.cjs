'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('offlineActivation',{
 status:()=>ipcRenderer.invoke('offline-license:status'),
 activate:serial=>ipcRenderer.invoke('offline-license:activate',{serial})
});
