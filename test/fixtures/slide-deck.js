const layouts = [
  ['cover', 'opening'],
  ['statement', 'objectives'],
  ['split', 'recall'],
  ['steps', 'concept'],
  ['comparison', 'example'],
  ['activity', 'activity'],
  ['quiz', 'check'],
  ['answer', 'check'],
  ['visual', 'synthesis'],
  ['summary', 'next-steps'],
];

export function makeTestSlideDeck() {
  return {
    deckTitle: 'Fractions Tell a Fair-Share Story',
    subtitle: 'Grade 5 Mathematics',
    communicationGoal: 'Learners compare and explain unlike fractions.',
    artDirection: 'Warm editorial collage with tactile paper shapes, soft shadows, and generous negative space.',
    themeColors: {
      primary: '17324D',
      secondary: 'E9A23B',
      accent: '2F6F7E',
      background: 'F7F3EA',
      text: '17212B',
    },
    slides: layouts.map(([layout, section], index) => ({
      title: index === 0 ? 'One pizza, many fair shares' : `Takeaway ${index + 1}: fractions show relationships`,
      kicker: section,
      subtitle: index === 0 ? 'Compare unlike fractions through models and reasoning.' : undefined,
      body: index === 6 ? 'Which fraction is greater: 2/3 or 3/5?' : 'Use the model, explain the relationship, and justify your choice.',
      bullets: ['Notice the whole', 'Compare equal-sized parts', 'Explain with evidence'],
      speakerNotes: `Slide ${index + 1}: Ask learners to explain their reasoning. Allow 2 minutes.`,
      visualPrompt: ['cover', 'statement', 'split', 'visual'].includes(layout)
        ? 'Paper fraction circles arranged as a fair-sharing scene on a classroom table'
        : undefined,
      visualPosition: index % 2 === 0 ? 'right' : 'left',
      layout,
      section,
    })),
  };
}
