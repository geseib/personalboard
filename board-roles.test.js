import { getBoardGroups } from './board-roles.js';

test('report selects only valid members from known roles, ignoring saved metadata', () => {
  const board = {
    mentors: [{ name: 'Mentor' }, null, 'old value'],
    coaches: { legacy: true },
    peers: [{ name: 'Peer' }],
    version: '1.0', timestamp: '2026-10-01', preferences: { view: 'cards' },
    goals: [{ description: 'A goal' }], you: { name: 'Owner' },
    custom: [{ name: 'Not a board member' }]
  };
  const groups = getBoardGroups(board);
  expect(groups).toHaveLength(5);
  expect(groups.flatMap(group => group.members).map(member => member.name)).toEqual(['Mentor', 'Peer']);
  expect(getBoardGroups().flatMap(group => group.members)).toEqual([]);
  expect(board.mentors).toHaveLength(3);
});
