import { describe, expect, it } from 'vitest';
import rawChangelog from './changelog.json';
import { CURRENT_VERSION, LATEST_RELEASE } from './changelog-latest';

describe('changelog-latest', () => {
  it('matches the newest entry in changelog.json (run `npm run changelog` if this fails)', () => {
    const latest = rawChangelog[0];
    expect(LATEST_RELEASE).toEqual({
      version: latest.version,
      date: latest.date,
      summary: latest.summary,
    });
    expect(CURRENT_VERSION).toBe(latest.version);
  });
});
