// Preload: override Node.js DNS to use Google's public DNS instead of 127.0.0.1
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
