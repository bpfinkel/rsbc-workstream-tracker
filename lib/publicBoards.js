import { RSBC_SOURCE_URL } from './rsbcSchedule';

// Shared metadata for the boards tracked on the Public Board Meeting Calendar
// page: the committee's own meetings plus the five town-wide boards it
// tracks for context. Imported by both the API route and the page so the
// board list, labels and source links can't drift apart.
export const BOARDS = {
  rsbc: {
    key: 'rsbc',
    short: 'RSBC',
    name: 'Riverside Building Committee',
    sourceLabel: 'Greenwich Public Schools — Riverside Building Committee meeting calendar',
    sourceUrl: RSBC_SOURCE_URL
  },
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

export const BOARD_ORDER = ['rsbc', 'bos', 'boe', 'rtm', 'bet', 'pz'];
