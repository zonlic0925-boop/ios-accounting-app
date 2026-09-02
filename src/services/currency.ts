/**
 * Multi-Currency Engine & Exchange Rate Service
 * Supports 160+ ISO currencies, offline baseline rates, real-time sync with caching,
 * custom user rates, conversions, and standardized money formatting.
 */

export interface CurrencyInfo {
  code: string;
  name?: string;
  nameZh: string;
  nameEn: string;
  symbol: string;
  flag: string;
  decimalDigits: number;
  isPopular?: boolean;
}

export interface ExchangeRatesData {
  base: string; // Base currency anchor (USD)
  rates: Record<string, number>;
  timestamp: number;
  source: string;
}

// Storage keys
const STORAGE_KEY_RATES = "ios_expense_exchange_rates";
const STORAGE_KEY_CUSTOM_RATES = "ios_expense_custom_rates";
const STORAGE_KEY_BASE_CURRENCY = "ios_expense_base_currency";

/**
 * 160+ Global Currency Metadata (ISO 4217)
 * Top 30+ popular currencies marked with isPopular: true
 */
export const CURRENCY_METADATA: Record<string, CurrencyInfo> = {
  // Top 30+ Major / Popular Currencies
  CNY: { code: "CNY", nameZh: "人民币", nameEn: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", decimalDigits: 2, isPopular: true },
  USD: { code: "USD", nameZh: "美元", nameEn: "US Dollar", symbol: "$", flag: "🇺🇸", decimalDigits: 2, isPopular: true },
  EUR: { code: "EUR", nameZh: "欧元", nameEn: "Euro", symbol: "€", flag: "🇪🇺", decimalDigits: 2, isPopular: true },
  JPY: { code: "JPY", nameZh: "日元", nameEn: "Japanese Yen", symbol: "¥", flag: "🇯🇵", decimalDigits: 0, isPopular: true },
  GBP: { code: "GBP", nameZh: "英镑", nameEn: "British Pound", symbol: "£", flag: "🇬🇧", decimalDigits: 2, isPopular: true },
  HKD: { code: "HKD", nameZh: "港币", nameEn: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰", decimalDigits: 2, isPopular: true },
  TWD: { code: "TWD", nameZh: "新台币", nameEn: "New Taiwan Dollar", symbol: "NT$", flag: "🇹🇼", decimalDigits: 2, isPopular: true },
  SGD: { code: "SGD", nameZh: "新加坡元", nameEn: "Singapore Dollar", symbol: "S$", flag: "🇸🇬", decimalDigits: 2, isPopular: true },
  AUD: { code: "AUD", nameZh: "澳大利亚元", nameEn: "Australian Dollar", symbol: "A$", flag: "🇦🇺", decimalDigits: 2, isPopular: true },
  CAD: { code: "CAD", nameZh: "加拿大元", nameEn: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦", decimalDigits: 2, isPopular: true },
  KRW: { code: "KRW", nameZh: "韩元", nameEn: "South Korean Won", symbol: "₩", flag: "🇰🇷", decimalDigits: 0, isPopular: true },
  THB: { code: "THB", nameZh: "泰铢", nameEn: "Thai Baht", symbol: "฿", flag: "🇹🇭", decimalDigits: 2, isPopular: true },
  CHF: { code: "CHF", nameZh: "瑞士法郎", nameEn: "Swiss Franc", symbol: "CHF", flag: "🇨🇭", decimalDigits: 2, isPopular: true },
  MYR: { code: "MYR", nameZh: "马来西亚林吉特", nameEn: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾", decimalDigits: 2, isPopular: true },
  NZD: { code: "NZD", nameZh: "新西兰元", nameEn: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿", decimalDigits: 2, isPopular: true },
  IDR: { code: "IDR", nameZh: "印度尼西亚卢比", nameEn: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩", decimalDigits: 0, isPopular: true },
  VND: { code: "VND", nameZh: "越南盾", nameEn: "Vietnamese Dong", symbol: "₫", flag: "🇻🇳", decimalDigits: 0, isPopular: true },
  PHP: { code: "PHP", nameZh: "菲律宾比索", nameEn: "Philippine Peso", symbol: "₱", flag: "🇵🇭", decimalDigits: 2, isPopular: true },
  INR: { code: "INR", nameZh: "印度卢比", nameEn: "Indian Rupee", symbol: "₹", flag: "🇮🇳", decimalDigits: 2, isPopular: true },
  AED: { code: "AED", nameZh: "阿联酋迪拉姆", nameEn: "UAE Dirham", symbol: "AED", flag: "🇦🇪", decimalDigits: 2, isPopular: true },
  SAR: { code: "SAR", nameZh: "沙特里亚尔", nameEn: "Saudi Riyal", symbol: "SAR", flag: "🇸🇦", decimalDigits: 2, isPopular: true },
  MOP: { code: "MOP", nameZh: "澳门元", nameEn: "Macanese Pataca", symbol: "MOP$", flag: "🇲🇴", decimalDigits: 2, isPopular: true },
  RUB: { code: "RUB", nameZh: "俄罗斯卢布", nameEn: "Russian Ruble", symbol: "₽", flag: "🇷🇺", decimalDigits: 2, isPopular: true },
  BRL: { code: "BRL", nameZh: "巴西雷亚尔", nameEn: "Brazilian Real", symbol: "R$", flag: "🇧🇷", decimalDigits: 2, isPopular: true },
  MXN: { code: "MXN", nameZh: "墨西哥比索", nameEn: "Mexican Peso", symbol: "Mex$", flag: "🇲🇽", decimalDigits: 2, isPopular: true },
  TRY: { code: "TRY", nameZh: "土耳其里拉", nameEn: "Turkish Lira", symbol: "₺", flag: "🇹🇷", decimalDigits: 2, isPopular: true },
  ZAR: { code: "ZAR", nameZh: "南非兰特", nameEn: "South African Rand", symbol: "R", flag: "🇿🇦", decimalDigits: 2, isPopular: true },
  SEK: { code: "SEK", nameZh: "瑞典克朗", nameEn: "Swedish Krona", symbol: "kr", flag: "🇸🇪", decimalDigits: 2, isPopular: true },
  NOK: { code: "NOK", nameZh: "挪威克朗", nameEn: "Norwegian Krone", symbol: "kr", flag: "🇳🇴", decimalDigits: 2, isPopular: true },
  DKK: { code: "DKK", nameZh: "丹麦克朗", nameEn: "Danish Krone", symbol: "kr", flag: "🇩🇰", decimalDigits: 2, isPopular: true },
  PLN: { code: "PLN", nameZh: "波兰兹罗提", nameEn: "Polish Zloty", symbol: "zł", flag: "🇵🇱", decimalDigits: 2, isPopular: true },
  ILS: { code: "ILS", nameZh: "以色列新谢克尔", nameEn: "Israeli New Shekel", symbol: "₪", flag: "🇮🇱", decimalDigits: 2, isPopular: true },
  EGP: { code: "EGP", nameZh: "埃及镑", nameEn: "Egyptian Pound", symbol: "E£", flag: "🇪🇬", decimalDigits: 2, isPopular: true },
  CLP: { code: "CLP", nameZh: "智利比索", nameEn: "Chilean Peso", symbol: "CLP$", flag: "🇨🇱", decimalDigits: 0, isPopular: true },
  ARS: { code: "ARS", nameZh: "阿根廷比索", nameEn: "Argentine Peso", symbol: "ARS$", flag: "🇦🇷", decimalDigits: 2, isPopular: true },

  // Other Global Currencies (130+ additional)
  AFN: { code: "AFN", nameZh: "阿富汗尼", nameEn: "Afghan Afghani", symbol: "؋", flag: "🇦🇫", decimalDigits: 2 },
  ALL: { code: "ALL", nameZh: "阿尔巴尼亚列克", nameEn: "Albanian Lek", symbol: "L", flag: "🇦🇱", decimalDigits: 2 },
  AMD: { code: "AMD", nameZh: "亚美尼亚德拉姆", nameEn: "Armenian Dram", symbol: "֏", flag: "🇦🇲", decimalDigits: 2 },
  ANG: { code: "ANG", nameZh: "荷属安的列斯盾", nameEn: "Netherlands Antillean Guilder", symbol: "ƒ", flag: "🇨🇼", decimalDigits: 2 },
  AOA: { code: "AOA", nameZh: "安哥拉宽扎", nameEn: "Angolan Kwanza", symbol: "Kz", flag: "🇦🇴", decimalDigits: 2 },
  AWG: { code: "AWG", nameZh: "阿鲁巴弗罗林", nameEn: "Aruban Florin", symbol: "ƒ", flag: "🇦🇼", decimalDigits: 2 },
  AZN: { code: "AZN", nameZh: "阿塞拜疆马纳特", nameEn: "Azerbaijani Manat", symbol: "₼", flag: "🇦🇿", decimalDigits: 2 },
  BAM: { code: "BAM", nameZh: "波黑可兑换马克", nameEn: "Bosnia-Herzegovina Convertible Mark", symbol: "KM", flag: "🇧🇦", decimalDigits: 2 },
  BBD: { code: "BBD", nameZh: "巴巴多斯元", nameEn: "Barbadian Dollar", symbol: "BBD$", flag: "🇧🇧", decimalDigits: 2 },
  BDT: { code: "BDT", nameZh: "孟加拉塔卡", nameEn: "Bangladeshi Taka", symbol: "৳", flag: "🇧🇩", decimalDigits: 2 },
  BGN: { code: "BGN", nameZh: "保加利亚列弗", nameEn: "Bulgarian Lev", symbol: "лв", flag: "🇧🇬", decimalDigits: 2 },
  BHD: { code: "BHD", nameZh: "巴林第纳尔", nameEn: "Bahraini Dinar", symbol: "BD", flag: "🇧🇭", decimalDigits: 3 },
  BIF: { code: "BIF", nameZh: "布隆迪法郎", nameEn: "Burundian Franc", symbol: "FBu", flag: "🇧🇮", decimalDigits: 0 },
  BMD: { code: "BMD", nameZh: "百慕大元", nameEn: "Bermudan Dollar", symbol: "BD$", flag: "🇧🇲", decimalDigits: 2 },
  BND: { code: "BND", nameZh: "文莱元", nameEn: "Brunei Dollar", symbol: "B$", flag: "🇧🇳", decimalDigits: 2 },
  BOB: { code: "BOB", nameZh: "玻利维亚诺", nameEn: "Bolivian Boliviano", symbol: "Bs.", flag: "🇧🇴", decimalDigits: 2 },
  BSD: { code: "BSD", nameZh: "巴哈马元", nameEn: "Bahamian Dollar", symbol: "B$", flag: "🇧🇸", decimalDigits: 2 },
  BTN: { code: "BTN", nameZh: "不丹努尔特鲁姆", nameEn: "Bhutanese Ngultrum", symbol: "Nu.", flag: "🇧🇹", decimalDigits: 2 },
  BWP: { code: "BWP", nameZh: "博茨瓦纳普拉", nameEn: "Botswanan Pula", symbol: "P", flag: "🇧🇼", decimalDigits: 2 },
  BYN: { code: "BYN", nameZh: "白俄罗斯卢布", nameEn: "Belarusian Ruble", symbol: "Br", flag: "🇧🇾", decimalDigits: 2 },
  BZD: { code: "BZD", nameZh: "伯利兹元", nameEn: "Belize Dollar", symbol: "BZ$", flag: "🇧🇿", decimalDigits: 2 },
  CDF: { code: "CDF", nameZh: "刚果法郎", nameEn: "Congolese Franc", symbol: "FC", flag: "🇨🇩", decimalDigits: 2 },
  COP: { code: "COP", nameZh: "哥伦比亚比索", nameEn: "Colombian Peso", symbol: "COL$", flag: "🇨🇴", decimalDigits: 2 },
  CRC: { code: "CRC", nameZh: "哥斯达黎加科朗", nameEn: "Costa Rican Colón", symbol: "₡", flag: "🇨🇷", decimalDigits: 2 },
  CUP: { code: "CUP", nameZh: "古巴比索", nameEn: "Cuban Peso", symbol: "₱", flag: "🇨🇺", decimalDigits: 2 },
  CVE: { code: "CVE", nameZh: "佛得角埃斯库多", nameEn: "Cape Verdean Escudo", symbol: "Esc", flag: "🇨🇻", decimalDigits: 2 },
  CZK: { code: "CZK", nameZh: "捷克克朗", nameEn: "Czech Koruna", symbol: "Kč", flag: "🇨🇿", decimalDigits: 2 },
  DJF: { code: "DJF", nameZh: "吉布提法郎", nameEn: "Djiboutian Franc", symbol: "Fdj", flag: "🇩🇯", decimalDigits: 0 },
  DOP: { code: "DOP", nameZh: "多米尼加比索", nameEn: "Dominican Peso", symbol: "RD$", flag: "🇩🇴", decimalDigits: 2 },
  DZD: { code: "DZD", nameZh: "阿尔及利亚第纳尔", nameEn: "Algerian Dinar", symbol: "DA", flag: "🇩🇿", decimalDigits: 2 },
  ERN: { code: "ERN", nameZh: "厄立特里亚纳克法", nameEn: "Eritrean Nakfa", symbol: "Nfk", flag: "🇪🇷", decimalDigits: 2 },
  ETB: { code: "ETB", nameZh: "埃塞俄比亚比尔", nameEn: "Ethiopian Birr", symbol: "Br", flag: "🇪🇹", decimalDigits: 2 },
  FJD: { code: "FJD", nameZh: "斐济元", nameEn: "Fijian Dollar", symbol: "FJ$", flag: "🇫🇯", decimalDigits: 2 },
  FKP: { code: "FKP", nameZh: "福克兰群岛镑", nameEn: "Falkland Islands Pound", symbol: "FK£", flag: "🇫🇰", decimalDigits: 2 },
  GEL: { code: "GEL", nameZh: "格鲁吉亚拉里", nameEn: "Georgian Lari", symbol: "₾", flag: "🇬🇪", decimalDigits: 2 },
  GHS: { code: "GHS", nameZh: "加纳塞地", nameEn: "Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭", decimalDigits: 2 },
  GIP: { code: "GIP", nameZh: "直布罗陀镑", nameEn: "Gibraltar Pound", symbol: "£", flag: "🇬🇮", decimalDigits: 2 },
  GMD: { code: "GMD", nameZh: "冈比亚达拉西", nameEn: "Gambian Dalasi", symbol: "D", flag: "🇬🇲", decimalDigits: 2 },
  GNF: { code: "GNF", nameZh: "几内亚法郎", nameEn: "Guinean Franc", symbol: "FG", flag: "🇬🇳", decimalDigits: 0 },
  GTQ: { code: "GTQ", nameZh: "危地马拉格查尔", nameEn: "Guatemalan Quetzal", symbol: "Q", flag: "🇬🇹", decimalDigits: 2 },
  GYD: { code: "GYD", nameZh: "圭亚那元", nameEn: "Guyanaese Dollar", symbol: "GY$", flag: "🇬🇾", decimalDigits: 2 },
  HNL: { code: "HNL", nameZh: "洪都拉斯伦皮拉", nameEn: "Honduran Lempira", symbol: "L", flag: "🇭🇳", decimalDigits: 2 },
  HRK: { code: "HRK", nameZh: "克罗地亚库纳", nameEn: "Croatian Kuna", symbol: "kn", flag: "🇭🇷", decimalDigits: 2 },
  HTG: { code: "HTG", nameZh: "海地古德", nameEn: "Haitian Gourde", symbol: "G", flag: "🇭🇹", decimalDigits: 2 },
  HUF: { code: "HUF", nameZh: "匈牙利福林", nameEn: "Hungarian Forint", symbol: "Ft", flag: "🇭🇺", decimalDigits: 2 },
  IQD: { code: "IQD", nameZh: "伊拉克第纳尔", nameEn: "Iraqi Dinar", symbol: "IQD", flag: "🇮🇶", decimalDigits: 3 },
  IRR: { code: "IRR", nameZh: "伊朗里亚尔", nameEn: "Iranian Rial", symbol: "﷼", flag: "🇮🇷", decimalDigits: 0 },
  ISK: { code: "ISK", nameZh: "冰岛克朗", nameEn: "Icelandic Króna", symbol: "kr", flag: "🇮🇸", decimalDigits: 0 },
  JMD: { code: "JMD", nameZh: "牙买加元", nameEn: "Jamaican Dollar", symbol: "J$", flag: "🇯🇲", decimalDigits: 2 },
  JOD: { code: "JOD", nameZh: "约旦第纳尔", nameEn: "Jordanian Dinar", symbol: "JD", flag: "🇯🇴", decimalDigits: 3 },
  KES: { code: "KES", nameZh: "肯尼亚先令", nameEn: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", decimalDigits: 2 },
  KGS: { code: "KGS", nameZh: "吉尔吉斯斯坦索姆", nameEn: "Kyrgystani Som", symbol: "с", flag: "🇰🇬", decimalDigits: 2 },
  KHR: { code: "KHR", nameZh: "柬埔寨瑞尔", nameEn: "Cambodian Riel", symbol: "៛", flag: "🇰🇭", decimalDigits: 2 },
  KMF: { code: "KMF", nameZh: "科摩罗法郎", nameEn: "Comorian Franc", symbol: "CF", flag: "🇰🇲", decimalDigits: 0 },
  KWD: { code: "KWD", nameZh: "科威特第纳尔", nameEn: "Kuwaiti Dinar", symbol: "KD", flag: "🇰🇼", decimalDigits: 3 },
  KYD: { code: "KYD", nameZh: "开曼群岛元", nameEn: "Cayman Islands Dollar", symbol: "CI$", flag: "🇰🇾", decimalDigits: 2 },
  KZT: { code: "KZT", nameZh: "哈萨克斯坦坚戈", nameEn: "Kazakhstani Tenge", symbol: "₸", flag: "🇰🇿", decimalDigits: 2 },
  LAK: { code: "LAK", nameZh: "老挝基普", nameEn: "Laotian Kip", symbol: "₭", flag: "🇱🇦", decimalDigits: 0 },
  LBP: { code: "LBP", nameZh: "黎巴嫩镑", nameEn: "Lebanese Pound", symbol: "L£", flag: "🇱🇧", decimalDigits: 2 },
  LKR: { code: "LKR", nameZh: "斯里兰卡卢比", nameEn: "Sri Lankan Rupee", symbol: "Rs", flag: "🇱🇰", decimalDigits: 2 },
  LRD: { code: "LRD", nameZh: "利比里亚元", nameEn: "Liberian Dollar", symbol: "L$", flag: "🇱🇷", decimalDigits: 2 },
  LSL: { code: "LSL", nameZh: "莱索托洛蒂", nameEn: "Lesotho Loti", symbol: "L", flag: "🇱🇸", decimalDigits: 2 },
  LYD: { code: "LYD", nameZh: "利比亚第纳尔", nameEn: "Libyan Dinar", symbol: "LD", flag: "🇱🇾", decimalDigits: 3 },
  MAD: { code: "MAD", nameZh: "摩洛哥迪拉姆", nameEn: "Moroccan Dirham", symbol: "MAD", flag: "🇲🇦", decimalDigits: 2 },
  MDL: { code: "MDL", nameZh: "摩尔多瓦列伊", nameEn: "Moldovan Leu", symbol: "MDL", flag: "🇲🇩", decimalDigits: 2 },
  MGA: { code: "MGA", nameZh: "马达加斯加阿里亚里", nameEn: "Malagasy Ariary", symbol: "Ar", flag: "🇲🇬", decimalDigits: 0 },
  MKD: { code: "MKD", nameZh: "北马其顿第纳尔", nameEn: "Macedonian Denar", symbol: "ден", flag: "🇲🇰", decimalDigits: 2 },
  MMK: { code: "MMK", nameZh: "缅甸元", nameEn: "Myanmar Kyat", symbol: "K", flag: "🇲🇲", decimalDigits: 2 },
  MNT: { code: "MNT", nameZh: "蒙古图格里克", nameEn: "Mongolian Tugrik", symbol: "₮", flag: "🇲🇳", decimalDigits: 2 },
  MRU: { code: "MRU", nameZh: "毛里塔尼亚乌吉亚", nameEn: "Mauritanian Ouguiya", symbol: "UM", flag: "🇲🇷", decimalDigits: 2 },
  MUR: { code: "MUR", nameZh: "毛里求斯卢比", nameEn: "Mauritian Rupee", symbol: "₨", flag: "🇲🇺", decimalDigits: 2 },
  MVR: { code: "MVR", nameZh: "马尔代夫拉菲亚", nameEn: "Maldivian Rufiyaa", symbol: "Rf", flag: "🇲🇻", decimalDigits: 2 },
  MWK: { code: "MWK", nameZh: "马拉维克瓦查", nameEn: "Malawian Kwacha", symbol: "MK", flag: "🇲🇼", decimalDigits: 2 },
  MZN: { code: "MZN", nameZh: "莫桑比克梅蒂卡尔", nameEn: "Mozambican Metical", symbol: "MT", flag: "🇲🇿", decimalDigits: 2 },
  NAD: { code: "NAD", nameZh: "纳米比亚元", nameEn: "Namibian Dollar", symbol: "N$", flag: "🇳🇦", decimalDigits: 2 },
  NGN: { code: "NGN", nameZh: "尼日利亚奈拉", nameEn: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", decimalDigits: 2 },
  NIO: { code: "NIO", nameZh: "尼加拉瓜科多巴", nameEn: "Nicaraguan Córdoba", symbol: "C$", flag: "🇳🇮", decimalDigits: 2 },
  NPR: { code: "NPR", nameZh: "尼泊尔卢比", nameEn: "Nepalese Rupee", symbol: "रू", flag: "🇳🇵", decimalDigits: 2 },
  OMR: { code: "OMR", nameZh: "阿曼里亚尔", nameEn: "Omani Rial", symbol: "OMR", flag: "🇴🇲", decimalDigits: 3 },
  PAB: { code: "PAB", nameZh: "巴拿马巴波亚", nameEn: "Panamanian Balboa", symbol: "B/.", flag: "🇵🇦", decimalDigits: 2 },
  PEN: { code: "PEN", nameZh: "秘鲁索尔", nameEn: "Peruvian Sol", symbol: "S/.", flag: "🇵🇪", decimalDigits: 2 },
  PGK: { code: "PGK", nameZh: "巴布亚新几内亚基那", nameEn: "Papua New Guinean Kina", symbol: "K", flag: "🇵🇬", decimalDigits: 2 },
  PKR: { code: "PKR", nameZh: "巴基斯坦卢比", nameEn: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰", decimalDigits: 2 },
  PYG: { code: "PYG", nameZh: "巴拉圭瓜拉尼", nameEn: "Paraguayan Guarani", symbol: "₲", flag: "🇵🇾", decimalDigits: 0 },
  QAR: { code: "QAR", nameZh: "卡塔尔里亚尔", nameEn: "Qatari Rial", symbol: "QR", flag: "🇶🇦", decimalDigits: 2 },
  RON: { code: "RON", nameZh: "罗马尼亚列伊", nameEn: "Romanian Leu", symbol: "lei", flag: "🇷🇴", decimalDigits: 2 },
  RSD: { code: "RSD", nameZh: "塞尔维亚第纳尔", nameEn: "Serbian Dinar", symbol: "din", flag: "🇷🇸", decimalDigits: 2 },
  RWF: { code: "RWF", nameZh: "卢旺达法郎", nameEn: "Rwandan Franc", symbol: "RF", flag: "🇷🇼", decimalDigits: 0 },
  SBD: { code: "SBD", nameZh: "所罗门群岛元", nameEn: "Solomon Islands Dollar", symbol: "SI$", flag: "🇸🇧", decimalDigits: 2 },
  SCR: { code: "SCR", nameZh: "塞舌尔卢比", nameEn: "Seychellois Rupee", symbol: "SR", flag: "🇸🇨", decimalDigits: 2 },
  SDG: { code: "SDG", nameZh: "苏丹镑", nameEn: "Sudanese Pound", symbol: "SDG", flag: "🇸🇩", decimalDigits: 2 },
  SHP: { code: "SHP", nameZh: "圣赫勒拿群岛磅", nameEn: "Saint Helena Pound", symbol: "£", flag: "🇸🇭", decimalDigits: 2 },
  SLL: { code: "SLL", nameZh: "塞拉利昂利昂", nameEn: "Sierra Leonean Leone", symbol: "Le", flag: "🇸🇱", decimalDigits: 2 },
  SOS: { code: "SOS", nameZh: "索马里先令", nameEn: "Somali Shilling", symbol: "S", flag: "🇸🇴", decimalDigits: 2 },
  SRD: { code: "SRD", nameZh: "苏里南元", nameEn: "Surinamese Dollar", symbol: "Sr$", flag: "🇸🇷", decimalDigits: 2 },
  SSP: { code: "SSP", nameZh: "南苏丹镑", nameEn: "South Sudanese Pound", symbol: "SSP", flag: "🇸🇸", decimalDigits: 2 },
  STN: { code: "STN", nameZh: "圣多美和普林西比多布拉", nameEn: "São Tomé & Príncipe Dobra", symbol: "Db", flag: "🇸🇹", decimalDigits: 2 },
  SYP: { code: "SYP", nameZh: "叙利亚镑", nameEn: "Syrian Pound", symbol: "£S", flag: "🇸🇾", decimalDigits: 2 },
  SZL: { code: "SZL", nameZh: "斯威士兰里兰吉尼", nameEn: "Swazi Lilangeni", symbol: "L", flag: "🇸🇿", decimalDigits: 2 },
  TJS: { code: "TJS", nameZh: "塔吉克斯坦索莫尼", nameEn: "Tajikistani Somoni", symbol: "SM", flag: "🇹🇯", decimalDigits: 2 },
  TMT: { code: "TMT", nameZh: "土库曼斯坦马纳特", nameEn: "Turkmenistani Manat", symbol: "T", flag: "🇹🇲", decimalDigits: 2 },
  TND: { code: "TND", nameZh: "突尼斯第纳尔", nameEn: "Tunisian Dinar", symbol: "DT", flag: "🇹🇳", decimalDigits: 3 },
  TOP: { code: "TOP", nameZh: "汤加潘加", nameEn: "Tongan Paʻanga", symbol: "T$", flag: "🇹🇴", decimalDigits: 2 },
  TTD: { code: "TTD", nameZh: "特立尼达和多巴哥元", nameEn: "Trinidad & Tobago Dollar", symbol: "TT$", flag: "🇹🇹", decimalDigits: 2 },
  TZS: { code: "TZS", nameZh: "坦桑尼亚先令", nameEn: "Tanzanian Shilling", symbol: "TSh", flag: "🇹🇿", decimalDigits: 2 },
  UAH: { code: "UAH", nameZh: "乌克兰格里夫纳", nameEn: "Ukrainian Hryvnia", symbol: "₴", flag: "🇺🇦", decimalDigits: 2 },
  UGX: { code: "UGX", nameZh: "乌干达先令", nameEn: "Ugandan Shilling", symbol: "USh", flag: "🇺🇬", decimalDigits: 0 },
  UYU: { code: "UYU", nameZh: "乌拉圭比索", nameEn: "Uruguayan Peso", symbol: "$U", flag: "🇺🇾", decimalDigits: 2 },
  UZS: { code: "UZS", nameZh: "乌兹别克斯坦苏姆", nameEn: "Uzbekistani Som", symbol: "soʻm", flag: "🇺🇿", decimalDigits: 2 },
  VES: { code: "VES", nameZh: "委内瑞拉玻利瓦尔", nameEn: "Venezuelan Bolívar", symbol: "Bs.S", flag: "🇻🇪", decimalDigits: 2 },
  VUV: { code: "VUV", nameZh: "瓦努阿图瓦图", nameEn: "Vanuatu Vatu", symbol: "VT", flag: "🇻🇺", decimalDigits: 0 },
  WST: { code: "WST", nameZh: "萨摩亚塔拉", nameEn: "Samoan Tala", symbol: "WS$", flag: "🇼🇸", decimalDigits: 2 },
  XAF: { code: "XAF", nameZh: "中非法郎", nameEn: "Central African CFA Franc", symbol: "FCFA", flag: "🇨🇲", decimalDigits: 0 },
  XCD: { code: "XCD", nameZh: "东加勒比元", nameEn: "East Caribbean Dollar", symbol: "EC$", flag: "🇦🇬", decimalDigits: 2 },
  XOF: { code: "XOF", nameZh: "西非法郎", nameEn: "West African CFA Franc", symbol: "CFA", flag: "🇸🇳", decimalDigits: 0 },
  XPF: { code: "XPF", nameZh: "太平洋法郎", nameEn: "CFP Franc", symbol: "₣", flag: "🇵🇫", decimalDigits: 0 },
  YER: { code: "YER", nameZh: "也门里亚尔", nameEn: "Yemeni Rial", symbol: "﷼", flag: "🇾🇪", decimalDigits: 2 },
  ZMW: { code: "ZMW", nameZh: "赞比亚克瓦查", nameEn: "Zambian Kwacha", symbol: "ZK", flag: "🇿🇲", decimalDigits: 2 },
  ZWL: { code: "ZWL", nameZh: "津巴布韦元", nameEn: "Zimbabwean Dollar", symbol: "Z$", flag: "🇿🇼", decimalDigits: 2 },
};

/**
 * Built-in Offline Baseline Exchange Rates (Anchor: 1 USD)
 * Ensures 100% functionality in offline / airplane mode.
 */
export const OFFLINE_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  CNY: 7.235,
  EUR: 0.922,
  JPY: 154.65,
  GBP: 0.789,
  HKD: 7.824,
  TWD: 32.48,
  SGD: 1.348,
  AUD: 1.528,
  CAD: 1.376,
  KRW: 1378.5,
  THB: 36.65,
  CHF: 0.908,
  MYR: 4.712,
  NZD: 1.662,
  IDR: 16250.0,
  VND: 25420.0,
  PHP: 58.12,
  INR: 83.52,
  AED: 3.673,
  SAR: 3.751,
  MOP: 8.058,
  RUB: 91.25,
  BRL: 5.385,
  MXN: 18.25,
  TRY: 32.85,
  ZAR: 18.45,
  SEK: 10.54,
  NOK: 10.68,
  DKK: 6.878,
  PLN: 3.985,
  ILS: 3.725,
  EGP: 47.65,
  CLP: 935.5,
  ARS: 915.0,
  AFN: 70.85,
  ALL: 93.45,
  AMD: 388.2,
  ANG: 1.802,
  AOA: 855.0,
  AWG: 1.8,
  AZN: 1.7,
  BAM: 1.803,
  BBD: 2.0,
  BDT: 117.5,
  BGN: 1.803,
  BHD: 0.376,
  BIF: 2875.0,
  BMD: 1.0,
  BND: 1.348,
  BOB: 6.91,
  BSD: 1.0,
  BTN: 83.52,
  BWP: 13.65,
  BYN: 3.28,
  BZD: 2.0,
  CDF: 2820.0,
  COP: 4120.0,
  CRC: 524.5,
  CUP: 24.0,
  CVE: 101.65,
  CZK: 23.15,
  DJF: 177.72,
  DOP: 59.2,
  DZD: 134.5,
  ERN: 15.0,
  ETB: 57.5,
  FJD: 2.26,
  FKP: 0.789,
  GEL: 2.78,
  GHS: 14.85,
  GIP: 0.789,
  GMD: 68.5,
  GNF: 8600.0,
  GTQ: 7.76,
  GYD: 209.2,
  HNL: 24.72,
  HRK: 6.946,
  HTG: 132.5,
  HUF: 366.5,
  IQD: 1310.0,
  IRR: 42000.0,
  ISK: 139.5,
  JMD: 156.2,
  JOD: 0.709,
  KES: 129.5,
  KGS: 87.5,
  KHR: 4095.0,
  KMF: 453.5,
  KWD: 0.307,
  KYD: 0.833,
  KZT: 448.5,
  LAK: 21850.0,
  LBP: 89500.0,
  LKR: 303.5,
  LRD: 194.0,
  LSL: 18.45,
  LYD: 4.86,
  MAD: 9.98,
  MDL: 17.75,
  MGA: 4480.0,
  MKD: 56.7,
  MMK: 2098.0,
  MNT: 3380.0,
  MRU: 39.75,
  MUR: 46.5,
  MVR: 15.45,
  MWK: 1735.0,
  MZN: 63.85,
  NAD: 18.45,
  NGN: 1485.0,
  NIO: 36.85,
  NPR: 133.6,
  OMR: 0.384,
  PAB: 1.0,
  PEN: 3.76,
  PGK: 3.88,
  PKR: 278.5,
  PYG: 7520.0,
  QAR: 3.64,
  RON: 4.58,
  RSD: 108.2,
  RWF: 1310.0,
  SBD: 8.45,
  SCR: 13.85,
  SDG: 601.0,
  SHP: 0.789,
  SLL: 22500.0,
  SOS: 571.0,
  SRD: 30.5,
  SSP: 1550.0,
  STN: 22.58,
  SYP: 13000.0,
  SZL: 18.45,
  TJS: 10.92,
  TMT: 3.5,
  TND: 3.12,
  TOP: 2.36,
  TTD: 6.78,
  TZS: 2610.0,
  UAH: 40.55,
  UGX: 3740.0,
  UYU: 39.25,
  UZS: 12650.0,
  VES: 36.45,
  VUV: 120.5,
  WST: 2.74,
  XAF: 604.8,
  XCD: 2.7,
  XOF: 604.8,
  XPF: 110.0,
  YER: 250.2,
  ZMW: 25.8,
  ZWL: 13.8,
};

/**
 * Currency Engine Class
 */
class CurrencyEngine {
  private memoryRates: Record<string, number> = { ...OFFLINE_EXCHANGE_RATES };
  private customRates: Record<string, number> = {};
  private lastUpdated: number = 0;
  private syncSource: string = "offline-fallback";
  private isSyncing: boolean = false;
  private baseCurrency: string = "CNY";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;

      // Load cached exchange rates
      const cachedRatesJson = localStorage.getItem(STORAGE_KEY_RATES);
      if (cachedRatesJson) {
        const parsed: ExchangeRatesData = JSON.parse(cachedRatesJson);
        if (parsed && parsed.rates && Object.keys(parsed.rates).length > 0) {
          this.memoryRates = { ...OFFLINE_EXCHANGE_RATES, ...parsed.rates };
          this.lastUpdated = parsed.timestamp || 0;
          this.syncSource = parsed.source || "cached";
        }
      }

      // Load user custom overrides
      const customRatesJson = localStorage.getItem(STORAGE_KEY_CUSTOM_RATES);
      if (customRatesJson) {
        this.customRates = JSON.parse(customRatesJson) || {};
      }

      // Load base currency setting
      const baseCur = localStorage.getItem(STORAGE_KEY_BASE_CURRENCY);
      if (baseCur && CURRENCY_METADATA[baseCur]) {
        this.baseCurrency = baseCur;
      }
    } catch (e) {
      console.warn("Failed to load currency cache from localStorage:", e);
    }
  }

  private saveRatesToStorage() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      const data: ExchangeRatesData = {
        base: "USD",
        rates: this.memoryRates,
        timestamp: this.lastUpdated,
        source: this.syncSource,
      };
      localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save rates to localStorage:", e);
    }
  }

  private saveCustomRatesToStorage() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      localStorage.setItem(STORAGE_KEY_CUSTOM_RATES, JSON.stringify(this.customRates));
    } catch (e) {
      console.warn("Failed to save custom rates to localStorage:", e);
    }
  }

  /**
   * Get Active Effective Rates (Combines Baseline/API rates with Custom User Overrides, USD base)
   */
  public getEffectiveRates(): Record<string, number> {
    return {
      ...OFFLINE_EXCHANGE_RATES,
      ...this.memoryRates,
      ...this.customRates,
    };
  }

  /**
   * Get all effective exchange rates (USD based)
   */
  public getAllRates(): Record<string, number> {
    return this.getEffectiveRates();
  }

  /**
   * Get User Base Currency
   */
  public getBaseCurrency(): string {
    return this.baseCurrency;
  }

  /**
   * Set User Base Currency
   */
  public setBaseCurrency(currencyCode: string): void {
    const code = currencyCode.toUpperCase();
    if (CURRENCY_METADATA[code]) {
      this.baseCurrency = code;
      try {
        localStorage.setItem(STORAGE_KEY_BASE_CURRENCY, code);
      } catch (e) {
        console.warn("Failed to save base currency:", e);
      }
    }
  }

  /**
   * Get Last Synced Timestamp
   */
  public getLastUpdatedTimestamp(): number {
    return this.lastUpdated;
  }

  /**
   * Get Sync Source description
   */
  public getSyncSource(): string {
    return this.syncSource;
  }

  /**
   * Sync Real-time Exchange Rates from Free Public APIs (No API key needed)
   */
  public async syncExchangeRates(force: boolean = false): Promise<{ success: boolean; error?: string; timestamp: number }> {
    // Check if synced recently (within 1 hour) unless forced
    const ONE_HOUR = 60 * 60 * 1000;
    if (!force && this.lastUpdated && Date.now() - this.lastUpdated < ONE_HOUR) {
      return { success: true, timestamp: this.lastUpdated };
    }

    if (this.isSyncing) {
      return { success: true, timestamp: this.lastUpdated };
    }

    this.isSyncing = true;

    // List of reliable, free, keyless APIs
    const apiEndpoints = [
      {
        url: "https://open.er-api.com/v6/latest/USD",
        parser: (data: any) => data?.rates,
        name: "open.er-api.com",
      },
      {
        url: "https://api.exchangerate-api.com/v4/latest/USD",
        parser: (data: any) => data?.rates,
        name: "exchangerate-api.com",
      },
      {
        url: "https://api.frankfurter.app/latest?from=USD",
        parser: (data: any) => ({ ...data?.rates, USD: 1.0 }),
        name: "frankfurter.app",
      },
    ];

    let lastError: any = null;

    for (const endpoint of apiEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(endpoint.url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${endpoint.name}`);
        }

        const data = await response.json();
        const fetchedRates = endpoint.parser(data);

        if (fetchedRates && typeof fetchedRates === "object" && Object.keys(fetchedRates).length > 10) {
          // Normalize and merge rates
          const normalized: Record<string, number> = {};
          for (const [k, v] of Object.entries(fetchedRates)) {
            if (typeof v === "number" && v > 0) {
              normalized[k.toUpperCase()] = v;
            }
          }
          normalized.USD = 1.0;

          this.memoryRates = { ...this.memoryRates, ...normalized };
          this.lastUpdated = Date.now();
          this.syncSource = endpoint.name;
          this.saveRatesToStorage();
          this.isSyncing = false;

          return { success: true, timestamp: this.lastUpdated };
        }
      } catch (err) {
        lastError = err;
        console.warn(`Failed to fetch rates from ${endpoint.name}:`, err);
      }
    }

    this.isSyncing = false;
    return {
      success: false,
      error: lastError ? String(lastError.message || lastError) : "All rate APIs unreachable",
      timestamp: this.lastUpdated,
    };
  }

  /**
   * User Custom Rates Manipulation
   */
  public getCustomRates(): Record<string, number> {
    return { ...this.customRates };
  }

  /**
   * Set custom exchange rate for a currency (relative to USD = 1.0)
   */
  public setCustomRate(currencyCode: string, rateToUSD: number): void {
    const code = currencyCode.toUpperCase();
    if (rateToUSD <= 0 || !isFinite(rateToUSD)) {
      throw new Error("Exchange rate must be a positive finite number");
    }
    this.customRates[code] = rateToUSD;
    this.saveCustomRatesToStorage();
  }

  /**
   * Set exchange rate relative to base currency (e.g., 1 CNY = X JPY)
   */
  public setCustomRateRelativeToBase(
    targetCurrency: string,
    rateFromBase: number,
    baseCurrency: string = this.baseCurrency
  ): void {
    const target = targetCurrency.toUpperCase();
    const base = baseCurrency.toUpperCase();
    if (target === base) return;

    const effective = this.getEffectiveRates();
    const baseToUSD = effective[base] || 1.0;
    // 1 base = rateFromBase target
    // target in USD = baseToUSD * rateFromBase
    const targetToUSD = baseToUSD * rateFromBase;
    this.setCustomRate(target, targetToUSD);
  }

  /**
   * Remove custom rate override for a currency
   */
  public removeCustomRate(currencyCode: string): void {
    const code = currencyCode.toUpperCase();
    delete this.customRates[code];
    this.saveCustomRatesToStorage();
  }

  /**
   * Reset all custom rates to default
   */
  public resetCustomRates(): void {
    this.customRates = {};
    this.saveCustomRatesToStorage();
  }

  /**
   * Calculate exchange rate between any two currencies (1 fromCurrency = ? toCurrency)
   */
  public getRate(fromCurrency: string, toCurrency: string, customRatesOverride?: Record<string, number>): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) return 1.0;

    const rates = customRatesOverride || this.getEffectiveRates();
    const rateFrom = rates[from] ?? OFFLINE_EXCHANGE_RATES[from] ?? 1.0;
    const rateTo = rates[to] ?? OFFLINE_EXCHANGE_RATES[to] ?? 1.0;

    if (rateFrom <= 0) return 1.0;

    // 1 USD = rateFrom FROM => 1 FROM = (1 / rateFrom) USD
    // 1 USD = rateTo TO => 1 FROM = (rateTo / rateFrom) TO
    return rateTo / rateFrom;
  }

  /**
   * Convert monetary amount between currencies
   */
  public convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    customRatesOverride?: Record<string, number>
  ): number {
    if (!amount || isNaN(amount)) return 0;
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return amount;

    const rate = this.getRate(from, to, customRatesOverride);
    const converted = amount * rate;

    // Rounding based on destination currency decimal digits
    const meta = CURRENCY_METADATA[to];
    const decimals = meta ? meta.decimalDigits : 2;
    const factor = Math.pow(10, decimals);
    return Math.round(converted * factor) / factor;
  }
}

// Global Singleton Instance
export const currencyService = new CurrencyEngine();

/**
 * Convenience Helper Functions
 */

export function getCurrencyInfo(code: string): CurrencyInfo {
  const upper = code ? code.toUpperCase() : "CNY";
  if (CURRENCY_METADATA[upper]) {
    const info = CURRENCY_METADATA[upper];
    return { ...info, name: info.nameZh };
  }
  return {
    code: upper,
    name: upper,
    nameZh: upper,
    nameEn: upper,
    symbol: upper,
    flag: "🌐",
    decimalDigits: 2,
  };
}

export function getAllCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCY_METADATA).map((c) => ({ ...c, name: c.nameZh }));
}

export function getPopularCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCY_METADATA)
    .filter((c) => c.isPopular)
    .map((c) => ({ ...c, name: c.nameZh }));
}

/**
 * Curated base-currency options for the settings selector: the world's most
 * traded currencies plus HKD for the home market. The full 160+ list stays
 * available for account currencies and conversion targets; the base selector
 * intentionally shows only these six.
 */
export const BASE_CURRENCY_CODES = ["CNY", "HKD", "USD", "EUR", "JPY", "GBP"];

export function getBaseCurrencyOptions(): CurrencyInfo[] {
  return BASE_CURRENCY_CODES.map((code) => ({
    ...CURRENCY_METADATA[code],
    name: CURRENCY_METADATA[code].nameZh,
  }));
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates?: Record<string, number>
): number {
  return currencyService.convertAmount(amount, fromCurrency, toCurrency, rates);
}

export function getRate(fromCurrency: string, toCurrency: string, rates?: Record<string, number>): number {
  return currencyService.getRate(fromCurrency, toCurrency, rates);
}

export const SUPPORTED_CURRENCIES = CURRENCY_METADATA;

export function formatCurrencyWithCode(
  amount: number,
  currencyCode = "CNY",
  options: FormatMoneyOptions = {}
): string {
  return formatMoney(amount, currencyCode, { ...options, showCode: true });
}

export function formatCurrency(
  amount: number,
  currencyCode = "CNY",
  options: FormatMoneyOptions = {}
): string {
  return formatMoney(amount, currencyCode, options);
}

export interface FormatMoneyOptions {
  showSymbol?: boolean;
  showCode?: boolean;
  showFlag?: boolean;
  precision?: number;
  useGrouping?: boolean;
}

/**
 * Standardized Money Formatter with Currency Symbol and Thousand Separators
 * e.g., formatMoney(1234.5, "USD") => "$1,234.50"
 * e.g., formatMoney(1234, "JPY") => "¥1,234"
 * e.g., formatMoney(1234.5, "CNY", { showCode: true }) => "¥1,234.50 CNY"
 */
export function formatMoney(amount: number, currencyCode = "CNY", options: FormatMoneyOptions = {}): string {
  const code = (currencyCode || "CNY").toUpperCase();
  const info = getCurrencyInfo(code);

  const {
    showSymbol = true,
    showCode = false,
    showFlag = false,
    precision = info.decimalDigits,
    useGrouping = true,
  } = options;

  const validAmount = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  const isNegative = validAmount < 0;
  const absAmount = Math.abs(validAmount);

  // Format number with grouping and precision
  const numPart = absAmount.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: useGrouping,
  });

  const symbolPart = showSymbol ? info.symbol : "";
  const signPart = isNegative ? "-" : "";
  const flagPart = showFlag ? `${info.flag} ` : "";
  const codePart = showCode ? ` ${code}` : "";

  return `${signPart}${flagPart}${symbolPart}${numPart}${codePart}`;
}
