# UI Guidelines

## Product Feel

The application should feel like a **calm, trustworthy system utility**, not a scary antivirus.

The UI should communicate:

> "I am watching your computer, and if something goes seriously wrong, I will help you recover."

Avoid:

* Fake hacker aesthetics
* Excessive red
* Unnecessary warnings
* Cluttered dashboards
* Technical jargon in primary UI
* Fake "100% protection" claims
* Animations that make security events feel like a game

The interface should feel modern, minimal and native to the operating system.

---

# 1. Main Window

The main window should immediately communicate the current state of the computer.

Example:

```text
┌─────────────────────────────────────────────┐
│  Guardian                           Settings│
│                                             │
│              ●                              │
│                                             │
│          Everything looks good             │
│                                             │
│       No unusual activity detected         │
│                                             │
│       Monitoring is active                  │
│                                             │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Recent activity                            │
│                                             │
│  ✓ Chrome                         Normal    │
│  ✓ Steam                           Normal    │
│  ✓ Windows Update                  Normal    │
│                                             │
│                    [View activity]          │
└─────────────────────────────────────────────┘
```

The main screen should not overwhelm the user with technical information.

---

# 2. Security States

The interface should have clear visual states.

### Normal

```text
● Everything looks good
```

Meaning:

* Monitoring active
* No relevant anomalies detected

### Observing

```text
● Monitoring unusual activity
```

Meaning:

* Something is slightly outside normal behavior
* No intervention has occurred

### Suspicious

```text
● Unusual activity detected
```

Meaning:

* Behavior requires investigation
* The user can inspect details

### Contained

```text
● Activity paused
```

Meaning:

* A process has been temporarily suspended
* The system is investigating/recovering

### Recovering

```text
● Recovering your system
```

Show progress.

### Recovered

```text
✓ System recovered
```

Clearly explain what was restored.

---

# 3. Critical Event UI

When dangerous behavior is detected, use a system notification/pop-up.

Do not immediately open a giant full-screen warning.

Example:

```text
┌─────────────────────────────────────────┐
│  Unusual activity detected              │
│                                         │
│  unknown.exe modified 1,842 files       │
│  in your Documents folder.              │
│                                         │
│  The activity has been paused while     │
│  we investigate what happened.          │
│                                         │
│  [View details]                          │
└─────────────────────────────────────────┘
```

The notification should be factual.

Never claim:

> "You have been hacked."

unless this has actually been established.

Prefer:

> "Unusual activity detected."

---

# 4. Incident Screen

Selecting "View details" opens a dedicated incident page.

Example:

```text
Unusual activity detected

unknown.exe

Status
● Activity paused

What happened
──────────────────────────────
1,842 files modified
11 files deleted
3 directories affected

Location
──────────────────────────────
Documents/

Why this was unusual
──────────────────────────────
• This process has not performed
  this operation before.
• The modification rate was
  significantly higher than normal.
• User documents were affected.

Recovery
──────────────────────────────
✓ 1,831 files restored
✓ 3 deleted files restored
✓ Process suspended

[View timeline]
[View affected files]
[Allow activity]
```

---

# 5. Timeline

Security events should be presented visually as a timeline.

Example:

```text
19:32:14
Process started

      │

19:32:18
143 files modified

      │

19:32:20
Unusual activity detected

      │

19:32:20
Process paused

      │

19:32:23
Recovery started

      │

19:32:27
Recovery completed

      │

19:32:28
System verified
```

Users should be able to expand individual events for technical details.

---

# 6. Technical Details

Advanced information should exist, but it should not dominate the interface.

Use an expandable section:

```text
Technical details ▸
```

It may contain:

* Process ID
* Executable path
* Hash
* Digital signature
* Parent process
* User
* Privileges
* File operation counts
* Network information
* Detection signals
* Internal event IDs

The application should be useful to both normal users and technical users.

---

# 7. Activity Dashboard

Provide an activity page showing recent behavior.

Example:

```text
Activity

Today

✓ Chrome
   Normal activity

✓ Steam
   Updated 327 files

⚠ unknown.exe
   Unusual activity
   Contained

✓ Visual Studio Code
   Normal activity
```

Users should be able to filter:

* All
* Normal
* Observing
* Suspicious
* Contained
* Recovered

---

# 8. Recovery UI

Recovery must never feel ambiguous.

Before recovery:

```text
Recovery available

We found changes that can be reversed.

Files affected: 1,842
Files recoverable: 1,831

[Review changes]
[Recover]
```

During recovery:

```text
Recovering...

1,248 / 1,831 files

Please do not close the application.
```

After recovery:

```text
✓ Recovery complete

1,831 files restored.

The system was checked after recovery
and no additional changes were detected.

[View report]
[Close]
```

Never display a fake progress bar.

Progress should reflect actual work.

---

# 9. Settings

Settings should be understandable without technical knowledge.

Suggested sections:

### Protection

* Monitoring
* Automatic containment
* Automatic recovery
* Notifications

### Trusted applications

Show applications with established behavioral history.

### Protected locations

Allow users to view important locations being monitored.

### Recovery

* Recovery storage
* Maximum storage usage
* Retention period

### Privacy

Clearly explain what information stays local.

### Advanced

Technical configuration should live here.

---

# 10. First Launch

The first launch should explain the concept in a few steps.

Example:

```text
Welcome

This app watches for unusual activity
that could damage your computer.

It learns what normal behavior looks like
and can temporarily pause suspicious
activity before it causes more damage.

Your activity stays on this computer
by default.

[Continue]
```

Then:

```text
Protection is ready

Monitoring: ON
Recovery: Ready

You can change these settings later.

[Start monitoring]
```

Do not require users to understand security terminology during setup.

---

# 11. No Fake Security Scores

Do not create meaningless UI such as:

```text
87% Protected
```

or:

```text
Security Level: 94/100
```

These numbers imply a level of certainty the system cannot guarantee.

Show actual system state instead.

---

# 12. Color

Color should communicate state without dominating the interface.

Recommended semantic approach:

* Neutral → normal
* Blue → information
* Yellow/amber → attention
* Red → active critical event
* Green → successful recovery

Do not make the entire application red during an incident.

A critical event should feel serious but controlled.

---

# 13. Dark Mode and Light Mode

Support both.

The design must remain readable and coherent in:

* Light mode
* Dark mode
* High contrast / accessibility modes where supported

Do not rely exclusively on color to communicate state.

Use:

* Icons
* Text
* Labels
* Status indicators

---

# 14. Accessibility

The UI should support:

* Keyboard navigation
* Screen readers where applicable
* Sufficient contrast
* Scalable text
* Clear focus states
* Reduced motion

Critical security information must remain understandable without relying on animation.

---

# 15. Design Principle

The interface should follow one major rule:

> **Show the user what matters first. Hide complexity until they ask for it.**

Normal users should be able to understand an incident in seconds.

Technical users should be able to investigate the same incident in depth.

The UI is not the security engine.

It is the layer that turns complex security events into information the user can understand and act on.


