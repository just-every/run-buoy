# Getting started

Run Buoy on your computer, finish the owner setup, then add your first account. Local use needs no Cloudflare account or mail provider.

## Get Buoy and start it

You need macOS, Linux or Windows with WSL2. One line, the same as [Run Buoy](/run):

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-buoy
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-buoy` does the same. The line installs rer for you alone, with its own Node if you have no Node 22 or later, then gets Buoy into `run-buoy`, installs its locked dependencies, prepares local data, makes you the owner and prints a private link that opens Buoy signed in. If the installer prints a line that puts rer on your PATH, run that line too.

To start Buoy again later, run the same line from the same folder, or `cd run-buoy && rer dev`. A first launch can take several minutes. Progress and queue messages explain what is happening; if the shell stops waiting, run `rer dev` again to resume.

Open the private link printed in your terminal on this computer. It opens Buoy signed in as the owner. Keep the link private: it grants access to the local installation.

## Finish setup

At **Finish setup**, confirm the owner and complete the first-run form. Until this is saved, the app returns the owner to setup. Then open **Accounts** and use the **First use** checklist.

An empty installation has no business records. Start with one real account and its confirmed renewal terms, or follow [Move in](/docs/move-in) to import your own records. Follow [Accounts and evidence](/docs/accounts) to understand what to enter.

## Choose your owner mailbox

For a fresh installation with your own mailbox, run `npx -y @runeditrun/rer install just-every/run-buoy`, then the separate setup steps from the checkout before starting:

```sh
rer setup
rer dev
```

Enter the mailbox in the setup prompt. Setup also supports `rer setup --owner-email you@example.com`. Repeating setup preserves an existing owner and data; it does not replace the owner with a different identity.

## Use ordinary email-link sign-in locally

Stop development, then start with the local outbox sign-in flow:

```sh
rer dev --stop
rer dev --login
```

Open the outbox link RER prints. Request sign-in for the saved owner email on the app’s sign-in page, then follow the newest ordinary sign-in message in the outbox and confirm it. Local mail stays on this computer. A successful sign-in consumes the link once.

## Stop and return later

```sh
rer dev --stop
```

Run `rer dev` from the same checkout to return. Local database state persists in `.wrangler/state`; private settings live in `.dev.vars`. Keep both outside Git. Stop development and preview before builds or data transfer. [Create a backup](/docs/backups) before discarding a checkout or resetting an installation.

## Install beyond your computer

The public site and an installed Buoy are separate. Your installed app has its own sign-in and data. For deployment into your Cloudflare account, follow the repository’s [deployment instructions](https://github.com/just-every/run-buoy#deploy-to-your-cloudflare-account), including private credentials and a working mail provider. A local dry run does not prove hosted sign-in or mail delivery.
