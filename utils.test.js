import { connectionLevels } from './utils.js';

test('includes currently engaged level', () => {
  expect(connectionLevels).toContain('Currently engaged');
});
