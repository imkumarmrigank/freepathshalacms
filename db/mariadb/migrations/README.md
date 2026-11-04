# MariaDB migrations

Put new schema changes here as `001_what_it_does.sql`, `002_...`, in MariaDB SQL. `npm run migrate`
applies each file once, in name order, and records it in `schema_migrations`.

- The baseline (`../schema.sql`, `../foreign-keys.sql`, `../triggers.sql`) is the schema as it was when
  the app moved from PostgreSQL (it already includes everything from the old `db/migrations/001`–`068`).
- MariaDB cannot roll back a schema change: keep files small, fix mistakes with a new file.
- Dates and booleans: use `DATE` / `TINYINT(1)`; arrays and JSON go in `JSON` columns; if a new date or
  timestamp column is added, also add it to `src/lib/sql-columns.ts` (the app uses it to translate date maths).
- After adding a column to a table, the old `db/migrations/` PostgreSQL files are NOT used any more.
