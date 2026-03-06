const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readClients, writeClients } = require('../utils/storage');

// GET /api/clients — list all clients (mask auth tokens)
router.get('/', (req, res) => {
    try {
        const clients = readClients();
        const masked = clients.map(c => ({
            ...c,
            authToken: c.authToken ? '••••' + c.authToken.slice(-4) : '••••'
        }));
        res.json({ success: true, clients: masked });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/clients — add a new client
router.post('/', (req, res) => {
    try {
        const { name, accountSid, authToken, phoneNumber, label } = req.body;

        if (!name || !accountSid || !authToken || !phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Name, Account SID, Auth Token, and Phone Number are required'
            });
        }

        const clients = readClients();
        const newClient = {
            id: uuidv4(),
            name: name.trim(),
            accountSid: accountSid.trim(),
            authToken: authToken.trim(),
            phoneNumber: phoneNumber.trim(),
            label: (label || '').trim(),
            createdAt: new Date().toISOString()
        };

        clients.push(newClient);
        writeClients(clients);

        res.json({
            success: true,
            client: {
                ...newClient,
                authToken: '••••' + newClient.authToken.slice(-4)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/clients/:id — update a client
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, accountSid, authToken, phoneNumber, label } = req.body;
        const clients = readClients();
        const index = clients.findIndex(c => c.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        if (name) clients[index].name = name.trim();
        if (accountSid) clients[index].accountSid = accountSid.trim();
        if (authToken) clients[index].authToken = authToken.trim();
        if (phoneNumber) clients[index].phoneNumber = phoneNumber.trim();
        if (label !== undefined) clients[index].label = label.trim();
        clients[index].updatedAt = new Date().toISOString();

        writeClients(clients);

        res.json({
            success: true,
            client: {
                ...clients[index],
                authToken: '••••' + clients[index].authToken.slice(-4)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/clients/:id — remove a client
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const clients = readClients();
        const index = clients.findIndex(c => c.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const removed = clients.splice(index, 1)[0];
        writeClients(clients);

        res.json({ success: true, removed: removed.name });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/clients/:id/verify — verify Twilio credentials
router.post('/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const clients = readClients();
        const client = clients.find(c => c.id === id);

        if (!client) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const twilio = require('twilio')(client.accountSid, client.authToken);
        const account = await twilio.api.accounts(client.accountSid).fetch();

        res.json({
            success: true,
            account: {
                friendlyName: account.friendlyName,
                status: account.status,
                type: account.type
            }
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Invalid credentials: ' + err.message
        });
    }
});

// POST /api/clients/fetch-numbers — fetch phone numbers using raw credentials (before saving)
router.post('/fetch-numbers', async (req, res) => {
    try {
        const { accountSid, authToken } = req.body;

        if (!accountSid || !authToken) {
            return res.status(400).json({
                success: false,
                error: 'Account SID and Auth Token are required'
            });
        }

        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const numbers = await twilio.incomingPhoneNumbers.list({ limit: 50 });

        const formatted = numbers.map(n => ({
            sid: n.sid,
            phoneNumber: n.phoneNumber,
            friendlyName: n.friendlyName,
            smsEnabled: n.capabilities?.sms || false,
            mmsEnabled: n.capabilities?.mms || false,
        }));

        res.json({ success: true, numbers: formatted });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Failed to fetch numbers: ' + err.message
        });
    }
});

// GET /api/clients/:id/numbers — fetch phone numbers for a saved client
router.get('/:id/numbers', async (req, res) => {
    try {
        const { id } = req.params;
        const clients = readClients();
        const client = clients.find(c => c.id === id);

        if (!client) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const twilio = require('twilio')(client.accountSid, client.authToken);
        const numbers = await twilio.incomingPhoneNumbers.list({ limit: 50 });

        const formatted = numbers.map(n => ({
            sid: n.sid,
            phoneNumber: n.phoneNumber,
            friendlyName: n.friendlyName,
            smsEnabled: n.capabilities?.sms || false,
            mmsEnabled: n.capabilities?.mms || false,
        }));

        res.json({ success: true, numbers: formatted });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Failed to fetch numbers: ' + err.message
        });
    }
});

module.exports = router;
