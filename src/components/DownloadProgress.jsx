import { Box, Text, useStdout } from 'ink';

export function DownloadProgress({ download }) {
  const { stdout } = useStdout();
  if (!download) return null;
  const width = Math.max(40, (stdout?.columns ?? 80) - 8);
  const barW = Math.min(30, width - 30);

  if (download.status === 'active') {
    const filled = Math.round(((download.pct ?? 0) / 100) * barW);
    const bar = '━'.repeat(filled) + '●' + '─'.repeat(Math.max(0, barW - filled - 1));
    return (
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text>Downloading… {download.title}</Text>
        <Text>
          {bar} {(download.pct ?? 0).toFixed(0)}%
        </Text>
        <Text dimColor>
          Speed: {download.speed ?? '…'} · ETA: {download.eta ?? '…'} · x cancels
        </Text>
      </Box>
    );
  }
  if (download.status === 'done') {
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text color="green">✓ Download complete — {download.title} (added to ~/Music)</Text>
      </Box>
    );
  }
  if (download.status === 'error') {
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text color="red">✗ Download failed — {download.message ?? download.title}</Text>
      </Box>
    );
  }
  if (download.status === 'cancelled') {
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text dimColor>Download cancelled — {download.title}</Text>
      </Box>
    );
  }
  return null;
}
