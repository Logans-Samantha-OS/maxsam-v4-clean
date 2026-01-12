# GITHUB BRANCH PROTECTION SETTINGS
Repository: maxsam-v4-clean
Branch: main

## PURPOSE
Prevent direct pushes to main and enforce CI validation before production changes.

## REQUIRED RULES

- Require pull request before merging
- Require at least 1 approving review
- Dismiss stale reviews
- Require status checks to pass
- Required status check name: validate
- Require branch to be up to date before merging
- Require linear history
- Include administrators
- Disable force pushes
- Disable branch deletion

## ENFORCEMENT
No code reaches production unless:
1. Changes are committed via PR
2. CI passes successfully
3. Review is approved

## VERIFICATION
Attempting to push directly to main must fail.

## EMERGENCY BYPASS
Only allowed with documented incident and immediate post-mortem.
