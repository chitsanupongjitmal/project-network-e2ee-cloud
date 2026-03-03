
import forge from 'node-forge';

const DB_NAME = 'CryptoKeyStore';
const DB_VERSION = 2; 
const KEY_PAIR_STORE_NAME = 'keys';
const GROUP_KEY_STORE_NAME = 'groupKeys';



const PBKDF2_ITERATIONS = 100000;


function bytesToBinaryString(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

function arrayBufferToBase64(buffer) {
    return window.btoa(bytesToBinaryString(new Uint8Array(buffer)));
}

function toUtf8BinaryString(input) {
    if (typeof TextEncoder !== 'undefined') {
        return bytesToBinaryString(new TextEncoder().encode(input));
    }

    return unescape(encodeURIComponent(input));
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening IndexedDB.");
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(KEY_PAIR_STORE_NAME)) {
                db.createObjectStore(KEY_PAIR_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(GROUP_KEY_STORE_NAME)) {
                db.createObjectStore(GROUP_KEY_STORE_NAME, { keyPath: 'groupId' });
            }
        };
    });
}

function _base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); }
    return bytes.buffer;
}

function pemToDer(pem) {
    const base64 = pem.replace(/-+BEGIN [^-]+-+/g, '').replace(/-+END [^-]+-+/g, '').replace(/\s/g, '');
    return _base64ToArrayBuffer(base64);
}

export async function decryptAndStoreKeys(password, encryptedData, publicKeyPem) {
    if (!window.isSecureContext || !window.crypto || !window.crypto.subtle) {
        const errorMsg = "Cannot decrypt keys: Environment is not secure or Crypto API is unavailable (HTTPS required).";
        console.error(errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        const [saltB64, ivB64, tagB64, encryptedB64] = encryptedData.split(':');
        const saltBinary = forge.util.decode64(saltB64);
        const ivBinary = forge.util.decode64(ivB64);
        const tagBinary = forge.util.decode64(tagB64);
        const encryptedBinary = forge.util.decode64(encryptedB64);

        const deriveKey = (saltString) => new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    resolve(forge.pkcs5.pbkdf2(password, saltString, PBKDF2_ITERATIONS, 32, 'sha256'));
                } catch (e) {
                    reject(e);
                }
            }, 0);
        });

        const tryDecrypt = (keyMaterial) => {
            const decipherInstance = forge.cipher.createDecipher('AES-GCM', keyMaterial);
            decipherInstance.start({ iv: ivBinary, tag: tagBinary });
            decipherInstance.update(forge.util.createBuffer(encryptedBinary));
            return decipherInstance.finish() ? decipherInstance.output.toString('utf8') : null;
        };

        const primaryKey = await deriveKey(saltBinary);
        let privateKeyPem = tryDecrypt(primaryKey);

        if (!privateKeyPem) {
            const legacySalt = toUtf8BinaryString(saltBinary);
            const legacyKey = await deriveKey(legacySalt);
            privateKeyPem = tryDecrypt(legacyKey);
        }

        if (!privateKeyPem) {
            throw new Error("Decryption failed. Authentication tag mismatch or incorrect password.");
        }
        
        const privateKeyDer = pemToDer(privateKeyPem);
        const publicKeyDer = pemToDer(publicKeyPem);
        
        const [privateKey, publicKey] = await Promise.all([
            window.crypto.subtle.importKey('pkcs8', privateKeyDer, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']),
            window.crypto.subtle.importKey('spki', publicKeyDer, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
        ]);

        const keyPair = { privateKey, publicKey };
        const db = await openDB();
        const tx = db.transaction(KEY_PAIR_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KEY_PAIR_STORE_NAME);
        await store.put({ id: 'keyPair', value: keyPair });
        return keyPair;
    } catch (error) {
        console.error("Failed to decrypt and store keys:", error);
        throw new Error("Incorrect password or corrupted key data.");
    }
}

export async function getKeys() {
    try {
        const db = await openDB();
        const tx = db.transaction(KEY_PAIR_STORE_NAME, 'readonly');
        const store = tx.objectStore(KEY_PAIR_STORE_NAME);
        const request = store.get('keyPair');
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Could not get keys from IndexedDB:", error);
        return null;
    }
}

export async function clearKeys() {
    try {
        const db = await openDB();
        const tx = db.transaction([KEY_PAIR_STORE_NAME, GROUP_KEY_STORE_NAME], 'readwrite');
        const keyPairStore = tx.objectStore(KEY_PAIR_STORE_NAME);
        const groupKeyStore = tx.objectStore(GROUP_KEY_STORE_NAME);
        
        keyPairStore.clear();
        groupKeyStore.clear();

        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    } catch (error) {
        console.error("Failed to clear keys:", error);
    }
}

export async function storeGroupKey(groupId, key) {
    try {
        const db = await openDB();
        const tx = db.transaction(GROUP_KEY_STORE_NAME, 'readwrite');
        const store = tx.objectStore(GROUP_KEY_STORE_NAME);
        await store.put({ groupId: String(groupId), value: key });
    } catch (error) {
        console.error(`Failed to store group key for group ${groupId}:`, error);
    }
}

export async function getAllGroupKeys() {
    try {
        const db = await openDB();
        const tx = db.transaction(GROUP_KEY_STORE_NAME, 'readonly');
        const store = tx.objectStore(GROUP_KEY_STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const keysMap = {};
                request.result.forEach(item => {
                    keysMap[item.groupId] = item.value;
                });
                resolve(keysMap);
            };
            request.onerror = () => {
                console.error("Could not get all group keys from IndexedDB:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Could not get all group keys from IndexedDB:", error);
        return {};
    }
}




export async function deriveSharedSecret(peerPublicKey, myPrivateKey) {
    return window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPublicKey },
        myPrivateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMessage(plaintext, peerPublicKey, myPrivateKey) {
    const sharedSecret = await deriveSharedSecret(peerPublicKey, myPrivateKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, sharedSecret, encodedText);
    const encryptedData = new Uint8Array(iv.length + ciphertext.byteLength);
    encryptedData.set(iv);
    encryptedData.set(new Uint8Array(ciphertext), iv.length);
    return window.btoa(String.fromCharCode(...encryptedData));
}

export async function decryptMessage(ciphertextB64, peerPublicKey, myPrivateKey) {
    const sharedSecret = await deriveSharedSecret(peerPublicKey, myPrivateKey);
    const encryptedData = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));
    if (encryptedData.byteLength < 12) throw new Error("Encrypted data is too short.");
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);
    const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, sharedSecret, ciphertext);
    return new TextDecoder().decode(decryptedBuffer);
}

export async function encryptFile(fileBuffer, peerPublicKey, myPrivateKey) {
    const sharedSecret = await deriveSharedSecret(peerPublicKey, myPrivateKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertextWithTag = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedSecret, fileBuffer);
    const encryptedData = new Uint8Array(iv.length + ciphertextWithTag.byteLength);
    encryptedData.set(iv);
    encryptedData.set(new Uint8Array(ciphertextWithTag), iv.length);
    return arrayBufferToBase64(encryptedData.buffer);
}

export async function decryptFile(encryptedBlob, peerPublicKey, myPrivateKey) {
    try {
        const sharedSecret = await deriveSharedSecret(peerPublicKey, myPrivateKey);
        const encryptedDataBuffer = await encryptedBlob.arrayBuffer();
        if (encryptedDataBuffer.byteLength < 28) throw new Error("Encrypted file data is too short.");
        const encryptedDataArray = new Uint8Array(encryptedDataBuffer);
        const iv = encryptedDataArray.subarray(0, 12);
        const ciphertextWithTag = encryptedDataArray.buffer.slice(12);
        return await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedSecret, ciphertextWithTag);
    } catch (error) {
        if (error.name === 'OperationError') {
             console.error("File decryption failed (Tag Mismatch).");
             throw new Error("Failed to decrypt file (Tag Mismatch).");
        }
        console.error("File decryption failed:", error);
        throw new Error("Failed to decrypt file.");
    }
}



export async function createGroupKey() {
    return window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptGroupKey(groupKey, memberPublicKey, myPrivateKey) {
    const rawGroupKey = await window.crypto.subtle.exportKey('raw', groupKey);
    return encryptMessage(arrayBufferToBase64(rawGroupKey), memberPublicKey, myPrivateKey);
}

export async function decryptGroupKey(encryptedKeyB64, creatorPublicKey, myPrivateKey) {
    const decryptedRawKeyB64 = await decryptMessage(encryptedKeyB64, creatorPublicKey, myPrivateKey);
    const rawKey = _base64ToArrayBuffer(decryptedRawKeyB64);
    return window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function encryptWithGroupKey(text, groupKey) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, groupKey, encodedText);
    const encryptedData = new Uint8Array(iv.length + ciphertext.byteLength);
    encryptedData.set(iv);
    encryptedData.set(new Uint8Array(ciphertext), iv.length);
    return arrayBufferToBase64(encryptedData.buffer);
}

export async function decryptWithGroupKey(encryptedB64, groupKey) {
    const encryptedData = _base64ToArrayBuffer(encryptedB64);
    if (encryptedData.byteLength < 12) throw new Error("Encrypted data is too short.");
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);
    const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, groupKey, ciphertext);
    return new TextDecoder().decode(decryptedBuffer);
}

export { pemToDer };
