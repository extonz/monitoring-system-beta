# Security Architecture

## Project Concept

This application is a **local behavioral protection system for desktop computers**.

Its purpose is to detect unusually dangerous activity, temporarily contain it, determine what happened, and recover the system when possible.

It is **not a traditional signature-based antivirus**.

The core idea is:

> **Detect → Pause → Investigate → Recover → Explain**

The application should behave like an **airbag for the computer**: it should intervene when something is behaving abnormally enough to potentially cause serious damage, while avoiding unnecessary interference with legitimate software.

---

# 1. Core Principles

## 1.1 Behavioral Detection

Do not determine that something is dangerous based on a single event.

A large number of file modifications does not automatically mean malicious activity.

A legitimate application may:

* Install an update
* Compile software
* Extract an archive
* Synchronize files
* Update a game
* Reorganize a cache
* Generate thousands of files

Detection must consider **context**.

The important question is:

> "Is this behavior unusual and potentially dangerous for this process on this computer?"

---

# 2. Behavioral Signals

The detection engine may consider signals such as:

* Number of files modified
* Number of files deleted
* Modification rate
* File extensions affected
* Directories affected
* Process identity
* Process parent
* Digital signature
* Executable location
* User privileges
* Network activity
* Previous behavior
* Whether the behavior is expected for the application
* Whether the application was recently installed or updated
* Whether the operation is reversible
* Whether user documents are affected
* Whether system-critical locations are affected

No single signal should normally trigger a critical response by itself.

---

# 3. Anomaly Scoring

The system should internally calculate an anomaly/risk score.

Example:

```text
Unknown process                    +20
Unsigned executable                +15
Rapid mass file modification      +25
Mass deletion                     +30
Unexpected user directories       +20
System configuration modification +20
Previously unseen behavior        +10
Known trusted updater              -25
Previously observed behavior      -15
Expected application directory    -10
```

These values are **examples only**.

They must not be hardcoded into the architecture without testing.

The detection engine should be configurable and extensible.

Possible states:

```text
NORMAL
OBSERVING
SUSPICIOUS
CRITICAL
CONTAINED
RECOVERING
RECOVERED
```

---

# 4. Legitimate Activity

The system must actively avoid false positives.

Before containment, consider whether the behavior matches an expected operation.

Examples of potentially legitimate high-volume activity:

* Windows updates
* Application updates
* Game updates
* Software installation
* Backup software
* Cloud synchronization
* Compilers
* Archive extraction
* Package managers
* Development tools

A trusted application performing a large operation should not automatically be treated as malicious.

Trust should be based on multiple signals rather than simply matching a process name.

---

# 5. Process Identity

Never identify a process only by its filename.

For example:

```text
update.exe
```

is not sufficient to establish trust.

Where available, inspect:

* Full executable path
* Digital signature
* Publisher
* Process ID
* Parent process
* Executable hash
* User
* Privilege level
* Installation location
* Historical behavior

A malicious executable can easily use the same filename as a legitimate application.

---

# 6. Containment

When behavior reaches a critical threshold, the preferred sequence is:

```text
Detect
   ↓
Capture current state
   ↓
Suspend process
   ↓
Stop further dangerous activity
   ↓
Investigate changes
   ↓
Determine recovery options
```

Do not immediately terminate processes unless necessary.

Suspending a process preserves the possibility of investigation and controlled recovery.

Containment must be reversible whenever technically possible.

---

# 7. Recovery

Recovery is a core feature.

The system should maintain enough information to determine:

* Which files changed
* Which files were created
* Which files were deleted
* Which files were renamed
* Which configuration values changed
* Which processes were involved

Whenever possible, recovery should restore the previous state.

Recovery must be:

* Explicit
* Logged
* Atomic where possible
* Safe against partial failure
* Reversible where possible

Never claim that something was recovered unless the recovery was actually verified.

---

# 8. Snapshots

Do not continuously create huge full-disk copies.

Prefer efficient mechanisms such as:

* Metadata snapshots
* File hashes
* Copy-on-write storage where available
* Windows restore mechanisms where appropriate
* Targeted backups
* Temporary recovery copies

The architecture should allow platform-specific recovery implementations.

Do not assume Windows mechanisms exist on macOS or Linux.

---

# 9. Protected Areas

The system should distinguish between different types of data.

Example categories:

```text
SYSTEM
APPLICATION
USER_DOCUMENT
TEMPORARY
CACHE
UNKNOWN
```

Risk should increase when unexpected processes interact with important user data or system configuration.

However, the system must never blindly block access solely because a path looks important.

---

# 10. Explainability

Every security event should have a human-readable explanation.

Bad:

```text
THREAT_SCORE = 87
```

Good:

```text
Unusual activity detected.

unknown.exe modified 1,842 files
inside your Documents folder in 11 seconds.

This process has never performed this
operation before.

The process has been paused while the
changes are investigated.
```

The user should always understand:

* What happened
* Which process caused it
* Why it was considered unusual
* What was paused
* What was recovered
* What remains unresolved

---

# 11. Recovery Notification

A critical event should produce a clear notification.

Example:

```text
Unusual activity detected

A process attempted to modify 1,842 files
in an unusually short period of time.

The activity has been paused.

Recovered:
✓ 1,831 files
✓ 6 configuration changes
✓ 3 deleted files

Process:
unknown.exe

Status:
CONTAINED

[View Details]
[Restore More]
[Allow Activity]
```

Do not use frightening language unnecessarily.

The application should communicate facts, not speculate.

---

# 12. Event Timeline

Security events should be recorded chronologically.

Example:

```text
19:32:14  Process started
19:32:15  Network connection detected
19:32:18  143 files modified
19:32:19  Modification rate increased
19:32:20  Anomaly threshold reached
19:32:20  Process suspended
19:32:21  Investigation started
19:32:23  Recovery started
19:32:27  Recovery completed
19:32:28  System verified
```

This timeline should be available to the user.

---

# 13. False Positive Handling

The application must provide a way to recover from incorrect detections.

The user should be able to:

* Review the event
* Allow the process
* Restore the process
* Restore or keep recovered files
* Mark behavior as expected where appropriate

However, "Allow" should not permanently create unlimited trust without additional confirmation.

Trust decisions should be specific and auditable.

---

# 14. Learning

The system may build a **local behavioral history**.

For example:

```text
Application: Steam
Observed operations: 843
Normal update behavior: 37
Suspicious events: 0
Trust confidence: High
```

Behavioral history should remain local by default.

Do not upload user activity, filenames, documents, or process telemetry to external servers unless the user explicitly enables such functionality.

---

# 15. Privacy

The system should operate locally by default.

Avoid collecting:

* File contents
* Personal documents
* Passwords
* Personal identifiers
* Unnecessary browsing information

Telemetry should be opt-in.

Security analysis should minimize exposure of user data.

---

# 16. Fail-Safe Behavior

When the application itself fails:

**Do not leave the user's computer in a partially modified or permanently locked state.**

Examples:

* If monitoring crashes, it must not corrupt files.
* If recovery fails halfway, preserve enough information for another recovery attempt.
* If the application is updated, existing recovery data must remain usable.
* If permissions are insufficient, report the limitation instead of pretending the action succeeded.

The security tool must never become the source of the damage it is designed to prevent.

---

# 17. Performance

Monitoring must have minimal impact on normal computer usage.

Avoid:

* Constant full-disk scanning
* Excessive polling
* Repeated hashing of unchanged files
* Unnecessary network requests
* Large background memory usage

Prefer event-driven monitoring where the operating system provides it.

Performance should be measured rather than assumed.

---

# 18. Architecture

Keep the security engine separate from the UI.

Recommended conceptual architecture:

```text
┌──────────────────────┐
│         UI           │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ Security Coordinator │
└──────────┬───────────┘
           │
    ┌──────┼───────┐
    ▼      ▼       ▼
 Monitor  Detector  Process Manager
    │      │       │
    └──────┼───────┘
           ▼
     Recovery Engine
           │
           ▼
      Event Database
```

Platform-specific code should live behind clear interfaces.

---

# 19. Development Rules

Do not implement destructive system functionality first.

Build incrementally:

### Phase 1

Passive monitoring.

### Phase 2

Event collection and timeline.

### Phase 3

Behavioral analysis.

### Phase 4

Risk scoring.

### Phase 5

Simulation/dry-run containment.

### Phase 6

Real process suspension.

### Phase 7

Recovery mechanisms.

### Phase 8

User-facing security notifications.

Real destructive recovery must only be enabled after it has been extensively tested.

---

# 20. Testing

Security functionality must be tested using controlled test environments.

Never test destructive behavior against real user data.

Create synthetic scenarios such as:

```text
Scenario A
Normal application update

Expected:
No containment
```

```text
Scenario B
Synthetic process modifies many test files

Expected:
Detection
```

```text
Scenario C
Synthetic process rapidly deletes test files

Expected:
Containment + recovery
```

```text
Scenario D
Legitimate application performs large update

Expected:
No false positive
```

The test suite should become increasingly comprehensive as the detection engine evolves.

---

# 21. Important Constraint

Do not turn this project into a generic antivirus.

The defining feature is:

> **Behavioral anomaly detection combined with temporary containment and recoverability.**

The application should answer:

**"What just happened to my computer, can I safely stop it, and can I put everything back the way it was?"**

That question should guide the architecture and every major feature decision.
