const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';
    // Ensure key is exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readClients() {
    ensureDataDir();
    if (!fs.existsSync(CLIENTS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(CLIENTS_FILE, 'utf8');
        const clients = JSON.parse(data);
        // Decrypt auth tokens before returning
        return clients.map(client => ({
            ...client,
            authToken: decrypt(client.authToken)
        }));
    } catch (err) {
        console.error('Error reading clients file:', err.message);
        return [];
    }
}

function writeClients(clients) {
    ensureDataDir();
    // Encrypt auth tokens before saving
    const encrypted = clients.map(client => ({
        ...client,
        authToken: encrypt(client.authToken)
    }));
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(encrypted, null, 2), 'utf8');
}

function getClientById(id) {
    const clients = readClients();
    return clients.find(c => c.id === id) || null;
}

module.exports = {
    readClients,
    writeClients,
    getClientById,
    encrypt,
    decrypt
};
