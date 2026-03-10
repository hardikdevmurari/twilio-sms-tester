// ===== Twilio SMS Tester — Frontend App =====
// Clients are stored in localStorage. The server is a stateless Twilio proxy.
(function () {
    'use strict';

    const API = '';
    const LS_KEY = 'twilio_tester_clients';

    let activeClientId = null;
    let clients = [];
    let incomingMessages = [];
    let eventSource = null;
    let lastLoadedMessages = [];

    // ===== DOM Elements =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        // Header
        activeClientName: $('#active-client-name'),
        activeClientBadge: $('#active-client-badge'),
        connectionStatus: $('#connection-status'),

        // Sidebar
        clientList: $('#client-list'),
        emptyClients: $('#empty-clients'),
        btnAddClient: $('#btn-add-client'),

        // Welcome
        welcomeState: $('#welcome-state'),
        btnWelcomeAdd: $('#btn-welcome-add'),

        // Workspace
        workspace: $('#workspace'),

        // Tabs
        tabBar: $('#tab-bar'),

        // Send SMS
        smsFrom: $('#sms-from'),
        smsTo: $('#sms-to'),
        smsBody: $('#sms-body'),
        charCount: $('#char-count'),
        segmentCount: $('#segment-count'),
        segmentPlural: $('#segment-plural'),
        btnSendSms: $('#btn-send-sms'),
        sendResult: $('#send-result'),

        // Webhooks
        webhooksList: $('#webhooks-list'),
        emptyWebhooks: $('#empty-webhooks'),
        btnRefreshWebhooks: $('#btn-refresh-webhooks'),

        // Logs — split view
        logLimit: $('#log-limit'),
        btnRefreshLogs: $('#btn-refresh-logs'),
        outgoingLogs: $('#outgoing-logs'),
        incomingLogs: $('#incoming-logs'),
        outgoingCount: $('#outgoing-count'),
        incomingLogCount: $('#incoming-log-count'),
        emptyOutgoing: $('#empty-outgoing'),
        emptyIncomingLogs: $('#empty-incoming-logs'),

        // Incoming (real-time)
        incomingCount: $('#incoming-count'),
        incomingList: $('#incoming-list'),
        emptyIncoming: $('#empty-incoming'),
        btnCopyWebhook: $('#btn-copy-webhook'),
        btnClearIncoming: $('#btn-clear-incoming'),
        webhookUrlDisplay: $('#webhook-url-display'),

        // Client Modal
        modalOverlay: $('#modal-overlay'),
        modalTitle: $('#modal-title'),
        clientForm: $('#client-form'),
        clientId: $('#client-id'),
        clientName: $('#client-name'),
        clientLabel: $('#client-label'),
        clientSid: $('#client-sid'),
        clientToken: $('#client-token'),
        clientPhone: $('#client-phone'),
        btnModalClose: $('#btn-modal-close'),
        btnCancelModal: $('#btn-cancel-modal'),
        btnVerifyCreds: $('#btn-verify-creds'),
        btnSaveClient: $('#btn-save-client'),
        btnToggleToken: $('#btn-toggle-token'),
        btnFetchNumbers: $('#btn-fetch-numbers'),
        fetchHint: $('#fetch-hint'),
        verifyResult: $('#verify-result'),

        // Message Detail Modal
        msgModalOverlay: $('#msg-modal-overlay'),
        btnMsgModalClose: $('#btn-msg-modal-close'),
        msgDetailContent: $('#msg-detail-content'),

        // Toast
        toastContainer: $('#toast-container'),
    };

    // ===== Initialize =====
    async function init() {
        setupEventListeners();
        setupSSE();
        updateWebhookUrl();
        loadClients();

        const savedId = localStorage.getItem('twilio_tester_active_client');
        if (savedId && clients.find(c => c.id === savedId)) {
            selectClient(savedId);
        }
    }

    // ===== API Helpers =====
    async function apiPost(url, data) {
        const res = await fetch(API + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    }

    async function apiPut(url, data) {
        const res = await fetch(API + url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    }

    // ===== localStorage Client Storage =====
    function lsGetClients() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function lsSaveClients(list) {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    // Return the active client's full credentials (for passing to proxy)
    function getActiveCreds() {
        return clients.find(c => c.id === activeClientId) || null;
    }

    // ===== Clients =====
    function loadClients() {
        clients = lsGetClients();
        renderClientList();
    }

    function renderClientList() {
        if (clients.length === 0) {
            dom.emptyClients.style.display = 'flex';
            dom.clientList.querySelectorAll('.client-item').forEach(el => el.remove());
            return;
        }

        dom.emptyClients.style.display = 'none';
        dom.clientList.querySelectorAll('.client-item').forEach(el => el.remove());

        clients.forEach(client => {
            const initials = client.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const el = document.createElement('div');
            el.className = `client-item${client.id === activeClientId ? ' active' : ''}`;
            el.dataset.id = client.id;

            el.innerHTML = `
        <div class="client-avatar">${initials}</div>
        <div class="client-item-info">
          <div class="client-item-name">${escapeHtml(client.name)}</div>
          <div class="client-item-phone">${escapeHtml(client.phoneNumber || '')}${client.label ? ` <span class="client-item-label">${escapeHtml(client.label)}</span>` : ''}</div>
        </div>
        <div class="client-item-actions">
          <button class="btn-icon btn-edit-client" title="Edit" data-id="${client.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-delete-client" title="Delete" data-id="${client.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

            el.addEventListener('click', (e) => {
                if (e.target.closest('.btn-edit-client') || e.target.closest('.btn-delete-client')) return;
                selectClient(client.id);
            });

            dom.clientList.appendChild(el);
        });

        dom.clientList.querySelectorAll('.btn-edit-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(btn.dataset.id);
            });
        });

        dom.clientList.querySelectorAll('.btn-delete-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteClient(btn.dataset.id);
            });
        });
    }

    function selectClient(id) {
        activeClientId = id;
        localStorage.setItem('twilio_tester_active_client', id);

        const client = clients.find(c => c.id === id);
        if (client) {
            dom.activeClientName.textContent = client.name;
            dom.smsFrom.value = client.phoneNumber || '';
            dom.welcomeState.style.display = 'none';
            dom.workspace.style.display = 'flex';
        }

        dom.clientList.querySelectorAll('.client-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });

        clearLogColumns();
        dom.webhooksList.querySelectorAll('.webhook-row').forEach(el => el.remove());
        dom.emptyWebhooks.style.display = 'flex';
        dom.sendResult.style.display = 'none';
    }

    function clearLogColumns() {
        dom.outgoingLogs.querySelectorAll('.log-card').forEach(el => el.remove());
        dom.incomingLogs.querySelectorAll('.log-card').forEach(el => el.remove());
        dom.emptyOutgoing.style.display = 'flex';
        dom.emptyIncomingLogs.style.display = 'flex';
        dom.outgoingCount.textContent = '0';
        dom.incomingLogCount.textContent = '0';
        lastLoadedMessages = [];
    }

    function openAddModal() {
        dom.modalTitle.textContent = 'Add Client';
        dom.clientForm.reset();
        dom.clientId.value = '';
        dom.clientToken.required = true;
        dom.clientToken.placeholder = 'Your Twilio Auth Token';
        dom.clientPhone.innerHTML = '<option value="">— Fetch numbers first —</option>';
        dom.verifyResult.style.display = 'none';
        dom.fetchHint.textContent = 'Enter Account SID & Auth Token above, then click Fetch';
        dom.fetchHint.style.color = '';
        dom.modalOverlay.style.display = 'flex';
        dom.clientName.focus();
    }

    function openEditModal(id) {
        const client = clients.find(c => c.id === id);
        if (!client) return;

        dom.modalTitle.textContent = 'Edit Client';
        dom.clientId.value = client.id;
        dom.clientName.value = client.name;
        dom.clientLabel.value = client.label || '';
        dom.clientSid.value = client.accountSid;
        dom.clientToken.value = client.authToken; // pre-fill from localStorage
        dom.clientToken.required = true;
        dom.clientToken.placeholder = 'Your Twilio Auth Token';

        dom.clientPhone.innerHTML = `<option value="${escapeHtml(client.phoneNumber)}">${escapeHtml(client.phoneNumber)}</option>`;
        dom.fetchHint.textContent = 'Click Fetch to reload numbers from this account';
        dom.fetchHint.style.color = '';

        dom.verifyResult.style.display = 'none';
        dom.modalOverlay.style.display = 'flex';
        dom.clientName.focus();
    }

    function closeModal() {
        dom.modalOverlay.style.display = 'none';
        dom.clientToken.placeholder = 'Your Twilio Auth Token';
        dom.clientToken.required = true;
    }

    // ===== Fetch Twilio Numbers =====
    async function fetchNumbers() {
        const sid = dom.clientSid.value.trim();
        const token = dom.clientToken.value.trim();

        if (!sid || !token) {
            showToast('Enter Account SID and Auth Token first', 'error');
            return;
        }

        try {
            dom.btnFetchNumbers.disabled = true;
            dom.btnFetchNumbers.innerHTML = '<span class="spinner"></span>';

            const data = await apiPost('/api/proxy/numbers', { accountSid: sid, authToken: token });

            if (data.success && data.numbers.length > 0) {
                const currentVal = dom.clientPhone.value;
                dom.clientPhone.innerHTML = data.numbers.map(n => {
                    const label = n.friendlyName && n.friendlyName !== n.phoneNumber
                        ? `${n.phoneNumber} (${n.friendlyName})`
                        : n.phoneNumber;
                    const smsTag = n.smsEnabled ? '' : ' [No SMS]';
                    return `<option value="${escapeHtml(n.phoneNumber)}" ${n.phoneNumber === currentVal ? 'selected' : ''}>${escapeHtml(label)}${smsTag}</option>`;
                }).join('');
                dom.fetchHint.textContent = `${data.numbers.length} number${data.numbers.length > 1 ? 's' : ''} found`;
                dom.fetchHint.style.color = 'var(--success)';
                showToast(`Found ${data.numbers.length} phone number(s)`, 'success');
            } else if (data.success) {
                dom.clientPhone.innerHTML = '<option value="">No numbers found</option>';
                dom.fetchHint.textContent = 'No phone numbers on this account';
                dom.fetchHint.style.color = 'var(--warning)';
            } else {
                showToast(data.error || 'Failed to fetch numbers', 'error');
                dom.fetchHint.textContent = data.error || 'Failed to fetch';
                dom.fetchHint.style.color = 'var(--danger)';
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            dom.btnFetchNumbers.disabled = false;
            dom.btnFetchNumbers.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        Fetch`;
        }
    }

    async function saveClient(e) {
        e.preventDefault();

        const id = dom.clientId.value;
        const name = dom.clientName.value.trim();
        const accountSid = dom.clientSid.value.trim();
        const authToken = dom.clientToken.value.trim();
        const phoneNumber = dom.clientPhone.value.trim();
        const label = dom.clientLabel.value.trim();

        if (!name || !accountSid || !authToken || !phoneNumber) {
            showToast('All fields are required', 'error');
            return;
        }

        dom.btnSaveClient.disabled = true;
        dom.btnSaveClient.innerHTML = '<span class="spinner"></span> Saving...';

        const allClients = lsGetClients();

        if (id) {
            // Update existing
            const index = allClients.findIndex(c => c.id === id);
            if (index !== -1) {
                allClients[index] = { ...allClients[index], name, accountSid, authToken, phoneNumber, label, updatedAt: new Date().toISOString() };
            }
        } else {
            // Add new
            allClients.push({
                id: crypto.randomUUID(),
                name,
                accountSid,
                authToken,
                phoneNumber,
                label,
                createdAt: new Date().toISOString()
            });
        }

        lsSaveClients(allClients);
        loadClients();

        const saved = allClients.find(c => (id ? c.id === id : c.name === name && c.accountSid === accountSid));
        if (saved) selectClient(saved.id);

        closeModal();
        showToast(id ? 'Client updated' : 'Client added', 'success');

        dom.btnSaveClient.disabled = false;
        dom.btnSaveClient.textContent = 'Save Client';
    }

    function deleteClient(id) {
        const client = clients.find(c => c.id === id);
        if (!client) return;

        if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;

        const updated = lsGetClients().filter(c => c.id !== id);
        lsSaveClients(updated);

        if (activeClientId === id) {
            activeClientId = null;
            localStorage.removeItem('twilio_tester_active_client');
            dom.activeClientName.textContent = 'No client selected';
            dom.workspace.style.display = 'none';
            dom.welcomeState.style.display = 'flex';
        }

        loadClients();
        showToast(`"${client.name}" deleted`, 'info');
    }

    async function verifyCreds() {
        const sid = dom.clientSid.value.trim();
        const token = dom.clientToken.value.trim();

        if (!sid || !token) {
            dom.verifyResult.style.display = 'block';
            dom.verifyResult.className = 'verify-result error';
            dom.verifyResult.textContent = 'Please fill in Account SID and Auth Token first';
            return;
        }

        try {
            dom.btnVerifyCreds.disabled = true;
            dom.btnVerifyCreds.innerHTML = '<span class="spinner"></span> Verifying...';

            const data = await apiPost('/api/proxy/verify', { accountSid: sid, authToken: token });

            dom.verifyResult.style.display = 'block';
            if (data.success) {
                dom.verifyResult.className = 'verify-result success';
                dom.verifyResult.textContent = `✓ Verified: ${data.account.friendlyName} (${data.account.status})`;
            } else {
                dom.verifyResult.className = 'verify-result error';
                dom.verifyResult.textContent = `✗ ${data.error}`;
            }
        } catch (err) {
            dom.verifyResult.style.display = 'block';
            dom.verifyResult.className = 'verify-result error';
            dom.verifyResult.textContent = `✗ Verification failed: ${err.message}`;
        } finally {
            dom.btnVerifyCreds.disabled = false;
            dom.btnVerifyCreds.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Verify`;
        }
    }

    // ===== Send SMS =====
    async function sendSms() {
        if (!activeClientId) {
            showToast('Select a client first', 'error');
            return;
        }

        const creds = getActiveCreds();
        if (!creds) { showToast('Client not found', 'error'); return; }

        const to = dom.smsTo.value.trim();
        const body = dom.smsBody.value.trim();

        if (!to || !body) {
            showToast('Please fill in both To number and Message', 'error');
            return;
        }

        try {
            dom.btnSendSms.disabled = true;
            dom.btnSendSms.innerHTML = '<span class="spinner"></span> Sending...';

            const data = await apiPost('/api/proxy/sms/send', {
                accountSid: creds.accountSid,
                authToken: creds.authToken,
                from: creds.phoneNumber,
                to,
                body,
            });

            dom.sendResult.style.display = 'block';
            if (data.success) {
                dom.sendResult.className = 'send-result success';
                dom.sendResult.innerHTML = `
          ✓ Message sent!<br>
          <span style="font-size:0.8rem;opacity:0.8;">
            SID: ${data.message.sid}<br>
            Status: ${data.message.status} &bull; To: ${data.message.to}
          </span>
        `;
                dom.smsBody.value = '';
                updateCharCount();
            } else {
                dom.sendResult.className = 'send-result error';
                dom.sendResult.textContent = `✗ ${data.error}`;
            }
        } catch (err) {
            dom.sendResult.style.display = 'block';
            dom.sendResult.className = 'send-result error';
            dom.sendResult.textContent = `✗ Error: ${err.message}`;
        } finally {
            dom.btnSendSms.disabled = false;
            dom.btnSendSms.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Send Message`;
        }
    }

    function updateCharCount() {
        const len = dom.smsBody.value.length;
        dom.charCount.textContent = len;
        const segments = Math.ceil(len / 160) || 0;
        dom.segmentCount.textContent = segments;
        dom.segmentPlural.textContent = segments !== 1 ? 's' : '';
    }

    // ===== Message Logs =====
    async function loadLogs() {
        if (!activeClientId) {
            showToast('Select a client first', 'error');
            return;
        }

        const creds = getActiveCreds();
        if (!creds) { showToast('Client not found', 'error'); return; }

        const limit = dom.logLimit.value || 50;

        try {
            dom.btnRefreshLogs.disabled = true;
            dom.btnRefreshLogs.innerHTML = '<span class="spinner"></span> Loading...';

            const data = await apiPost('/api/proxy/sms/logs', {
                accountSid: creds.accountSid,
                authToken: creds.authToken,
                phoneNumber: creds.phoneNumber,
                limit,
            });

            if (data.success) {
                lastLoadedMessages = [...data.outgoing, ...data.incoming];

                dom.outgoingLogs.querySelectorAll('.log-card').forEach(el => el.remove());
                dom.emptyOutgoing.style.display = data.outgoing.length === 0 ? 'flex' : 'none';
                dom.outgoingCount.textContent = data.outgoingCount;
                data.outgoing.forEach(m => dom.outgoingLogs.appendChild(createLogCard(m, 'outgoing')));

                dom.incomingLogs.querySelectorAll('.log-card').forEach(el => el.remove());
                dom.emptyIncomingLogs.style.display = data.incoming.length === 0 ? 'flex' : 'none';
                dom.incomingLogCount.textContent = data.incomingCount;
                data.incoming.forEach(m => dom.incomingLogs.appendChild(createLogCard(m, 'incoming')));

                const total = data.outgoingCount + data.incomingCount;
                showToast(`Loaded ${total} messages (${data.outgoingCount} out, ${data.incomingCount} in) for ${data.clientNumber}`, 'success');
            } else {
                showToast(data.error || 'Failed to load logs', 'error');
            }
        } catch (err) {
            showToast('Error loading logs: ' + err.message, 'error');
        } finally {
            dom.btnRefreshLogs.disabled = false;
            dom.btnRefreshLogs.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refresh`;
        }
    }

    function createLogCard(m, type) {
        const card = document.createElement('div');
        card.className = 'log-card';
        card.dataset.sid = m.sid;

        const displayPhone = type === 'outgoing' ? (m.to || '') : (m.from || '');

        card.innerHTML = `
      <div class="log-card-header">
        <span class="log-card-phone">${type === 'outgoing' ? '→' : '←'} ${escapeHtml(displayPhone)}</span>
        <span class="log-card-time">${formatDate(m.dateCreated)}</span>
      </div>
      <div class="log-card-body">${escapeHtml(m.body || '')}</div>
      <div class="log-card-footer">
        <span class="status-badge ${m.status}">${m.status || ''}</span>
        <span class="log-card-price">${m.price ? `$${Math.abs(parseFloat(m.price)).toFixed(4)}` : ''}</span>
      </div>
    `;

        card.addEventListener('click', () => openMessageDetail(m.sid));
        return card;
    }

    function openMessageDetail(sid) {
        const msg = lastLoadedMessages.find(m => m.sid === sid);
        if (!msg) return;

        dom.msgDetailContent.innerHTML = `
      <div class="msg-detail-grid">
        <div class="msg-detail-item">
          <span class="msg-detail-label">SID</span>
          <span class="msg-detail-value mono">${msg.sid}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Status</span>
          <span class="msg-detail-value"><span class="status-badge ${msg.status}">${msg.status}</span></span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Direction</span>
          <span class="msg-detail-value">${formatDirection(msg.direction)}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Segments</span>
          <span class="msg-detail-value">${msg.numSegments || '—'}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">From</span>
          <span class="msg-detail-value mono">${msg.from || '—'}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">To</span>
          <span class="msg-detail-value mono">${msg.to || '—'}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Date Created</span>
          <span class="msg-detail-value">${formatDateFull(msg.dateCreated)}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Date Sent</span>
          <span class="msg-detail-value">${formatDateFull(msg.dateSent)}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Price</span>
          <span class="msg-detail-value mono">${msg.price ? `$${Math.abs(parseFloat(msg.price)).toFixed(4)} ${msg.priceUnit || ''}` : '—'}</span>
        </div>
        <div class="msg-detail-item">
          <span class="msg-detail-label">Error</span>
          <span class="msg-detail-value">${msg.errorCode ? `${msg.errorCode}: ${msg.errorMessage}` : 'None'}</span>
        </div>
        <div class="msg-detail-item full-width">
          <span class="msg-detail-label">Body</span>
          <div class="msg-detail-value msg-detail-body">${escapeHtml(msg.body || '')}</div>
        </div>
      </div>
    `;

        dom.msgModalOverlay.style.display = 'flex';
    }

    // ===== Webhook Manager =====
    async function loadWebhooks() {
        if (!activeClientId) {
            showToast('Select a client first', 'error');
            return;
        }

        const creds = getActiveCreds();
        if (!creds) { showToast('Client not found', 'error'); return; }

        try {
            dom.btnRefreshWebhooks.disabled = true;
            dom.btnRefreshWebhooks.innerHTML = '<span class="spinner"></span> Loading...';

            const data = await apiPost('/api/proxy/numbers', {
                accountSid: creds.accountSid,
                authToken: creds.authToken,
            });

            if (data.success) {
                dom.webhooksList.querySelectorAll('.webhook-row').forEach(el => el.remove());
                dom.emptyWebhooks.style.display = data.numbers.length === 0 ? 'flex' : 'none';
                data.numbers.forEach(n => dom.webhooksList.appendChild(createWebhookRow(n, creds)));
                if (data.numbers.length > 0) showToast(`Loaded ${data.numbers.length} number(s)`, 'success');
            } else {
                showToast(data.error || 'Failed to load numbers', 'error');
            }
        } catch (err) {
            showToast('Error loading numbers: ' + err.message, 'error');
        } finally {
            dom.btnRefreshWebhooks.disabled = false;
            dom.btnRefreshWebhooks.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refresh`;
        }
    }

    function createWebhookRow(number, creds) {
        const row = document.createElement('div');
        row.className = 'webhook-row';
        row.dataset.sid = number.sid;

        row.innerHTML = `
      <div class="webhook-row-header">
        <div class="webhook-number-info">
          <span class="webhook-number">${escapeHtml(number.phoneNumber)}</span>
          ${number.friendlyName && number.friendlyName !== number.phoneNumber
            ? `<span class="webhook-friendly">${escapeHtml(number.friendlyName)}</span>`
            : ''}
          <span class="webhook-sid mono">${escapeHtml(number.sid)}</span>
        </div>
        <button class="btn btn-secondary btn-sm btn-edit-webhook">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </button>
      </div>
      <div class="webhook-urls">
        <div class="webhook-url-row">
          <span class="webhook-url-label">SMS</span>
          <span class="webhook-url-value mono" id="sms-url-display-${escapeHtml(number.sid)}">${escapeHtml(number.smsUrl || '—')}</span>
        </div>
        <div class="webhook-url-row">
          <span class="webhook-url-label">Voice</span>
          <span class="webhook-url-value mono" id="voice-url-display-${escapeHtml(number.sid)}">${escapeHtml(number.voiceUrl || '—')}</span>
        </div>
      </div>
      <div class="webhook-edit-form" id="webhook-edit-${escapeHtml(number.sid)}" style="display:none;">
        <div class="form-group">
          <label>SMS Webhook URL</label>
          <input type="url" class="input webhook-sms-input" placeholder="https://yourapp.com/sms" value="${escapeHtml(number.smsUrl || '')}">
        </div>
        <div class="form-group">
          <label>Voice Webhook URL</label>
          <input type="url" class="input webhook-voice-input" placeholder="https://yourapp.com/voice" value="${escapeHtml(number.voiceUrl || '')}">
        </div>
        <div class="webhook-edit-actions">
          <button class="btn btn-ghost btn-sm btn-cancel-webhook">Cancel</button>
          <button class="btn btn-primary btn-sm btn-save-webhook">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save Webhooks
          </button>
        </div>
      </div>
    `;

        const editForm = row.querySelector(`#webhook-edit-${number.sid}`);
        const editBtn = row.querySelector('.btn-edit-webhook');
        const cancelBtn = row.querySelector('.btn-cancel-webhook');
        const saveBtn = row.querySelector('.btn-save-webhook');

        editBtn.addEventListener('click', () => {
            const open = editForm.style.display === 'none';
            editForm.style.display = open ? 'block' : 'none';
            editBtn.innerHTML = open
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Close`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
        });

        cancelBtn.addEventListener('click', () => {
            editForm.style.display = 'none';
            editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
        });

        saveBtn.addEventListener('click', async () => {
            const smsUrl = row.querySelector('.webhook-sms-input').value.trim();
            const voiceUrl = row.querySelector('.webhook-voice-input').value.trim();

            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

                const data = await apiPut(`/api/proxy/numbers/${number.sid}/webhook`, {
                    accountSid: creds.accountSid,
                    authToken: creds.authToken,
                    smsUrl,
                    voiceUrl,
                });

                if (data.success) {
                    document.getElementById(`sms-url-display-${number.sid}`).textContent = data.number.smsUrl || '—';
                    document.getElementById(`voice-url-display-${number.sid}`).textContent = data.number.voiceUrl || '—';
                    editForm.style.display = 'none';
                    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
                    showToast('Webhooks updated successfully', 'success');
                } else {
                    showToast(data.error || 'Failed to update webhooks', 'error');
                }
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Webhooks`;
            }
        });

        return row;
    }

    // ===== Incoming Messages (SSE) =====
    function setupSSE() {
        if (eventSource) eventSource.close();

        eventSource = new EventSource('/api/sms/incoming/stream');

        eventSource.onopen = () => {
            dom.connectionStatus.classList.add('connected');
            dom.connectionStatus.querySelector('.status-text').textContent = 'Listening';
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'connected') return;
                incomingMessages.unshift(data);
                renderIncoming();
                updateIncomingCount();
                showToast(`New SMS from ${data.from}`, 'info');
            } catch (e) {
                console.error('SSE parse error:', e);
            }
        };

        eventSource.onerror = () => {
            dom.connectionStatus.classList.remove('connected');
            dom.connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
        };
    }

    function renderIncoming() {
        dom.emptyIncoming.style.display = incomingMessages.length === 0 ? 'flex' : 'none';
        dom.incomingList.querySelectorAll('.incoming-msg-card').forEach(el => el.remove());

        incomingMessages.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'incoming-msg-card';
            card.innerHTML = `
        <div class="incoming-msg-header">
          <div>
            <span class="incoming-msg-from">↓ ${escapeHtml(msg.from || 'Unknown')}</span>
            <span class="incoming-msg-to">→ ${escapeHtml(msg.to || '')}</span>
          </div>
          <span class="incoming-msg-time">${formatDate(msg.timestamp)}</span>
        </div>
        <div class="incoming-msg-body">${escapeHtml(msg.body || '')}</div>
        <div class="incoming-msg-meta">
          <span>SID: ${msg.sid || '—'}</span>
          ${msg.numMedia && msg.numMedia !== '0' ? `<span>📎 ${msg.numMedia} media</span>` : ''}
        </div>
      `;
            dom.incomingList.appendChild(card);
        });
    }

    function updateIncomingCount() {
        const count = incomingMessages.length;
        dom.incomingCount.textContent = count;
        dom.incomingCount.style.display = count > 0 ? 'inline-block' : 'none';
    }

    function updateWebhookUrl() {
        const url = `${window.location.origin}/api/sms/webhook/incoming`;
        dom.webhookUrlDisplay.textContent = url;
    }

    // ===== Tabs =====
    function switchTab(tabName) {
        dom.tabBar.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        $$('.tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `panel-${tabName}`);
        });

        if (tabName === 'logs' && activeClientId && lastLoadedMessages.length === 0) {
            loadLogs();
        }
        if (tabName === 'webhooks' && activeClientId) {
            loadWebhooks();
        }
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        dom.btnAddClient.addEventListener('click', openAddModal);
        dom.btnWelcomeAdd.addEventListener('click', openAddModal);

        dom.btnModalClose.addEventListener('click', closeModal);
        dom.btnCancelModal.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });
        dom.clientForm.addEventListener('submit', saveClient);
        dom.btnVerifyCreds.addEventListener('click', verifyCreds);
        dom.btnFetchNumbers.addEventListener('click', fetchNumbers);

        dom.btnToggleToken.addEventListener('click', () => {
            const isPassword = dom.clientToken.type === 'password';
            dom.clientToken.type = isPassword ? 'text' : 'password';
        });

        dom.tabBar.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        dom.btnSendSms.addEventListener('click', sendSms);
        dom.smsBody.addEventListener('input', updateCharCount);
        dom.smsBody.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendSms();
        });

        dom.btnRefreshLogs.addEventListener('click', loadLogs);
        dom.btnRefreshWebhooks.addEventListener('click', loadWebhooks);

        dom.btnCopyWebhook.addEventListener('click', () => {
            const url = `${window.location.origin}/api/sms/webhook/incoming`;
            navigator.clipboard.writeText(url).then(() => {
                showToast('Webhook URL copied!', 'success');
            }).catch(() => {
                const el = document.createElement('textarea');
                el.value = url;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                showToast('Webhook URL copied!', 'success');
            });
        });

        dom.btnClearIncoming.addEventListener('click', () => {
            incomingMessages.length = 0;
            renderIncoming();
            updateIncomingCount();
        });

        dom.btnMsgModalClose.addEventListener('click', () => {
            dom.msgModalOverlay.style.display = 'none';
        });
        dom.msgModalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.msgModalOverlay) dom.msgModalOverlay.style.display = 'none';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                dom.msgModalOverlay.style.display = 'none';
            }
        });
    }

    // ===== Utilities =====
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDirection(dir) {
        if (!dir) return '—';
        const map = {
            'outbound-api': '↑ Outbound (API)',
            'outbound-reply': '↑ Outbound (Reply)',
            'inbound': '↓ Inbound',
        };
        return map[dir] || dir;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateFull(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString();
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ===== Boot =====
    document.addEventListener('DOMContentLoaded', init);
})();
