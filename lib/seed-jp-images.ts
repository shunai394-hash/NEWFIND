/** JP demo images: licensed stock portraits mixed with remaining gen_* stills. */
export type JpImageAsset = {
  id: string;
  url: string;
  theme: string;
  note: string;
  place?: string;
};

const HOST = "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img";

function stock(file: string) {
  return `${HOST}/${file}?v=mix1`;
}

function gen(file: string) {
  return `${HOST}/${file}?v=gen1`;
}

/** Ordinary licensed portraits for JP personal / reactor avatars (Pexels). */
export const JP_PHOTO_AVATARS: string[] = [
  1858175, 1382731, 2773977, 1239291, 1181686, 1130626, 1542085, 1821095,
  1987301, 2709388, 3394658, 3532557, 3763188, 1181519, 1587009, 1845534,
  2787341, 2811089, 3812944, 1065084, 1310522, 1468379, 1536619, 762080,
  851477, 884788, 935756, 973401,
].map(
  (id) =>
    `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop`,
);

export const JP_FASHION_IMAGES: JpImageAsset[] = [
  { id: "p:7671166", url: stock("p_7671166.jpg"), theme: "今日のコーデ", note: "街歩きのカジュアルコーデ" },
  { id: "gen:fashion:008", url: gen("gen_fashion_008.jpg"), theme: "今日のコーデ", note: "鏡越しのシンプルコーデ" },
  { id: "p:7671168", url: stock("p_7671168.jpg"), theme: "今日のコーデ", note: "休日のゆるコーデ" },
  { id: "p:7671186", url: stock("p_7671186.jpg"), theme: "今日のコーデ", note: "淡色寄りの普段着" },
  { id: "p:9856354", url: stock("p_9856354.jpg"), theme: "今日のコーデ", note: "シンプルなトップス合わせ" },
  { id: "gen:fashion:010", url: gen("gen_fashion_010.jpg"), theme: "今日のコーデ", note: "鏡越しのシンプルコーデ" },
  { id: "p:9856351", url: stock("p_9856351.jpg"), theme: "今日のコーデ", note: "通勤前の一枚" },
  { id: "p:9856357", url: stock("p_9856357.jpg"), theme: "今日のコーデ", note: "デニムの休日コーデ" },
  { id: "p:9856360", url: stock("p_9856360.jpg"), theme: "今日のコーデ", note: "上半身の記録" },
  { id: "p:1485031", url: stock("p_1485031.jpg"), theme: "今日のコーデ", note: "バッグを持った外出着" },
  { id: "p:1759622", url: stock("p_1759622.jpg"), theme: "きれいめカジュアル", note: "シャツ寄りの仕事着" },
  { id: "gen:fashion:016", url: gen("gen_fashion_016.jpg"), theme: "きれいめカジュアル", note: "シャツとスラックスの仕事寄り" },
  { id: "p:1852382", url: stock("p_1852382.jpg"), theme: "きれいめカジュアル", note: "ジャケットのきれいめ" },
  { id: "p:2129970", url: stock("p_2129970.jpg"), theme: "きれいめカジュアル", note: "パンツスタイル" },
  { id: "p:3768005", url: stock("p_3768005.jpg"), theme: "きれいめカジュアル", note: "オフィスカジュアル" },
  { id: "p:3965545", url: stock("p_3965545.jpg"), theme: "きれいめカジュアル", note: "仕事帰りの一枚" },
  { id: "gen:fashion:020", url: gen("gen_fashion_020.jpg"), theme: "きれいめカジュアル", note: "シャツとスラックスの仕事寄り" },
  { id: "p:4210866", url: stock("p_4210866.jpg"), theme: "韓国っぽコーデ", note: "オーバーサイズの休日" },
  { id: "p:4467687", url: stock("p_4467687.jpg"), theme: "韓国っぽコーデ", note: "ゆったりトップス" },
  { id: "p:5709661", url: stock("p_5709661.jpg"), theme: "韓国っぽコーデ", note: "カジュアルな外出着" },
  { id: "p:6311392", url: stock("p_6311392.jpg"), theme: "韓国っぽコーデ", note: "レイヤードの休日" },
  { id: "gen:fashion:024", url: gen("gen_fashion_024.jpg"), theme: "韓国っぽコーデ", note: "オーバーサイズの休日コーデ" },
  { id: "p:6311586", url: stock("p_6311586.jpg"), theme: "韓国っぽコーデ", note: "シンプルな休日服" },
  { id: "p:6567607", url: stock("p_6567607.jpg"), theme: "韓国っぽコーデ", note: "ニットの普段着" },
  { id: "p:7940621", url: stock("p_7940621.jpg"), theme: "ストリートスナップ", note: "街歩きのスナップ" },
  { id: "p:8532616", url: stock("p_8532616.jpg"), theme: "ストリートスナップ", note: "カジュアルな街着" },
  { id: "gen:fashion:028", url: gen("gen_fashion_028.jpg"), theme: "韓国っぽコーデ", note: "オーバーサイズの休日コーデ" },
  { id: "p:1055691", url: stock("p_1055691.jpg"), theme: "ストリートスナップ", note: "レイヤードの外出" },
  { id: "p:1375849", url: stock("p_1375849.jpg"), theme: "ストリートスナップ", note: "バッグと一緒の一枚" },
  { id: "p:1549200", url: stock("p_1549200.jpg"), theme: "ストリートスナップ", note: "散歩のときの服" },
  { id: "p:1898555", url: stock("p_1898555.jpg"), theme: "デート服", note: "柔らかめのワンピ寄り" },
  { id: "gen:fashion:032", url: gen("gen_fashion_032.jpg"), theme: "ストリートスナップ", note: "レイヤードの街歩きコーデ" },
  { id: "p:2010812", url: stock("p_2010812.jpg"), theme: "デート服", note: "きれいめの休日服" },
  { id: "p:2043590", url: stock("p_2043590.jpg"), theme: "デート服", note: "カフェに行く日の服" },
  { id: "p:2300334", url: stock("p_2300334.jpg"), theme: "デート服", note: "やわらかい色のコーデ" },
  { id: "p:2466756", url: stock("p_2466756.jpg"), theme: "デート服", note: "ワンピ寄りの外出着" },
  { id: "gen:fashion:036", url: gen("gen_fashion_036.jpg"), theme: "デート服", note: "柔らかめのワンピコーデ" },
  { id: "p:2492109", url: stock("p_2492109.jpg"), theme: "デート服", note: "休日のきれいめ" },
  { id: "p:2657208", url: stock("p_2657208.jpg"), theme: "今日のコーデ", note: "普通の普段着" },
  { id: "p:934070", url: stock("p_934070.jpg"), theme: "今日のコーデ", note: "部屋着に近い休日" },
  { id: "gen:fashion:041", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_041.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:042", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_042.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:043", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_043.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:044", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_044.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:045", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_045.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:046", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_046.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:047", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_047.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:048", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_048.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:049", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_049.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:050", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_050.jpg?v=gen1", theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
  { id: "gen:fashion:051", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_051.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:052", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_052.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:053", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_053.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:054", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_054.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:055", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_055.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:056", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_056.jpg?v=gen1", theme: "スニーカーコーデ", note: "白スニーカーの足元コーデ" },
  { id: "gen:fashion:057", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_057.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:058", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_058.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:059", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_059.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:060", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_060.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:061", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_061.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:062", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_062.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:063", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_063.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:064", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_064.jpg?v=gen1", theme: "腕時計コーデ", note: "シンプルな腕時計の手元" },
  { id: "gen:fashion:065", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_065.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:066", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_066.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:067", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_067.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:068", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_068.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:069", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_069.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:070", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_070.jpg?v=gen1", theme: "アクセサリー", note: "ネックレスとシンプル服" },
  { id: "gen:fashion:071", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_071.jpg?v=gen1", theme: "古着ミックス", note: "デニムとトップスの組み合わせ" },
  { id: "gen:fashion:072", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_072.jpg?v=gen1", theme: "古着ミックス", note: "デニムとトップスの組み合わせ" },
  { id: "gen:fashion:073", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_073.jpg?v=gen1", theme: "古着ミックス", note: "デニムとトップスの組み合わせ" },
  { id: "gen:fashion:074", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_074.jpg?v=gen1", theme: "古着ミックス", note: "デニムとトップスの組み合わせ" },
  { id: "gen:fashion:075", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_fashion_075.jpg?v=gen1", theme: "古着ミックス", note: "デニムとトップスの組み合わせ" },
];

export const JP_BEAUTY_IMAGES: JpImageAsset[] = [
  { id: "u:1522335789203-aabd1fc54bc9", url: stock("u_1522335789203-aabd1fc54bc9.jpg"), theme: "今日のメイク", note: "ナチュラルメイクの記録" },
  { id: "u:1616394584738-fc6e612e71b9", url: stock("u_1616394584738-fc6e612e71b9.jpg"), theme: "今日のメイク", note: "薄いメイクの日" },
  { id: "u:1522337660859-02fbefca4702", url: stock("u_1522337660859-02fbefca4702.jpg"), theme: "リップ", note: "今日のリップ色" },
  { id: "u:1487412720507-e7ab37603c6f", url: stock("u_1487412720507-e7ab37603c6f.jpg"), theme: "今日のメイク", note: "アイメイク控えめで" },
  { id: "p:3738349", url: stock("p_3738349.jpg"), theme: "リップ", note: "リップの色見本" },
  { id: "p:3785147", url: stock("p_3785147.jpg"), theme: "今日のメイク", note: "朝のメイク記録" },
  { id: "p:3993449", url: stock("p_3993449.jpg"), theme: "リップ", note: "今日のリップ色" },
  { id: "p:4041392", url: stock("p_4041392.jpg"), theme: "今日のメイク", note: "ナチュラルメイクの記録" },
  { id: "p:5122188", url: stock("p_5122188.jpg"), theme: "今日のメイク", note: "仕事の日の薄めメイク" },
  { id: "p:6663469", url: stock("p_6663469.jpg"), theme: "リップ", note: "グロス寄りの口元" },
  { id: "p:7242770", url: stock("p_7242770.jpg"), theme: "今日のメイク", note: "血色感だけ足した日" },
  { id: "p:1844012", url: stock("p_1844012.jpg"), theme: "今日のメイク", note: "休日の薄いメイク" },
  { id: "gen:beauty:088", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_088.jpg?v=gen1", theme: "スキンケア", note: "朝のスキンケアシーン" },
  { id: "gen:beauty:089", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_089.jpg?v=gen1", theme: "スキンケア", note: "朝のスキンケアシーン" },
  { id: "gen:beauty:090", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_090.jpg?v=gen1", theme: "スキンケア", note: "朝のスキンケアシーン" },
  { id: "gen:beauty:091", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_091.jpg?v=gen1", theme: "スキンケア", note: "朝のスキンケアシーン" },
  { id: "gen:beauty:092", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_092.jpg?v=gen1", theme: "ポーチの中身", note: "コスメポーチの中身" },
  { id: "gen:beauty:093", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_093.jpg?v=gen1", theme: "ポーチの中身", note: "コスメポーチの中身" },
  { id: "gen:beauty:094", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_094.jpg?v=gen1", theme: "ポーチの中身", note: "コスメポーチの中身" },
  { id: "gen:beauty:095", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_095.jpg?v=gen1", theme: "ポーチの中身", note: "コスメポーチの中身" },
  { id: "gen:beauty:096", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_096.jpg?v=gen1", theme: "ネイル", note: "短めネイルの色" },
  { id: "gen:beauty:097", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_097.jpg?v=gen1", theme: "ネイル", note: "短めネイルの色" },
  { id: "gen:beauty:098", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_098.jpg?v=gen1", theme: "ネイル", note: "短めネイルの色" },
  { id: "gen:beauty:099", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_099.jpg?v=gen1", theme: "チーク", note: "血色感のあるチーク" },
  { id: "gen:beauty:100", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_100.jpg?v=gen1", theme: "チーク", note: "血色感のあるチーク" },
  { id: "gen:beauty:101", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_beauty_101.jpg?v=gen1", theme: "チーク", note: "血色感のあるチーク" },
];

export const JP_FOOD_IMAGES: JpImageAsset[] = [
  { id: "gen:food:102", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_102.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:103", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_103.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:104", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_104.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:105", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_105.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:106", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_106.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:107", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_107.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:108", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_108.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:109", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_109.jpg?v=gen1", theme: "カフェ", note: "窓際のカフェ時間" },
  { id: "gen:food:110", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_110.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:111", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_111.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:112", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_112.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:113", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_113.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:114", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_114.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:115", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_115.jpg?v=gen1", theme: "スイーツ", note: "カフェのスイーツ" },
  { id: "gen:food:116", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_116.jpg?v=gen1", theme: "抹茶", note: "抹茶ラテ" },
  { id: "gen:food:117", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_117.jpg?v=gen1", theme: "抹茶", note: "抹茶ラテ" },
  { id: "gen:food:118", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_118.jpg?v=gen1", theme: "抹茶", note: "抹茶ラテ" },
  { id: "gen:food:119", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_food_119.jpg?v=gen1", theme: "抹茶", note: "抹茶ラテ" },
];

export const JP_LIFESTYLE_IMAGES: JpImageAsset[] = [
  { id: "gen:lifestyle:120", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_120.jpg?v=gen1", theme: "購入品", note: "今日の購入品メモ" },
  { id: "gen:lifestyle:121", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_121.jpg?v=gen1", theme: "購入品", note: "今日の購入品メモ" },
  { id: "gen:lifestyle:122", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_122.jpg?v=gen1", theme: "購入品", note: "今日の購入品メモ" },
  { id: "gen:lifestyle:123", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_123.jpg?v=gen1", theme: "購入品", note: "今日の購入品メモ" },
  { id: "gen:lifestyle:124", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_124.jpg?v=gen1", theme: "購入品", note: "今日の購入品メモ" },
  { id: "gen:lifestyle:125", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_125.jpg?v=gen1", theme: "バッグの中身", note: "ポーチと小物の整理" },
  { id: "gen:lifestyle:126", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_126.jpg?v=gen1", theme: "バッグの中身", note: "ポーチと小物の整理" },
  { id: "gen:lifestyle:127", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_127.jpg?v=gen1", theme: "バッグの中身", note: "ポーチと小物の整理" },
  { id: "gen:lifestyle:128", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_128.jpg?v=gen1", theme: "バッグの中身", note: "ポーチと小物の整理" },
  { id: "gen:lifestyle:129", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_129.jpg?v=gen1", theme: "バッグの中身", note: "ポーチと小物の整理" },
  { id: "gen:lifestyle:130", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_130.jpg?v=gen1", theme: "休日", note: "のんびりした午後" },
  { id: "gen:lifestyle:131", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_131.jpg?v=gen1", theme: "休日", note: "のんびりした午後" },
  { id: "gen:lifestyle:132", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_132.jpg?v=gen1", theme: "休日", note: "のんびりした午後" },
  { id: "gen:lifestyle:133", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_lifestyle_133.jpg?v=gen1", theme: "休日", note: "のんびりした午後" },
];

export const JP_HOME_IMAGES: JpImageAsset[] = [
  { id: "gen:home:134", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_134.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:135", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_135.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:136", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_136.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:137", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_137.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:138", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_138.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:139", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_139.jpg?v=gen1", theme: "部屋", note: "朝のデスク周り" },
  { id: "gen:home:140", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_140.jpg?v=gen1", theme: "雑貨", note: "小さなインテリア更新" },
  { id: "gen:home:141", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_141.jpg?v=gen1", theme: "雑貨", note: "小さなインテリア更新" },
  { id: "gen:home:142", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_142.jpg?v=gen1", theme: "雑貨", note: "小さなインテリア更新" },
  { id: "gen:home:143", url: "https://lfftfzghfjdwyyfzijte.supabase.co/storage/v1/object/public/media/demo-jp-img/gen_home_143.jpg?v=gen1", theme: "雑貨", note: "小さなインテリア更新" },
];

/** Travel/tech/other intentionally empty — not used in fashion-first demo feed. */
export const JP_TRAVEL_IMAGES: JpImageAsset[] = [];
export const JP_TECH_IMAGES: JpImageAsset[] = [];
export const JP_OTHER_IMAGES: JpImageAsset[] = [];

export const JP_IMAGES_BY_CATEGORY = {
  fashion: JP_FASHION_IMAGES,
  beauty: JP_BEAUTY_IMAGES,
  food: JP_FOOD_IMAGES,
  lifestyle: JP_LIFESTYLE_IMAGES,
  travel: JP_TRAVEL_IMAGES,
  tech: JP_TECH_IMAGES,
  home: JP_HOME_IMAGES,
  other: JP_OTHER_IMAGES,
} as const;

export function assertJpImageUniqueness() {
  const seen = new Set<string>();
  for (const list of Object.values(JP_IMAGES_BY_CATEGORY)) {
    for (const asset of list) {
      if (seen.has(asset.url)) {
        throw new Error(`Duplicate JP image URL in catalog: ${asset.url}`);
      }
      seen.add(asset.url);
    }
  }
}
