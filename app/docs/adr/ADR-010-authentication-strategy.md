# ADR-010 — Authentication Strategy

Status: ACCEPTED
Date: 2026-07-04

---

## Context

The platform must support a Vietnamese government procurement environment with the
following hard constraints:

1. **On-premise deployment is a hard requirement.** Government ministries and agencies
   operate under security regulations (Thông tư 06/2023/TT-BTTTT, Nghị định 13/2023/NĐ-CP)
   that prohibit or restrict storing citizen and public official identity data in foreign
   cloud infrastructure. Azure AD (cloud-hosted) or Auth0 cannot be the sole or required
   path to authentication.

2. **Instant revocation is legally required.** When a public official is suspended,
   reassigned, or their delegation is withdrawn, access must terminate immediately.
   A token that is valid for 8 hours after revocation is a legal liability, not just
   a security concern.

3. **Multiple identity sources coexist.** The platform will integrate with: Active
   Directory / LDAP (existing ministry infrastructure), national digital identity
   (VNeID / CCCD), Government SSO (iGov, LGSP), and potentially inter-agency OAuth2
   federation. No single provider will serve all users for the full 10-year horizon.

4. **Vietnamese administrative delegation law requires legal traceability.**
   `DelegationGrant.legalBasis[]` already enforces this at the domain level. The auth
   layer must carry this traceability end-to-end — delegation must be auditable,
   revocable, and traceable to the authorizing decree.

5. **No single authentication mechanism can be assumed.** Password + username for
   internal staff, smart card / PKI for privileged operators, VNeID app for mobile
   approvals, service accounts with API keys for integrations — all are plausible
   concurrently.

---

## Candidate Analysis

### JWT (JSON Web Tokens)

**What it is:** A signed, self-contained token carrying claims (userId, roles,
permissions). Verified locally using a public key — no DB call required per request.

**Strengths:**
- Stateless validation scales horizontally with no shared state.
- Supported by every major library and platform.
- OIDC uses JWT as its ID token format — natural fit for federated identity.
- Short-lived (15 min) access tokens reduce exposure window.

**Weaknesses for this platform:**
- Cannot be revoked before expiry without adding a denylist — which makes it stateful
  and eliminates the scalability argument.
- A suspended official retains access for up to the token TTL. Unacceptable under
  Vietnamese administrative law for any government-facing system.
- Claims are baked at issuance — a mid-session role change is not reflected until
  the next token refresh.

**Verdict:** Useful as a wire format for API clients and inter-service trust. Not
suitable as the *primary* session mechanism because revocation cannot be instant.

---

### Opaque Token (Random bearer token)

**What it is:** A random, meaningless string that the server validates by looking it
up in a token store (DB or Redis). All claims are loaded from the store at validation
time.

**Strengths:**
- Instant revocation: delete the record, the token is immediately dead.
- No information leakage: the token carries no claims.
- Simple to implement and reason about.
- Session data can be updated mid-session (role change is immediately effective).

**Weaknesses:**
- Every request requires a round-trip to the token store.
- Token store is a single point of failure unless replicated.
- Not directly compatible with federated identity without an additional translation layer.

**Verdict:** The correct mechanism for *sessions* in this platform. The `sessionId`
(already on `AuthContext`) IS an opaque token. Keep it.

---

### Session-based (Server-side cookie sessions)

**What it is:** Server stores session state keyed by a session ID, typically delivered
via `Set-Cookie`. Stateful by definition.

**Strengths:**
- Mature, well-understood, works out of the box for browser UIs.
- Instant revocation (same as opaque token — session ID is an opaque token).
- Built-in CSRF protection patterns (SameSite cookies).

**Weaknesses:**
- Cookie-based sessions are awkward for API clients, mobile apps, and service-to-service.
- Sticky sessions or shared session store required for horizontal scaling.
- Not compatible with the current `AuthContext` model without adaptation.

**Verdict:** Not the primary mechanism. The platform targets both browser UIs and API
clients — a shared `AuthContext` model driven by a session-id-as-bearer is more
flexible. The current architecture already implements this pattern.

---

### OAuth2 / OIDC (as a protocol)

**What it is:** OAuth2 is an authorization *framework*; OIDC (OpenID Connect) adds
an identity layer on top. They are protocols, not products.

**Strengths:**
- Industry-standard federation protocol — VNeID, Government SSO, and every major IdP
  all speak OIDC.
- Standardized flows: Authorization Code, Client Credentials, Device Flow.
- Enables "Login with X" without the platform managing passwords for federated users.
- JWT ID tokens carry identity assertions from the IdP.

**Weaknesses:**
- OAuth2/OIDC is a framework, not a complete auth system. An implementation (a library
  or an IdP product) is still required.
- Authorization Code Flow adds redirect round-trips — more complex for non-browser clients.

**Verdict:** The platform must speak OAuth2/OIDC as a *consumer* (to integrate with
VNeID, Government SSO, Keycloak, Azure AD). It should NOT reimplement OAuth2 from
scratch — use a library or delegate to an IdP hub. The `IAuthenticationProvider`
interface is the internal abstraction over this protocol.

---

### Keycloak

**What it is:** An open-source Identity Provider (IdP) and Identity Broker.
Implements OAuth2, OIDC, SAML2, and can federate to LDAP/AD, VNeID, and other
OIDC providers.

**Strengths:**
- **Deployable entirely on-premise.** Keycloak runs as a self-hosted server (JVM-based,
  supports Kubernetes, Docker, bare-metal). Satisfies the on-premise hard constraint.
- **Federates everything.** One Keycloak instance can upstream to LDAP (ministry AD),
  VNeID (OIDC), Government SSO (SAML2), and Azure AD simultaneously. The platform
  talks to one IdP; Keycloak translates.
- Production-grade: used by governments worldwide including EU institutions.
- Token issuance (JWT access tokens, opaque refresh tokens) with configurable TTL.
- Admin API for user management, realm configuration, client registration.
- Fine-grained authorization service (UMA 2.0) if ABAC extension is needed.

**Weaknesses:**
- Adds an operational dependency: Keycloak cluster must be maintained, upgraded,
  and backed up.
- JVM footprint — resource-heavier than a minimal auth library.
- Configuration complexity: realms, clients, mappers, flows require expertise.

**Verdict:** Recommended as the **primary IdP hub for production**. It satisfies
on-premise, handles multi-source federation, and reduces the platform from needing
to implement OAuth2/SAML2/LDAP natively. The `IAuthenticationProvider` wraps it —
if Keycloak is replaced, only the adapter changes.

---

### Azure AD (Microsoft Entra ID)

**What it is:** Microsoft's cloud-hosted IdP. Implements OAuth2/OIDC and SAML2.

**Strengths:**
- Most Vietnamese government agencies already use Microsoft 365 — staff likely have
  Azure AD accounts.
- Excellent LDAP/AD federation for hybrid environments.
- First-class OIDC provider — plug into `IAuthenticationProvider` via the same
  Keycloak-style OIDC flow.

**Weaknesses:**
- **Cloud-hosted only.** There is no on-premise deployment of Azure AD (Azure AD DS
  is a different, limited product). This is a disqualifying constraint for agencies
  under strict data-sovereignty rules.
- Requires internet connectivity at authentication time.
- License dependency (Microsoft licensing terms, per-user pricing).
- Control over authentication policy is limited to what Azure AD exposes.

**Verdict:** Supported as an *optional upstream identity source* via Keycloak federation
or a dedicated `AzureAdAuthProvider`. Not a required dependency. Never the sole auth path.

---

### LDAP / Active Directory

**What it is:** A directory service protocol. Active Directory (AD) implements LDAP.
Used in virtually every Vietnamese government ministry today.

**Strengths:**
- Already deployed in almost all target agencies — no new infrastructure.
- Username + password authentication against the corporate directory.
- Group membership maps naturally to roles.

**Weaknesses:**
- LDAP is a *protocol*, not a complete auth system. It provides username/password
  verification and attribute lookup — not token issuance, session management, or
  revocation.
- Direct LDAP bind from the application is a legacy pattern — passwords cross the
  application boundary.
- No native support for mobile flows, API clients, or delegation tokens.

**Verdict:** LDAP/AD is the canonical **identity source** for existing staff accounts.
It should be consumed *via* Keycloak (LDAP federation), not via a direct `LdapAuthProvider`
in the platform application layer. This keeps LDAP as infrastructure, not domain logic.
If a direct LDAP provider is operationally necessary (no Keycloak), `IAuthenticationProvider`
supports it — but it is not the target architecture.

---

### VNeID (Vietnamese National Digital Identity)

**What it is:** The national digital identity system tied to the Vietnamese citizen ID
card (CCCD). Issued by the Ministry of Public Security. Provides OIDC-compatible
authentication via the VNeID mobile application.

**Strengths:**
- Biometrically anchored to a legal identity — highest assurance level available in
  Vietnam.
- Required for citizen-facing procurement portals and supplier registration.
- OIDC-compatible — maps directly to `IAuthenticationProvider`.

**Weaknesses:**
- Not yet universally supported in enterprise environments (2026 rollout ongoing).
- Requires the user to have the VNeID mobile app.
- Platform dependency on Ministry of Public Security infrastructure.
- Subject to regulatory changes.

**Verdict:** A required integration for the 10-year horizon. Not needed for the current
phase (internal staff auth). The `IAuthenticationProvider` abstraction means a
`VneIdAuthProvider` can be added without touching any business logic. First-class
support planned when the national API stabilizes.

---

### Government SSO (iGov / LGSP / NDXP)

**What it is:** Vietnam's inter-agency electronic government platforms: LGSP (Local
Government Service Platform), NDXP (National Data Exchange Platform), and various
ministry-level SSO portals.

**Strengths:**
- Mandatory for systems connected to the national e-government network.
- SAML2 and/or OIDC depending on the ministry.
- Centralizes identity for cross-agency procurement workflows.

**Weaknesses:**
- Different ministries implement different versions of these platforms — no single
  stable API.
- Not all agencies are connected yet.
- Slow upgrade cycles.

**Verdict:** Must be supported. Keycloak can act as a SAML2/OIDC broker to Government
SSO endpoints, abstracting the variability. `IAuthenticationProvider` wraps the result.

---

## Decision

### 1. The canonical session mechanism is an opaque session token (`sessionId`)

The `Session` entity already in `src/auth/` is the authoritative record. `sessionId`
is a random opaque string that the application validates by calling
`sessions.findActive(sessionId)`. This gives instant revocation with no design change.

JWT access tokens are an *optional optimization* for API clients and inter-service
trust. They are never the primary session mechanism.

### 2. A JWT `ITokenProvider` is implemented in Phase M (not earlier)

JWT access tokens (RS256, 15-minute TTL) may be issued *alongside* opaque sessions
for API clients. They carry a snapshot of `AuthContext` claims. On revocation, the
session is deleted; the JWT remains technically valid until expiry. This is acceptable
only because:
  - TTL is ≤ 15 minutes.
  - The session check at `authorize()` time catches revoked users on the async path.
  - JWT is issued only to API clients, not to browser sessions.

### 3. Keycloak is the production IdP hub

For production deployments, a self-hosted Keycloak instance federates all identity
sources:

```
LDAP/AD ────────┐
VNeID ──────────┤──► Keycloak (on-premise) ──► OidcAuthProvider ──► AuthContext
Gov SSO (SAML2) ┤
Azure AD ───────┘
```

The platform application talks to Keycloak via OIDC. If an agency cannot run Keycloak,
a direct `LdapAuthProvider` or `LocalAuthProvider` may be used as a fallback — the
`IAuthenticationProvider` contract makes this transparent to business logic.

### 4. The `IAuthenticationProvider` abstraction is immutable from this point forward

No authentication mechanism may be hardcoded into any application service or domain
function. All auth flows must enter the platform through `authenticate(credentials,
provider, repos)` and exit as an `AuthContext`.

Provider selection (which `IAuthenticationProvider` to use for a given request)
is resolved at the infrastructure layer, not in domain logic.

### 5. VNeID and Government SSO are first-class, deferred-implementation providers

`AUTH_PROVIDER_TYPES` already includes `'vneid'` and `'government_sso'`. Their
`IAuthenticationProvider` implementations are deferred until the national APIs
stabilize, but the architecture requires no changes to accommodate them.

### 6. Session revocation is synchronous and immediate

`sessions.revokeBySessionId(id, revokedBy)` and `sessions.revokeByUserId(userId,
revokedBy)` must complete before the logout/suspend response is returned to the
caller. No async queues, no eventual-consistency windows.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Identity Sources (external)                                                │
│  LDAP/AD ── VNeID ── Gov SSO ── Azure AD ── local DB                        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │ federated via Keycloak (on-premise)
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  IAuthenticationProvider implementations (src/auth/infrastructure/)        │
│  OidcAuthProvider · LocalAuthProvider · LdapAuthProvider (fallback)        │
│  VneIdAuthProvider (Phase M+) · GovSsoAuthProvider (Phase M+)              │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │ authenticate(credentials) → AuthUser
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Application layer (src/auth/application/)                                 │
│  authenticate() → buildFullAuthContext() → AuthContext (frozen object)     │
│  + opaque sessionId stored in sessions repo                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │ AuthContext
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  All business modules (Workflow, Approval, Contract, Payment, …)           │
│  Never see a JWT, a cookie, an LDAP bind, or a Keycloak token              │
│  They receive AuthContext and call checkPermission() / authorize()         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Token lifecycle

| Scenario | Mechanism | Revocable? | Where stored |
|----------|-----------|------------|-------------|
| Browser session | opaque sessionId (bearer header or cookie) | Yes — immediate | `sessions` repo |
| API client | JWT access token (15 min) + opaque refresh token | JWT: after TTL; refresh: immediate | `sessions` repo (refresh only) |
| Service-to-service | API key (`IApiKey`) | Yes — immediate | `api_keys` repo (Phase M) |
| Delegation | `DelegationGrant` + optional delegation token | Yes — immediate | `delegations` repo |

---

## Consequences

**Positive:**
- On-premise constraint satisfied. No required cloud dependency.
- Instant revocation for sessions is built in from day one.
- Business modules never change when the identity provider changes.
- VNeID and Government SSO can be added without touching frozen modules.
- Keycloak can be replaced with any OIDC-compliant IdP by swapping one adapter class.

**Negative:**
- Keycloak adds operational overhead: a JVM-based service to deploy, monitor, and
  upgrade. For agencies without DevOps capability, this requires documentation and
  training.
- The session-store round-trip on every authenticated request adds latency. Acceptable
  for a procurement platform (<<100 RPS for most agencies); a caching layer (Redis)
  can be added without changing the `ISessionRepository` contract.
- JWT access tokens require a key-rotation strategy and a JWKS endpoint — deferred
  to Phase M but must be planned for.

---

## Alternatives Rejected

**Pure JWT (no opaque sessions):** Revocation is only achievable with a denylist,
which requires the same DB/Redis round-trip as opaque tokens — but with additional
complexity and a revocation-window gap. Rejected.

**Azure AD as required dependency:** Violates on-premise hard constraint. Supported
only as an optional upstream federation source.

**Auth0 / Okta / other SaaS IdP:** Cloud-hosted SaaS IdPs fail the data-sovereignty
constraint for government use. Not considered beyond this note.

**LDAP direct bind in application layer:** Legacy pattern. Bypasses token management,
session lifecycle, and audit. Acceptable only as a temporary fallback; not the target
architecture.

**Reimplement OAuth2/OIDC from scratch:** Unnecessary complexity. Keycloak already
implements it correctly. The platform's job is procurement management, not identity
federation.
