// preload.js
console.log('Preload script STARTED');

const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script: contextBridge and ipcRenderer loaded');

// Example: Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Expose a function to get tasks
  getTasks: () => ipcRenderer.invoke('db:get-tasks'), 

  // Add functions here that your renderer process can call
  // For example:
  // addTask: (taskData) => ipcRenderer.invoke('db:add-task', taskData),
  // send: (channel, data) => ipcRenderer.send(channel, data),
  // receive: (channel, func) => {
  //   ipcRenderer.on(channel, (event, ...args) => func(...args));
  // }
  insertMatchingResult: (data) => ipcRenderer.invoke('db:insert-matching-result', data),
  getMatchingResults: (recipientId) => ipcRenderer.invoke('db:get-matching-results', recipientId),
  updateMatchingResultStatus: (data) => ipcRenderer.invoke('db:update-matching-result-status', data),
  getRecipientById: (recipientId) => ipcRenderer.invoke('db:get-recipient-by-id', recipientId),
  getAvailableDonors: () => ipcRenderer.invoke('db:get-available-donors'),

  // Donor CRUD operations
  addDonor: (donorData) => ipcRenderer.invoke('db:add-donor', donorData),
  getDonors: () => ipcRenderer.invoke('db:get-donors'),
  getDonorById: (id) => ipcRenderer.invoke('db:get-donor-by-id', id),
  updateDonor: (id, donorData) => ipcRenderer.invoke('db:update-donor', id, donorData),
  deleteDonor: (id) => ipcRenderer.invoke('db:delete-donor', id),

  // Recipient related IPC calls
  createRecipient: (data) => ipcRenderer.invoke('db:add-recipient', data),
  getRecipients: () => ipcRenderer.invoke('db:get-recipients'),
  getRecipientById: (id) => ipcRenderer.invoke('db:get-recipient-by-id', id),
  updateRecipient: (id, recipientData) => {
    console.log(`[preload.js] updateRecipient called with id: ${id}, data:`, recipientData);
    return ipcRenderer.invoke('db:update-recipient', id, recipientData);
  },
  deleteRecipient: (id) => ipcRenderer.invoke('db:delete-recipient', id),
  getRecipientCount: () => ipcRenderer.invoke('db:get-recipient-count'),

  // Matching related
  runMatch: (recipientId, donorId) => ipcRenderer.invoke('db:run-match', recipientId, donorId),

  // Dashboard specific IPC calls
  getDonorCount: () => ipcRenderer.invoke('db:get-donor-count'),
  getAllMatchingResultsStatus: () => ipcRenderer.invoke('db:get-all-matching-results-status'),
  getRecentDonors: () => ipcRenderer.invoke('db:get-recent-donors'),
  getRecentMatches: () => ipcRenderer.invoke('db:get-recent-matches')
});

console.log('Preload script: contextBridge.exposeInMainWorld CALLED for electronAPI');
