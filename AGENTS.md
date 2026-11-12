# SecretSanta – notes for agents

CLI that draws Secret Santa pairs, generates a Polish message (OpenAI) and an image per person, and emails them via SendGrid.
Flags: `node dist/index.js --help`. npm scripts: `package.json`. Human docs: `README.md`.

## Running the app

Every real run emails real people and costs money. Pick the mode by what the user asked for:

| Goal | Command | Needs |
|---|---|---|
| Check code changes | `npm test && npm run lint && npm run build` | nothing |
| Smoke-test the CLI offline | `OPENAI_BASE_URL=http://127.0.0.1:9 OPENAI_API_KEY=x node dist/index.js --dry-run` from a scratch dir holding `config/participants.json` | nothing; fails at the first OpenAI call by design |
| Preview real content | `npm run santa:dry-run` (or `santa:dry-run-no-images`, cheaper) | OpenAI key |
| Send the real draw | `npm run santa -- --yes` | the user's explicit go-ahead **in this task** |

- The sending run asks `[y/N]` on a terminal. Without one it exits 0 and sends nothing unless you pass `--yes`. Treat `--yes` as the user's confirmation, so pass it only after they gave it.
- After a failed real run, use `npm run santa:resume`. A plain `npm run santa` refuses while `state/` exists.
- `--fresh` re-draws, and people who already got an email receive a second, different one. Ask the user first.
- `--resume` refuses if `config/participants.json` changed since the draw. Restore the file instead of reaching for `--fresh`.

## Keeping the draw secret

The user organizes and takes part, so nobody may see who drew whom, including the user. In anything you show the user (replies, logs, commits, PRs):

- Report the verification block (✓ checks, cycle structure, draw code) and counts. That is the spoiler-free summary.
- Leave `output/` (dry-run preview) and `state/` (encrypted draw) unopened. Their contents are pairs.
- A dry-run draw is throwaway: it is never reused for the real run.

## Environment

- `.env` is blocked for agents by a project hook. Ask the user to edit it, and name the variables: `OPENAI_API_KEY`, `SENDGRID_API_KEY`, `SENDGRID_FROM`, optional `OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`.
- When OpenAI retires a model, change the default constant in `src/services/LlmService.ts` / `ImageService.ts` and check the OpenAI deprecations page for the replacement.
- Commits follow Conventional Commits.
