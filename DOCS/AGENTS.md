# AGENTS.md

## Purpose

You are working on a real software project, not a throwaway prototype.

Your priority is to produce code that is:

* Correct
* Maintainable
* Secure
* Testable
* Cross-platform where applicable
* Consistent with the existing project architecture

Do not optimize for writing the most code. Optimize for writing the **right code**.

---

## 1. Before Changing Anything

**Do not start coding immediately.**

First inspect the repository and understand:

* Project structure
* Existing architecture
* Programming languages
* Frameworks and libraries
* Build system
* Package manager
* Entry points
* Existing tests
* Configuration files
* CI/CD configuration
* Platform-specific code
* Existing documentation

Look for existing functionality before implementing something new.

Do not recreate functionality that already exists.

If the repository is already partially implemented, preserve working functionality unless there is a clear reason to change it.

---

## 2. Plan Before Implementation

For any non-trivial task:

1. Inspect the relevant code.
2. Identify dependencies and side effects.
3. Determine the smallest clean implementation.
4. Consider failure cases.
5. Consider security implications.
6. Implement.
7. Test.
8. Review the implementation.

For large changes, create a short implementation plan before modifying files.

Do not make large architectural changes without understanding the existing architecture first.

---

## 3. Code Quality

Write production-quality code.

Prefer:

* Simple solutions
* Small modules
* Clear names
* Strong typing where supported
* Explicit error handling
* Minimal dependencies
* Reusable components
* Deterministic behavior

Avoid:

* Dead code
* Duplicate implementations
* Unused dependencies
* Unnecessary abstractions
* Huge files
* Hardcoded paths
* Hardcoded credentials
* Magic numbers without explanation
* Temporary hacks presented as final solutions

Do not add a dependency when the functionality can reasonably be implemented using the existing stack or standard library.

---

## 4. Security

Treat security as a first-class requirement.

Never:

* Hardcode secrets
* Commit API keys
* Commit passwords or tokens
* Disable security mechanisms just to make something work
* Execute untrusted input without validation
* Trust user-controlled paths
* Use dangerous system commands without validation

When working with filesystem, processes, networking, authentication, or system APIs, explicitly consider:

* Permissions
* Path traversal
* Privilege escalation
* Process injection
* Command injection
* Race conditions
* Data loss
* Resource exhaustion

For security-sensitive functionality, prefer **fail-safe behavior**.

---

## 5. Filesystem and User Data

Never assume that files can safely be modified or deleted.

Before destructive operations:

* Validate the target.
* Confirm the operation is intentional.
* Prefer reversible operations when possible.
* Handle failures gracefully.
* Never silently delete user data.

If an operation can cause significant data loss, design a recovery mechanism whenever reasonably possible.

---

## 6. Error Handling

Errors must be handled deliberately.

Do not silently ignore exceptions.

Errors should:

* Provide useful diagnostic information.
* Preserve application stability.
* Avoid exposing secrets.
* Allow the user or developer to understand what happened.

Do not hide errors merely to make tests or the UI appear successful.

---

## 7. Testing

Every meaningful feature should have appropriate tests.

Before considering work complete:

1. Run the relevant tests.
2. Run the build/type checker/linter when available.
3. Test important failure cases.
4. Verify existing functionality still works.

For bug fixes, add a regression test whenever practical.

Do not claim something works without actually verifying it.

If a test cannot be run, clearly state why.

---

## 8. Platform Compatibility

If the project targets multiple operating systems:

* Do not assume Windows-only behavior is portable.
* Isolate platform-specific functionality.
* Detect the operating system explicitly.
* Use platform-appropriate APIs.
* Keep the shared logic platform-independent whenever possible.

Supported platforms must be verified individually where practical.

---

## 9. Dependencies

Before adding a dependency:

1. Check whether the project already has an equivalent.
2. Check whether the standard library can solve the problem.
3. Consider maintenance and security.
4. Consider bundle/application size.
5. Consider platform compatibility.

Do not add dependencies simply because they make implementation slightly easier.

---

## 10. Documentation

Keep documentation synchronized with the implementation.

Update documentation when changes affect:

* Installation
* Configuration
* Architecture
* Commands
* Supported platforms
* User-facing behavior
* Development workflow

Do not create documentation that describes functionality that does not actually exist.

---

## 11. Git

Keep changes focused.

Do not:

* Modify unrelated files
* Reformat the entire repository unnecessarily
* Delete existing work without justification
* Commit generated files unless the project requires them

Before finishing, inspect the changed files and make sure every change is intentional.

---

## 12. Working With Existing Code

When modifying existing code:

* Understand it before replacing it.
* Preserve compatible behavior.
* Prefer incremental improvements.
* Do not rewrite working systems just because you personally prefer another approach.

If existing code is genuinely problematic, explain the issue and fix the smallest appropriate part.

---

## 13. No Fake Completion

Never say:

> "Done"

if the implementation has not been verified.

Before declaring a task complete, confirm:

* Code compiles.
* Tests pass or limitations are documented.
* No obvious errors remain.
* New functionality is actually connected to the application.
* Documentation is accurate.
* No secrets or unnecessary files were introduced.

---

## 14. When Something Is Ambiguous

Do not invent requirements.

If the repository provides enough context, infer the most reasonable implementation.

If an ambiguity could materially affect architecture, security, data integrity, or user-visible behavior, stop and ask for clarification.

For minor implementation details, choose the simplest reasonable option and document the decision when useful.

---

## 15. Final Response

When finishing a task, provide a concise summary containing:

### Changed

What was implemented or modified.

### Verified

What tests, builds, checks, or manual verification were performed.

### Notes

Anything important that remains unresolved or requires future work.

Do not claim verification that was not actually performed.

---

## Core Principle

**Understand first. Plan second. Implement third. Verify last.**

The goal is not to produce more code.

The goal is to leave the repository **better, safer, and more maintainable than you found it.**
