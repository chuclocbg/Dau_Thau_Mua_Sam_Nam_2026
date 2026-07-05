# Module: Notification Service

**Status:** PLANNED — Phase L (after Phase J, parallel with K)
**Location:** `src/notification/` (to be created)
**Tests:** ~390 (planned)

---

## Purpose

Manages notifications across channels (email, SMS, in-app, push).
Template-driven. Retry queue with exponential backoff.
Domain events from frozen modules trigger notifications via integration bridge.
New modules (Phase N+) emit DomainEvent objects that NotificationTrigger subscribes to.

---

## Planned Public API

```typescript
Notification {
  id, channel: NotificationChannel,
  recipientId: string,           // userId or address
  templateId, params,
  priority: 'HIGH' | 'NORMAL' | 'LOW',
  status: NotificationStatus,
  attempts, maxAttempts,
  nextRetryAt?, sentAt?, error?,
  createdAt, scheduledFor?
}

NotificationTemplate {
  templateId, channel,
  subject?: string,              // EMAIL only
  bodyTemplate: string,          // Handlebars/mustache
  requiredParams: string[]
}

// INotificationChannel interface
isAvailable(): boolean
send(notification, template): Promise<SendResult>
// Implementations: SmtpEmailChannel, SmsChannel, InternalChannel, WebPushChannel
```

---

## Retry Policy

```
maxAttempts: 5
Delays: immediate → 30s → 60s → 120s → 240s
After 5 failures: status = FAILED, alert ops
```

---

## Domain Event → Notification Mapping (frozen module triggers)

| Event | Channels |
|-------|---------|
| Approval request created | INTERNAL + EMAIL to approver |
| Contract signed | EMAIL to contractor |
| Tender published | EMAIL + INTERNAL to registered suppliers |
| Bid evaluation complete | EMAIL + INTERNAL to all bidders |
| Payment approved | EMAIL to treasury |

---

## Dependencies

- `src/auth/` — notifications link to `userId`

---

## Design Reference

Full type definitions: `.memory/infra-architecture.md`
