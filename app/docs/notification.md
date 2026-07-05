# Notification Module (Phase L)

Provider-independent notification infrastructure: template rendering, multi-channel delivery,
scheduling (immediate/scheduled/delayed/recurring/bulk/event-driven), retry with backoff, and
an append-only audit trail. Business modules (Workflow, Approval, Contract, Acceptance, Payment)
never know which provider — or even which channel — ultimately delivers a message.

---

## ER Diagram

```
Notification (central entity)
  ├─ id, templateCode, subject, body        ← rendered, not raw template
  ├─ priority: Priority                     LOW | NORMAL | HIGH | CRITICAL
  ├─ mode: NotificationMode                 IMMEDIATE | SCHEDULED | DELAYED | RECURRING | BULK | EVENT_DRIVEN
  ├─ channels: ChannelType[]                derived from recipients at creation
  ├─ variables: Record<string,string>       template variables used to render
  ├─ moduleType?, moduleId?                 originating business entity (never a hard FK)
  ├─ scheduleTime?: ScheduleTime            for SCHEDULED / DELAYED / RECURRING
  ├─ batchId?, ruleId?                      set when created via BatchService / EventRuleService
  └─ status: DeliveryStatus                 aggregate — DELIVERED only once every recipient is DELIVERED

NotificationRecipient
  ├─ notificationId → Notification
  ├─ userId, address                        address is channel-appropriate (email/phone/token/URL)
  ├─ channelType: ChannelType
  └─ status: DeliveryStatus

NotificationDelivery (one row per attempt)
  ├─ notificationId, recipientId
  ├─ channelType, providerType              providerType is opaque to business logic
  ├─ attempt: number                        1, 2, 3, ... up to RetryPolicy.maxAttempts
  ├─ status, sentAt?, deliveredAt?, failedAt?, failureReason?, providerMessageId?

NotificationTemplate
  ├─ code, name, subjectTemplate, bodyTemplate
  ├─ requiredVariables: string[]
  ├─ channels: ChannelType[]                declared supported channels
  └─ legalBasis: LegalBasis[]               non-empty only for legally-mandated notices

NotificationChannel (routing configuration)
  ├─ channelType, providerType, isEnabled, priority
  └─ config: Record<string,string>          provider-neutral opaque key/value

NotificationBatch
  ├─ name, templateCode
  └─ totalCount, queuedCount, sentCount, failedCount, status

NotificationPreference
  ├─ userId, channelType, isOptedIn
  └─ quietHoursStart?, quietHoursEnd?        recorded; not yet enforced in dispatch (see Retry & Scheduling)

NotificationRule (event-driven trigger)
  ├─ eventType, templateCode, channels, priority
  └─ conditions: Record<string,string>       AND-matched against NotificationEvent.payload

NotificationEvent (inbound, from notificationIntegration.ts only)
  ├─ eventType, sourceModule, sourceId
  ├─ payload: Record<string,string>
  └─ occurredAt, processedAt?

NotificationAuditEvent (append-only, no update/delete)
  ├─ eventType: 15 types (CREATED, QUEUED, SENT, DELIVERED, FAILED, EXPIRED, CANCELLED, RETRIED, ...)
  ├─ notificationId?, recipientId?, deliveryId?, batchId?, ruleId?
  └─ userId, outcome, reason?, occurredAt
```

---

## State Machine

### Notification.status / NotificationRecipient.status / NotificationDelivery.status

All three share the same `DeliveryStatus` vocabulary, but at different granularity: a
`Notification` is an aggregate over its recipients, a `NotificationRecipient` is aggregate over
its (possibly retried) deliveries, and a `NotificationDelivery` is one concrete attempt.

```
        ┌────────────────────────────────────────────┐
        │                                            │
 QUEUED ──► (provider.send) ──► SENT ──► DELIVERED    │
   │                              │                   │
   │                              ▼                   │
   ├──────────────────────────► FAILED ──► RETRIED ──► (new delivery, attempt+1) ──► QUEUED
   │                              │
   │                              ▼ (attempt >= maxAttempts)
   │                       RETRY_LIMIT_EXCEEDED (thrown, delivery stays FAILED)
   │
   └──► CANCELLED (via cancelNotification, only while QUEUED)

RECURRING notification, after a cycle completes:
   next cycle due → recipients reset to QUEUED → new NotificationDelivery per recipient
   recurrence exhausted (endsAt / occurrenceCount) → Notification.status = EXPIRED
```

Terminal states for a `NotificationDelivery`: `DELIVERED`, `FAILED` (after `retryNotification`
throws `RETRY_LIMIT_EXCEEDED`), `CANCELLED`. `RETRIED` is a transient marker on the *previous*
attempt's row — the retry itself lives in a brand-new `NotificationDelivery` with `attempt + 1`.

---

## Sequence Diagrams

### Immediate notification

```
Caller → NotificationService.createNotification()
             │  renders template, persists Notification + NotificationRecipient rows
             ▼
        SchedulingService.scheduleNotification() [mode=IMMEDIATE]
             │
             ▼
        DeliveryService.queueNotification()
             │  one NotificationDelivery per non-opted-out recipient
             ▼
        DeliveryService.sendNotification() × N
             │  registry.resolve(channelType) → INotificationProvider → provider.send()
             ▼
        NotificationAuditEvent: NOTIFICATION_SENT (or NOTIFICATION_FAILED)
```

### Event-driven

```
Business module state change (Approval/Contract/Acceptance/Payment/Workflow)
             │  observed by an orchestration layer ABOVE both sides — the frozen module
             │  never imports notification, and notification never imports the frozen module
             │  except through notificationIntegration.ts
             ▼
notificationIntegration.recordEventFromModule(sourceModule, eventType, sourceId, payload)
             │
             ▼
        EventRuleService.triggerFromEvent(event, recipients, createdBy)
             │  matches NotificationRule.eventType + conditions (AND, exact match) against payload
             │  one NotificationService.createNotification() call per matching active rule
             ▼
        (same immediate/scheduled dispatch path as above)
```

### Retry after failure

```
DeliveryService.sendNotification(deliveryId)
        │  provider.send() throws
        ▼
   delivery marked FAILED, recipient marked FAILED, NOTIFICATION_FAILED audited
        │
        ▼
DeliveryService.retryNotification(deliveryId)
        │  shouldRetry(attempt, DEFAULT_RETRY_POLICY)? else throw RETRY_LIMIT_EXCEEDED
        │  original delivery → RETRIED; new delivery created with attempt+1
        ▼
DeliveryService.sendNotification(newDeliveryId)   [recursive re-entry into the send path]
```

---

## Provider Architecture

Business modules and every application service (`NotificationService`, `DeliveryService`, ...)
depend only on `ChannelType` (`EMAIL | SMS | PUSH | IN_APP | WEBHOOK`) — never on
`NotificationProviderType`. Routing is a pure `Map<ChannelType, INotificationProvider>` lookup via
`NotificationProviderRegistry`, with no `switch`/`if` on provider identity anywhere in the
application layer (same pattern as the Knowledge Platform's router).

```
INotificationProvider
  ├─ providerId, providerType, channelType
  └─ send(params: SendParams): Promise<ProviderSendResult>   ← the ONLY method

NotificationProviderRegistry
  ├─ register(provider)         → byChannel.set(provider.channelType, provider)
  ├─ resolve(channelType)       → byChannel.get(channelType)   (one active provider per channel)
  └─ listChannels()             → Array.from(byChannel.keys())
```

**Supported provider types** (`NOTIFICATION_PROVIDER_TYPES`): `smtp`, `microsoft_graph`,
`sms_gateway`, `zalo_oa`, `fcm`, `web_push`, `internal_message_center`,
`government_notification_gateway`.

**Implemented in Phase L:**
- `MockNotificationProvider` — in-memory, any channel, for tests (`simulateFailure()` exercises
  the retry path deterministically).
- `InAppNotificationProvider` — a genuine (non-mock) `internal_message_center` implementation.
  In-app messages never leave the process, so the "provider" is simply an inbox
  (`getInbox`, `markRead`, `unreadCount`).

**Deferred to later phases:** SMTP, Microsoft Graph, SMS Gateway, Zalo OA, FCM, Web Push, and
Government Notification Gateway all require real network clients and credentials — adding any of
them is exactly one new class implementing `INotificationProvider` plus a `registry.register()`
call. No application-layer code changes, per the open-provider design above.

---

## Retry Strategy

`RetryPolicy = { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier }`, default
`{ 5, 1_000, 60_000, 2 }` (`DEFAULT_RETRY_POLICY`).

```
computeNextRetryDelay(attempt, policy) = min(baseDelayMs * backoffMultiplier^(attempt-1), maxDelayMs)

attempt:  1        2        3        4        5
delay:    1,000ms  2,000ms  4,000ms  8,000ms  16,000ms   (capped at maxDelayMs = 60,000ms)
```

`shouldRetry(attempt, policy) = attempt < policy.maxAttempts`. Once exhausted,
`DeliveryService.retryNotification()` throws `RETRY_LIMIT_EXCEEDED` and the delivery remains
`FAILED` permanently — a human or a higher-level job must intervene (e.g. via
`getNotificationTimeline()` to see the full failure history).

`computeNextRetryAt(now, attempt, policy)` is provided for callers that want to *schedule* the
retry rather than execute it inline (not wired into `DeliveryService` in Phase L — retries are
caller-triggered, not a background timer).

---

## Scheduling

`NotificationMode`: `IMMEDIATE | SCHEDULED | DELAYED | RECURRING | BULK | EVENT_DRIVEN`.

- **IMMEDIATE** — `SchedulingService.scheduleNotification()` creates the notification and calls
  `queueNotification` + `sendNotification` synchronously in the same call.
- **SCHEDULED / DELAYED** — require a `ScheduleTime.scheduledAt` in the future
  (`validateScheduleTime` throws `SCHEDULE_IN_PAST` otherwise). The notification stays `QUEUED`
  until `SchedulingService.processDueSchedules(asOf)` finds it via
  `INotificationRepository.findDueSchedules(asOf)`.
- **RECURRING** — additionally carries a `RecurrenceRule { frequency: DAILY|WEEKLY|MONTHLY,
  interval, endsAt?, occurrenceCount? }`. After each due cycle fires,
  `computeNextOccurrence()` advances `scheduleTime.scheduledAt`, every recipient is reset to
  `QUEUED` for the next cycle, and `isRecurrenceExhausted()` (checked against `endsAt` or
  `occurrenceCount`, the latter counted from `NOTIFICATION_QUEUED` audit events) marks the
  notification `EXPIRED` once the series ends.
- **BULK** — `BatchService.createBatch()` creates one `Notification` per request under a shared
  `NotificationBatch`; `sendBatch()` queues and sends all of them, tallying `sentCount` /
  `failedCount` on the batch.
- **EVENT_DRIVEN** — `EventRuleService.triggerFromEvent()` creates one `Notification` per matching
  active `NotificationRule`.

**Quiet hours** (`NotificationPreference.quietHoursStart/End`, `isInQuietHours()`) are recorded and
queryable via `PreferenceService.isQuietNow()`, but — see the `ponytail:` marker in
`preferenceService.ts` — dispatch does not yet defer sends during quiet hours. That is a
scheduling refinement for a later phase, not a Phase L deliverable.

---

## API Reference

| Service | Method | Purpose |
|---|---|---|
| `NotificationService` | `createNotification(request)` | Render template, persist Notification + Recipients |
| | `cancelNotification(id, by)` | Cancel a not-yet-sent notification and its queued recipients |
| | `markDelivered(deliveryId)` / `markFailed(deliveryId, reason)` | Provider callback hooks |
| | `getNotificationTimeline(id)` | Audit trail, sorted by `occurredAt` |
| | `getNotification(id)` / `listByModule(type, id)` | Lookups |
| `DeliveryService` | `queueNotification(id)` | Create one `NotificationDelivery` per eligible recipient |
| | `sendNotification(deliveryId)` | Resolve provider by channel, send, never throws on provider failure |
| | `retryNotification(deliveryId)` | New attempt, honors `RetryPolicy.maxAttempts` |
| `SchedulingService` | `scheduleNotification(request, asOf?)` | IMMEDIATE / SCHEDULED / DELAYED / RECURRING entry point |
| | `processDueSchedules(asOf?)` | Dispatch due notifications; reschedule or expire recurrences |
| | `cancelSchedule(id, by)` | Delegates to `NotificationService.cancelNotification` |
| `BatchService` | `createBatch(name, templateCode, requests, by)` | BULK mode |
| | `sendBatch(batchId)` | Queue + send every notification in the batch |
| `TemplateService` | `registerTemplate(params)` / `getTemplate(code)` / `renderForNotification(code, vars)` | Template CRUD + rendering |
| `PreferenceService` | `setPreference` / `getPreference` / `isOptedIn` / `isQuietNow` | Per-user, per-channel opt-in and quiet hours |
| `EventRuleService` | `registerRule` / `recordEvent` / `triggerFromEvent` | Event-driven mode |

**Integration bridge** (`src/notification/integration/notificationIntegration.ts` — the only file
allowed to import outside `src/notification/`):

| Function | Purpose |
|---|---|
| `resolveDepartmentForNotification(notification, masterdata)` | Department lookup via MasterData |
| `recordEventFromModule(sourceModule, eventType, sourceId, payload, repos)` | Ingest an event from Workflow/Approval/Contract/Acceptance/Payment |
| `resolveNotificationsForModule(moduleType, moduleId, repos)` | Lookup by originating business entity |

---

## Extension Guide

**Add a new provider** (e.g. real SMTP in a later phase):
1. Implement `INotificationProvider` (`providerId`, `providerType`, `channelType`, `send()`).
2. `registry.register(new SmtpProvider())` wherever the registry is composed (application
   bootstrap, not inside `src/notification/`).
3. No changes to `NotificationService`, `DeliveryService`, or any other application file —
   they only ever call `registry.resolve(channelType)`.

**Add a new channel type:** extend `CHANNEL_TYPES` in `notificationTypes.ts`, then register a
provider for it. `validateChannels()` and the provider registry both key off the same union type.

**Add a new event source module:** extend `NOTIFICATION_SOURCE_MODULES` in
`notificationIntegration.ts`. Frozen business modules never import notification — an
orchestration layer above both calls `recordEventFromModule()` after observing a state change.

**Freeze constraint:** once `src/notification/` is frozen, all of the above still applies —
extension never means modifying a frozen file, it means registering a new provider or adding one
new type-union member plus its registration, exactly as Auth and Storage do for their own
provider surfaces.
