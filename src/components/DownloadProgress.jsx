import { Box, Text, useStdout } from 'ink';
import { COLORS } from '../ui/theme.js';

export function DownloadProgress({ download }) {
  const { stdout } = useStdout();
  if (!download) return null;
  const width = Math.max(40, (stdout?.columns ?? 80) - 8);
  const barW = Math.min(30, width - 30);

  if (download.status === 'active') {
    const filled = Math.round(((download.pct ?? 0) / 100) * barW);
    const bar = '━'.repeat(filled) + '○' + '─'.repeat(Math.max(0, barW - filled - 1));
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1} flexDirection="column">
        <Text color={COLORS.TEXT}>Downloading… {download.title}</Text>
        <Text>
          <Text color={COLORS.PINK}>{bar}</Text> {(download.pct ?? 0).toFixed(0)}%
        </Text>
        <Text color={COLORS.MUTED}>
          Speed: {download.speed ?? '…'} · ETA: {download.eta ?? '…'} · x cancels
        </Text>
      </Box>
    );
  }
  if (download.status === 'done') {
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1}>
        <Text color={COLORS.GREEN}>✓ Download complete — {download.title} (added to ~/Music)</Text>
      </Box>
    );
  }
  if (download.status === 'error') {
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1}>
        <Text color={COLORS.RED}>✗ Download failed — {download.message ?? download.title}</Text>
      </Box>
    );
  }
  if (download.status === 'cancelled') {
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1}>
        <Text color={COLORS.MUTED}>Download cancelled — {download.title}</Text>
      </Box>
    );
  }
  return null;
}
