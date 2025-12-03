# Kiro Execution Issues & Workarounds

## Command Completion Detection Issue

There is a known issue where Kiro runs a command that completes successfully in the shell, but Kiro doesn't recognize the completion and hangs waiting for output. The command finishes in seconds and output is visible in the terminal, but Kiro doesn't proceed.

### Symptoms
- Command executes and completes in shell
- Output is visible in terminal
- Kiro appears to hang/wait indefinitely
- Copying command + output into chat causes Kiro to continue

### Root Cause
Likely an execution feedback loop issue:
- Output buffering problems (output not flushed before Kiro reads)
- Timing race conditions (Kiro checks before output fully available)
- Large output truncation breaking parsing

### Workarounds

**1. Add explicit completion signals:**
```bash
npm run build && echo "BUILD_COMPLETE"
npm test && echo "TESTS_COMPLETE"
```

**2. Redirect stderr to stdout:**
```bash
npm test 2>&1
```

**3. Use file-based verification in specs:**
Instead of relying on command output, verify completion by checking files:
```markdown
- Run build command and verify dist/ directory exists
- Run tests and check for test-results.json
```

**4. Structure tasks atomically:**
Break tasks into smaller commands that are less likely to have output issues.

**5. Avoid commands with excessive output:**
If a command produces very large output, it may trigger truncation issues.

### When This Happens
- Can affect any command type (npm, node, ts-node, etc.)
- More common with commands that have substantial output
- May be related to shell configuration (zsh themes/plugins)

### If You Encounter This
1. Wait to see if Kiro eventually processes the output
2. If stuck, manually provide the command output in chat
3. Consider using the workarounds above for subsequent commands
4. Note which specific commands trigger the issue for pattern recognition
