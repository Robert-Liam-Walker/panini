# Simple Kanban Service — Agent Notes

Local-first Kanban app. Was previously `panini`. See `CODEX.md` for full architecture; this file is shortcuts and gotchas for future Claude/agent sessions.

## Production

- **URL:** http://34.205.37.22:3000/
- **EC2:** `i-0b056890b11987ec4`, t3.nano, us-east-1a, AWS account `056195341948`
- **SSH:** `ssh -i ~/.ssh/panini-key.pem ubuntu@34.205.37.22`
- **App dir:** `/home/ubuntu/panini` (dir not renamed; pm2 cwd depends on it)
- **Process manager:** pm2 process `simple-kanban-service` (script: `/home/ubuntu/panini/server/dist/index.js`)
- **DB:** MySQL 8 systemd service. db `simple_kanban_service`, user `simple_kanban_service`, port 3306, password in `~/panini/.env`
- **AWS metadata still named "panini":** instance Name tag, SG `panini-sg`, key pair `panini-key`. Not renamed — SG/key would need recreation. Cosmetic.

## Deploying

```bash
ssh -i ~/.ssh/panini-key.pem ubuntu@34.205.37.22
cd ~/panini && git pull && npm install && npm run build && pm2 restart simple-kanban-service
```

If `.env` or workspace `name:` fields change, `pm2 restart --update-env` (or `pm2 delete` + `pm2 start`) is required.

## Env var loading

`npm start` passes `--env-file=../.env` to node so `process.env.SESSION_SECRET` actually loads. **Don't remove that flag** — without it, Prisma still works (it loads .env itself) but `@fastify/session` silently falls back to the placeholder secret in `server/src/index.ts`, invalidating sessions and leaking the secret to git.

## MySQL gotchas on this box

- `mysqldump` as the app user needs `--no-tablespaces` (no global PROCESS privilege).
- Ubuntu's `root@localhost` uses auth_socket — use `sudo mysql`, not `mysql -u root`.
- Both MySQL on EC2 (Ubuntu) and on local Mac (Homebrew, port 3307, socket `/tmp/mysql_brew.sock`) — don't mix them up.

## Don't do this

- **Never wrap `mysql < dump.sql` in a pipe under `set -e`.** Pipeline exit code is the last command's, so `mysql ... | grep -v warning` masks restore failures and `set -e` won't bail. Either drop the pipe, or `set -o pipefail`, or check `${PIPESTATUS[0]}`.
- Don't commit the local backup file (`*-backup-*.sql`) — contains real data. Keep it outside the repo, in `~/Documents/Development/`.
