
importScripts('https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js');

self.onmessage = (event) => {
    const { password, salt } = event.data;
    try {
        const derivedKey = forge.pkcs5.pbkdf2(password, salt, 100000, 32, 'sha256');
        const keyHex = forge.util.bytesToHex(derivedKey);
        
        self.postMessage({ status: 'success', keyHex });
    } catch (e) {
        self.postMessage({ status: 'error', message: e.message });
    }
};