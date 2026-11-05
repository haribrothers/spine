---
title: Email
description: Send quotes, invoices, reminders and invitations from your own mail server.
sidebar:
  order: 3
---

Spine sends quotes, invoices, statements, receipts, reminders, invitations, password resets and notifications by email through any SMTP service: your mail provider, Amazon SES, Postmark, Mailgun, Brevo, or your own server.

## Set it up

Add your SMTP details to `.env`, then restart (`docker compose --profile minimal up -d`):

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=spine@example.com
SMTP_PASSWORD=…
SMTP_FROM="Harbour Builders <accounts@example.com>"
```

`SMTP_FROM` is the sender your customers see. Use an address on a domain whose SPF and DKIM records allow that service to send for it, or your emails will land in spam.

## Without email settings

Nothing fails. Documents still issue, and every email waits in the queue; Spine sends them once the settings are in place. The **Set up Spine** page shows the Email sending card as not done.

## Check what was sent

Owners open **Settings › Team › Email log**: every email Spine sent or tried to send, with when, to whom, the subject, the record it's about, its status (queued, sent, retrying or failed, with the error) and the attempts. **Retry now** on a row sends a failed one again.

:::tip
An email that keeps failing with "authentication failed" or "connection refused" is almost always the port or the password: port `587` uses STARTTLS, `465` uses TLS from the start.
:::
