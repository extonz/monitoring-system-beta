# App Description — MVP

Build the MVP of a desktop security application currently codenamed **Guardian**.

The application is a **local behavioral protection system for desktop computers**. Its purpose is not to behave like a traditional antivirus that simply searches for known malware. Instead, it monitors the computer for **unusual and potentially dangerous behavior**, temporarily contains suspicious activity when necessary, records exactly what happened, and provides recovery options.

The core product idea is:

**Detect → Pause → Investigate → Recover → Explain**

The application should feel like an **airbag for the computer**: normally it stays quietly in the background, but when something starts behaving abnormally enough to potentially cause serious damage, it should intervene and help the user understand and recover from the situation.

---

## What the MVP should demonstrate

The MVP does not need to be a complete antivirus or production-ready security product.

It needs to demonstrate the core concept convincingly:

1. Monitor a selected folder.
2. Observe file activity in real time.
3. Establish a baseline of normal activity.
4. Detect unusual bursts or patterns of file operations.
5. Assign a simple anomaly/risk state.
6. Clearly notify the user when unusual activity is detected.
7. Record a chronological event timeline.
8. Show what happened in understandable language.
9. Maintain a recovery snapshot for the monitored test environment.
10. Allow the user to restore the previous state.
11. Provide a clean, polished desktop UI.

The MVP should prioritize **safe experimentation and demonstration** over aggressive system-level protection.

Do not implement destructive system-wide behavior in the MVP.

---

# Core Concept

Imagine a process suddenly starts doing this:

```text
19:32:14  Process starts
19:32:18  143 files modified
19:32:19  Modification rate increases
19:32:20  500 files modified
19:32:20  Unusual activity detected
19:32:20  Activity contained / monitored
19:32:21  Investigation begins
19:32:23  Recovery available
```

The user should not simply see a technical error.

Instead, Guardian should explain:

> **Unusual activity detected**
>
> A process caused an unusually large number of file changes in a short period of time.
>
> The activity has been paused or contained while the changes are investigated.
>
> **Recovered:** 183 files
> **Affected:** 197 files
> **Status:** Recovered

The exact wording should remain factual. Never claim that the computer was hacked or infected unless that has actually been established.

---

# Behavioral Detection

The important part of the application is that it should eventually distinguish between **legitimate high-volume activity** and genuinely suspicious behavior.

For example, an application update might modify thousands of files.

That should not automatically trigger a critical warning.

The detection system should consider context such as:

* Number of files modified
* Number of files deleted
* Modification speed
* File extensions
* Directories affected
* Whether the process is known
* Whether the executable is signed
* Process location
* Parent process
* User privileges
* Previous behavior
* Whether the behavior is expected for the application
* Whether user documents are affected
* Whether system-critical locations are affected

For the MVP, this can be simplified to a transparent behavioral scoring system, but the architecture must allow the detector to become more sophisticated later.

---

# Example

A legitimate update might look like:

```text
Steam
→ Steam installation directory
→ Hundreds of game files
→ Known update process
→ Expected behavior
```

This should normally remain:

**NORMAL**

Whereas:

```text
unknown.exe
→ User Documents
→ Thousands of files
→ Extremely high modification rate
→ Previously unseen behavior
```

should become something like:

**SUSPICIOUS / CRITICAL**

The application must never rely solely on a process filename such as `update.exe`.

---

# Security States

The application should have clear states:

```text
NORMAL
OBSERVING
SUSPICIOUS
CRITICAL
CONTAINED
RECOVERING
RECOVERED
```

These states should be reflected consistently throughout the UI.

For example:

### NORMAL

> Everything looks good
> Monitoring is active.

### OBSERVING

> Monitoring unusual activity
> Something changed, but there is not enough evidence to intervene.

### SUSPICIOUS

> Unusual activity detected
> Guardian is investigating.

### CONTAINED

> Activity paused
> The suspicious operation has been temporarily contained.

### RECOVERING

> Recovering your system
> Restoring the previous state.

### RECOVERED

> System recovered
> The detected changes were successfully reversed.

---

# Recovery

Recovery is one of the defining features.

Guardian should maintain a recoverable state for the monitored test environment.

The MVP can use a simple snapshot-based system.

Before monitoring begins:

```text
TEST FOLDER
     ↓
SNAPSHOT
     ↓
MONITORING
```

If a simulated dangerous event occurs:

```text
EVENT
 ↓
DETECTION
 ↓
CONTAINMENT
 ↓
COMPARE WITH SNAPSHOT
 ↓
RECOVERY
```

The application should be able to identify:

* Created files
* Deleted files
* Modified files
* Renamed files where practical

and restore the previous state.

The UI should report actual recovery results.

Never claim:

> "183 files restored"

unless the application actually verified that 183 files were restored.

---

# Important MVP Safety Restriction

Do **not** start by implementing system-wide process killing, kernel drivers, automatic deletion, registry modification, or aggressive OS-level blocking.

The MVP should operate primarily inside a **user-selected test directory**.

The goal is to prove the concept safely before introducing deeper operating-system integrations.

If process containment is demonstrated, use controlled/test processes where possible.

---

# UI

The application should have a polished, modern desktop interface.

It should feel like a serious operating-system utility rather than a hacker-themed antivirus.

Avoid:

* Fake hacker visuals
* Excessive red
* Fake security percentages
* "YOU ARE HACKED" style warnings
* Huge dashboards full of meaningless numbers
* Technical information being shown before it is useful

The main screen should immediately answer:

> **Is my computer okay right now?**

Example:

```text
Guardian

●

Everything looks good

Monitoring is active.
No unusual activity detected.

────────────────────────

Monitored location
C:\Guardian\Test

Recent activity

✓ File activity       Normal
✓ Application         Normal
✓ Monitoring          Active
```

---

# Incident UI

When an anomaly occurs, show a calm but noticeable notification.

Example:

```text
Unusual activity detected

unknown.exe modified
1,842 files in 11 seconds.

The activity has been paused
while Guardian investigates.

[View details]
```

The detailed incident page should show:

### What happened

```text
1,842 files modified
11 files deleted
3 directories affected
```

### Why it was unusual

```text
• This behavior has not been observed before.
• The modification rate was unusually high.
• User files were affected.
```

### Recovery

```text
✓ 1,831 files restored
✓ 3 deleted files recovered
✓ System verified
```

### Technical details

Hidden behind an expandable section:

```text
Process
PID
Executable path
Hash
Digital signature
Parent process
Detection signals
Event IDs
```

Normal users should not need to understand this information.

Technical users should still be able to investigate an incident deeply.

---

# Activity Timeline

The application should have an activity/history page.

Example:

```text
19:32:14   Process started
19:32:18   143 files modified
19:32:20   Unusual activity detected
19:32:20   Activity contained
19:32:23   Recovery started
19:32:27   Recovery completed
19:32:28   System verified
```

Events should be stored locally.

---

# Main Dashboard

The dashboard should contain:

* Current protection state
* Monitoring status
* Monitored location
* Recent activity
* Recent incidents
* Recovery status
* Access to detailed activity

Do not expose the internal anomaly score as the primary user-facing metric.

The user cares about:

> "Is everything okay?"

not:

> "Your threat score is 74.2."

---

# Testing / Demo Mode

Because this is an MVP, include a safe demonstration mechanism.

The user should be able to run a simulated scenario against a test directory.

For example:

### Normal update simulation

Creates/modifies a large number of files in an expected pattern.

Expected:

> Normal activity.

### Suspicious activity simulation

Rapidly creates/modifies/deletes many test files.

Expected:

> Unusual activity detected.

### Recovery simulation

The simulated activity changes the test environment, then Guardian demonstrates restoring the previous state.

This allows the complete product flow to be demonstrated without risking real user data.

---

# Architecture

Keep the system modular.

Conceptually:

```text
                ┌──────────────┐
                │      UI      │
                └──────┬───────┘
                       │
              ┌────────▼────────┐
              │    Coordinator  │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Monitor        Detector       Recovery
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                 Event History
```

Keep:

* Monitoring
* Detection
* Process management
* Recovery
* Event storage
* UI

as separate concerns.

The project should be designed so that the MVP can later evolve into a deeper OS-level security application without requiring the entire codebase to be rewritten.

---

# Privacy

The application should be local-first.

By default:

* No file contents should be uploaded.
* No personal documents should leave the machine.
* No telemetry should be sent to external servers.
* Security analysis should happen locally.

If telemetry is ever introduced, it should be explicitly opt-in.

---

# Design Philosophy

Guardian should not consta
