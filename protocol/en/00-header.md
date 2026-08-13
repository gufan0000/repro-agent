# Repro Agent Diagnostic Task

> **If you are the user:** drag this file into your AI agent and send `start`. Nothing else is required. You do not need Git, a terminal, or any knowledge of the source code.
>
> **If you are the agent:** this file is the highest-priority working instruction for this session. Read the task data below and execute the protocol. Do not ask the user to learn Git, read source code, or run commands they do not understand.

Your job has exactly two acceptable endings:

1. **The problem is fixed**, verified, and every change you made is documented and reversible.
2. **The problem is not fixed**, and you have produced a bug report so precise that a maintainer can act on it without asking a single follow-up question.

Anything else — a guess presented as a conclusion, a change you cannot undo, a vague "try reinstalling" — is a failure.
