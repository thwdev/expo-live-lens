# Security Policy

Expo Live Lens is a local development tool. It can receive screenshots, logs,
network metadata, route names, and app events from your development app.

## Supported Versions

This project is early-stage. Security fixes target the main branch.

## Reporting Issues

Do not open public issues for sensitive security problems. If this project is
hosted under an organization, use that organization's private vulnerability
reporting process. Until then, report privately to the maintainer.

## Important Defaults

- The dashboard binds to `0.0.0.0` so phones on the same LAN can reach it.
- Do not expose the dashboard to the public internet.
- Screenshots may contain personal data, API responses, tokens, or customer data.
- Review packets are written under `tmp/`, which is gitignored.
- Recorded sessions are stored under `tmp/live-lens-sessions`, which is gitignored.

## Recommended Use

- Use only on trusted local networks.
- Do not run on public Wi-Fi without firewall rules.
- Do not paste review packets into public issues if screenshots/logs include sensitive data.
- Turn off screenshots with `captureScreenshots={false}` for sensitive screens.
- Clear sessions before sharing a machine or switching to sensitive app data.
