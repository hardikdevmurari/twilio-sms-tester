const express = require('express');
const router = express.Router();

// POST /api/proxy/verify — verify credentials
router.post('/verify', async (req, res) => {
    const { accountSid, authToken } = req.body;
    if (!accountSid || !authToken) {
        return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
    }
    try {
        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const account = await twilio.api.accounts(accountSid.trim()).fetch();
        res.json({
            success: true,
            account: { friendlyName: account.friendlyName, status: account.status, type: account.type }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Invalid credentials: ' + err.message });
    }
});

// POST /api/proxy/numbers — list phone numbers with webhook URLs
router.post('/numbers', async (req, res) => {
    const { accountSid, authToken } = req.body;
    if (!accountSid || !authToken) {
        return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
    }
    try {
        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const numbers = await twilio.incomingPhoneNumbers.list({ limit: 50 });
        const formatted = numbers.map(n => ({
            sid: n.sid,
            phoneNumber: n.phoneNumber,
            friendlyName: n.friendlyName,
            smsEnabled: n.capabilities?.sms || false,
            mmsEnabled: n.capabilities?.mms || false,
            smsUrl: n.smsUrl || '',
            smsMethod: n.smsMethod || 'POST',
            voiceUrl: n.voiceUrl || '',
            voiceMethod: n.voiceMethod || 'POST',
        }));
        res.json({ success: true, numbers: formatted });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Failed to fetch numbers: ' + err.message });
    }
});

// PUT /api/proxy/numbers/:numberSid/webhook — update SMS and Voice webhooks
router.put('/numbers/:numberSid/webhook', async (req, res) => {
    const { numberSid } = req.params;
    const { accountSid, authToken, smsUrl, voiceUrl, smsMethod, voiceMethod } = req.body;
    if (!accountSid || !authToken) {
        return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
    }
    try {
        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const updatePayload = {};
        if (smsUrl !== undefined) updatePayload.smsUrl = smsUrl;
        if (voiceUrl !== undefined) updatePayload.voiceUrl = voiceUrl;
        if (smsMethod) updatePayload.smsMethod = smsMethod;
        if (voiceMethod) updatePayload.voiceMethod = voiceMethod;
        const updated = await twilio.incomingPhoneNumbers(numberSid).update(updatePayload);
        res.json({
            success: true,
            number: {
                sid: updated.sid,
                phoneNumber: updated.phoneNumber,
                smsUrl: updated.smsUrl || '',
                smsMethod: updated.smsMethod || 'POST',
                voiceUrl: updated.voiceUrl || '',
                voiceMethod: updated.voiceMethod || 'POST',
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Failed to update webhook: ' + err.message });
    }
});

// POST /api/proxy/sms/send — send an SMS
router.post('/sms/send', async (req, res) => {
    const { accountSid, authToken, from, to, body } = req.body;
    if (!accountSid || !authToken || !from || !to || !body) {
        return res.status(400).json({ success: false, error: 'accountSid, authToken, from, to, and body are required' });
    }
    try {
        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const message = await twilio.messages.create({ body, from, to });
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

// POST /api/proxy/sms/logs — fetch message logs
router.post('/sms/logs', async (req, res) => {
    const { accountSid, authToken, phoneNumber, limit = 50, dateSentAfter, dateSentBefore } = req.body;
    if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ success: false, error: 'accountSid, authToken, and phoneNumber are required' });
    }
    try {
        const twilio = require('twilio')(accountSid.trim(), authToken.trim());
        const perQueryLimit = parseInt(limit);
        const baseFilters = {};
        if (dateSentAfter) baseFilters.dateSentAfter = new Date(dateSentAfter);
        if (dateSentBefore) baseFilters.dateSentBefore = new Date(dateSentBefore);

        const [sentRaw, receivedRaw] = await Promise.all([
            twilio.messages.list({ ...baseFilters, from: phoneNumber, limit: perQueryLimit }),
            twilio.messages.list({ ...baseFilters, to: phoneNumber, limit: perQueryLimit })
        ]);

        const formatMsg = m => ({
            sid: m.sid, status: m.status, to: m.to, from: m.from, body: m.body,
            numSegments: m.numSegments, price: m.price, priceUnit: m.priceUnit,
            direction: m.direction, dateCreated: m.dateCreated, dateSent: m.dateSent,
            dateUpdated: m.dateUpdated, errorCode: m.errorCode, errorMessage: m.errorMessage
        });

        const dedup = (list) => {
            const seen = new Set();
            return list.filter(m => { if (seen.has(m.sid)) return false; seen.add(m.sid); return true; });
        };

        const outgoing = dedup(sentRaw)
            .filter(m => m.direction === 'outbound-api')
            .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
            .map(formatMsg);
        const incoming = dedup(receivedRaw)
            .filter(m => m.direction === 'inbound')
            .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
            .map(formatMsg);

        res.json({
            success: true,
            outgoing,
            incoming,
            outgoingCount: outgoing.length,
            incomingCount: incoming.length,
            clientNumber: phoneNumber
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
