// Shared metadata for the five town-wide boards tracked on the Public Board
// Meeting Calendar page. Imported by both the API route and the page so the
// board list, labels and source links can't drift apart.
export const BOARDS = {
  bos: {
    key: 'bos',
    short: 'BOS',
    name: 'Board of Selectmen',
    sourceLabel: 'Town of Greenwich — Board of Selectmen calendar',
    sourceUrl: 'https://www.greenwichct.gov/calendar.aspx?CID=30'
  },
  boe: {
    key: 'boe',
    short: 'BOE',
    name: 'Board of Education',
    sourceLabel: 'Greenwich Public Schools — Board of Education meeting calendar',
    sourceUrl: 'https://www.greenwichschools.org/board-of-education'
  },
  rtm: {
    key: 'rtm',
    short: 'RTM',
    name: 'Representative Town Meeting',
    sourceLabel: 'Town of Greenwich — Representative Town Meeting calendar',
    sourceUrl: 'https://www.greenwichct.gov/calendar.aspx?CID=46'
  },
  bet: {
    key: 'bet',
    short: 'BET',
    name: 'Board of Estimate & Taxation',
    sourceLabel: 'Town of Greenwich — Board of Estimate & Taxation calendar',
    sourceUrl: 'https://www.greenwichct.gov/calendar.aspx?CID=38'
  },
  pz: {
    key: 'pz',
    short: 'P&Z',
    name: 'Planning & Zoning Commission',
    sourceLabel: 'Town of Greenwich — Planning & Zoning Commission calendar',
    sourceUrl: 'https://www.greenwichct.gov/calendar.aspx?CID=29'
  }
};

export const BOARD_ORDER = ['bos', 'boe', 'rtm', 'bet', 'pz'];
