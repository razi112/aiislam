/**
 * Quran API helpers — powered by https://api.quran.com (free, no key required)
 * and https://api.alquran.cloud (fallback).
 *
 * All Quranic text is sourced from verified datasets.
 * Never generate Quranic Arabic text programmatically.
 */

const BASE = 'https://api.quran.com/api/v4'
const CLOUD = 'https://api.alquran.cloud/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SurahMeta {
  number: number
  arabicName: string
  englishName: string
  malayalamName: string
  englishNameTranslation: string
  revelationType: 'Meccan' | 'Medinan'
  numberOfAyahs: number
  description: string
}

export interface Ayah {
  surahNumber: number
  ayahNumber: number
  arabic: string
  transliteration: string
  englishTranslation: string
  malayalamTranslation: string
  reference: string // e.g. "Quran 2:255"
}

export interface TafsirEntry {
  source: string
  text: string
  scholar: string
}

export interface SearchResult {
  surahNumber: number
  surahName: string
  ayahNumber: number
  arabic: string
  translation: string
  reference: string
}

// ── 114 Surahs static metadata (accurate) ───────────────────────────────────

export const SURAHS: SurahMeta[] = [
  { number: 1, arabicName: 'الفاتحة', englishName: 'Al-Fatihah', malayalamName: 'അൽ-ഫാതിഹ', englishNameTranslation: 'The Opening', revelationType: 'Meccan', numberOfAyahs: 7, description: 'The opening chapter of the Quran, recited in every unit of prayer.' },
  { number: 2, arabicName: 'البقرة', englishName: 'Al-Baqarah', malayalamName: 'അൽ-ബഖറ', englishNameTranslation: 'The Cow', revelationType: 'Medinan', numberOfAyahs: 286, description: 'The longest chapter of the Quran, covering faith, law, and guidance.' },
  { number: 3, arabicName: 'آل عمران', englishName: 'Ali \'Imran', malayalamName: "ആലു ഇംറാൻ", englishNameTranslation: 'Family of Imran', revelationType: 'Medinan', numberOfAyahs: 200, description: 'Discusses the family of Imran, including Maryam and Isa.' },
  { number: 4, arabicName: 'النساء', englishName: 'An-Nisa', malayalamName: 'അൻ-നിസാ', englishNameTranslation: 'The Women', revelationType: 'Medinan', numberOfAyahs: 176, description: 'Covers laws regarding women, family, and social justice.' },
  { number: 5, arabicName: 'المائدة', englishName: 'Al-Ma\'idah', malayalamName: 'അൽ-മാഇദ', englishNameTranslation: 'The Table Spread', revelationType: 'Medinan', numberOfAyahs: 120, description: 'The final revealed Surah, covering dietary laws and covenants.' },
  { number: 6, arabicName: 'الأنعام', englishName: 'Al-An\'am', malayalamName: 'അൽ-അൻആം', englishNameTranslation: 'The Cattle', revelationType: 'Meccan', numberOfAyahs: 165, description: 'Focuses on monotheism, prophethood, and the rejection of polytheism.' },
  { number: 7, arabicName: 'الأعراف', englishName: 'Al-A\'raf', malayalamName: 'അൽ-അഅ്റാഫ്', englishNameTranslation: 'The Heights', revelationType: 'Meccan', numberOfAyahs: 206, description: 'Stories of past prophets and the consequences of rejecting truth.' },
  { number: 8, arabicName: 'الأنفال', englishName: 'Al-Anfal', malayalamName: 'അൽ-അൻഫാൽ', englishNameTranslation: 'The Spoils of War', revelationType: 'Medinan', numberOfAyahs: 75, description: 'Revealed after the Battle of Badr, discussing ethics of warfare.' },
  { number: 9, arabicName: 'التوبة', englishName: 'At-Tawbah', malayalamName: 'അത്-തൗബ', englishNameTranslation: 'The Repentance', revelationType: 'Medinan', numberOfAyahs: 129, description: 'The only Surah without Bismillah, addressing hypocrites and disbelievers.' },
  { number: 10, arabicName: 'يونس', englishName: 'Yunus', malayalamName: 'യൂനുസ്', englishNameTranslation: 'Jonah', revelationType: 'Meccan', numberOfAyahs: 109, description: 'Discusses the story of Prophet Yunus and the mercy of Allah.' },
  { number: 11, arabicName: 'هود', englishName: 'Hud', malayalamName: 'ഹൂദ്', englishNameTranslation: 'Hud', revelationType: 'Meccan', numberOfAyahs: 123, description: 'Stories of prophets Nuh, Hud, Salih, Lut, Shuayb, and Musa.' },
  { number: 12, arabicName: 'يوسف', englishName: 'Yusuf', malayalamName: 'യൂസുഫ്', englishNameTranslation: 'Joseph', revelationType: 'Meccan', numberOfAyahs: 111, description: 'The complete story of Prophet Yusuf, described as the best of stories.' },
  { number: 13, arabicName: 'الرعد', englishName: 'Ar-Ra\'d', malayalamName: 'അർ-റഅ്ദ്', englishNameTranslation: 'The Thunder', revelationType: 'Medinan', numberOfAyahs: 43, description: 'Emphasizes the greatness of Allah and His signs in creation.' },
  { number: 14, arabicName: 'إبراهيم', englishName: 'Ibrahim', malayalamName: 'ഇബ്‍റാഹീം', englishNameTranslation: 'Abraham', revelationType: 'Meccan', numberOfAyahs: 52, description: 'The prayer and legacy of Prophet Ibrahim.' },
  { number: 15, arabicName: 'الحجر', englishName: 'Al-Hijr', malayalamName: 'അൽ-ഹിജ്ർ', englishNameTranslation: 'The Rocky Tract', revelationType: 'Meccan', numberOfAyahs: 99, description: 'Mentions the people of Al-Hijr and the creation of man.' },
  { number: 16, arabicName: 'النحل', englishName: 'An-Nahl', malayalamName: 'അൻ-നഹ്ൽ', englishNameTranslation: 'The Bee', revelationType: 'Meccan', numberOfAyahs: 128, description: 'Allah\'s blessings and signs in nature, including the honey bee.' },
  { number: 17, arabicName: 'الإسراء', englishName: 'Al-Isra', malayalamName: 'അൽ-ഇസ്റാ', englishNameTranslation: 'The Night Journey', revelationType: 'Meccan', numberOfAyahs: 111, description: 'The miraculous night journey of the Prophet from Makkah to Jerusalem.' },
  { number: 18, arabicName: 'الكهف', englishName: 'Al-Kahf', malayalamName: 'അൽ-കഹ്ഫ്', englishNameTranslation: 'The Cave', revelationType: 'Meccan', numberOfAyahs: 110, description: 'Four stories: People of the Cave, Two Gardens, Musa and Khidr, Dhul-Qarnayn.' },
  { number: 19, arabicName: 'مريم', englishName: 'Maryam', malayalamName: 'മർയം', englishNameTranslation: 'Mary', revelationType: 'Meccan', numberOfAyahs: 98, description: 'The story of Maryam and the miraculous birth of Isa.' },
  { number: 20, arabicName: 'طه', englishName: 'Ta-Ha', malayalamName: 'ത്വാഹാ', englishNameTranslation: 'Ta-Ha', revelationType: 'Meccan', numberOfAyahs: 135, description: 'The story of Musa and the guidance given to him.' },
  { number: 21, arabicName: 'الأنبياء', englishName: 'Al-Anbya', malayalamName: 'അൽ-അൻബിയാ', englishNameTranslation: 'The Prophets', revelationType: 'Meccan', numberOfAyahs: 112, description: 'Stories of many prophets and the unity of their message.' },
  { number: 22, arabicName: 'الحج', englishName: 'Al-Hajj', malayalamName: 'അൽ-ഹജ്ജ്', englishNameTranslation: 'The Pilgrimage', revelationType: 'Medinan', numberOfAyahs: 78, description: 'Discusses the pilgrimage (Hajj) and the Day of Judgment.' },
  { number: 23, arabicName: 'المؤمنون', englishName: 'Al-Mu\'minun', malayalamName: 'അൽ-മുഅ്മിനൂൻ', englishNameTranslation: 'The Believers', revelationType: 'Meccan', numberOfAyahs: 118, description: 'Qualities of true believers and the stages of human creation.' },
  { number: 24, arabicName: 'النور', englishName: 'An-Nur', malayalamName: 'അൻ-നൂർ', englishNameTranslation: 'The Light', revelationType: 'Medinan', numberOfAyahs: 64, description: 'Laws of modesty, the verse of Light, and household ethics.' },
  { number: 25, arabicName: 'الفرقان', englishName: 'Al-Furqan', malayalamName: 'അൽ-ഫുർഖാൻ', englishNameTranslation: 'The Criterion', revelationType: 'Meccan', numberOfAyahs: 77, description: 'The Quran as a criterion between truth and falsehood.' },
  { number: 26, arabicName: 'الشعراء', englishName: 'Ash-Shu\'ara', malayalamName: 'അശ്-ശുഅറാ', englishNameTranslation: 'The Poets', revelationType: 'Meccan', numberOfAyahs: 227, description: 'Stories of several prophets and the nature of divine revelation.' },
  { number: 27, arabicName: 'النمل', englishName: 'An-Naml', malayalamName: 'അൻ-നംൽ', englishNameTranslation: 'The Ant', revelationType: 'Meccan', numberOfAyahs: 93, description: 'Stories of Sulayman, the Queen of Sheba, and the ant.' },
  { number: 28, arabicName: 'القصص', englishName: 'Al-Qasas', malayalamName: 'അൽ-ഖസസ്', englishNameTranslation: 'The Stories', revelationType: 'Meccan', numberOfAyahs: 88, description: 'The detailed story of Musa from birth to prophethood.' },
  { number: 29, arabicName: 'العنكبوت', englishName: 'Al-\'Ankabut', malayalamName: 'അൽ-അൻകബൂത്', englishNameTranslation: 'The Spider', revelationType: 'Meccan', numberOfAyahs: 69, description: 'Tests of faith and the parable of the spider\'s web.' },
  { number: 30, arabicName: 'الروم', englishName: 'Ar-Rum', malayalamName: 'അർ-റൂം', englishNameTranslation: 'The Romans', revelationType: 'Meccan', numberOfAyahs: 60, description: 'Prophecy of the Roman victory and signs of Allah in creation.' },
  { number: 31, arabicName: 'لقمان', englishName: 'Luqman', malayalamName: 'ലുഖ്‌മാൻ', englishNameTranslation: 'Luqman', revelationType: 'Meccan', numberOfAyahs: 34, description: 'Wisdom of Luqman and advice to his son.' },
  { number: 32, arabicName: 'السجدة', englishName: 'As-Sajdah', malayalamName: 'അസ്-സജ്ദ', englishNameTranslation: 'The Prostration', revelationType: 'Meccan', numberOfAyahs: 30, description: 'The creation of man and the truth of the Quran.' },
  { number: 33, arabicName: 'الأحزاب', englishName: 'Al-Ahzab', malayalamName: 'അൽ-അഹ്‌സാബ്', englishNameTranslation: 'The Combined Forces', revelationType: 'Medinan', numberOfAyahs: 73, description: 'The Battle of the Trench and laws regarding the Prophet\'s household.' },
  { number: 34, arabicName: 'سبإ', englishName: 'Saba\'', malayalamName: 'സബഅ്', englishNameTranslation: 'Sheba', revelationType: 'Meccan', numberOfAyahs: 54, description: 'The story of Dawud, Sulayman, and the people of Saba.' },
  { number: 35, arabicName: 'فاطر', englishName: 'Fatir', malayalamName: 'ഫാതിർ', englishNameTranslation: 'Originator', revelationType: 'Meccan', numberOfAyahs: 45, description: 'Allah as the Originator of creation and the futility of polytheism.' },
  { number: 36, arabicName: 'يس', englishName: 'Ya-Sin', malayalamName: 'യാ-സീൻ', englishNameTranslation: 'Ya-Sin', revelationType: 'Meccan', numberOfAyahs: 83, description: 'Called the heart of the Quran; covers resurrection and prophethood.' },
  { number: 37, arabicName: 'الصافات', englishName: 'As-Saffat', malayalamName: 'അസ്-സ്വാഫ്ഫാത്', englishNameTranslation: 'Those Who Set the Ranks', revelationType: 'Meccan', numberOfAyahs: 182, description: 'The angels in rows and stories of Ibrahim, Musa, and Yunus.' },
  { number: 38, arabicName: 'ص', englishName: 'Sad', malayalamName: 'സ്വാദ്', englishNameTranslation: 'Sad', revelationType: 'Meccan', numberOfAyahs: 88, description: 'Stories of Dawud, Sulayman, and Ayyub.' },
  { number: 39, arabicName: 'الزمر', englishName: 'Az-Zumar', malayalamName: 'അസ്-സുമർ', englishNameTranslation: 'The Troops', revelationType: 'Meccan', numberOfAyahs: 75, description: 'Sincerity in worship and the mercy of Allah.' },
  { number: 40, arabicName: 'غافر', englishName: 'Ghafir', malayalamName: 'ഗാഫിർ', englishNameTranslation: 'The Forgiver', revelationType: 'Meccan', numberOfAyahs: 85, description: 'The believer of Pharaoh\'s family and the attributes of Allah.' },
  { number: 41, arabicName: 'فصلت', englishName: 'Fussilat', malayalamName: 'ഫുസ്സ്വിലത്', englishNameTranslation: 'Explained in Detail', revelationType: 'Meccan', numberOfAyahs: 54, description: 'The detailed explanation of the Quran and the fate of Ad and Thamud.' },
  { number: 42, arabicName: 'الشورى', englishName: 'Ash-Shura', malayalamName: 'അശ്-ശൂറാ', englishNameTranslation: 'The Consultation', revelationType: 'Meccan', numberOfAyahs: 53, description: 'Consultation in Muslim affairs and the nature of divine revelation.' },
  { number: 43, arabicName: 'الزخرف', englishName: 'Az-Zukhruf', malayalamName: 'അസ്-സുഖ്‌റുഫ്', englishNameTranslation: 'The Ornaments of Gold', revelationType: 'Meccan', numberOfAyahs: 89, description: 'The nature of this world\'s adornments and the truth of Isa.' },
  { number: 44, arabicName: 'الدخان', englishName: 'Ad-Dukhan', malayalamName: 'അദ്-ദുഖാൻ', englishNameTranslation: 'The Smoke', revelationType: 'Meccan', numberOfAyahs: 59, description: 'The smoke on the Day of Judgment and the story of Musa.' },
  { number: 45, arabicName: 'الجاثية', englishName: 'Al-Jathiyah', malayalamName: 'അൽ-ജാഥിയ', englishNameTranslation: 'The Crouching', revelationType: 'Meccan', numberOfAyahs: 37, description: 'Signs of Allah in creation and the Day of Judgment.' },
  { number: 46, arabicName: 'الأحقاف', englishName: 'Al-Ahqaf', malayalamName: 'അൽ-അഹ്ഖാഫ്', englishNameTranslation: 'The Wind-Curved Sandhills', revelationType: 'Meccan', numberOfAyahs: 35, description: 'The story of Ad and the Jinn listening to the Quran.' },
  { number: 47, arabicName: 'محمد', englishName: 'Muhammad', malayalamName: 'മുഹമ്മദ്', englishNameTranslation: 'Muhammad', revelationType: 'Medinan', numberOfAyahs: 38, description: 'Rules of warfare and the hypocrites\' opposition to the Prophet.' },
  { number: 48, arabicName: 'الفتح', englishName: 'Al-Fath', malayalamName: 'അൽ-ഫത്ഹ്', englishNameTranslation: 'The Victory', revelationType: 'Medinan', numberOfAyahs: 29, description: 'The treaty of Hudaybiyyah and the promise of victory.' },
  { number: 49, arabicName: 'الحجرات', englishName: 'Al-Hujurat', malayalamName: 'അൽ-ഹുജുറാത്', englishNameTranslation: 'The Rooms', revelationType: 'Medinan', numberOfAyahs: 18, description: 'Etiquettes of Islamic brotherhood and social conduct.' },
  { number: 50, arabicName: 'ق', englishName: 'Qaf', malayalamName: 'ഖ്വാഫ്', englishNameTranslation: 'Qaf', revelationType: 'Meccan', numberOfAyahs: 45, description: 'Resurrection and the recording of deeds.' },
  { number: 51, arabicName: 'الذاريات', englishName: 'Adh-Dhariyat', malayalamName: 'അദ്-ദാരിയാത്', englishNameTranslation: 'The Winnowing Winds', revelationType: 'Meccan', numberOfAyahs: 60, description: 'The Day of Judgment and stories of the prophets.' },
  { number: 52, arabicName: 'الطور', englishName: 'At-Tur', malayalamName: 'അത്-തൂർ', englishNameTranslation: 'The Mount', revelationType: 'Meccan', numberOfAyahs: 49, description: 'Oaths by sacred things and the rewards of the righteous.' },
  { number: 53, arabicName: 'النجم', englishName: 'An-Najm', malayalamName: 'അൻ-നജ്മ്', englishNameTranslation: 'The Star', revelationType: 'Meccan', numberOfAyahs: 62, description: 'The divine nature of revelation and the Ascension of the Prophet.' },
  { number: 54, arabicName: 'القمر', englishName: 'Al-Qamar', malayalamName: 'അൽ-ഖമർ', englishNameTranslation: 'The Moon', revelationType: 'Meccan', numberOfAyahs: 55, description: 'The splitting of the moon and stories of those who rejected truth.' },
  { number: 55, arabicName: 'الرحمن', englishName: 'Ar-Rahman', malayalamName: 'അർ-റഹ്‌മാൻ', englishNameTranslation: 'The Beneficent', revelationType: 'Medinan', numberOfAyahs: 78, description: 'A celebration of Allah\'s blessings, with the refrain: "So which of your Lord\'s favors will you deny?"' },
  { number: 56, arabicName: 'الواقعة', englishName: 'Al-Waqi\'ah', malayalamName: 'അൽ-വാഖിഅ', englishNameTranslation: 'The Inevitable', revelationType: 'Meccan', numberOfAyahs: 96, description: 'Three groups of people on the Day of Judgment.' },
  { number: 57, arabicName: 'الحديد', englishName: 'Al-Hadid', malayalamName: 'അൽ-ഹദീദ്', englishNameTranslation: 'The Iron', revelationType: 'Medinan', numberOfAyahs: 29, description: 'Spending in the way of Allah and the transience of this world.' },
  { number: 58, arabicName: 'المجادلة', englishName: 'Al-Mujadila', malayalamName: 'അൽ-മുജാദില', englishNameTranslation: 'The Pleading Woman', revelationType: 'Medinan', numberOfAyahs: 22, description: 'A woman\'s complaint to the Prophet about her husband.' },
  { number: 59, arabicName: 'الحشر', englishName: 'Al-Hashr', malayalamName: 'അൽ-ഹശ്ർ', englishNameTranslation: 'The Exile', revelationType: 'Medinan', numberOfAyahs: 24, description: 'Expulsion of the Banu Nadir tribe and the Beautiful Names of Allah.' },
  { number: 60, arabicName: 'الممتحنة', englishName: 'Al-Mumtahanah', malayalamName: 'അൽ-മുംതഹിന', englishNameTranslation: 'She That Is to Be Examined', revelationType: 'Medinan', numberOfAyahs: 13, description: 'Loyalty and relations with non-Muslims.' },
  { number: 61, arabicName: 'الصف', englishName: 'As-Saf', malayalamName: 'അസ്-സ്വഫ്ഫ്', englishNameTranslation: 'The Ranks', revelationType: 'Medinan', numberOfAyahs: 14, description: 'Struggling in the path of Allah in organized ranks.' },
  { number: 62, arabicName: 'الجمعة', englishName: 'Al-Jumu\'ah', malayalamName: 'അൽ-ജുമുഅ', englishNameTranslation: 'Friday', revelationType: 'Medinan', numberOfAyahs: 11, description: 'The Friday prayer and its obligations.' },
  { number: 63, arabicName: 'المنافقون', englishName: 'Al-Munafiqun', malayalamName: 'അൽ-മുനാഫിഖൂൻ', englishNameTranslation: 'The Hypocrites', revelationType: 'Medinan', numberOfAyahs: 11, description: 'The characteristics and deception of hypocrites.' },
  { number: 64, arabicName: 'التغابن', englishName: 'At-Taghabun', malayalamName: 'അത്-തഗാബുൻ', englishNameTranslation: 'The Mutual Disillusion', revelationType: 'Medinan', numberOfAyahs: 18, description: 'Mutual loss and gain on the Day of Judgment.' },
  { number: 65, arabicName: 'الطلاق', englishName: 'At-Talaq', malayalamName: 'അത്-ത്വലാഖ്', englishNameTranslation: 'The Divorce', revelationType: 'Medinan', numberOfAyahs: 12, description: 'Laws and procedures for divorce.' },
  { number: 66, arabicName: 'التحريم', englishName: 'At-Tahrim', malayalamName: 'അത്-തഹ്‌രീം', englishNameTranslation: 'The Prohibition', revelationType: 'Medinan', numberOfAyahs: 12, description: 'An incident with the Prophet\'s household and lessons drawn.' },
  { number: 67, arabicName: 'الملك', englishName: 'Al-Mulk', malayalamName: 'അൽ-മുൽക്', englishNameTranslation: 'The Sovereignty', revelationType: 'Meccan', numberOfAyahs: 30, description: 'Allah\'s sovereignty and the signs pointing to His existence.' },
  { number: 68, arabicName: 'القلم', englishName: 'Al-Qalam', malayalamName: 'അൽ-ഖലം', englishNameTranslation: 'The Pen', revelationType: 'Meccan', numberOfAyahs: 52, description: 'The Pen, the character of the Prophet, and the parable of the garden.' },
  { number: 69, arabicName: 'الحاقة', englishName: 'Al-Haqqah', malayalamName: 'അൽ-ഹാഖ്ഖ', englishNameTranslation: 'The Reality', revelationType: 'Meccan', numberOfAyahs: 52, description: 'The Day of Resurrection as an inevitable reality.' },
  { number: 70, arabicName: 'المعارج', englishName: 'Al-Ma\'arij', malayalamName: 'അൽ-മആരിജ്', englishNameTranslation: 'The Ascending Stairways', revelationType: 'Meccan', numberOfAyahs: 44, description: 'The Day of Judgment and the qualities of the believers.' },
  { number: 71, arabicName: 'نوح', englishName: 'Nuh', malayalamName: 'നൂഹ്', englishNameTranslation: 'Noah', revelationType: 'Meccan', numberOfAyahs: 28, description: 'The story of Prophet Nuh and his people.' },
  { number: 72, arabicName: 'الجن', englishName: 'Al-Jinn', malayalamName: 'അൽ-ജിൻ', englishNameTranslation: 'The Jinn', revelationType: 'Meccan', numberOfAyahs: 28, description: 'The Jinn who heard the Quran and accepted Islam.' },
  { number: 73, arabicName: 'المزمل', englishName: 'Al-Muzzammil', malayalamName: 'അൽ-മുസ്സമ്മിൽ', englishNameTranslation: 'The Enshrouded One', revelationType: 'Meccan', numberOfAyahs: 20, description: 'Instructions for night prayer and patience.' },
  { number: 74, arabicName: 'المدثر', englishName: 'Al-Muddaththir', malayalamName: 'അൽ-മുദ്ദസ്സിർ', englishNameTranslation: 'The Cloaked One', revelationType: 'Meccan', numberOfAyahs: 56, description: 'The command to warn and the fate of the rejecter of truth.' },
  { number: 75, arabicName: 'القيامة', englishName: 'Al-Qiyamah', malayalamName: 'അൽ-ഖിയാമ', englishNameTranslation: 'The Resurrection', revelationType: 'Meccan', numberOfAyahs: 40, description: 'The certainty of resurrection and the gathering.' },
  { number: 76, arabicName: 'الإنسان', englishName: 'Al-Insan', malayalamName: 'അൽ-ഇൻസാൻ', englishNameTranslation: 'Man', revelationType: 'Medinan', numberOfAyahs: 31, description: 'The creation of man and the rewards of the righteous.' },
  { number: 77, arabicName: 'المرسلات', englishName: 'Al-Mursalat', malayalamName: 'അൽ-മുർസലാത്', englishNameTranslation: 'The Emissaries', revelationType: 'Meccan', numberOfAyahs: 50, description: 'The sending of winds and angels as messengers.' },
  { number: 78, arabicName: 'النبإ', englishName: 'An-Naba', malayalamName: 'അൻ-നബ', englishNameTranslation: 'The Announcement', revelationType: 'Meccan', numberOfAyahs: 40, description: 'The great news of resurrection.' },
  { number: 79, arabicName: 'النازعات', englishName: 'An-Nazi\'at', malayalamName: 'അൻ-നാസിആത്', englishNameTranslation: "Those Who Drag Forth", revelationType: 'Meccan', numberOfAyahs: 46, description: 'The angels and the Day of Judgment.' },
  { number: 80, arabicName: "'عبس", englishName: 'Abasa', malayalamName: 'അബസ', englishNameTranslation: 'He Frowned', revelationType: 'Meccan', numberOfAyahs: 42, description: 'An incident where the Prophet frowned at a blind man.' },
  { number: 81, arabicName: 'التكوير', englishName: 'At-Takwir', malayalamName: 'അത്-തക്‌വീർ', englishNameTranslation: 'The Overthrowing', revelationType: 'Meccan', numberOfAyahs: 29, description: 'Terrifying events at the end of time.' },
  { number: 82, arabicName: 'الانفطار', englishName: 'Al-Infitar', malayalamName: 'അൽ-ഇൻഫിതാർ', englishNameTranslation: 'The Cleaving', revelationType: 'Meccan', numberOfAyahs: 19, description: 'The sky splitting and deeds being recorded.' },
  { number: 83, arabicName: 'المطففين', englishName: 'Al-Mutaffifin', malayalamName: 'അൽ-മുതഫ്ഫിഫീൻ', englishNameTranslation: 'Defrauding', revelationType: 'Meccan', numberOfAyahs: 36, description: 'The sin of giving short measure and the fate of wrongdoers.' },
  { number: 84, arabicName: 'الانشقاق', englishName: 'Al-Inshiqaq', malayalamName: 'അൽ-ഇൻഷിഖ്വാഖ്', englishNameTranslation: 'The Sundering', revelationType: 'Meccan', numberOfAyahs: 25, description: 'The sky splitting and man\'s gradual journey to his Lord.' },
  { number: 85, arabicName: 'البروج', englishName: 'Al-Buruj', malayalamName: 'അൽ-ബുറൂജ്', englishNameTranslation: 'The Mansions of the Stars', revelationType: 'Meccan', numberOfAyahs: 22, description: 'The People of the Ditch and the perseverance of the believers.' },
  { number: 86, arabicName: 'الطارق', englishName: 'At-Tariq', malayalamName: 'അത്-ത്വാരിഖ്', englishNameTranslation: 'The Nightcomer', revelationType: 'Meccan', numberOfAyahs: 17, description: 'The night star and the creation of man.' },
  { number: 87, arabicName: 'الأعلى', englishName: "Al-A'la", malayalamName: 'അൽ-അഅ്ലാ', englishNameTranslation: 'The Most High', revelationType: 'Meccan', numberOfAyahs: 19, description: 'Glorifying Allah and the eternal nature of the Hereafter.' },
  { number: 88, arabicName: 'الغاشية', englishName: 'Al-Ghashiyah', malayalamName: 'അൽ-ഗ്വാഷിയ', englishNameTranslation: 'The Overwhelming', revelationType: 'Meccan', numberOfAyahs: 26, description: 'The Day of Judgment and the signs of Allah in creation.' },
  { number: 89, arabicName: 'الفجر', englishName: 'Al-Fajr', malayalamName: 'അൽ-ഫജ്ർ', englishNameTranslation: 'The Dawn', revelationType: 'Meccan', numberOfAyahs: 30, description: 'The dawn and the fate of those who denied their Lord.' },
  { number: 90, arabicName: 'البلد', englishName: 'Al-Balad', malayalamName: 'അൽ-ബലദ്', englishNameTranslation: 'The City', revelationType: 'Meccan', numberOfAyahs: 20, description: 'The city of Makkah and the difficult path of righteousness.' },
  { number: 91, arabicName: 'الشمس', englishName: 'Ash-Shams', malayalamName: 'അശ്-ശംസ്', englishNameTranslation: 'The Sun', revelationType: 'Meccan', numberOfAyahs: 15, description: 'Oaths by celestial objects and the purification of the soul.' },
  { number: 92, arabicName: 'الليل', englishName: 'Al-Layl', malayalamName: 'അൽ-ലൈൽ', englishNameTranslation: 'The Night', revelationType: 'Meccan', numberOfAyahs: 21, description: 'The contrast between generosity and miserliness.' },
  { number: 93, arabicName: 'الضحى', englishName: 'Ad-Duha', malayalamName: 'അദ്-ദുഹ', englishNameTranslation: 'The Morning Hours', revelationType: 'Meccan', numberOfAyahs: 11, description: 'Reassurance to the Prophet and gratitude for Allah\'s blessings.' },
  { number: 94, arabicName: 'الشرح', englishName: 'Ash-Sharh', malayalamName: 'അശ്-ശർഹ്', englishNameTranslation: 'The Relief', revelationType: 'Meccan', numberOfAyahs: 8, description: 'The expansion of the Prophet\'s chest and the promise of ease.' },
  { number: 95, arabicName: 'التين', englishName: 'At-Tin', malayalamName: 'അത്-തീൻ', englishNameTranslation: 'The Fig', revelationType: 'Meccan', numberOfAyahs: 8, description: 'Man\'s noble creation and the reward for deeds.' },
  { number: 96, arabicName: 'العلق', englishName: 'Al-Alaq', malayalamName: 'അൽ-അലഖ്', englishNameTranslation: 'The Clot', revelationType: 'Meccan', numberOfAyahs: 19, description: 'The first revelation: Read in the name of your Lord.' },
  { number: 97, arabicName: 'القدر', englishName: 'Al-Qadr', malayalamName: 'അൽ-ഖദ്ർ', englishNameTranslation: 'The Power', revelationType: 'Meccan', numberOfAyahs: 5, description: 'The Night of Power, better than a thousand months.' },
  { number: 98, arabicName: 'البينة', englishName: 'Al-Bayyinah', malayalamName: 'അൽ-ബയ്യിന', englishNameTranslation: 'The Clear Proof', revelationType: 'Medinan', numberOfAyahs: 8, description: 'The People of the Book and the clear evidence of Islam.' },
  { number: 99, arabicName: 'الزلزلة', englishName: 'Az-Zalzalah', malayalamName: 'അസ്-സൽസ്വല', englishNameTranslation: 'The Earthquake', revelationType: 'Medinan', numberOfAyahs: 8, description: 'The earthquake of the Last Hour and the recording of deeds.' },
  { number: 100, arabicName: 'العاديات', englishName: 'Al-Adiyat', malayalamName: 'അൽ-ആദിയാത്', englishNameTranslation: 'The Courser', revelationType: 'Meccan', numberOfAyahs: 11, description: 'War horses and the ingratitude of man.' },
  { number: 101, arabicName: 'القارعة', englishName: 'Al-Qari\'ah', malayalamName: 'അൽ-ഖാരിഅ', englishNameTranslation: 'The Calamity', revelationType: 'Meccan', numberOfAyahs: 11, description: 'The Great Calamity and the weighing of deeds.' },
  { number: 102, arabicName: 'التكاثر', englishName: 'At-Takathur', malayalamName: 'അത്-തകാഥുർ', englishNameTranslation: 'The Rivalry in World Increase', revelationType: 'Meccan', numberOfAyahs: 8, description: 'The distraction of competition for worldly gains.' },
  { number: 103, arabicName: 'العصر', englishName: 'Al-Asr', malayalamName: 'അൽ-അസ്ർ', englishNameTranslation: 'The Declining Day', revelationType: 'Meccan', numberOfAyahs: 3, description: 'All of mankind is in loss except those who believe and do good.' },
  { number: 104, arabicName: 'الهمزة', englishName: 'Al-Humazah', malayalamName: 'അൽ-ഹുമസ', englishNameTranslation: 'The Traducer', revelationType: 'Meccan', numberOfAyahs: 9, description: 'The punishment of those who backbite and slander.' },
  { number: 105, arabicName: 'الفيل', englishName: 'Al-Fil', malayalamName: 'അൽ-ഫീൽ', englishNameTranslation: 'The Elephant', revelationType: 'Meccan', numberOfAyahs: 5, description: 'The army of elephants destroyed while attacking the Ka\'bah.' },
  { number: 106, arabicName: 'قريش', englishName: 'Quraysh', malayalamName: 'ഖുറൈശ്', englishNameTranslation: 'Quraysh', revelationType: 'Meccan', numberOfAyahs: 4, description: 'Allah\'s blessing upon the Quraysh tribe.' },
  { number: 107, arabicName: 'الماعون', englishName: 'Al-Ma\'un', malayalamName: 'അൽ-മആഊൻ', englishNameTranslation: 'The Small Kindnesses', revelationType: 'Meccan', numberOfAyahs: 7, description: 'Signs of those who deny religion by neglecting the poor.' },
  { number: 108, arabicName: 'الكوثر', englishName: 'Al-Kawthar', malayalamName: 'അൽ-കൗഥർ', englishNameTranslation: 'A River in Paradise', revelationType: 'Meccan', numberOfAyahs: 3, description: 'The gift of Al-Kawthar and prayer and sacrifice.' },
  { number: 109, arabicName: 'الكافرون', englishName: 'Al-Kafirun', malayalamName: 'അൽ-കാഫിറൂൻ', englishNameTranslation: 'The Disbelievers', revelationType: 'Meccan', numberOfAyahs: 6, description: 'A declaration of complete separation from disbelief.' },
  { number: 110, arabicName: 'النصر', englishName: 'An-Nasr', malayalamName: 'അൻ-നസ്ർ', englishNameTranslation: 'The Divine Support', revelationType: 'Medinan', numberOfAyahs: 3, description: 'The victory of Islam and the command to glorify Allah.' },
  { number: 111, arabicName: 'المسد', englishName: 'Al-Masad', malayalamName: 'അൽ-മസദ്', englishNameTranslation: 'The Palm Fiber', revelationType: 'Meccan', numberOfAyahs: 5, description: 'The condemnation of Abu Lahab, the Prophet\'s enemy.' },
  { number: 112, arabicName: 'الإخلاص', englishName: 'Al-Ikhlas', malayalamName: 'അൽ-ഇഖ്‌ലാസ്', englishNameTranslation: 'Sincerity', revelationType: 'Meccan', numberOfAyahs: 4, description: 'The absolute oneness of Allah — equal to one-third of the Quran.' },
  { number: 113, arabicName: 'الفلق', englishName: 'Al-Falaq', malayalamName: 'അൽ-ഫലഖ്', englishNameTranslation: 'The Daybreak', revelationType: 'Meccan', numberOfAyahs: 5, description: 'Seeking refuge with Allah from the evils of creation.' },
  { number: 114, arabicName: 'الناس', englishName: 'An-Nas', malayalamName: 'അൻ-നാസ്', englishNameTranslation: 'Mankind', revelationType: 'Meccan', numberOfAyahs: 6, description: 'Seeking refuge with Allah from the whisperings of Shaytan.' },
]

// ── API calls ─────────────────────────────────────────────────────────────────

// Cache in memory
const ayahCache = new Map<string, any>()
const surahCache = new Map<number, any>()

export async function fetchAyah(surah: number, ayah: number): Promise<Ayah | null> {
  const key = `${surah}:${ayah}`
  if (ayahCache.has(key)) return ayahCache.get(key)

  try {
    // Fetch Arabic + English + transliteration in parallel
    const [arabicRes, engRes] = await Promise.all([
      fetch(`${CLOUD}/ayah/${surah}:${ayah}/ar.alafasy`),
      fetch(`${CLOUD}/ayah/${surah}:${ayah}/en.sahih`),
    ])

    if (!arabicRes.ok || !engRes.ok) return null

    const [arabicData, engData] = await Promise.all([arabicRes.json(), engRes.json()])

    const result: Ayah = {
      surahNumber: surah,
      ayahNumber: ayah,
      arabic: arabicData.data?.text ?? '',
      transliteration: '',
      englishTranslation: engData.data?.text ?? '',
      malayalamTranslation: '',
      reference: `Quran ${surah}:${ayah}`,
    }

    ayahCache.set(key, result)
    return result
  } catch {
    return null
  }
}

export async function fetchSurah(surahNumber: number): Promise<{ arabic: string[]; english: string[]; } | null> {
  if (surahCache.has(surahNumber)) return surahCache.get(surahNumber)

  try {
    const [arRes, enRes] = await Promise.all([
      fetch(`${CLOUD}/surah/${surahNumber}/ar.alafasy`),
      fetch(`${CLOUD}/surah/${surahNumber}/en.sahih`),
    ])
    if (!arRes.ok || !enRes.ok) return null

    const [arData, enData] = await Promise.all([arRes.json(), enRes.json()])
    const arabic: string[] = (arData.data?.ayahs ?? []).map((a: any) => a.text)
    const english: string[] = (enData.data?.ayahs ?? []).map((a: any) => a.text)

    const result = { arabic, english }
    surahCache.set(surahNumber, result)
    return result
  } catch {
    return null
  }
}

export async function searchQuran(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(query)}&size=20&page=1&language=en`
    )
    if (!res.ok) return []
    const data = await res.json()
    const hits = data.search?.results ?? []

    return hits.map((h: any) => ({
      surahNumber: h.verse_key?.split(':')[0] ? parseInt(h.verse_key.split(':')[0]) : 0,
      surahName: h.verse_key ?? '',
      ayahNumber: h.verse_key?.split(':')[1] ? parseInt(h.verse_key.split(':')[1]) : 0,
      arabic: h.text ?? '',
      translation: h.translations?.[0]?.text?.replace(/<[^>]+>/g, '') ?? '',
      reference: h.verse_key ? `Quran ${h.verse_key}` : '',
    })).filter((r: SearchResult) => r.surahNumber > 0)
  } catch {
    return []
  }
}

export async function fetchTafsir(surah: number, ayah: number): Promise<TafsirEntry[]> {
  // Tafsir Ibn Kathir (English) via quran.com API
  try {
    const res = await fetch(
      `${BASE}/tafsirs/en-tafsir-ibn-kathir?verse_key=${surah}:${ayah}`
    )
    if (!res.ok) return []
    const data = await res.json()
    const text: string = data.tafsirs?.[0]?.text?.replace(/<[^>]+>/g, '').slice(0, 1200) ?? ''
    if (!text) return []
    return [{
      source: 'Tafsir Ibn Kathir',
      scholar: 'Ibn Kathir (rahimahullah)',
      text: text + (text.length >= 1200 ? '…' : ''),
    }]
  } catch {
    return []
  }
}
