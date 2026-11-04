# Switch from Neon to MariaDB (Hostinger)

About 10-15 minutes, ideally late evening or early morning. Everyone is logged out at step 5, and
the old database is kept untouched as a rollback until the team has used the new one for a while.

## Before the window (anytime)
- Tell the team the site will be down for ~15 minutes and they must log in again afterwards.
- Have ready: the Neon connection string (the pooled one), the MariaDB user/password
  (`u544746722_smstest`), a new random `JWT_SECRET` (`openssl rand -hex 32`).

## In the window
1. **Freeze Neon** (Neon SQL editor, one line). Saves now fail with an error instead of changing data:
   `ALTER DATABASE neondb SET default_transaction_read_only = on;`
   (use the real database name from the connection string; already-open connections can keep
   writing for a short while, step 3 catches that)
2. **Final copy** (Terminal on the server, in `~/smstest`):
   `read -s` the Neon URL and the MariaDB password, then
   `node copy-data.mjs --replace --with-media`
   Wait for `RESULT: every table matches the source exactly.`
3. **Prove nothing changed during the copy:** run it again with `--verify-only`. Must say the same.
   If not, repeat step 2.
4. **Merge** `mariadb-port` into `main` (fast-forward, main has nothing the branch lacks).
5. **hPanel > the site > Node.js > Environment variables**, edit only these two, then save/redeploy:
   - `DATABASE_URL` = `mysql://u544746722_smstest:<password, URL-encoded>@127.0.0.1:3306/u544746722_smstest`
   - `JWT_SECRET` = the new random value (this logs every user out)
   Push/redeploy takes about 3 minutes; the site is unavailable during that time.
6. **Check:** log in, open the dashboard, a student, and save one attendance mark.

## Roll back (only if something is badly wrong)
Put the old `DATABASE_URL` (Neon) back, run
`ALTER DATABASE neondb SET default_transaction_read_only = off;`, and revert the merge. Anything saved
on MariaDB since the switch would not be on Neon.

## After a few quiet days
Delete the Neon project. Rotate the Neon password and the Render key that were pasted in chat.
