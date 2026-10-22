# Data Cleaning & Normalization Notes (`CLEANING_NOTES.md`)

**Source file:** `uploads/1200_most_commonly_repeated_words_in.pdf` (4 pages, titled *"The 1200 most commonly repeated words in IELTS Listening Test"*)  
**Generated output:** `words.json`  
**Build pipeline:** `scripts/build_words.py`

---

## 1. Summary Metrics

| Metric | Count | Notes |
|---|---:|---|
| Source pages parsed | 4 | Page footers `1`, `2`, `3`, `4` stripped |
| Categories preserved in exact source order | **37** | Matches Section 3.1 word-for-word |
| Raw comma-delimited tokens in PDF | 924 | *(Note: the PDF title says "1200 words" because its body contains ~1,130 individual whitespace-separated words across multi-word phrases)* |
| Merged items split (`+3`) | +3 | `"July August"`, `"Australia and Antarctica"`, `"tourist guided tour"` |
| Within-category duplicates removed (`-4`) | -4 | `"India"`, `"French"`, `"hot"`, `"paper"` |
| **Final category entries in `words.json`** | **923** | Every entry conforms strictly to `Word` schema (`id`, `text`, `category`, `alt?`, `hint?`) |
| **Unique normalized `Word.id` slugs** | **919** | 4 words appear in 2 categories each and share progress via identical `id` |
| Entries with British/American or orthographic `alt` spellings | **55** | Every `text` is pure ASCII so every item is directly typeable on any keyboard |
| Entries with disambiguating `hint` clues | **29** | Covers homophones (including non-rhotic British RP homophones such as `fort`/`fought` and `court`/`caught`) |

---

## 2. Category Headings Normalized (All 37 in Exact Order)

All 37 categories from Section 3.1 were extracted using PDF font-span inspection (`TrebuchetMS-Bold`, 19pt) — critical because **Category 26 (`Measurement`) lacks a colon in the PDF** and would merge into `Shapes` under naive colon-based regex splitting.

| # | Category ID | Canonical Name | Raw PDF Heading Span | Heading Fix Applied |
|---:|---|---|---|---|
| 1 | `days-of-the-week` | Days of the week | `Days of the week:` | Stripped `:` |
| 2 | `months-of-the-year` | Months of the year | `Months of the year:` | Stripped `:` |
| 3 | `money-matters` | Money matters | `Money matters:` | Stripped `:` |
| 4 | `subjects` | Subjects | `Subjects:` | Stripped `:` |
| 5 | `studying-at-college-university` | Studying at college/university | `Studying at college/university:` | Stripped `:` |
| 6 | `marketing` | Marketing | `Marketing:` | Stripped `:` |
| 7 | `health` | Health | `Health:` | Stripped `:` |
| 8 | `nature` | Nature | `Nature:` | Stripped `:` |
| 9 | `the-environment` | The environment | `the environment:` | Capitalized initial `T`; stripped `:` |
| 10 | `the-animal-kingdom` | The animal kingdom | `The animal kingdom:` | Stripped `:` |
| 11 | `plants` | Plants | `plants: ` | Capitalized `P`; stripped `: ` |
| 12 | `continents` | Continents | `continents:` | Capitalized `C`; stripped `:` |
| 13 | `countries` | Countries | `Countries:` | Stripped `:` |
| 14 | `languages` | Languages | `Languages:` | Stripped `:` |
| 15 | `architecture-and-buildings` | Architecture and buildings | `Architecture and buildings: ` | Stripped `: ` |
| 16 | `homes` | Homes | `Homes:` | Stripped `:` |
| 17 | `in-the-city` | In the city | `In the city:` | Stripped `:` |
| 18 | `workplaces` | Workplaces | `Workplaces:` | Stripped `:` |
| 19 | `rating-and-qualities` | Rating and qualities | `Rating and qualities:` | Stripped `:` |
| 20 | `touring` | Touring | `Touring:` | Stripped `:` (no space after colon in PDF) |
| 21 | `verbs` | Verbs | `Verbs:` | Stripped `:` |
| 22 | `adjectives` | Adjectives | `Adjectives:` | Stripped `:` |
| 23 | `hobbies` | Hobbies | `hobbies:` | Capitalized `H`; stripped `:` |
| 24 | `sports` | Sports | `sports:` | Capitalized `S`; stripped `:` |
| 25 | `shapes` | Shapes | `Shapes:` | Stripped `:` |
| 26 | `measurement` | Measurement | `Measurement` | **Missing colon in source PDF** — detected via 19pt bold font span |
| 27 | `transportations` | Transportations | `Transportations: ` | Stripped `: ` (kept `Transportations` per Spec §3.1) |
| 28 | `vehicles` | Vehicles | `Vehicles:` | Stripped `:` |
| 29 | `weather` | Weather | `Weather:` | Stripped `:` |
| 30 | `places` | Places | `Places: ` | Stripped `: ` |
| 31 | `equipment-and-tools` | Equipment and tools | `equipment and tools:` | Capitalized `E`; stripped `:` |
| 32 | `the-arts-and-media` | The arts and media | `The arts and media:` | Stripped `:` |
| 33 | `materials` | Materials | `Materials: ` | Stripped `: ` |
| 34 | `works-and-jobs` | Works and jobs | `Works and jobs:` | Stripped `:` |
| 35 | `color` | Color | `Color:` | Stripped `:` (kept `Color` per Spec §3.1) |
| 36 | `expressions-and-time` | Expressions and time | `expressions and time:` | Capitalized `E`; stripped `:` |
| 37 | `other` | Other | `Other:` | Stripped `:` |

---

## 3. Obvious Typos Fixed

| Page | Category | Raw PDF Text | Cleaned `text` | Notes |
|---:|---|---|---|---|
| 2 | `the-environment` | `burring fossil` | `burning fossils` | Typo `burring` → `burning`; pluralized for natural grammar with `alt: ["burning fossil"]` (see §9 review notes) |
| 2 | `the-environment` | `soar power` | `solar power` | Typo `soar` → `solar` |
| 3 | `vehicles` | `stream train` | `steam train` | Typo `stream` → `steam` |
| 4 | `equipment-and-tools` | `breaks` | `brakes` | Appears immediately adjacent to `helmet, light, ... wheels` — classic homophone transcription error for vehicle/bicycle `brakes` (also flagged in §9) |
| 4 | `other` | `proﬁciency` | `proficiency` | Contained Unicode ligature `ﬁ` (`U+FB01`) in `LucidaGrande` font span, which fails keyboard comparison if un-normalized *(note: some PDF extractors drop `ﬁ` entirely here and in `sufficient` → `sufcient`; both are pure ASCII `proficiency` and `sufficient` in `words.json`)* |

---

## 4. Merged Items Split (Missing Commas / List Conjunctions)

| Page | Category | Raw PDF Text | Cleaned Items | Rationale |
|---:|---|---|---|---|
| 1 | `months-of-the-year` | `July August` | `"July"`, `"August"` | Missing comma between the 7th and 8th months |
| 2 | `continents` | `Australia and Antarctica .` | `"Australia"`, `"Antarctica"` | Conjunction `and` used before final list item instead of a comma; splitting yields all 7 continents |
| 3 | `touring` | `Touring:tourist guided tour` | `"tourist"`, `"guided tour"` | Missing comma between `tourist` and `guided tour` right after unspaced colon (flagged in §9) |

---

## 5. Non-ASCII Punctuation, Stray Delimiters & Line-Break Fixes

### 5.1 Arabic Commas (`،` — `U+060C`) Replaced with Standard Delimiters (5 instances)
1. **Page 1 · `money-matters`:** `coupon، counterfeit money` → `"coupon"`, `"counterfeit money"`
2. **Page 1 · `health`:** `medicine، treatment` → `"medicine"`, `"treatment"`
3. **Page 2 · `countries`:** `the philippines، Denmark.` → `"the Philippines"`, `"Denmark"`
4. **Page 3 · `adjectives`:** `voluntary، mandatory` → `"voluntary"`, `"mandatory"`
5. **Page 4 · `works-and-jobs`:** `psychologist، volunteer` → `"psychologist"`, `"volunteer"`

### 5.2 Curly Apostrophes (`’` — `U+2019`) Normalized to ASCII `'` (2 instances)
1. **Page 1 · `money-matters`:** `taxpayers’ money` → `"taxpayers' money"`
2. **Page 1 · `studying-at-college-university`:** `registrar’s office` → `"registrar's office"`

### 5.3 Double Commas, Stray Spaces Around Commas, Trailing Commas & Periods
- **Double comma collapsed:** Page 4 · `other`: `private sector,, practice` → `"private sector"`, `"practice"` (no empty item generated).
- **Missing spaces after commas cleaned:** `budget deficit,retail voucher` (`money-matters`), `airport,crew` (`transportations`), `exhibition,classical music` (`the-arts-and-media`), `museum,ballet` (`the-arts-and-media`), `craftsman ,work experience` (`works-and-jobs`).
- **Extra spaces before commas/periods cleaned:** `geography ,` (`subjects`), `Australia and Antarctica .` (`continents`), `Switzerland ,` (`countries`), `wheels ,` (`equipment-and-tools`), `Opera ,` / `Orchestra ,` / `concert ,` (`the-arts-and-media`), `craftsman ,` (`works-and-jobs`), `dialogue ,` (`other`).
- **Double internal spaces collapsed:** `debt,  interest-free credit`, `renewable,  source of energy`, `ocean currents,  soil conditioner`, `the press,  conductor`, `cotton,  fabric`, `pedestrian safety,  traffic jams`.
- **Trailing periods stripped (9 categories):** `duty-free store.`, `stationery.`, `recruitment.`, `regular exercise.`, `contaminated.`, `Australia and Antarctica .`, `Denmark.`, `cheap.`, `touch.`, `fortnight.`.
- **Trailing commas stripped (9 categories):** after `penguin,`, `French,`, `sculpture,`, `avenue,`, `aquarium,`, `cylindrical,`, `goods train,`, `moisture,`, `backpack,`, `sufficient,`.
- **Stray page numbers stripped:** `1`, `2`, `3`, `4` at bottom of pages 1–4 plus document title line on page 1.

### 5.4 Line-Wrapped Multi-Word Phrases & Hyphenation Rejoined (12 instances)
- **Hyphenated word split across line break (joined without space):**
  - `expressions-and-time`: `full-\ntime` → `"full-time"` (matches `"full-time"` in `studying-at-college-university`!)
- **Multi-word phrases wrapped across PDF lines (joined with single space):**
  - `money-matters`: `finance \ndepartment` → `"finance department"`
  - `subjects`: `visual \narts` → `"visual arts"`
  - `studying-at-college-university`: `bachelor's \ndegree` → `"bachelor's degree"`
  - `the-environment`: `hydroelectric \npower` → `"hydroelectric power"`, `soil \nconditioner` → `"soil conditioner"`
  - `homes`: `apartment \nbuilding` → `"apartment building"`
  - `in-the-city`: `department \nstore` → `"department store"`
  - `workplaces`: `technical \ncooperation` → `"technical cooperation"`
  - `rating-and-qualities`: `strongly \nrecommended` → `"strongly recommended"`
  - `vehicles`: `freight \ntrain` → `"freight train"`
  - `works-and-jobs`: `mail \naddress` → `"mail address"`
  - `other`: `life \nexpectancy` → `"life expectancy"`

---

## 6. Capitalization Normalizations

### 6.1 Stray Uppercase Lowercased (7 items)
| Category | Raw PDF | Normalized |
|---|---|---|
| `studying-at-college-university` | `Proofreading` | `proofreading` |
| `adjectives` | `Immense` | `immense` |
| `adjectives` | `Western` | `western` |
| `shapes` | `Square` | `square` |
| `shapes` | `Oval` | `oval` |
| `measurement` | `Mass` | `mass` |
| `the-arts-and-media` | `Opera`, `Orchestra` | `opera`, `orchestra` |

### 6.2 Lowercase Proper Nouns / Nationalities Capitalized (3 items)
| Category | Raw PDF | Normalized |
|---|---|---|
| `countries` | `the dominican republic` | `the Dominican Republic` |
| `countries` | `the philippines` | `the Philippines` |
| `sports` | `american football` | `American football` |

### 6.3 Proper Nouns, Acronyms & Brands Preserved Uppercase
- **Days (`days-of-the-week`):** `Monday`–`Sunday` preserved; common nouns `weekdays`, `weekend` kept lowercase.
- **Months (`months-of-the-year`):** `January`–`December` preserved.
- **Continents (`continents`):** `South America`, `North America`, `Africa`, `Asia`, `Europe`, `Australia`, `Antarctica` preserved.
- **Countries (`countries`):** All 23 country names preserved capitalized.
- **Languages (`languages`):** All 15 language proper nouns (`Portuguese`–`Greek`) preserved capitalized; common linguistics terms (`linguistics`, `bilingual`, `trilingual`, `polyglot`) kept lowercase.
- **Brands & Acronyms:** `MasterCard`, `VISA`, `TV program` preserved.

---

## 7. Deduplication & Cross-Category Shared Progress

### 7.1 Within-Category Duplicates Removed (4 exact + 1 slash duplicate)
1. **`countries`:** `India` appeared twice → second occurrence removed.
2. **`languages`:** `French` appeared twice → second occurrence removed.
3. **`weather`:** `hot` appeared twice → second occurrence removed.
4. **`materials`:** `paper` appeared twice → second occurrence removed.
5. **`materials`:** `lumber/wood` appeared 6 items before standalone `wood` → normalized `lumber/wood` to `"lumber"` (with `alt: ["lumber/wood"]`) while keeping standalone `"wood"` so both words are practiced cleanly without redundancy (see §9).

### 7.2 Cross-Category Words Retained with Shared `id` (4 words / 8 entries)
Per Section 3.3, a word appearing in more than one category is kept in both categories and keyed by the same normalized `Word.id` so mastering it once counts everywhere:
- `accommodation` → `studying-at-college-university`, `places`
- `field` → `nature`, `sports`
- `full-time` → `studying-at-college-university`, `expressions-and-time`
- `specialist` → `studying-at-college-university`, `works-and-jobs`

---

## 8. Accepted Alternative Spellings (`alt`) Added (55 Entries)

| Category | Canonical `text` | Accepted `alt` Spellings | Reason |
|---|---|---|---|
| `money-matters` | `cheque` | `check` | UK / US spelling |
| `money-matters` | `taxpayers' money` | `taxpayers money`, `taxpayer's money` | Spoken possessive apostrophe ambiguity |
| `subjects` | `archaeology` | `archeology` | UK / US spelling |
| `studying-at-college-university` | `student advisor` | `student adviser` | US / UK spelling |
| `studying-at-college-university` | `computer centre` | `computer center` | UK / US spelling |
| `studying-at-college-university` | `home stay` | `homestay` | Open vs closed compound |
| `studying-at-college-university` | `post-secondary` | `postsecondary` | Hyphenated vs closed compound |
| `studying-at-college-university` | `bachelor's degree` | `bachelors degree` | Spoken possessive apostrophe variant |
| `studying-at-college-university` | `registrar's office` | `registrars office` | Spoken possessive apostrophe variant |
| `marketing` | `catalogue` | `catalog` | UK / US spelling |
| `marketing` | `TV program` | `TV programme` | US / UK spelling |
| `health` | `yoghurt` | `yogurt`, `yoghourt` | UK / US / Commonwealth spellings |
| `health` | `blackcurrant` | `black currant` | Closed vs open compound |
| `the-environment` | `burning fossils` | `burning fossil` | Plural / singular form from typo fix |
| `plants` | `fertilizer` | `fertiliser` | US (`-ize`) / UK (`-ise`) |
| `countries` | `Turkey` | `Türkiye`, `Turkiye` | Modern official spelling |
| `countries` | `the Dominican Republic` | `Dominican Republic` | Optional leading article |
| `countries` | `the Philippines` | `Philippines` | Optional leading article |
| `languages` | `Punjabi` | `Panjabi` | Standard / academic variant |
| `homes` | `town house` | `townhouse` | Open vs closed compound |
| `homes` | `neighborhood` | `neighbourhood` | US / UK spelling |
| `homes` | `storey` | `story` | UK / US spelling |
| `in-the-city` | `city centre` | `city center` | UK / US spelling |
| `workplaces` | `technical cooperation` | `technical co-operation` | Unhyphenated / UK hyphenated form |
| `rating-and-qualities` | `colored` | `coloured` | US / UK spelling |
| `touring` | `single/double bedded room` | `single double bedded room`, `single or double bedded room` | Slash / spoken equivalents |
| `hobbies` | `snorkeling` | `snorkelling` | US (`-l-`) / UK (`-ll-`) |
| `hobbies` | `woodcarving` | `wood carving` | Closed vs open compound |
| `sports` | `the discus` | `discus` | Optional leading article |
| `sports` | `the javelin` | `javelin` | Optional leading article |
| `sports` | `the hammer` | `hammer` | Optional leading article |
| `sports` | `the high jump` | `high jump` | Optional leading article |
| `sports` | `bodyboarding` | `body boarding` | Closed vs open compound |
| `sports` | `kitesurfing` | `kite surfing` | Closed vs open compound |
| `transportations` | `narrowboat` | `narrow boat` | Closed vs open compound |
| `transportations` | `sailboat` | `sail boat` | Closed vs open compound |
| `transportations` | `rowboat` | `row boat` | Closed vs open compound |
| `transportations` | `seaplane` | `sea plane` | Closed vs open compound |
| `vehicles` | `pickup` | `pick-up` | Closed vs hyphenated/open compound |
| `places` | `cafe` | `café` | Unaccented / accented spelling |
| `places` | `sports centre` | `sports center` | UK / US spelling |
| `equipment-and-tools` | `disk` | `disc` | US / UK spelling |
| `the-arts-and-media` | `theatre` | `theater` | UK / US spelling |
| `materials` | `aluminum` | `aluminium` | US / UK spelling |
| `materials` | `lumber` | `lumber/wood` | Normalized from slash entry |
| `materials` | `fiberglass` | `fibreglass` | US / UK spelling |
| `color` | `grey` | `gray` | UK / US spelling |
| `expressions-and-time` | `a gap year` | `gap year` | Optional indefinite article |
| `other` | `practice` | `practise` | Noun / UK verb homophone |
| `other` | `dialogue` | `dialog` | UK / US spelling |
| `other` | `personal fulfillment` | `personal fulfilment` | US / UK spelling |
| `other` | `driving license` | `driving licence` | US (`-se`) / UK (`-ce`) noun spelling |
| `other` | `man-made` | `manmade` | Hyphenated vs closed compound |
| `other` | `fund-raising event` | `fundraising event` | Hyphenated vs closed compound |
| `other` | `encyclopedia` | `encyclopaedia` | Modern / UK classical spelling |

---

## 9. Ambiguous Source Items Flagged for User Review

Per Section 3.3 (*"Flag anything ambiguous in `CLEANING_NOTES.md` for the user to review instead of guessing silently"*), please review the decisions below — if you want any changed in `words.json` before Phase 2, tell me and I will update them immediately:

1. **`single double bedded room` (`touring`, p. 3)**
   - **Current `words.json`:** `text: "single/double bedded room"`, `alt: ["single double bedded room", "single or double bedded room"]`, `hint: "hotel room capacity option"`.
   - **Why flagged:** Matches Section 3.3's suggestion (`"single/double bedded room"`). Alternative option: split into two separate entries (`"single-bedded room"` and `"double-bedded room"`).
2. **`burring fossil` (`the-environment`, p. 2)**
   - **Current `words.json`:** `text: "burning fossils"`, `alt: ["burning fossil"]`.
   - **Why flagged:** Section 3.3 notes `"burning fossil(s)"`. Putting literal parentheses in `text` would cause Web Speech TTS to read `"parenthesis"` aloud; `"burning fossils"` speaks naturally and `"burning fossil"` is accepted via `alt`.
3. **`breaks` → `brakes` (`equipment-and-tools`, p. 4)**
   - **Current `words.json`:** `text: "brakes"`, `hint: "stopping mechanism on a vehicle or bike"` (`"breaks"` is **not** accepted in `alt` because IELTS Listening strictly penalizes homophone misspellings).
   - **Why flagged:** Appears in `helmet, light, ... screen, breaks, wheels` — clearly a source PDF homophone typo for bicycle/vehicle `brakes`.
4. **`lumber/wood` (`materials`, p. 4)**
   - **Current `words.json`:** `text: "lumber"`, `alt: ["lumber/wood"]` (since standalone `"wood"` already appears 6 items later in `materials`).
   - **Why flagged:** Avoids TTS reading `"lumber slash wood"` while preserving both `"lumber"` and `"wood"` in `materials`.
5. **`Touring:tourist guided tour` (`touring`, p. 3)**
   - **Current `words.json`:** Split into `"tourist"` and `"guided tour"`.
   - **Why flagged:** Source omitted the comma right after `Touring:`.
6. **`poultry and game` (`the-animal-kingdom`, p. 2)**
   - **Current `words.json`:** Kept intact as `"poultry and game"`.
   - **Why flagged:** Standard British set phrase in IELTS contexts, though it could optionally be split into `"poultry"` and `"game"`.
7. **Leading articles in `the Dominican Republic`, `the Philippines`, `the discus`, `the javelin`, `the hammer`, `the high jump`, `a gap year`**
   - **Current `words.json`:** Preserved leading articles as in the source PDF and added article-free forms in `alt` so learners aren't penalized either way.
8. **Unusual category placements preserved verbatim from PDF (`antenna` in `weather`, `parachute` in `hobbies`)**
   - **Current `words.json`:** Retained faithfully rather than altering source vocabulary.
