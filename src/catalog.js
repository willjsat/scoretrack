export const CATALOG = [
  ['Death Knight', ['Blood', 'Frost', 'Unholy']],
  ['Demon Hunter', ['Havoc', 'Vengeance', 'Devourer']],
  ['Druid', ['Balance', 'Feral', 'Guardian', 'Restoration']],
  ['Evoker', ['Augmentation', 'Devastation', 'Preservation']],
  ['Hunter', ['Beast Mastery', 'Marksmanship', 'Survival']],
  ['Mage', ['Arcane', 'Fire', 'Frost']],
  ['Monk', ['Brewmaster', 'Mistweaver', 'Windwalker']],
  ['Paladin', ['Holy', 'Protection', 'Retribution']],
  ['Priest', ['Discipline', 'Holy', 'Shadow']],
  ['Rogue', ['Assassination', 'Outlaw', 'Subtlety']],
  ['Shaman', ['Elemental', 'Enhancement', 'Restoration']],
  ['Warlock', ['Affliction', 'Demonology', 'Destruction']],
  ['Warrior', ['Arms', 'Fury', 'Protection']]
];

export const slug = value => value.toLowerCase().replaceAll(' ', '-');

export function entities() {
  return CATALOG.flatMap(([className, specs]) => [
    { id: slug(className), type: 'class', className, specName: null },
    ...specs.map(specName => ({
      id: `${slug(className)}-${slug(specName)}`,
      type: 'spec', className, specName
    }))
  ]);
}
