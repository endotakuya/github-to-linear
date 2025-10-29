#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { importIssue } from './importer';

dotenv.config();

const program = new Command();

program
  .name('github-to-linear')
  .description('Import a single GitHub issue to Linear')
  .version('1.0.0');

program
  .command('import')
  .description('Import a GitHub issue to Linear')
  .requiredOption('-o, --owner <owner>', 'GitHub repository owner')
  .requiredOption('-r, --repo <repo>', 'GitHub repository name')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .requiredOption('-t, --team <teamKey>', 'Linear team key (e.g., ENG, PROD)')
  .option('-k, --linear-key <apiKey>', 'Linear API key (overrides LINEAR_API_KEY env var)')
  .option(
    '-p, --priority <priority>',
    'Priority (0-4: No priority, Urgent, High, Medium, Low)',
    '3'
  )
  .option('--with-comments', 'Import comments as well', false)
  .option('--with-labels', 'Import labels as Linear labels', false)
  .option('--link-github', 'Link to the original GitHub issue', true)
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (options) => {
    try {
      const result = await importIssue({
        owner: options.owner,
        repo: options.repo,
        issueNumber: Number.parseInt(options.issue, 10),
        teamId: options.team,
        linearApiKey: options.linearKey,
        priority: Number.parseInt(options.priority, 10),
        withComments: options.withComments,
        withLabels: options.withLabels,
        linkGithub: options.linkGithub,
        skipConfirmation: options.yes,
      });

      console.log('✅ Issue imported successfully!');
      console.log(`Linear URL: ${result.url}`);
      console.log(`Linear ID: ${result.id}`);
    } catch (error) {
      console.error('❌ Error importing issue:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
