import React from 'react';
import { render } from 'ink';
import { parseArgs, KNOWN_COMMANDS } from './cli/parse.js';
import { helpText } from './cli/help.js';
import { getVersion } from './cli/version.js';
import { App } from './app/App.jsx';
import { runScan } from './cli/scan.js';
import { runDoctor } from './cli/doctor.js';
import { runYtSearch } from './cli/yt-search.js';

async function main() {
  const { command, rest } = parseArgs(process.argv);

  if (command === 'help') {
    process.stdout.write(helpText());
    return;
  }

  if (command === 'version') {
    process.stdout.write(`ymusix ${getVersion()}\n`);
    return;
  }

  if (command === 'scan') {
    await runScan();
    return;
  }

  if (command === 'doctor') {
    await runDoctor();
    return;
  }

  if (command === 'yt-search') {
    await runYtSearch((rest ?? []).join(' ').trim());
    return;
  }

  if (command === 'play' || command === undefined) {
    // Signal/exit cleanup is owned by App (it must stop mpv first).
    const { waitUntilExit } = render(<App />);
    await waitUntilExit();
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n\n`);
  process.stdout.write(helpText());
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`Error: ${err?.message ?? err}\n`);
  process.exitCode = 1;
});
