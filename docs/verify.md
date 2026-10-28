# Verify Buoy

[CONTRACT.md](../CONTRACT.md) is the current acceptance and status source; [ACCEPTANCE.md](../ACCEPTANCE.md) is generated from it. The former hand-written acceptance source is archived in [CHANGELOG.md](../CHANGELOG.md).

From the checkout root, regenerate and check contract documents before locking:

```sh
node src/base/contract-docs.mjs write
node src/base/contract-docs.mjs check
node scripts/edition-authoring/cli.mjs lock
rer check
rer build --site
rer verify
```

The carried-done assertion audit is in [DONE-AUDIT.md](contract/DONE-AUDIT.md). Verify runs the product suites on the exact candidate commit; a historical receipt does not establish a later commit.
