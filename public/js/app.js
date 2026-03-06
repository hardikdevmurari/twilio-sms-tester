// ===== Twilio SMS Tester — Frontend App =====
(function () {
    'use strict';

    const API = '';
    let activeClientId = null;
    let clients = [];
    let incomingMessages = [];
    let eventSource = null;

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

        // Logs
        logDirectionFilter: $('#log-direction-filter'),
        logLimit: $('#log-limit'),
        btnRefreshLogs: $('#btn-refresh-logs'),
        logsTableContainer: $('#logs-table-container'),
        logsTable: $('#logs-table'),
        logsTableBody: $('#logs-table-body'),
        emptyLogs: $('#empty-logs'),

        // Incoming
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
        await loadClients();

        // Restore active client
        const savedId = localStorage.getItem('twilio_tester_active_client');
        if (savedId && clients.find(c => c.id === savedId)) {
            selectClient(savedId);
        }
    }

    // ===== API Helpers =====
    async function apiGet(url) {
        const res = await fetch(API + url);
        return res.json();
    }

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

    async function apiDelete(url) {
        const res = await fetch(API + url, { method: 'DELETE' });
        return res.json();
    }

    // ===== Clients =====
    async function loadClients() {
        try {
            const data = await apiGet('/api/clients');
            if (data.success) {
                clients = data.clients;
                renderClientList();
            }
        } catch (err) {
            showToast('Failed to load clients', 'error');
        }
    }

    function renderClientList() {
        if (clients.length === 0) {
            dom.emptyClients.style.display = 'flex';
            // Remove any client items but keep empty state
            dom.clientList.querySelectorAll('.client-item').forEach(el => el.remove());
            return;
        }

        dom.emptyClients.style.display = 'none';
        // Remove existing items
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
          <div class="client-item-phone">${escapeHtml(client.phoneNumber || '')}</div>
        </div>
        ${client.label ? `<span class="client-item-label">${escapeHtml(client.label)}</span>` : ''}
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

        // Attach edit/delete
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

        // Update sidebar active state
        dom.clientList.querySelectorAll('.client-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });

        // Clear previous state
        dom.logsTableBody.innerHTML = '';
        dom.logsTable.style.display = 'none';
        dom.emptyLogs.style.display = 'flex';
        dom.sendResult.style.display = 'none';
    }

    function openAddModal() {
        dom.modalTitle.textContent = 'Add Client';
        dom.clientForm.reset();
        dom.clientId.value = '';
        dom.verifyResult.style.display = 'none';
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
        dom.clientToken.value = ''; // Don't pre-fill token
        dom.clientToken.placeholder = 'Leave empty to keep current token';
        dom.clientToken.required = false;
        dom.clientPhone.value = client.phoneNumber;
        dom.verifyResult.style.display = 'none';
        dom.modalOverlay.style.display = 'flex';
        dom.clientName.focus();
    }

    function closeModal() {
        dom.modalOverlay.style.display = 'none';
        dom.clientToken.placeholder = 'Your Twilio Auth Token';
        dom.clientToken.required = true;
    }

    async function saveClient(e) {
        e.preventDefault();

        const id = dom.clientId.value;
        const payload = {
            name: dom.clientName.value,
            accountSid: dom.clientSid.value,
            phoneNumber: dom.clientPhone.value,
            label: dom.clientLabel.value,
        };

        // Only include token if provided
        if (dom.clientToken.value) {
            payload.authToken = dom.clientToken.value;
        }

        try {
            dom.btnSaveClient.disabled = true;
            dom.btnSaveClient.innerHTML = '<span class="spinner"></span> Saving...';

            let data;
            if (id) {
                data = await apiPut(`/api/clients/${id}`, payload);
            } else {
                if (!dom.clientToken.value) {
                    showToast('Auth Token is required for new clients', 'error');
                    return;
                }
                data = await apiPost('/api/clients', payload);
            }

            if (data.success) {
                closeModal();
                await loadClients();
                if (!activeClientId && data.client) {
                    selectClient(data.client.id);
                }
                showToast(id ? 'Client updated' : 'Client added', 'success');
            } else {
                showToast(data.error || 'Failed to save', 'error');
            }
        } catch (err) {
            showToast('Error saving client: ' + err.message, 'error');
        } finally {
            dom.btnSaveClient.disabled = false;
            dom.btnSaveClient.textContent = 'Save Client';
        }
    }

    async function deleteClient(id) {
        const client = clients.find(c => c.id === id);
        if (!client) return;

        if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;

        try {
            const data = await apiDelete(`/api/clients/${id}`);
            if (data.success) {
                if (activeClientId === id) {
                    activeClientId = null;
                    localStorage.removeItem('twilio_tester_active_client');
                    dom.activeClientName.textContent = 'No client selected';
                    dom.workspace.style.display = 'none';
                    dom.welcomeState.style.display = 'flex';
                }
                await loadClients();
                showToast(`"${client.name}" deleted`, 'info');
            }
        } catch (err) {
            showToast('Error deleting client', 'error');
        }
    }

    async function verifyCreds() {
        const sid = dom.clientSid.value;
        const token = dom.clientToken.value;
        const id = dom.clientId.value;

        // For verifying, we need either a saved client or SID+token
        if (!id && (!sid || !token)) {
            dom.verifyResult.style.display = 'block';
            dom.verifyResult.className = 'verify-result error';
            dom.verifyResult.textContent = 'Please fill in Account SID and Auth Token first';
            return;
        }

        // If editing and no new token, verify using saved client
        if (id && !token) {
            try {
                dom.btnVerifyCreds.disabled = true;
                dom.btnVerifyCreds.innerHTML = '<span class="spinner"></span> Verifying...';

                const data = await apiPost(`/api/clients/${id}/verify`, {});
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
            return;
        }

        // For new clients, we need to save first then verify
        // Just show a hint
        dom.verifyResult.style.display = 'block';
        dom.verifyResult.className = 'verify-result info';
        dom.verifyResult.style.background = 'var(--info-bg)';
        dom.verifyResult.style.borderColor = 'rgba(59, 130, 246, 0.2)';
        dom.verifyResult.style.color = 'var(--info)';
        dom.verifyResult.textContent = 'Save the client first, then use Verify to check credentials.';
    }

    // ===== Send SMS =====
    async function sendSms() {
        if (!activeClientId) {
            showToast('Select a client first', 'error');
            return;
        }

        const to = dom.smsTo.value.trim();
        const body = dom.smsBody.value.trim();

        if (!to || !body) {
            showToast('Please fill in both To number and Message', 'error');
            return;
        }

        try {
            dom.btnSendSms.disabled = true;
            dom.btnSendSms.innerHTML = '<span class="spinner"></span> Sending...';

            const data = await apiPost('/api/sms/send', {
                clientId: activeClientId,
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
                // Clear body after successful send
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

        const limit = dom.logLimit.value || 50;

        try {
            dom.btnRefreshLogs.disabled = true;
            dom.btnRefreshLogs.innerHTML = '<span class="spinner"></span> Loading...';

            const data = await apiGet(`/api/sms/logs/${activeClientId}?limit=${limit}`);

            if (data.success && data.messages.length > 0) {
                dom.emptyLogs.style.display = 'none';
                dom.logsTable.style.display = 'table';

                const dirFilter = dom.logDirectionFilter.value;
                let msgs = data.messages;
                if (dirFilter) {
                    msgs = msgs.filter(m => m.direction === dirFilter);
                }

                dom.logsTableBody.innerHTML = msgs.map(m => `
          <tr data-sid="${m.sid}" title="Click for details">
            <td><span class="direction-badge ${m.direction?.includes('outbound') ? 'outbound' : 'inbound'}">${formatDirection(m.direction)}</span></td>
            <td class="col-phone">${escapeHtml(m.from || '')}</td>
            <td class="col-phone">${escapeHtml(m.to || '')}</td>
            <td class="col-body">${escapeHtml(m.body || '')}</td>
            <td><span class="status-badge ${m.status}">${m.status || ''}</span></td>
            <td class="col-date">${formatDate(m.dateCreated)}</td>
            <td class="col-price">${m.price ? `$${Math.abs(parseFloat(m.price)).toFixed(4)}` : '—'}</td>
          </tr>
        `).join('');

                // Click handler for rows
                dom.logsTableBody.querySelectorAll('tr').forEach(row => {
                    row.addEventListener('click', () => openMessageDetail(row.dataset.sid, data.messages));
                });

                showToast(`Loaded ${msgs.length} messages`, 'success');
            } else if (data.success) {
                dom.emptyLogs.style.display = 'flex';
                dom.logsTable.style.display = 'none';
                showToast('No messages found', 'info');
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

    function openMessageDetail(sid, messages) {
        const msg = messages.find(m => m.sid === sid);
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
          <span class="msg-detail-value"><span class="direction-badge ${msg.direction?.includes('outbound') ? 'outbound' : 'inbound'}">${formatDirection(msg.direction)}</span></span>
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

    // ===== Incoming Messages (SSE) =====
    function setupSSE() {
        if (eventSource) {
            eventSource.close();
        }

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

        // Remove existing cards (don't remove empty state)
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

        // Auto-load logs when switching to logs tab
        if (tabName === 'logs' && activeClientId && dom.logsTableBody.innerHTML === '') {
            loadLogs();
        }
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Add client buttons
        dom.btnAddClient.addEventListener('click', openAddModal);
        dom.btnWelcomeAdd.addEventListener('click', openAddModal);

        // Modal
        dom.btnModalClose.addEventListener('click', closeModal);
        dom.btnCancelModal.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });
        dom.clientForm.addEventListener('submit', saveClient);
        dom.btnVerifyCreds.addEventListener('click', verifyCreds);

        // Token toggle
        dom.btnToggleToken.addEventListener('click', () => {
            const isPassword = dom.clientToken.type === 'password';
            dom.clientToken.type = isPassword ? 'text' : 'password';
        });

        // Tabs
        dom.tabBar.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Send SMS
        dom.btnSendSms.addEventListener('click', sendSms);
        dom.smsBody.addEventListener('input', updateCharCount);

        // Enter to send (Ctrl+Enter or Cmd+Enter)
        dom.smsBody.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                sendSms();
            }
        });

        // Logs
        dom.btnRefreshLogs.addEventListener('click', loadLogs);
        dom.logDirectionFilter.addEventListener('change', () => {
            if (dom.logsTableBody.innerHTML) loadLogs();
        });

        // Incoming
        dom.btnCopyWebhook.addEventListener('click', () => {
            const url = `${window.location.origin}/api/sms/webhook/incoming`;
            navigator.clipboard.writeText(url).then(() => {
                showToast('Webhook URL copied!', 'success');
            }).catch(() => {
                // Fallback
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

        // Message detail modal
        dom.btnMsgModalClose.addEventListener('click', () => {
            dom.msgModalOverlay.style.display = 'none';
        });
        dom.msgModalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.msgModalOverlay) dom.msgModalOverlay.style.display = 'none';
        });

        // Keyboard shortcuts
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
            'outbound-api': '↑ API',
            'outbound-reply': '↑ Reply',
            'inbound': '↓ Inbound',
        };
        return map[dir] || dir;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();

        if (isToday) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateFull(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleString();
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
