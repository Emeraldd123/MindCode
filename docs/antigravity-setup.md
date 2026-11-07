# Running the three agents in Antigravity (one computer)

The agents are Antigravity's own models. They don't need an OpenRouter key; that key is only for the app we build. They talk to each other through issue #1 using `tools/board`, which needs `git`, `bash` and the GitHub CLI.

## 1. One-time setup on the computer

- Install [Git](https://git-scm.com) (on Windows this includes **Git Bash**) and the [GitHub CLI](https://cli.github.com).
- Log in once (all three agents share this login):
  ```bash
  gh auth login
  ```

## 2. Three clones, one per agent

Each agent needs its own folder so they don't overwrite each other's files or board state.

```bash
mkdir mindcode-agents && cd mindcode-agents
git clone https://github.com/Emeraldd123/MindCode web-agent
git clone https://github.com/Emeraldd123/MindCode api-agent
git clone https://github.com/Emeraldd123/MindCode ai-agent
(cd web-agent && tools/board iam web-agent)
(cd api-agent && tools/board iam api-agent)
(cd ai-agent  && tools/board iam ai-agent)
```

Check one: `cd ai-agent && tools/board whoami` should print your GitHub login and `agent: ai-agent`.

**Windows:** run these in Git Bash. Antigravity's terminal may default to PowerShell; switch its default terminal to Git Bash, or the agents must call `bash tools/board ...`.

## 3. Open each clone as its own Antigravity workspace

- Open the `web-agent`, `api-agent` and `ai-agent` folders as three workspaces (three windows, or three workspaces in the Agent Manager).
- Antigravity loads `.agents/rules/team.md` automatically, so each agent knows the rules.
- In Antigravity settings, set terminal command execution so the agents can run commands without asking each time: auto-execute, or at least allow `tools/board`, `git`, `npm`, `pip`/`uv` and `fastapi`. Otherwise every `tools/board wait` pauses for your click and the loop stalls.

## 4. Start the loop

In each of the three workspaces, start an agent conversation and type:

```
/swarm
```

Each agent checks its handle, then waits on the board.

## 5. Give the goal

From any clone's terminal (or as a comment on issue #1):

```bash
BOARD_HUMAN=Ben tools/goal "your idea here"
```

`ai-agent` posts the PLAN, all three build in parallel and push to `main`, and `ai-agent` posts `SHIPPED:` when it runs end to end.

To task one agent directly, comment on issue #1, e.g. `[Ben's Human] @web-agent make the header sticky`. If an agent finishes and stops looping, type `/swarm` in its window again.

## Teammates

Oliver, Lorien and 内山天満 don't have to run agents. They can watch issue #1, post goals or tasks, and test `DONE:` posts. If someone else does take over an agent, they follow the same steps on their own computer for that one handle. Only one copy of each handle should run at a time.
