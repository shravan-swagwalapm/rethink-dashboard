# Notification System - Integration & Deployment Guide

## 🎯 Quick Start

### Step 1: Run Database Migration

**The corrected migration script is now in your clipboard!**

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste the migration script (already in clipboard)
4. Click "Run" (or press Cmd+Enter)
5. Wait for success message

**What it does:**
- ✅ Drops any existing notification tables (clean slate)
- ✅ Creates 8 new tables with proper relationships
- ✅ Sets up Row Level Security (admin-only access)
- ✅ Creates indexes for performance
- ✅ Adds 3 sample templates
- ✅ Sets up auto-updating timestamps

### Step 2: Verify Installation

Run this query in Supabase SQL Editor:

```sql
-- Check all tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'notification%'
       OR table_name LIKE 'contact%'
       OR table_name LIKE 'campaign%')
ORDER BY table_name;
```

**Expected result:** 8 tables
- campaign_enrollments
- contact_lists
- contacts
- notification_campaigns
- notification_jobs
- notification_logs
- notification_rules
- notification_templates

### Step 3: Configure Environment Variables

Add these to your `.env.local`:

```bash
# Email Delivery (Resend.com)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=notifications@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com

# Cron Job Security
CRON_SECRET=your_random_secret_here
```

**Get Resend API Key:**
1. Go to https://resend.com
2. Sign up / Log in
3. Go to API Keys → Create API Key
4. Add your sending domain (verify DNS records)
5. Copy the API key

### Step 4: Deploy to Production

```bash
# Build and deploy
npm run build
vercel deploy --prod

# Or push to GitHub (auto-deploys)
git add .
git commit -m "Add notification system"
git push origin main
```

**After deployment:**
1. Add environment variables in Vercel Dashboard
2. Verify cron job is running (Vercel → Settings → Cron Jobs)

---

## 🔌 External Integration Guide

### Integration Options

The notification system can be triggered from:
1. **Internal UI** - Manual sending via dashboard
2. **API Endpoints** - Programmatic access
3. **Webhooks** - External tool triggers (Zapier, Make, n8n)
4. **Scheduled Rules** - Recurring notifications
5. **Event-Based** - Trigger on user actions

---

## 📡 API Reference for External Tools

### Base URL
```
Production: https://your-domain.vercel.app
Development: http://localhost:3000
```

### Authentication
All API requests require admin authentication via Supabase JWT token.

```bash
# Get auth token
curl -X POST 'https://your-supabase-url/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Use the `access_token` from response in subsequent requests.

---

### API 1: Send Notification

**Send a notification immediately to specific recipients**

```http
POST /api/admin/notifications/compose
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "template_id": "uuid-of-template",
  "recipients": {
    "type": "email_list",
    "emails": ["user1@example.com", "user2@example.com"]
  },
  "variables": {
    "name": "John",
    "cohort_name": "PM Masterclass",
    "start_date": "Feb 1, 2026"
  },
  "priority": "high",
  "send_at": "2026-02-01T09:00:00Z"
}
```

**Recipient Types:**
- `cohorts` - Send to all users in cohorts
  ```json
  {
    "type": "cohorts",
    "cohort_ids": ["uuid1", "uuid2"]
  }
  ```
- `users` - Send to specific users
  ```json
  {
    "type": "users",
    "user_ids": ["uuid1", "uuid2"]
  }
  ```
- `contacts` - Send to contact lists
  ```json
  {
    "type": "contacts",
    "contact_list_ids": ["uuid1"]
  }
  ```
- `email_list` - Send to manual emails
  ```json
  {
    "type": "email_list",
    "emails": ["email1@test.com", "email2@test.com"]
  }
  ```

**Response:**
```json
{
  "data": {
    "job_id": "uuid",
    "recipient_count": 150,
    "scheduled_for": "2026-02-01T09:00:00Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.vercel.app/api/admin/notifications/compose \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "template-uuid",
    "recipients": {
      "type": "email_list",
      "emails": ["test@example.com"]
    },
    "variables": {
      "name": "John",
      "cohort_name": "Product Management"
    }
  }'
```

---

### API 2: List Templates

**Get all available notification templates**

```http
GET /api/admin/notifications/templates
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Welcome Email",
      "description": "Welcome new users",
      "channel": "email",
      "variables": [
        {"name": "name", "example": "John Doe"},
        {"name": "cohort_name", "example": "PM 101"}
      ]
    }
  ]
}
```

---

### API 3: Create Template

**Create a new notification template**

```http
POST /api/admin/notifications/templates
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Custom Welcome",
  "description": "Custom welcome email",
  "channel": "email",
  "subject": "Welcome {{name}}!",
  "body": "<h1>Hello {{name}}</h1><p>Welcome to {{cohort_name}}</p>",
  "variables": [
    {"name": "name", "example": "John"},
    {"name": "cohort_name", "example": "Course Name"}
  ]
}
```

---

### API 4: Import Contacts

**Bulk import contacts via CSV**

```http
PUT /api/admin/notifications/contacts/import
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "list_id": "contact-list-uuid",
  "contacts": [
    {
      "email": "user1@example.com",
      "name": "User One",
      "phone": "+1234567890"
    },
    {
      "email": "user2@example.com",
      "name": "User Two"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "imported": 150,
    "failed": 2,
    "skipped_duplicates": 5,
    "total": 157
  }
}
```

---

### API 5: Get Analytics

**Fetch notification analytics**

```http
GET /api/admin/notifications/analytics?from=2026-01-01&to=2026-01-31
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "data": {
    "total_sent": 1523,
    "delivered": 1450,
    "failed": 73,
    "opened": 890,
    "clicked": 234,
    "delivery_rate": 95.2,
    "open_rate": 61.4,
    "click_rate": 16.1
  }
}
```

---

## 🔗 Integration Examples

### Zapier Integration

**Use Case:** Send notification when new Stripe payment received

1. **Trigger:** Stripe - New Payment
2. **Action:** Webhooks by Zapier - POST Request

**Configuration:**
- URL: `https://your-domain.vercel.app/api/admin/notifications/compose`
- Method: `POST`
- Headers:
  ```
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
  ```
- Body:
  ```json
  {
    "template_id": "payment-receipt-template-uuid",
    "recipients": {
      "type": "email_list",
      "emails": ["{{customer_email}}"]
    },
    "variables": {
      "name": "{{customer_name}}",
      "amount": "{{amount}}",
      "date": "{{created}}"
    }
  }
  ```

---

### Make.com (Integromat) Integration

**Use Case:** Send welcome email when new user added to Airtable

**Scenario:**
1. **Watch Records** (Airtable) → Trigger on new user
2. **HTTP Request** (Make) → Send notification

**HTTP Module Configuration:**
```
URL: https://your-domain.vercel.app/api/admin/notifications/compose
Method: POST
Headers:
  Authorization: Bearer {{YOUR_JWT_TOKEN}}
  Content-Type: application/json
Body:
{
  "template_id": "{{welcome_template_id}}",
  "recipients": {
    "type": "email_list",
    "emails": ["{{user_email}}"]
  },
  "variables": {
    "name": "{{user_name}}",
    "signup_date": "{{created_time}}"
  }
}
```

---

### n8n Integration

**Use Case:** Drip campaign via scheduled webhook

**Workflow:**
1. **Schedule Trigger** - Daily at 9 AM
2. **HTTP Request** - Fetch users from database
3. **HTTP Request** - Send notifications

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "https://your-domain.vercel.app/api/admin/notifications/compose",
  "authentication": "headerAuth",
  "headerAuth": {
    "name": "Authorization",
    "value": "Bearer YOUR_JWT_TOKEN"
  },
  "body": {
    "template_id": "{{ $json.templateId }}",
    "recipients": {
      "type": "email_list",
      "emails": "{{ $json.emails }}"
    },
    "variables": {
      "name": "{{ $json.userName }}",
      "content": "{{ $json.dynamicContent }}"
    }
  }
}
```

---

### Custom Webhook Integration

**Use Case:** Trigger notification from your backend

**Node.js Example:**
```javascript
const axios = require('axios');

async function sendNotification(recipientEmail, userName) {
  try {
    const response = await axios.post(
      'https://your-domain.vercel.app/api/admin/notifications/compose',
      {
        template_id: 'your-template-uuid',
        recipients: {
          type: 'email_list',
          emails: [recipientEmail]
        },
        variables: {
          name: userName,
          custom_field: 'value'
        },
        priority: 'high'
      },
      {
        headers: {
          'Authorization': `Bearer ${YOUR_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Notification queued:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to send notification:', error.response?.data);
    throw error;
  }
}

// Usage
sendNotification('user@example.com', 'John Doe');
```

**Python Example:**
```python
import requests

def send_notification(recipient_email, user_name):
    url = "https://your-domain.vercel.app/api/admin/notifications/compose"
    headers = {
        "Authorization": f"Bearer {YOUR_JWT_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "template_id": "your-template-uuid",
        "recipients": {
            "type": "email_list",
            "emails": [recipient_email]
        },
        "variables": {
            "name": user_name,
            "custom_field": "value"
        }
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

# Usage
send_notification("user@example.com", "John Doe")
```

---

## 🔐 Security Best Practices

### 1. JWT Token Management
- **Never** commit JWT tokens to git
- Store tokens in environment variables
- Rotate tokens regularly
- Use short-lived tokens with refresh mechanism

### 2. API Rate Limiting
Current limits:
- Compose endpoint: 10 requests/minute per admin
- Email sending: 1200 emails/hour (Vercel Cron limit)

### 3. Webhook Security
For incoming webhooks, add signature verification:

```javascript
// Example: Verify webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}
```

---

## 📊 Monitoring & Debugging

### Check Notification Status

**Query notification jobs:**
```sql
SELECT
  id,
  status,
  scheduled_for,
  sent_at,
  error_message,
  recipient_count
FROM notification_jobs
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

**Query delivery logs:**
```sql
SELECT
  nl.event_type,
  nl.recipient_email,
  nl.created_at,
  nj.status as job_status
FROM notification_logs nl
JOIN notification_jobs nj ON nj.id = nl.job_id
WHERE nl.created_at > NOW() - INTERVAL '1 day'
ORDER BY nl.created_at DESC;
```

### Common Issues

**Issue:** Emails not sending
**Solution:**
1. Check Resend API key is valid
2. Verify domain is verified in Resend
3. Check cron job logs in Vercel
4. Verify `notification_jobs.status = 'pending'`

**Issue:** Cron not running
**Solution:**
1. Verify `CRON_SECRET` env var is set
2. Check Vercel cron job is enabled
3. View logs: Vercel Dashboard → Functions → Logs

**Issue:** Variables not substituting
**Solution:**
1. Verify variable names match exactly (case-sensitive)
2. Check template has variables defined
3. Ensure variables passed in compose request

---

## 🚀 Advanced Features

### Scheduled Notifications

Send notification at specific time:

```json
{
  "template_id": "uuid",
  "recipients": {...},
  "variables": {...},
  "send_at": "2026-02-01T09:00:00Z"
}
```

### Priority Levels

Control sending order:

```json
{
  "priority": "high"  // Options: "high", "normal", "low"
}
```

High priority = processed first in queue

### Bulk Operations

Send to multiple recipient types:

```json
{
  "recipients": {
    "type": "cohorts",
    "cohort_ids": ["uuid1", "uuid2"],
    "user_ids": ["uuid3"],
    "emails": ["extra@email.com"]
  }
}
```

---

## 📈 Performance Optimization

### Best Practices

1. **Batch Recipients:** Send to lists instead of individual emails
2. **Template Reuse:** Create reusable templates for common notifications
3. **Schedule Off-Peak:** Schedule bulk sends during low-traffic hours
4. **Monitor Analytics:** Track delivery rates and adjust accordingly

### Scaling Considerations

Current limits:
- **Queue Processing:** 10 jobs per 5 minutes
- **Batch Size:** 100 recipients per job
- **Hourly Limit:** ~1200 emails/hour

To scale beyond:
1. Adjust cron frequency (e.g., every 2 minutes)
2. Increase batch size in cron processor
3. Add multiple cron jobs
4. Consider dedicated email service (SendGrid, AWS SES)

---

## ✅ Testing Checklist

Before going live:

- [ ] Migration script runs successfully
- [ ] 3 sample templates visible in dashboard
- [ ] Can create new template
- [ ] Can send test email to yourself
- [ ] Email arrives within 5 minutes
- [ ] Delivery shows in Logs tab
- [ ] Analytics reflect test send
- [ ] External API call works (use Postman)
- [ ] Scheduled notification works (schedule 5 min ahead)
- [ ] CSV import works with sample data

---

## 🆘 Support

**Documentation:**
- Resend Docs: https://resend.com/docs
- Supabase Docs: https://supabase.com/docs
- Vercel Cron: https://vercel.com/docs/cron-jobs

**Common Commands:**
```bash
# Test cron locally (won't send actual emails in dev)
curl -X GET http://localhost:3000/api/cron/process-notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check build
npm run build

# Deploy
vercel --prod
```

---

## 🎉 You're Ready!

Your notification system is now fully integrated and ready to connect with external tools. Use the API endpoints above to trigger notifications from Zapier, Make, n8n, or any custom webhook.

**Next Steps:**
1. ✅ Run the migration script (in clipboard)
2. ✅ Configure environment variables
3. ✅ Test with a simple notification
4. ✅ Set up your first external integration
5. ✅ Monitor delivery in Analytics tab

Happy sending! 🚀
