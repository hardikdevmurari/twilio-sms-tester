const express = require('express');
const router = express.Router();

// In-memory store for incoming messages (real-time webhook only)
const incomingMessages = [];
const sseClients = [];

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

    incomingMessages.unshift(incomingMsg);
    if (incomingMessages.length > 200) {
        incomingMessages.length = 200;
    }

    sseClients.forEach(sseRes => {
        sseRes.write(`data: ${JSON.stringify(incomingMsg)}\n\n`);
    });

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
