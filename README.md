# Twilio SMS Tester

A developer tool for testing and managing Twilio SMS across multiple client accounts — without touching the Twilio dashboard.

**Live:** [https://twilio-sms-tester.onrender.com](https://twilio-sms-tester.onrender.com)

---

## Why?

When building SMS features for clients, testing is painful:
- Switching between Twilio accounts to check logs
- Using the "Try SMS" dashboard page to send test messages
- Digging through the console to find specific messages
- Going back to configure webhooks every time

**This tool puts everything in one place.**

## Features

| Feature | Description |
|---|---|
| **Multi-Client** | Add multiple Twilio accounts, switch between them in one click |
| **Send SMS** | Compose and send messages from your Twilio number |
| **Message Logs** | Split-view outgoing/incoming history with full message details |
| **Webhook Manager** | View and update SMS & Voice webhook URLs per phone number |
| **Incoming SMS** | Real-time incoming feed via webhook + SSE |
| **No server storage** | Credentials stay in your browser's localStorage only |

## Run locally

### Prerequisites
- [Node.js](https://nodejs.org/) v16+
- A [Twilio](https://www.twilio.com/) account

```bash
git clone https://github.com/hardikdevmurari/twilio-sms-tester.git
cd twilio-sms-tester
npm install
npm start
# → http://localhost:3456
```

No `.env` required. Optionally set `PORT` to change the port.

## Usage

### Add a client
Click **+** → enter Account SID, Auth Token, and phone number → **Save**.
Credentials are stored only in your browser's `localStorage` — nothing is saved on the server.

### Send SMS
Select a client → **Send SMS** tab → enter destination number and message → **Send**.

### Message Logs
Select a client → **Message Logs** tab → click **Refresh** to pull from Twilio API.
Click any row for full details (SID, price, direction, error codes).

### Webhook Manager
Select a client → **Webhooks** tab → see all phone numbers with their current SMS and Voice webhook URLs → click **Edit** to update.

### Incoming SMS (real-time)
The app listens for incoming messages via Twilio webhook + SSE.

Set your Twilio number's SMS webhook to:
```
https://twilio-sms-tester.onrender.com/api/sms/webhook/incoming
```

Or if running locally, expose your port with [ngrok](https://ngrok.com):
```bash
ngrok http 3456
# then set: https://<your-id>.ngrok.io/api/sms/webhook/incoming
```

## How it works

The server is a **stateless Twilio proxy** — credentials are passed with each request and used to call the Twilio API, but never stored on the server. All client data lives in your browser's `localStorage`.

## Project Structure

```
twilio-sms-tester/
├── server.js              # Express server
├── routes/
│   ├── proxy.js           # Stateless Twilio proxy (send, logs, numbers, webhooks)
│   └── sms.js             # Incoming webhook receiver + SSE stream
├── public/
│   ├── index.html         # Single-page app
│   ├── css/style.css      # Dark theme UI
│   └── js/app.js          # Frontend logic (localStorage client storage)
└── package.json
```

## API

### Proxy (stateless — credentials in request body)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/proxy/verify` | Verify Twilio credentials |
| `POST` | `/api/proxy/numbers` | List phone numbers with webhook URLs |
| `PUT` | `/api/proxy/numbers/:sid/webhook` | Update SMS/Voice webhooks |
| `POST` | `/api/proxy/sms/send` | Send an SMS |
| `POST` | `/api/proxy/sms/logs` | Fetch message logs |

### Incoming SMS
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sms/webhook/incoming` | Twilio webhook for incoming SMS |
| `GET` | `/api/sms/incoming/stream` | SSE stream for real-time messages |

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML/CSS/JS (SPA)
- **Real-time:** Server-Sent Events (SSE)
- **Twilio SDK:** [twilio-node](https://github.com/twilio/twilio-node) v5
- **Hosting:** Render

## License

MIT
