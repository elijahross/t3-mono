# Prisma Setup & Usage Guide

### 1. Install Dependencies

```bash
npm install @prisma/adapter-pg pg
npm install -D @types/pg
```

### 2. Configure Environment Variables

Add your database connection string to `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

## Database Migrations

### Creating a Migration

```bash
npx prisma migrate dev --name your_migration_name
```

This will:

1. Generate SQL migration files in `prisma/migrations/`
2. Apply the migration to your database
3. Regenerate the Prisma Client

### Applying Migrations (Production)

```bash
npx prisma migrate deploy
```

### Without Shadow Database

Some databases don't require a shadow database for migrations. The `prisma.config.ts` file is configured to use your main `DATABASE_URL` for migrations.

If you encounter shadow database errors, use `prisma db push` for development instead:

```bash
npx prisma db push
```

## Migration History & Logging

### View Migration Status

```bash
npx prisma migrate status
```

This shows:

- Applied migrations
- Pending migrations
- Migration history issues

### View Migration History

Migration history is stored in two places:

1. **File system**: `prisma/migrations/` directory contains all migration SQL files
2. **Database**: `_prisma_migrations` table tracks applied migrations

To query the migration table directly:

```sql
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
```

## Removing Migrations

### Remove an Unapplied Migration

If a migration hasn't been applied yet, simply delete the folder from `prisma/migrations/`.

### Remove an Applied Migration from History

To remove a migration record from the database log (marking it as rolled back):

```bash
npx prisma migrate resolve --rolled-back "migration_name"
```

Example:

```bash
npx prisma migrate resolve --rolled-back "20240115_add_user_fields"
```

### Force Reset Migration History (Development Only)

**Warning**: This will delete all data in your database.

```bash
npx prisma migrate reset
```

This will:

1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed scripts (if configured)

### Manually Remove Migration Record

If you need to manually remove a migration from the log without affecting the schema:

```sql
DELETE FROM _prisma_migrations WHERE migration_name = '20240115_add_user_fields';
```

Then delete the corresponding folder from `prisma/migrations/`.

## Common Commands Reference

| Command                     | Description                               |
| --------------------------- | ----------------------------------------- |
| `npx prisma generate`       | Regenerate Prisma Client                  |
| `npx prisma migrate dev`    | Create and apply migration (dev)          |
| `npx prisma migrate deploy` | Apply pending migrations (prod)           |
| `npx prisma migrate status` | Check migration status                    |
| `npx prisma migrate reset`  | Reset database and reapply all migrations |
| `npx prisma db push`        | Push schema changes without migration     |
| `npx prisma studio`         | Open Prisma Studio GUI                    |
| `npx prisma format`         | Format schema file                        |

## Troubleshooting

### "Migration failed to apply cleanly"

Run migrate status to see the issue:

```bash
npx prisma migrate status
```

Then resolve with:

```bash
npx prisma migrate resolve --applied "migration_name"
```

### "Drift detected"

Your database schema doesn't match the migration history. Options:

1. Run `npx prisma db push` to sync (loses migration history for those changes)
2. Create a new migration to capture the drift
3. Reset the database (development only)
