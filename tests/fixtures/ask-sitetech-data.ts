import type { AskAnswer } from '@/components/screens/ask-sitetech';

export const askAnswerFixture: AskAnswer = {
  text: 'TCO moves about 11 working days, about $132k at your project\'s delay cost. The switchgear need, A4120 Energize building, which has 4 days of float. A 3-week slip uses all of it and pushes elevator commissioning and TCO inspections behind it. Owner\'s carry and your general conditions are both in the $12k/day rate the PX set on Sep 30.',
  chart: [
    { label: '-1 week\nTCO v+8d', value: 0 },
    { label: '2 weeks\nTCO +9d', value: 72000 },
    { label: '3 weeks\nTCO +16d', value: 192000 },
    { label: '4 weeks\nTCO +21d', value: 0 },
  ],
  suggestions: [
    'Draft expedite request to vendor',
    'Draft owner delay notice',
    'Show resequence options',
  ],
};

export const recentQuestionsFixture: string[] = [
  'What\'s blocking level 3 this week?',
  'Did anyone send out the formal notice this month?',
  'Chase the curtain wall shop drawings',
  'Draft the change event for the owner\'s EV charger email',
];
