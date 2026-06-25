Use Expo Live Lens to inspect the running Expo Go app before making mobile UI or debugging changes.

Workflow:

1. Check `http://localhost:4317/api/health`.
2. If no fresh screenshot exists, run `npm run capture:now` from the Expo Live Lens repo.
3. Prefer `npm run mobile:insights` for low-context review.
4. Use `npm run review:prompt -- mobile`, `npm run review:prompt -- ui`, or `npm run review:prompt -- bug` when a fuller prompt is needed.
5. For flows, run `npm run session:start`, let the user perform the flow, then run `npm run session:stop` and `npm run session:pull`.
6. Make focused code changes based on screenshots, logs, network events, errors, and route context.
7. Request another capture and compare before/after.

Privacy:

- Treat screenshots, logs, network payloads, and session packets as sensitive local data.
- Redact tokens, emails, private IPs, cookies, Authorization headers, and customer data before sharing.
- Remember sessions persist under `tmp/live-lens-sessions`.
