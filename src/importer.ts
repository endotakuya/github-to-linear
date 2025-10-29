import { exec } from 'node:child_process';
import * as readline from 'node:readline';
import { promisify } from 'node:util';
import { LinearClient } from '@linear/sdk';

const execAsync = promisify(exec);

interface ImportOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  teamId: string;
  linearApiKey?: string;
  priority?: number;
  withComments?: boolean;
  withLabels?: boolean;
  linkGithub?: boolean;
  skipConfirmation?: boolean;
}

interface ImportResult {
  id: string;
  url: string;
  title: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
}

interface GitHubComment {
  user: {
    login: string;
  };
  created_at: string;
  body: string;
}

async function checkGhCli(): Promise<void> {
  try {
    await execAsync('gh --version');
  } catch (error) {
    throw new Error(
      'gh CLI is not installed or not in PATH. Please install it from https://cli.github.com/'
    );
  }
}

async function fetchGitHubIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssue> {
  const { stdout } = await execAsync(`gh api repos/${owner}/${repo}/issues/${issueNumber}`);
  return JSON.parse(stdout);
}

async function fetchGitHubComments(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const { stdout } = await execAsync(
    `gh api repos/${owner}/${repo}/issues/${issueNumber}/comments`
  );
  return JSON.parse(stdout);
}

async function confirmImport(
  issue: GitHubIssue,
  options: {
    withComments: boolean;
    withLabels: boolean;
    priority: number;
  }
): Promise<boolean> {
  console.log('\n📋 Issue Preview:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Title: ${issue.title}`);
  console.log(`State: ${issue.state}`);
  console.log(`URL: ${issue.html_url}`);
  console.log(`Labels: ${issue.labels.map((l) => l.name).join(', ') || 'None'}`);
  console.log(`Priority: ${['No priority', 'Urgent', 'High', 'Medium', 'Low'][options.priority]}`);
  console.log(`Import comments: ${options.withComments ? 'Yes' : 'No'}`);
  console.log(`Import labels: ${options.withLabels ? 'Yes' : 'No'}`);
  console.log('─────────────────────────────────────────────────────────');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nImport this issue to Linear? [y/N] ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function resolveTeamId(linear: LinearClient, teamKeyOrId: string): Promise<string> {
  // If it's already a UUID, return it as is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(teamKeyOrId)) {
    return teamKeyOrId;
  }

  // Otherwise, treat it as a team key and resolve to team ID
  console.log(`🔍 Resolving team key: ${teamKeyOrId}...`);

  const teams = await linear.teams();

  // Find team by key (case-insensitive)
  const team = teams.nodes.find((t) => t.key.toLowerCase() === teamKeyOrId.toLowerCase());

  if (!team) {
    const availableTeams = teams.nodes.map((t) => `  - ${t.key}: ${t.name}`).join('\n');

    throw new Error(
      `Team not found: "${teamKeyOrId}"\n\nAvailable teams:\n${availableTeams}\n\nPlease use one of the team keys above.`
    );
  }

  console.log(`✓ Found team: ${team.name} (${team.key})`);
  return team.id;
}

export async function importIssue(options: ImportOptions): Promise<ImportResult> {
  const {
    owner,
    repo,
    issueNumber,
    teamId,
    linearApiKey,
    priority = 3,
    withComments = false,
    withLabels = false,
    linkGithub = true,
    skipConfirmation = false,
  } = options;

  // Check gh CLI
  await checkGhCli();

  // Resolve Linear API key with priority: CLI argument > Environment variable
  const apiKey = linearApiKey || process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Linear API key is required. Please provide it via:\n' +
        '  1. Command line: --linear-key YOUR_KEY\n' +
        '  2. Environment variable: LINEAR_API_KEY=YOUR_KEY\n' +
        '\n' +
        'Get your API key from: https://linear.app/settings/api'
    );
  }

  const linear = new LinearClient({ apiKey });

  // Resolve team key to team ID
  const resolvedTeamId = await resolveTeamId(linear, teamId);

  console.log(`📥 Fetching GitHub issue #${issueNumber} from ${owner}/${repo}...`);

  // Fetch GitHub issue using gh CLI
  const issue = await fetchGitHubIssue(owner, repo, issueNumber);

  console.log(`📝 Issue title: ${issue.title}`);

  // Interactive confirmation (unless --yes is specified)
  if (!skipConfirmation) {
    const confirmed = await confirmImport(issue, {
      withComments,
      withLabels,
      priority,
    });

    if (!confirmed) {
      console.log('❌ Import cancelled.');
      process.exit(0);
    }
  }

  // Prepare description
  let description = issue.body || '';

  if (linkGithub) {
    description = `> Imported from GitHub: ${issue.html_url}\n\n${description}`;
  }

  // Convert GitHub state to Linear state
  let stateId: string | undefined;
  try {
    const states = await linear.workflowStates({
      filter: { team: { id: { eq: resolvedTeamId } } },
    });

    if (issue.state === 'closed') {
      // Find "Done" or "Completed" state
      const doneState = states.nodes.find(
        (s) => s.name.toLowerCase() === 'done' || s.name.toLowerCase() === 'completed'
      );
      stateId = doneState?.id;
    } else {
      // Find "Backlog" or "Todo" state
      const backlogState = states.nodes.find(
        (s) => s.name.toLowerCase() === 'backlog' || s.name.toLowerCase() === 'todo'
      );
      stateId = backlogState?.id;
    }
  } catch (error) {
    console.warn('⚠️  Could not fetch workflow states:', error);
  }

  // Prepare label IDs
  const labelIds: string[] = [];
  if (withLabels && issue.labels.length > 0) {
    console.log(`🏷️  Processing ${issue.labels.length} labels...`);

    try {
      const linearLabels = await linear.issueLabels();

      for (const ghLabel of issue.labels) {
        const labelName = ghLabel.name;
        if (!labelName) continue;

        // Find or create label in Linear
        let linearLabel = linearLabels.nodes.find(
          (l) => l.name.toLowerCase() === labelName.toLowerCase()
        );

        if (!linearLabel) {
          console.log(`  Creating label: ${labelName}`);
          const created = await linear.createIssueLabel({
            name: labelName,
            color: `#${ghLabel.color || '000000'}`,
          });
          linearLabel = await created.issueLabel;
        }

        if (linearLabel) {
          labelIds.push(linearLabel.id);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not process labels:', error);
    }
  }

  // Create issue in Linear
  console.log('🚀 Creating issue in Linear...');

  const issueData: {
    teamId: string;
    title: string;
    description: string;
    priority: number;
    stateId?: string;
    labelIds?: string[];
  } = {
    teamId: resolvedTeamId,
    title: issue.title,
    description,
    priority: priority,
  };

  if (stateId) {
    issueData.stateId = stateId;
  }

  if (labelIds.length > 0) {
    issueData.labelIds = labelIds;
  }

  const createdIssue = await linear.createIssue(issueData);
  const linearIssue = await createdIssue.issue;

  if (!linearIssue) {
    throw new Error('Failed to create issue in Linear');
  }

  // Import comments if requested
  if (withComments) {
    console.log('💬 Fetching comments...');

    const comments = await fetchGitHubComments(owner, repo, issueNumber);

    if (comments.length > 0) {
      console.log(`  Found ${comments.length} comments`);

      for (const comment of comments) {
        try {
          const commentBody = `**Comment by @${comment.user?.login} on ${new Date(comment.created_at).toLocaleDateString()}:**\n\n${comment.body}`;

          await linear.createComment({
            issueId: linearIssue.id,
            body: commentBody,
          });
        } catch (error) {
          console.warn(`  ⚠️  Could not import comment: ${error}`);
        }
      }
    }
  }

  return {
    id: linearIssue.id,
    url: linearIssue.url,
    title: linearIssue.title,
  };
}