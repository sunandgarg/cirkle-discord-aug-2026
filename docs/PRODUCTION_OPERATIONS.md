# Production operations

## Capacity target

One million HTTP requests per day averages 11.6 requests/second. Capacity tests use 100 requests/second by default to leave room for traffic bursts. Run against staging:

```sh
k6 run -e BASE_URL=https://staging.example.com load/k6-million-daily.js
```

The release gate is less than 1% failed requests, p95 below 500 ms, and p99 below 1 second. Repeat with authenticated API journeys and production-sized data before declaring capacity.

## Required alerts

- Frontend 5xx/error rate and Core Web Vitals
- Supabase database CPU, IO, connections, slow queries, storage, and replication lag
- Edge-function error rate, p95 duration, invocations, and throttling
- Authentication failures, suspicious role changes, and abnormal write volume
- Daily.co and other third-party quota/failure rates
- Cost and usage alerts at 50%, 75%, 90%, and 100% of budget

## Recovery

- Enable point-in-time recovery and daily backups.
- Test restoration into a separate project quarterly.
- Deploy database migrations before the frontend and keep the previous frontend artifact available for rollback.
- Never roll back a destructive migration; use forward corrective migrations.
