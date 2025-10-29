# github-to-linear

A CLI tool to import a single GitHub issue to Linear.

## Prerequisites

### GitHub CLI

This tool requires GitHub CLI (`gh`) to be installed and authenticated:

```bash
# macOS
brew install gh

# Authenticate
gh auth login
```

[GitHub CLI Installation Guide](https://cli.github.com/)

### Linear API Key

Get your Linear API key from https://linear.app/settings/api

**Required Permissions:**
- **Read** (required)
- **Create issues** (required)
- **Create comments** (required if using `--with-comments`)

## Quick Start

Import a GitHub issue to Linear using npx (no installation required):

```bash
npx github-to-linear import \
  --linear-key lin_api_xxxxxxxxxxxxx \
  --owner octocat \
  --repo hello-world \
  --issue 42 \
  --team ENG
```

### Find Your Team Key

Your team key can be found in the Linear URL when viewing your team:

```
https://linear.app/your-workspace/team/ENG/...
                                        ^^^
                                     Team Key
```

For example:
- `https://linear.app/acme/team/ENG/active` → Team Key is `ENG`
- `https://linear.app/acme/team/PROD/backlog` → Team Key is `PROD`

Simply navigate to your team's page in Linear and copy the team key from the URL.

## Usage

### Basic Usage

```bash
npx github-to-linear import \
  --linear-key YOUR_LINEAR_API_KEY \
  --owner GITHUB_OWNER \
  --repo REPO_NAME \
  --issue ISSUE_NUMBER \
  --team TEAM_KEY
```

### Using Environment Variable

You can also set the Linear API key as an environment variable:

```bash
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx

npx github-to-linear import \
  --owner octocat \
  --repo hello-world \
  --issue 42 \
  --team ENG
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--owner` | `-o` | GitHub repository owner | **Required** |
| `--repo` | `-r` | GitHub repository name | **Required** |
| `--issue` | `-i` | GitHub issue number | **Required** |
| `--team` | `-t` | Linear team key (e.g., ENG, PROD) | **Required** |
| `--linear-key` | `-k` | Linear API key (overrides env var) | - |
| `--priority` | `-p` | Priority (0-4) | `3` |
| `--with-comments` | - | Import comments as well | `false` |
| `--with-labels` | - | Import labels as Linear labels | `false` |
| `--link-github` | - | Link to the original GitHub issue | `true` |
| `--yes` | `-y` | Skip confirmation prompt | `false` |

### Priority Values

- `0`: No priority
- `1`: Urgent
- `2`: High
- `3`: Medium (default)
- `4`: Low

## Examples

### Simple import

```bash
npx github-to-linear import \
  -k lin_api_xxxxxxxxxxxxx \
  -o octocat \
  -r hello-world \
  -i 42 \
  -t ENG
```

### Import with comments and labels

```bash
npx github-to-linear import \
  -k lin_api_xxxxxxxxxxxxx \
  -o octocat \
  -r hello-world \
  -i 42 \
  -t ENG \
  --with-comments \
  --with-labels
```

### Skip confirmation (non-interactive)

Useful for CI/CD or scripts:

```bash
npx github-to-linear import \
  -k lin_api_xxxxxxxxxxxxx \
  -o octocat \
  -r hello-world \
  -i 42 \
  -t ENG \
  --yes
```

### High priority urgent issue

```bash
npx github-to-linear import \
  -k lin_api_xxxxxxxxxxxxx \
  -o octocat \
  -r hello-world \
  -i 42 \
  -t ENG \
  -p 1
```

## Features

- ✅ Import GitHub issue title and body
- ✅ Convert GitHub state to Linear workflow state
  - `open` → `Backlog` / `Todo`
  - `closed` → `Done` / `Completed`
- ✅ Set priority
- ✅ Import labels (auto-create if not exists)
- ✅ Import comments
- ✅ Automatic link to original GitHub issue
- ✅ Interactive confirmation before import
- ✅ Team key resolution (no need for UUID)

## Development

### Setup

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd github-to-linear
npm install
```

### Build

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev -- import -k lin_api_xxx -o owner -r repo -i 123 -t ENG
```

### Lint & Format

This project uses [Biome](https://biomejs.dev/).

```bash
# Check
npm run lint

# Auto-fix
npm run lint:fix

# Format
npm run format
```

## License

MIT