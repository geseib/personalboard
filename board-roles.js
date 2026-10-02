export const REPORT_ROLES = [
  {key:'mentors', name:'Mentors', purpose:'Perspective & wisdom', color:[16,145,108]},
  {key:'coaches', name:'Coaches', purpose:'Skills & accountability', color:[37,99,235]},
  {key:'connectors', name:'Connectors', purpose:'Relationships & opportunity', color:[185,119,13]},
  {key:'sponsors', name:'Sponsors', purpose:'Advocacy & advancement', color:[124,74,204]},
  {key:'peers', name:'Peers', purpose:'Shared learning & support', color:[211,65,77]}
];

// Saved boards can include metadata or legacy fields alongside the role lists.
export function getBoardGroups(data = {}) {
  return REPORT_ROLES.map(role => ({
    ...role,
    members: Array.isArray(data[role.key])
      ? data[role.key].filter(member => member && typeof member === 'object' && !Array.isArray(member))
      : []
  }));
}
