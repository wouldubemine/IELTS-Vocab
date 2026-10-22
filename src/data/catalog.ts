import rawWords from '../../words.json';
import type { CategoryMeta, Word } from '../types/word';

export const WORDS: Word[] = rawWords as Word[];

type SeedCategory = {
  id: string;
  name: string;
  mark: string;
};

/**
 * Exact 37 categories in source PDF order (Spec Section 3.1).
 * Each gets a deterministic tint index (0..7) and an italic Fraunces monogram mark.
 */
const CANONICAL_CATEGORY_SEEDS: SeedCategory[] = [
  { id: 'days-of-the-week', name: 'Days of the week', mark: 'Dy' },
  { id: 'months-of-the-year', name: 'Months of the year', mark: 'Mo' },
  { id: 'money-matters', name: 'Money matters', mark: '£$' },
  { id: 'subjects', name: 'Subjects', mark: 'Sb' },
  { id: 'studying-at-college-university', name: 'Studying at college/university', mark: 'Un' },
  { id: 'marketing', name: 'Marketing', mark: 'Mk' },
  { id: 'health', name: 'Health', mark: 'Hl' },
  { id: 'nature', name: 'Nature', mark: 'Na' },
  { id: 'the-environment', name: 'The environment', mark: 'Ev' },
  { id: 'the-animal-kingdom', name: 'The animal kingdom', mark: 'An' },
  { id: 'plants', name: 'Plants', mark: 'Pl' },
  { id: 'continents', name: 'Continents', mark: 'Cn' },
  { id: 'countries', name: 'Countries', mark: 'Ct' },
  { id: 'languages', name: 'Languages', mark: 'Lg' },
  { id: 'architecture-and-buildings', name: 'Architecture and buildings', mark: 'Ar' },
  { id: 'homes', name: 'Homes', mark: 'Hm' },
  { id: 'in-the-city', name: 'In the city', mark: 'Ci' },
  { id: 'workplaces', name: 'Workplaces', mark: 'Wp' },
  { id: 'rating-and-qualities', name: 'Rating and qualities', mark: 'Rq' },
  { id: 'touring', name: 'Touring', mark: 'Tr' },
  { id: 'verbs', name: 'Verbs', mark: 'Vb' },
  { id: 'adjectives', name: 'Adjectives', mark: 'Aj' },
  { id: 'hobbies', name: 'Hobbies', mark: 'Hb' },
  { id: 'sports', name: 'Sports', mark: 'Sp' },
  { id: 'shapes', name: 'Shapes', mark: 'Sh' },
  { id: 'measurement', name: 'Measurement', mark: 'Ms' },
  { id: 'transportations', name: 'Transportations', mark: 'Tp' },
  { id: 'vehicles', name: 'Vehicles', mark: 'Vh' },
  { id: 'weather', name: 'Weather', mark: 'Wt' },
  { id: 'places', name: 'Places', mark: 'Pc' },
  { id: 'equipment-and-tools', name: 'Equipment and tools', mark: 'Eq' },
  { id: 'the-arts-and-media', name: 'The arts and media', mark: 'Am' },
  { id: 'materials', name: 'Materials', mark: 'Mt' },
  { id: 'works-and-jobs', name: 'Works and jobs', mark: 'Jb' },
  { id: 'color', name: 'Color', mark: 'Cl' },
  { id: 'expressions-and-time', name: 'Expressions and time', mark: 'Tm' },
  { id: 'other', name: 'Other', mark: 'Ot' },
];

function buildCatalog(): {
  categories: CategoryMeta[];
  wordsByCategory: Map<string, Word[]>;
  uniqueWordCount: number;
} {
  const wordsByCategory = new Map<string, Word[]>();
  const uniqueIds = new Set<string>();

  for (const w of WORDS) {
    uniqueIds.add(w.id);
    const bucket = wordsByCategory.get(w.category);
    if (bucket) {
      bucket.push(w);
    } else {
      wordsByCategory.set(w.category, [w]);
    }
  }

  const seenCats = new Set<string>();
  const categories: CategoryMeta[] = [];

  for (const seed of CANONICAL_CATEGORY_SEEDS) {
    seenCats.add(seed.id);
    const list = wordsByCategory.get(seed.id) ?? [];
    const order = categories.length;
    categories.push({
      id: seed.id,
      name: seed.name,
      order,
      tintIndex: order % 8,
      mark: seed.mark,
      wordCount: list.length,
    });
  }

  // Automatically surface any user-added category in words.json without code edits
  for (const [catId, list] of wordsByCategory.entries()) {
    if (!seenCats.has(catId)) {
      const order = categories.length;
      const pretty = catId
        .replace(/-/g, ' ')
        .replace(/^\w/, (ch) => ch.toUpperCase());
      categories.push({
        id: catId,
        name: pretty,
        order,
        tintIndex: order % 8,
        mark: pretty.slice(0, 2),
        wordCount: list.length,
      });
    }
  }

  return {
    categories,
    wordsByCategory,
    uniqueWordCount: uniqueIds.size,
  };
}

export const CATALOG = buildCatalog();

export function getCategoryById(id: string | undefined): CategoryMeta | undefined {
  if (!id) return undefined;
  return CATALOG.categories.find((c) => c.id === id);
}
