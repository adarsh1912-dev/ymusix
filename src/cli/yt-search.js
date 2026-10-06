import { searchYouTube } from '../online/YouTubeSearch.js';
import { formatTime } from '../utils/formatTime.js';
import { formatViews } from '../utils/formatViews.js';

// Diagnostic plumbing command: exercises the YouTube search service
// without the UI. `ymusix yt-search "<query>"`
export async function runYtSearch(query) {
  if (!query) {
    process.stderr.write('Usage: ymusix yt-search "<query>"\n');
    process.exitCode = 1;
    return;
  }
  try {
    const { results, cached } = await searchYouTube(query, { limit: 10 });
    if (results.length === 0) {
      process.stdout.write('No results.\n');
      return;
    }
    process.stdout.write(`YouTube results for "${query}"${cached ? ' (cached)' : ''}:\n\n`);
    results.forEach((r, i) => {
      const views = r.viewCount != null ? ` · ${formatViews(r.viewCount)}` : '';
      process.stdout.write(
        `${String(i + 1).padStart(2, ' ')}. ${r.title}\n    ${r.channel} · ${formatTime(r.duration)}${views}\n    ${r.url}\n`,
      );
    });
  } catch (err) {
    if (err.code === 'missing') {
      process.stderr.write(`✗ ${err.hint ?? 'yt-dlp is not installed.'}\n`);
    } else {
      process.stderr.write(`✗ ${err.message}\n`);
    }
    process.exitCode = 1;
  }
}
