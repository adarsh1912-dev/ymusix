export function parseArgs(argv) {
  const args = argv.slice(2);
  let command = 'play';
  let commandSet = false;
  const rest = [];

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      return { command: 'help', flags: {}, rest: [] };
    }
    if (arg === '--version' || arg === '-V' || arg === '-v') {
      return { command: 'version', flags: {}, rest: [] };
    }
    if (!arg.startsWith('-') && !commandSet) {
      command = arg;
      commandSet = true;
    } else if (commandSet && !arg.startsWith('-')) {
      rest.push(arg);
    }
  }

  // No args -> default interactive player
  if (args.length === 0) {
    return { command: 'play', flags: {}, rest: [] };
  }

  return { command, flags: {}, rest };
}

export const KNOWN_COMMANDS = ['play', 'scan', 'doctor', 'yt-search', 'help', 'version'];
