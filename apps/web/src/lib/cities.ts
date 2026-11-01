/**
 * Ülkelere göre şehir listesi (aranabilir seçim + konumdan otomatik bulma için).
 * Biçim: "Kayıtlı ad|diğer yazımlar…" — ilk ad saklanır, diğerleri yalnızca arama/eşleştirmede kullanılır.
 * Listede olmayan şehir serbest metinle girilebilir.
 */
const CITIES: Record<string, string[]> = {
  UZ: [
    'Toshkent|Tashkent|Ташкент', 'Samarqand|Samarkand|Самарканд', 'Buxoro|Bukhara|Бухара', 'Namangan|Наманган',
    'Andijon|Andijan|Андижан', 'Fargʻona|Fergana|Farg‘ona|Фергана', 'Qoʻqon|Kokand|Qo‘qon|Коканд', 'Margʻilon|Margilan|Маргилан',
    'Nukus|Нукус', 'Qarshi|Karshi|Карши', 'Termiz|Termez|Термез', 'Jizzax|Jizzakh|Джизак', 'Navoiy|Navoi|Навои',
    'Urganch|Urgench|Ургенч', 'Xiva|Khiva|Хива', 'Guliston|Gulistan|Гулистан', 'Chirchiq|Chirchik|Чирчик',
    'Olmaliq|Almalyk|Алмалык', 'Angren|Ангрен', 'Bekobod|Bekabad|Бекабад', 'Shahrisabz|Шахрисабз',
    'Kattaqoʻrgʻon|Kattakurgan|Каттакурган', 'Denov|Denau|Денау', 'Chust|Чуст', 'Zarafshon|Zarafshan|Зарафшан',
  ],
  KZ: [
    'Almaty|Алматы', 'Astana|Астана|Nur-Sultan', 'Shymkent|Шымкент|Chimkent', 'Turkistan|Туркестан', 'Taraz|Тараз',
    'Aktobe|Актобе', 'Karaganda|Караганда', 'Atyrau|Атырау', 'Aktau|Актау', 'Kyzylorda|Кызылорда', 'Oral|Uralsk|Уральск',
    'Pavlodar|Павлодар', 'Semey|Семей', 'Oskemen|Ust-Kamenogorsk|Усть-Каменогорск', 'Kostanay|Костанай',
  ],
  KG: ['Bishkek|Бишкек', 'Osh|Ош', 'Jalal-Abad|Джалал-Абад', 'Karakol|Каракол', 'Tokmok|Токмок', 'Uzgen|Özgön|Узген', 'Batken|Баткен', 'Naryn|Нарын', 'Talas|Талас'],
  TJ: ['Dushanbe|Душанбе', 'Khujand|Xoʻjand|Худжанд', 'Bokhtar|Бохтар', 'Kulob|Kulyab|Куляб', 'Istaravshan|Истаравшан', 'Panjakent|Пенджикент', 'Tursunzoda|Турсунзаде', 'Isfara|Исфара'],
  TM: ['Ashgabat|Ашхабад', 'Turkmenabat|Туркменабад', 'Dashoguz|Дашогуз', 'Mary|Мары', 'Balkanabat|Балканабад', 'Turkmenbashi|Туркменбаши'],
  AF: ['Kabul|Кабул', 'Mazar-i-Sharif|Мазари-Шариф', 'Herat|Герат', 'Kandahar|Кандагар', 'Kunduz|Кундуз', 'Jalalabad|Джелалабад', 'Andkhoy|Андхой'],
  RU: [
    'Moscow|Moskva|Москва', 'Saint Petersburg|Sankt-Peterburg|Санкт-Петербург', 'Kazan|Казань', 'Novosibirsk|Новосибирск',
    'Yekaterinburg|Екатеринбург', 'Nizhny Novgorod|Нижний Новгород', 'Ufa|Уфа', 'Samara|Самара', 'Krasnodar|Краснодар',
    'Rostov-on-Don|Ростов-на-Дону', 'Grozny|Грозный', 'Makhachkala|Махачкала', 'Kaliningrad|Калининград',
    'Tyumen|Тюмень', 'Chelyabinsk|Челябинск', 'Omsk|Омск', 'Krasnoyarsk|Красноярск', 'Surgut|Сургут', 'Vladivostok|Владивосток',
  ],
  TR: [
    'İstanbul|Istanbul|Стамбул', 'Ankara|Анкара', 'İzmir|Izmir|Измир', 'Bursa|Бурса', 'Antalya|Анталья', 'Konya|Конья',
    'Kayseri|Кайсери', 'Gaziantep|Газиантеп', 'Şanlıurfa|Sanliurfa|Шанлыурфа', 'Adana|Адана', 'Mersin|Мерсин',
    'Kocaeli|Izmit|Коджаэли', 'Sakarya|Сакарья', 'Eskişehir|Eskisehir|Эскишехир', 'Samsun|Самсун', 'Trabzon|Трабзон',
    'Erzurum|Эрзурум', 'Diyarbakır|Diyarbakir|Диярбакыр', 'Malatya|Малатья', 'Denizli|Денизли',
  ],
  AZ: ['Baku|Bakı|Баку', 'Ganja|Gəncə|Гянджа', 'Sumgait|Sumqayıt|Сумгаит', 'Mingachevir|Mingəçevir|Мингечевир', 'Lankaran|Lənkəran|Ленкорань', 'Nakhchivan|Naxçıvan|Нахичевань'],
  SA: ['Riyadh|الرياض|Эр-Рияд', 'Jeddah|جدة|Джидда', 'Makkah|Mecca|مكة|Мекка', 'Madinah|Medina|المدينة|Медина', 'Dammam|الدمام|Даммам', 'Taif|الطائف'],
  AE: ['Dubai|دبي|Дубай', 'Abu Dhabi|أبو ظبي|Абу-Даби', 'Sharjah|الشارقة|Шарджа', 'Ajman|عجمان', 'Al Ain|العين'],
  QA: ['Doha|الدوحة|Доха', 'Al Wakrah|الوكرة'],
  KW: ['Kuwait City|الكويت|Эль-Кувейт', 'Hawalli|حولي'],
  BH: ['Manama|المنامة|Манама', 'Muharraq|المحرق'],
  OM: ['Muscat|مسقط|Маскат', 'Salalah|صلالة', 'Sohar|صحار'],
  EG: ['Cairo|القاهرة|Каир', 'Alexandria|الإسكندرية|Александрия', 'Giza|الجيزة|Гиза', 'Mansoura|المنصورة'],
  JO: ['Amman|عمان|Амман', 'Zarqa|الزرقاء', 'Irbid|إربد'],
  MA: ['Casablanca|الدار البيضاء|Касабланка', 'Rabat|الرباط|Рабат', 'Marrakesh|مراكش|Марракеш', 'Fes|فاس|Фес', 'Tangier|طنجة|Танжер'],
  DZ: ['Algiers|الجزائر|Алжир', 'Oran|وهران|Оран', 'Constantine|قسنطينة'],
  TN: ['Tunis|تونس|Тунис', 'Sfax|صفاقس', 'Sousse|سوسة'],
  PK: ['Karachi|کراچی|Карачи', 'Lahore|لاہور|Лахор', 'Islamabad|اسلام آباد|Исламабад', 'Rawalpindi|Равалпинди', 'Peshawar|Пешавар', 'Faisalabad|Фейсалабад'],
  IN: ['Delhi|Дели', 'Mumbai|Мумбаи', 'Hyderabad|Хайдарабад', 'Bengaluru|Bangalore|Бангалор', 'Lucknow|Лакхнау', 'Kolkata|Калькутта'],
  BD: ['Dhaka|Дакка', 'Chittagong|Читтагонг', 'Sylhet|Силхет'],
  ID: ['Jakarta|Джакарта', 'Surabaya|Сурабая', 'Bandung|Бандунг', 'Medan|Медан'],
  MY: ['Kuala Lumpur|Куала-Лумпур', 'Penang|Пинанг', 'Johor Bahru|Джохор-Бару', 'Kota Bharu'],
  GB: ['London|Лондон', 'Birmingham|Бирмингем', 'Manchester|Манчестер', 'Leicester|Лестер', 'Bradford|Брэдфорд', 'Glasgow|Глазго'],
  DE: ['Berlin|Берлин', 'Hamburg|Гамбург', 'Munich|München|Мюнхен', 'Cologne|Köln|Кёльн', 'Frankfurt|Франкфурт', 'Stuttgart|Штутгарт'],
  FR: ['Paris|Париж', 'Marseille|Марсель', 'Lyon|Лион', 'Lille|Лилль', 'Toulouse|Тулуза'],
  NL: ['Amsterdam|Амстердам', 'Rotterdam|Роттердам', 'The Hague|Den Haag|Гаага', 'Utrecht|Утрехт'],
  BE: ['Brussels|Bruxelles|Брюссель', 'Antwerp|Антверпен', 'Liège|Liege|Льеж'],
  SE: ['Stockholm|Стокгольм', 'Gothenburg|Göteborg|Гётеборг', 'Malmö|Malmo|Мальмё'],
  US: ['New York|Нью-Йорк', 'Chicago|Чикаго', 'Houston|Хьюстон', 'Los Angeles|Лос-Анджелес', 'Dallas|Даллас', 'Philadelphia|Филадельфия'],
  CA: ['Toronto|Торонто', 'Montreal|Монреаль', 'Calgary|Калгари', 'Vancouver|Ванкувер', 'Ottawa|Оттава'],
  AU: ['Sydney|Сидней', 'Melbourne|Мельбурн', 'Brisbane|Брисбен', 'Perth|Перт'],
};

/** Aramada harf farklarını yok say: büyük/küçük, aksan, kesme işaretleri (ʻ ‘ ' ’). */
export const normalizeCity = (s: string) =>
  s
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ‘’'`ı]/g, (c) => (c === 'ı' ? 'i' : ''))
    .trim();

export interface CityOption {
  name: string;
  keys: string[];
}

export function citiesFor(country: string): CityOption[] {
  return (CITIES[country] ?? []).map((entry) => {
    const names = entry.split('|');
    return { name: names[0], keys: names.map(normalizeCity) };
  });
}

/** Konumdan gelen (herhangi bir dildeki) adı listedeki kayıtlı ada çevirir; yoksa olduğu gibi döner. */
export function matchCity(country: string, raw: string): string {
  const q = normalizeCity(raw);
  return citiesFor(country).find((c) => c.keys.includes(q))?.name ?? raw;
}

/** İzin istemeden ön seçim: saat diliminden, olmazsa tarayıcı dilinin bölgesinden ülke tahmini. */
const TZ_COUNTRY: Record<string, string> = {
  'Asia/Tashkent': 'UZ', 'Asia/Samarkand': 'UZ', 'Asia/Almaty': 'KZ', 'Asia/Qyzylorda': 'KZ', 'Asia/Aqtobe': 'KZ',
  'Asia/Aqtau': 'KZ', 'Asia/Atyrau': 'KZ', 'Asia/Oral': 'KZ', 'Asia/Qostanay': 'KZ', 'Asia/Bishkek': 'KG',
  'Asia/Dushanbe': 'TJ', 'Asia/Ashgabat': 'TM', 'Asia/Kabul': 'AF', 'Europe/Istanbul': 'TR', 'Asia/Baku': 'AZ',
  'Europe/Moscow': 'RU', 'Europe/Kaliningrad': 'RU', 'Europe/Samara': 'RU', 'Asia/Yekaterinburg': 'RU',
  'Asia/Novosibirsk': 'RU', 'Asia/Omsk': 'RU', 'Asia/Krasnoyarsk': 'RU', 'Asia/Vladivostok': 'RU',
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM', 'Africa/Cairo': 'EG', 'Asia/Amman': 'JO', 'Africa/Casablanca': 'MA', 'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Jakarta': 'ID',
  'Asia/Kuala_Lumpur': 'MY', 'Europe/London': 'GB', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Stockholm': 'SE', 'America/New_York': 'US',
  'America/Chicago': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'Australia/Sydney': 'AU',
};

export function guessCountry(known: readonly string[], fallback = 'UZ'): string {
  try {
    const tz = TZ_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone];
    if (tz && known.includes(tz)) return tz;
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && known.includes(region)) return region;
  } catch {
    /* yoksay */
  }
  return fallback;
}

/**
 * Tarayıcı konumundan ülke + şehir (izin ister). Ters coğrafi kodlama: BigDataCloud'un ücretsiz,
 * anahtarsız istemci uç noktası (tarayıcıdan çağrılmak için tasarlanmış).
 */
export function detectLocation(): Promise<{ country: string; city: string } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`;
          const r = await (await fetch(url)).json();
          const country = String(r.countryCode ?? '').toUpperCase();
          const raw = String(r.city || r.locality || '');
          resolve(country ? { country, city: raw ? matchCity(country, raw) : '' } : null);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  });
}
