const express = require('express');
const router = express.Router();
const { getClientById } = require('../utils/storage');

// In-memory store for incoming messages
const incomingMessages = [];
// SSE clients
const sseClients = [];

// POST /api/sms/send — send an SMS
router.post('/send', async (req, res) => {
    try {
        const { clientId, to, body } = req.body;

        if (!clientId || !to || !body) {
            return res.status(400).json({
                success: false,
                error: 'clientId, to, and body are required'
            });
        }

        const client = getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const twilio = require('twilio')(client.accountSid, client.authToken);
        const message = await twilio.messages.create({
            body: body,
            from: client.phoneNumber,
            to: to
        });

        res.json({
            success: true,
            message: {
                sid: message.sid,
                status: message.status,
                to: message.to,
                from: message.from,
                body: message.body,
                dateCreated: message.dateCreated,
                direction: message.direction
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/sms/logs/:clientId — fetch message logs from Twilio (only for client's phone number)
router.get('/logs/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { limit = 50, dateSentAfter, dateSentBefore } = req.query;

        const client = getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const twilio = require('twilio')(client.accountSid, client.authToken);
        const perQueryLimit = parseInt(limit);

        const baseFilters = {};
        if (dateSentAfter) baseFilters.dateSentAfter = new Date(dateSentAfter);
        if (dateSentBefore) baseFilters.dateSentBefore = new Date(dateSentBefore);

        // Fetch messages sent FROM and received TO the client's phone number
        const [sentMessages, receivedMessages] = await Promise.all([
            twilio.messages.list({ ...baseFilters, from: client.phoneNumber, limit: perQueryLimit }),
            twilio.messages.list({ ...baseFilters, to: client.phoneNumber, limit: perQueryLimit })
        ]);

        // Merge and deduplicate by SID
        const seen = new Set();
        const allMessages = [...sentMessages, ...receivedMessages].filter(m => {
            if (seen.has(m.sid)) return false;
            seen.add(m.sid);
            return true;
        });

        // Sort by date (newest first) and apply limit
        allMessages.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
        const limited = allMessages.slice(0, perQueryLimit);

        const formatted = limited.map(m => ({
            sid: m.sid,
            status: m.status,
            to: m.to,
            from: m.from,
            body: m.body,
            numSegments: m.numSegments,
            price: m.price,
            priceUnit: m.priceUnit,
            direction: m.direction,
            dateCreated: m.dateCreated,
            dateSent: m.dateSent,
            dateUpdated: m.dateUpdated,
            errorCode: m.errorCode,
            errorMessage: m.errorMessage
        }));

        res.json({ success: true, messages: formatted, count: formatted.length });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/sms/message/:clientId/:messageSid — get a single message detail
router.get('/message/:clientId/:messageSid', async (req, res) => {
    try {
        const { clientId, messageSid } = req.params;

        const client = getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const twilio = require('twilio')(client.accountSid, client.authToken);
        const m = await twilio.messages(messageSid).fetch();

        res.json({
            success: true,
            message: {
                sid: m.sid,
                status: m.status,
                to: m.to,
                from: m.from,
                body: m.body,
                numSegments: m.numSegments,
                price: m.price,
                priceUnit: m.priceUnit,
                direction: m.direction,
                dateCreated: m.dateCreated,
                dateSent: m.dateSent,
                dateUpdated: m.dateUpdated,
                errorCode: m.errorCode,
                errorMessage: m.errorMessage
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/sms/webhook/incoming — Twilio incoming SMS webhook
router.post('/webhook/incoming', (req, res) => {
    const incomingMsg = {
        sid: req.body.MessageSid || req.body.SmsSid,
        from: req.body.From,
        to: req.body.To,
        body: req.body.Body,
        numMedia: req.body.NumMedia,
        accountSid: req.body.AccountSid,
        timestamp: new Date().toISOString()
    };

    // Store in memory (keep last 200)
    incomingMessages.unshift(incomingMsg);
    if (incomingMessages.length > 200) {
        incomingMessages.length = 200;
    }

    // Broadcast to all SSE clients
    sseClients.forEach(sseRes => {
        sseRes.write(`data: ${JSON.stringify(incomingMsg)}\n\n`);
    });

    // Respond with TwiML (empty response)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

// GET /api/sms/incoming/stream — SSE for real-time incoming messages
router.get('/incoming/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial heartbeat
    res.write('data: {"type":"connected"}\n\n');

    sseClients.push(res);

    req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index > -1) sseClients.splice(index, 1);
    });
});

// GET /api/sms/incoming — get stored incoming messages
router.get('/incoming', (req, res) => {
    const { accountSid } = req.query;
    let messages = incomingMessages;

    if (accountSid) {
        messages = messages.filter(m => m.accountSid === accountSid);
    }

    res.json({ success: true, messages, count: messages.length });
});

module.exports = router;
