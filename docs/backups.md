# Backup and restore

The owner creates a local archive from the checkout’s command line. Opening **Backups** in the app explains the commands; it does not create an archive.

## Save a backup

Stop the local app so nothing can write during export. If preview is running, stop it with `rer preview --stop` too. From the checkout root:

```sh
rer dev --stop
rer export --output exports/buoy.rer
```

Keep the archive private and record the release commit beside it. Store a copy outside the checkout before losing or replacing the computer. Exports belong under `exports/` in the checkout, or at an absolute path outside it; do not put an archive in a publicly served directory.

## Know what the archive includes

The archive contains domain records, historical approval identity labels, imported normalized evidence, undo history and erasure tombstones. Evidence references are retained; documents held in other systems are not copied. Original upload byte formatting is not retained.

It excludes native operators, sessions, agent credentials, outbox mail and private settings. Restoring establishes a new owner and fresh local configuration; historical approval labels remain as part of the domain record. Recreate required agent access deliberately after restoration.

## Restore into an empty installation

Use a fresh clone of the same release commit, before starting `dev`. Put the private archive at the path you will import, then run from that fresh checkout:

```sh
npx -y @runeditrun/rer install just-every/run-buoy
cd run-buoy
rer import --input /path/to/buoy.rer --yes
rer setup
rer dev
```

Replace `/path/to/buoy.rer` with the saved archive’s actual path. Enter the new owner mailbox in the setup prompt, or use the documented `--owner-email` flag. Open the private **RER_OPEN** link, confirm **Finish setup**, then inspect the restored accounts and historical decisions.

Import validates the archive and requires an empty destination. Damaged archives and nonempty destinations are refused. Restoration does not merge the archive into an active installation. Local transfer is supported; remote transfer is unsupported and fails visibly.

## Reset only after saving what matters

`rer reset --yes` is destructive. It removes local database and storage state, owner and sessions, outbox, private settings and local installer bookkeeping. It retains source, dependencies and exported archives. Review the command’s declared inventory and export any records you need before confirming reset.

For a deliberate replacement of the current local installation, stop the app, export, reset, import the saved archive, then run setup and dev again. A fresh clone is the clearer restoration path when you want to preserve the current installation for comparison.

## Account deletion and old backups

Deleting an account removes its live work, decisions and retained normalized import evidence. Nonpersonal erasure receipts and replay tombstones remain. Deletion cannot remove copies that were already exported or documents in other systems.

Keep old archives under your team’s retention policy. Restoring an older archive into a different empty installation restores its historical contents, including records that existed at the time of export.

The repository’s [local operations guide](https://github.com/just-every/run-buoy/blob/main/RUN-LOCALLY.md) explains supported transfer paths, private state and reset behaviour.
