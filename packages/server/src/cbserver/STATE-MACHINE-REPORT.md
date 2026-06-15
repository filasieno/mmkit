# CBServer state machine design report

> **Canonical documentation is JSDoc** in per-actor [`*Invariants.ts`](./actors/server/CBServerInvariants.ts) files.
> Open those in the IDE for full rationale (why each invariant holds, how it is checked,
> hierarchical composition, handler classification, and design ratings).

## Quick links

| Actor | Invariants (JSDoc) | Actor implementation |
|-------|-------------------|----------------------|
| CBServer supervisor | [`CBServerInvariants.ts`](./actors/server/CBServerInvariants.ts) | [`CBServerActor.ts`](./actors/server/CBServerActor.ts) |
| CBConnection | [`CBServerConnectionInvariants.ts`](./actors/connection/CBServerConnectionInvariants.ts) | [`CBServerConnectionActor.ts`](./actors/connection/CBServerConnectionActor.ts) |
| CBCommandChannel | [`CBCommandChannelInvariants.ts`](./actors/commandChannel/CBCommandChannelInvariants.ts) | [`CBCommandChannelActor.ts`](./actors/commandChannel/CBCommandChannelActor.ts) |
| CBNotificationChannel | [`CBNotificationChannelInvariants.ts`](./actors/notificationChannel/CBNotificationChannelInvariants.ts) | [`CBNotificationChannelActor.ts`](./actors/notificationChannel/CBNotificationChannelActor.ts) |
| CBConnectionReader | [`CBConnectionReaderInvariants.ts`](./actors/reader/CBConnectionReaderInvariants.ts) | [`CBConnectionReaderActor.ts`](./actors/reader/CBConnectionReaderActor.ts) |
| CBConnectionWriter | [`CBConnectionWriterInvariants.ts`](./actors/writer/CBConnectionWriterInvariants.ts) | [`CBConnectionWriterActor.ts`](./actors/writer/CBConnectionWriterActor.ts) |
| StdoutLogReader | [`CBServerStdoutLogReaderInvariants.ts`](./actors/stdoutLogReader/CBServerStdoutLogReaderInvariants.ts) | [`CBServerStdoutLogReaderActor.ts`](./actors/stdoutLogReader/CBServerStdoutLogReaderActor.ts) |
| StderrLogReader | [`CBServerStderrLogReaderInvariants.ts`](./actors/stderrLogReader/CBServerStderrLogReaderInvariants.ts) | [`CBServerStderrReaderActor.ts`](./actors/stderrLogReader/CBServerStderrReaderActor.ts) |

## Handler codes

| Code | Meaning |
|------|---------|
| **U** | Unhandled → fatal |
| **P** | Parent handles (do not reimplement) |
| **E** | No-op / idempotent swallow |
| **G** | Guard throw (client error) |
| **B** | Real behaviour |

## Related reports

| Report | File |
|--------|------|
| State machine design & invariants | [`*Invariants.ts`](./actors/server/CBServerInvariants.ts) + this index |
| Process/socket event coverage & slimming | [`EVENT-COVERAGE-REPORT.md`](./EVENT-COVERAGE-REPORT.md) |
