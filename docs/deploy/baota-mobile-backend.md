# BaoTa Deployment Runbook for memduck Mobile Backend

## Target

- Panel: https://bt.talkape.net:4646/site/node
- Domain: https://memduck.talkape.net
- Project path: `/www/wwwroot/memduck`
- Internal port: `3000`
- PM2 app name: `memduck`
- Runtime data: `/www/wwwroot/memduck/.memduck/runtime`

## GUI-First Setup

1. Open the BaoTa panel in Safari.
2. Go to Node Project.
3. Create or edit the `memduck` Node project.
4. Set project path to `/www/wwwroot/memduck`.
5. Set run mode to PM2.
6. Set the internal port to `3000`.
7. Set the public domain to `memduck.talkape.net`.
8. Configure SSL for `memduck.talkape.net`.
9. Configure the webhook command:

```bash
bash /www/wwwroot/memduck/deploy.sh
```

## First Manual Deploy

Run the webhook once from the BaoTa GUI. If the GUI cannot run it, use SSH only for this narrow release command:

```bash
ssh baota-talkape 'bash /www/wwwroot/memduck/deploy.sh'
```

## Verification

Open:

- `https://memduck.talkape.net/api/setup-state`
- `https://memduck.talkape.net/channels`

Expected:

- The site responds over HTTPS.
- The Node project is visible in BaoTa.
- PM2 app `memduck` is online.
- Runtime data is under `/www/wwwroot/memduck/.memduck/runtime`.
