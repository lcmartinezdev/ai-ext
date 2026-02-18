---
name: security-baseline
description: Baseline security policy — prevents destructive commands and protects sensitive files
permissions:
  deny:
    - "Bash(rm -rf *)"
    - "Bash(curl * | sh)"
    - "Read(.env)"
    - "Read(**/*.pem)"
    - "Read(**/*.key)"
  ask:
    - "Bash(git push *)"
    - "Bash(npm publish *)"
    - "Edit(*.config.*)"
    - "Edit(*.json)"
  allow:
    - "Read(src/**)"
    - "Bash(npm test)"
    - "Bash(npm run lint)"
    - "Bash(npm run build)"
sandbox:
  enabled: true
  network:
    allowedDomains:
      - "github.com"
      - "*.npmjs.org"
      - "registry.npmjs.org"
---

## Security Baseline Policy

This policy enforces minimum security standards across all agents:

### Prohibited Actions
- Destructive shell commands (`rm -rf`, piping curl to shell)
- Reading secret files (`.env`, private keys, certificates)

### Requires Confirmation
- Publishing packages or pushing to remote
- Editing configuration files

### Pre-approved
- Reading source code
- Running tests, lints, and builds

### Sandboxing
- Network access restricted to GitHub and npm registries
- All other outbound connections blocked
