/**
 * Build unique JP image catalog: validate candidates, write lib/seed-jp-images.ts
 * Run: npx tsx scripts/build-jp-image-catalog.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Cat =
  | "fashion"
  | "beauty"
  | "food"
  | "lifestyle"
  | "travel"
  | "tech"
  | "home"
  | "other";

type Asset = { id: string; theme: string; note: string; place?: string };

/** Existing JP pool IDs (keep — do not drop). */
const EXISTING: Record<Cat, string[]> = {
  fashion: [
    "1521572163474-6864f9cf17ab", "1489987707025-afc232f7ea0f", "1490481651871-ab68de25d43d",
    "1515886657613-9f3515b0c78f", "1525507119028-ed4c629a60a3", "1469334031218-e382a71b716b",
    "1487222477890-8d468c566260", "1519741497674-611481863552", "1434389677669-e08b4cac3107",
    "1475180098004-ca77a66827be", "1483985988106-5a444bfd0855", "1495121605193-b116b5b9c5fe",
    "1503342217505-b0a15ec3261c", "1512436991641-6745cdb1723f", "1551488831-00a57f5a6b32",
    "1562157873-818bc0726f68", "1576566588028-4147f3842f27", "1583292650898-7d22cd27ca6f",
    "1594633312681-425c7b97ccd1", "1603252109360-909baaf261fd", "1520975954732-35ac2460fc65",
    "1509631175647-303152414ceb", "1515378791036-0648a3ef77b2", "1541099649032-18d8914e8a0c",
    "1516826957135-700dedea998c", "1532453288672-3a27e9be9ed6", "1560243563-062bfc001d68",
    "1549298916-b547d66f3a4a", "1542291026-7eec264c27ff", "1571008887538-b36bb32f4571",
  ],
  beauty: [
    "1556228720-195a672e8a03", "1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348",
    "1611930022073-b7a4ba5fcccd", "1571781926291-c477ebfd024b", "1512496015851-a90fb479ba36",
    "1515688594390-b649df4936b7", "1522337660859-02fbefca4702", "1586495777744-4413f21062fa",
    "1598440947619-2c35fc72c884", "1608248543803-ba4f8c27ae75", "1616394584738-fc6e612e71b9",
    "1515377905703-c4788e51af15", "1487412947146-5bad2030bbda", "1492106087820-71f1a00d2b11",
    "1535632066927-ab7c9ab60908", "1563170351-be82bc888aa4", "1570172619644-dfd03ed5d881",
    "1604654894610-df63bc536371", "1616683693504-3ea7e9ba6ced", "1487412720507-e7ab37603c6f",
  ],
  food: [
    "1495474472287-4d71bcdd2085", "1504674900247-0877df9cc836", "1512621776951-a57141f2eefd",
    "1476224203421-9ac39bcb3327", "1467003909585-2f8a72700288", "1497534447292-69de707efe17",
    "1509042239860-f550ce710b93", "1551024506-0bccd828d307", "1563805042-7684c019e1cb",
    "1541167760496-1628856ab772", "1565299624946-b28f40a0ae38", "1578985545062-69928b1d9587",
    "1499636134819-e0eb8aa2b809", "1506086679734-ee8bf6a6d1ad",
  ],
  lifestyle: [
    "1485955900006-10f4d324d411", "1441986300917-64674bd600d8", "1500530855697-b586d89ba3ee",
    "1478146896981-b80fe463b330", "1505691938895-1758d7feb511", "1493663284031-b7e3aefcae8e",
    "1555041469-a586c61ea9bc", "1586023492125-27b2c045efd7", "1434030216411-0b793f4b4173",
    "1484480974691-166ee2e27e3b",
  ],
  travel: [
    "1469854523086-cc02fe5d8800", "1507525428034-b723cf961d3e", "1476514525535-07fb3b4ae5f1",
    "1488646953014-85cb44e25828", "1500534314209-a25ddb2bd429",
  ],
  tech: [
    "1517336714731-489689fd1ca8", "1498050108023-c5249f4df085", "1518770660439-4636190af475",
    "1587825140708-dfaf72ae4b04",
  ],
  home: [],
  other: [
    "1453928582365-b6ad33cbcf64", "1513364776144-60967b0f800f", "1523275335684-37898b6baf30",
  ],
};

/** Extra Unsplash IDs to expand pools (validated via HEAD). */
const EXTRA: Record<Cat, string[]> = {
  fashion: [
    "1558171813-4b0360e71ca8", "1496747611176-843222e1e57c", "1467043152298-d0f0a0d0f0e0",
    "1445205170230-053b83016050", "1469334031218-e382a71b716b", "1558769132-cb1aea458c5e",
    "1490481651871-ab68de25d43d", "1515886657613-9f3515b0c78f", "1509631175647-303152414ceb",
    "1551488831-00a57f5a6b32", "1576566588028-4147f3842f27", "1562157873-818bc0726f68",
    "1541099649032-18d8914e8a0c", "1539109136881-3be0616acf4b", "1544441893-675973e31985",
    "1552374196-1ab2a1c593e8", "1503342217505-b0a15ec3261c", "1525507119028-ed4c629a60a3",
    "1487222477890-8d468c566260", "1519741497674-611481863552", "1475180098004-ca77a66827be",
    "1483985988106-5a444bfd0855", "1495121605193-b116b5b9c5fe", "1512436991641-6745cdb1723f",
    "1583292650898-7d22cd27ca6f", "1594633312681-425c7b97ccd1", "1603252109360-909baaf261fd",
    "1520975954732-35ac2460fc65", "1515378791036-0648a3ef77b2", "1516826957135-700dedea998c",
    "1532453288672-3a27e9be9ed6", "1560243563-062bfc001d68", "1549298916-b547d66f3a4a",
    "1542291026-7eec264c27ff", "1571008887538-b36bb32f4571", "1434389677669-e08b4cac3107",
    "1521572163474-6864f9cf17ab", "1489987707025-afc232f7ea0f", "1469334031218-e382a71b716b",
    "1554562189-9d4d0d0d0d0d",
    // more fashion / street style
    "1469334031218-e382a71b716b", "1506629082955-511b1aa78063", "1529139576474-2e3e0e0e0e0e",
    "1515886657613-9f3515b0c78f", "1492707892039-ec8cab1e0e0e",
    "1558769132-cb1aea458c5e", "1529139576474-2e3fc9c0ef91", "1506629082955-511b1aa78063",
    "1490481651871-ab68de25d43d", "1544441893-675973e31985", "1539109136881-3be0616acf4b",
    "1552374196-1ab2a1c593e8", "1467043152298-ce4c8c0c0c0c",
    "1496747611176-843222e1e57c", "1445205170230-053b83016050", "1558171813-4b0360e71ca8",
    "1566207384-4b0e0e0e0e0e", "1576566588028-4147f3842f27",
    "1585487000160-6eb4f25d0e0e", "1594633313593-bab3825d0e0e",
    "1603252109301-0e0e0e0e0e0e", "1617127365659-c47b064ab0e0",
    "1469334031218-e382a71b716b",
  ],
  beauty: [
    "1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348", "1611930022073-b7a4ba5fcccd",
    "1571781926291-c477ebfd024b", "1512496015851-a90fb479ba36", "1522337660859-02fbefca4702",
    "1586495777744-4413f21062fa", "1598440947619-2c35fc72c884", "1608248543803-ba4f8c27ae75",
    "1616394584738-fc6e612e71b9", "1487412947146-5bad2030bbda", "1492106087820-71f1a00d2b11",
    "1535632066927-ab7c9ab60908", "1563170351-be82bc888aa4", "1570172619644-dfd03ed5d881",
    "1616683693504-3ea7e9ba6ced", "1515688594390-b649df4936b7", "1515377905703-c4788e51af15",
    "1556228578-8c89e6adf883", "1571875257727-256c39da42af", "1596755094514-f87e34085b2c",
    "1620916568808-9f0e0e0e0e0e", "1631217868270-0e0e0e0e0e0e",
    "1526045478516-96981070924f", "1512496015851-a90fb479ba36", "1612810286770-0e0e0e0e0e0e",
  ],
  food: [
    "1414235077428-338989a2e8c0", "1504754524776-8f4f37790ca0", "1493770348161-369560ae357d",
    "1473093295043-cdd812d0e601", "1517248135467-4c7edcad34c4", "1559339352-11d035aa65de",
    "1567620907592-17fc6fe0d8e0", "1572442388796-11668a67e53d", "1546069901-ba9599a7e63c",
    "1555939594-58d7cb561ad1", "1565958011703-44f9829ba187", "1574071318508-1cdbab80d002",
    "1608039829572-78524f79c4c0", "1625944232030-0e0e0e0e0e0e", "1635324128000-0e0e0e0e0e0e",
    "1551218808-94e220e084d2", "1467003909585-2f8a72700288", "1497534447292-69de707efe17",
    "1509042239860-f550ce710b93", "1551024506-0bccd828d307", "1563805042-7684c019e1cb",
    "1541167760496-1628856ab772", "1565299624946-b28f40a0ae38", "1578985545062-69928b1d9587",
    "1499636134819-e0eb8aa2b809", "1506086679734-ee8bf6a6d1ad", "1512621776951-a57141f2eefd",
    "1476224203421-9ac39bcb3327", "1495474472287-4d71bcdd2085", "1504674900247-0877df9cc836",
  ],
  lifestyle: [
    "1494438639946-1ebd1d20bf85", "1507003211169-0a1dd7228f2d", "1511988617509-a57c8a288659",
    "1522771739844-6a9f6d5f14af", "1533090161767-e6ffed986c88", "1556912173-3ba5acb4e0e0",
    "1560184897-ae74f7fe0e0e", "1574629810360-7efbbe195018", "1583847268964-b28f40a0ae38",
    "1598301257982-0e0e0e0e0e0e", "1600585154340-0e0e0e0e0e0e", "1600210492486-0e0e0e0e0e0e",
    "1485955900006-10f4d324d411", "1441986300917-64674bd600d8", "1500530855697-b586d89ba3ee",
    "1478146896981-b80fe463b330", "1493663284031-b7e3aefcae8e", "1434030216411-0b793f4b4173",
    "1484480974691-166ee2e27e3b", "1524758634661-95ff9e4e0e0e", "1540518614846-0e0e0e0e0e0e",
  ],
  travel: [
    "1493976040374-85c8e12f0c0e", "1528164344705-0e0e0e0e0e0e", "1536095860-0e0e0e0e0e0e",
    "1540959733332-eab4deabeeaf", "1493976040374-85c8e12f0c0e", "1524413840807-0e0e0e0e0e0e",
    "1540959733332-eab4deabeeaf", "1503899036084-c66799e21eec", "1524413840807-0f74f18d0e0e",
    "1545569341-9eb8b30979d9", "1493976040374-85c8e12f0c0e", "1528164344705-0e0e0e0e0e0e",
    "1469854523086-cc02fe5d8800", "1507525428034-b723cf961d3e", "1476514525535-07fb3b4ae5f1",
    "1488646953014-85cb44e25828", "1500534314209-a25ddb2bd429", "1528164344705-ebaabe0e0e0e",
    "1545569341-9eb8b30979d9", "1503899036084-c66799e21eec", "1524413840807-0f74f18d4251",
    "1493976040374-85c8e12f0c0e", "1536095860-0e0e0e0e0e0e", "1557409519-0e0e0e0e0e0e",
    "1564507592333-c60657eea0e0", "1570077990-0e0e0e0e0e0e", "1583417319070-0e0e0e0e0e0e",
  ],
  tech: [
    "1519389950473-47ba0277781c", "1525547719571-a2d4ac8945e2", "1531297484001-80022131f5a1",
    "1550009158-0e0e0e0e0e0e", "1555617981-0e0e0e0e0e0e", "1563986768609-0e0e0e0e0e0e",
    "1573164713714-0e0e0e0e0e0e", "1581091226825-0e0e0e0e0e0e", "1593640408182-0e0e0e0e0e0e",
    "1517336714731-489689fd1ca8", "1498050108023-c5249f4df085", "1518770660439-4636190af475",
    "1587825140708-dfaf72ae4b04", "1525547719571-a2d4ac8945e2", "1531297484001-80022131f5a1",
    "1519389950473-47ba0277781c", "1550745165-9bc0b252726f", "1561154464-0e0e0e0e0e0e",
  ],
  home: [
    "1586023492125-27b2c045efd7", "1555041469-a586c61ea9bc", "1493663284031-b7e3aefcae8e",
    "1505691938895-1758d7feb511", "1524758634661-95ff9e4e0e0e", "1532372320572-0e0e0e0e0e0e",
    "1556912173-46c336b7bfd4", "1560185127-6ed189bf02f4", "1574629810360-7efbbe195018",
    "1583847268964-b28f40a0ae38", "1595526114035-0e0e0e0e0e0e", "1600210492493-0e0e0e0e0e0e",
    "1600585154526-0e0e0e0e0e0e", "1600607687939-0e0e0e0e0e0e", "1615874959470-0e0e0e0e0e0e",
  ],
  other: [
    "1453928582365-b6ad33cbcf64", "1513364776144-60967b0f800f", "1523275335684-37898b6baf30",
    "1481349518771-0e0e0e0e0e0e", "1494438639946-1ebd1d20bf85", "1505740420928-0e0e0e0e0e0e",
    "1511988617509-a57c8a288659", "1522771739844-6a9f6d5f14af", "1533090161767-e6ffed986c88",
    "1542291026-7eec264c27ff", "1556911220-0e0e0e0e0e0e", "1560184897-ae74f7fe0e0e",
  ],
};

/** Pexels photo IDs — Japan / city / food / fashion / lifestyle friendly. */
const PEXELS: Record<Cat, number[]> = {
  fashion: [
    7671166, 9558761, 9558575, 9558601, 9558787, 7671168, 7671169, 9856354,
    1040945, 1926769, 298863, 934070, 1126993, 1462637, 1485031, 1759622,
    1852382, 2065200, 2129970, 2529148, 2690323, 2827400, 2917628, 3094857,
    3363728, 3596703, 3755706, 3768005, 3965545, 4210866, 4467687, 5119214,
    5709661, 6311392, 6311477, 6311586, 6311653, 6567607, 6626903, 6764007,
    6764040, 6764053, 7671186, 7940621, 8532616, 9558571, 9558585, 9558593,
    9558607, 9558619, 9558630, 9558642, 9558654, 9558665, 9558677, 9558689,
    9558701, 9558713, 9558725, 9558737, 9558749, 9558763, 9558775, 9558786,
    9558798, 9558810, 9856351, 9856357, 9856360, 1007018, 1036623, 1043474,
    1055691, 1183266, 1307677, 1375849, 1462636, 1549200, 1689731, 1721558,
    1844012, 1898555, 2010812, 2043590, 2300334, 2349576, 2466756, 2492109,
    2657208, 2776353, 2887766, 3014856, 3128245, 3206167, 3311574, 3437204,
  ],
  beauty: [
    3373736, 3373745, 3373747, 3373750, 3373752, 3738347, 3738349, 3738351,
    3738353, 3738355, 3785147, 3785149, 3785151, 3785153, 3785155, 3993449,
    3993451, 3993453, 3993455, 3993457, 4041392, 4041394, 4041396, 4041398,
    4041400, 415829, 4158290, 4158291, 4158292, 4158293, 457701, 4577010,
    4577011, 4577012, 4577013, 5122188, 5122190, 5122192, 5122194, 5122196,
    5939401, 5939403, 5939405, 5939407, 5939409, 6663469, 6663471, 6663473,
    6663475, 6663477, 7242770, 7242772, 7242774, 7242776, 7242778, 8128069,
    8128071, 8128073, 8128075, 8128077, 3373740, 3373742, 3738340, 3738342,
    3785140, 3785142, 3993440, 3993442, 4041380, 4041382, 5122170, 5122172,
    5939390, 5939392, 6663450, 6663452, 7242750, 7242752, 8128050, 8128052,
  ],
  food: [
    376464, 461198, 70497, 1639562, 1633578, 1640777, 1099680, 1279330,
    1640772, 1640774, 1640770, 1660030, 1833349, 2097090, 2147491, 2290070,
    2313682, 2347311, 2474658, 2641886, 2696064, 2871757, 2983101, 3026808,
    3184183, 3184192, 3338681, 3535384, 3535385, 3752188, 3758891, 3763800,
    3822967, 3872373, 4198026, 4252137, 4393021, 4551832, 4551971, 4871111,
    5409009, 5409010, 5409011, 5409015, 5409017, 5560760, 5560763, 566566,
    5778898, 5778899, 5778900, 5908226, 6287295, 6287296, 6287298, 6287300,
    6419736, 6419738, 6419740, 6605214, 6605216, 6605218, 7422160, 7422161,
    8471703, 8471705, 8471707, 896923, 958545, 1055272, 1123250, 1199957,
    1234535, 1351238, 1437267, 1527605, 1624487, 1703272, 1731535, 1851164,
  ],
  lifestyle: [
    1571460, 1571463, 1571468, 1648776, 1866149, 2082087, 2082090, 2082092,
    245208, 271816, 276583, 276724, 279618, 279746, 280222, 280229,
    1090638, 1090641, 1090642, 1125130, 1125135, 1125137, 1350789, 1457842,
    1571459, 1643383, 1669799, 1886169, 2029667, 2029722, 2062431, 2079249,
    2082095, 2102587, 2121121, 2251247, 2343468, 2422267, 2499060, 259588,
    271743, 2724749, 276554, 279640, 280216, 2826787, 2883047, 2893177,
    3097112, 3201760, 3201761, 3201763, 3201765, 3201767, 37347, 37348,
    37349, 37350, 37351, 3990359, 3990360, 3990361, 4050318, 4050319,
    4050320, 4050321, 4050322, 4112236, 4112237, 4112238, 4112239, 4112240,
    4352247, 4352248, 4352249, 4352250, 4352251, 4846097, 4846098, 4846099,
  ],
  travel: [
    2506923, 161251, 402028, 3408354, 2187605, 2193300, 2372117, 2614818,
    2901209, 3016141, 3016142, 3016143, 3016144, 3016145, 3408353, 3408355,
    3408356, 3408357, 3408358, 3573382, 3573383, 3573384, 3573385, 3573386,
    3779816, 3779817, 3779818, 3779819, 3779820, 4050314, 4050315, 4050316,
    4050317, 460376, 460377, 460378, 460379, 460380, 5077047, 5077048,
    5077049, 5077050, 5077051, 5169056, 5169057, 5169058, 5169059, 5169060,
    5530880, 5530881, 5530882, 5530883, 5530884, 5746250, 5746251, 5746252,
    5746253, 5746254, 6021381, 6021382, 6021383, 6021384, 6021385, 6419727,
    6419728, 6419729, 6419730, 6419731, 7073471, 7073472, 7073473, 7073474,
    7073475, 7242078, 7242079, 7242080, 7242081, 7242082, 2506923, 161251,
  ],
  tech: [
    356056, 373543, 546819, 788946, 1029757, 1038628, 1229861, 1334597,
    1440727, 1476321, 163100, 1714208, 1841841, 2047905, 2115257, 2582937,
    265087, 267394, 325153, 374074, 3861969, 3861972, 4050290, 4050291,
    4050292, 4050293, 4050294, 4144179, 4144180, 4144181, 4144182, 4144183,
    4491461, 4491462, 4491463, 4491464, 4491465, 5082579, 5082580, 5082581,
    1181244, 1181263, 1181271, 1181298, 1181354, 1181467, 1181675, 1181686,
    1181243, 1181292, 1181316, 1181355, 1181371, 1181468, 1181472, 1181676,
  ],
  home: [
    // Distinct from lifestyle list to avoid global key collisions
    6480707, 6480708, 6480709, 6480710, 6480711, 6585763, 6585764, 6585765,
    6585766, 6585767, 6758772, 6758773, 6758774, 6758775, 6758776, 6758777,
    6969831, 6969832, 6969833, 6969834, 6969835, 6969836, 6969837, 6969838,
    7031413, 7031414, 7031415, 7031416, 7031417, 7031418, 7031419, 7031420,
    7188330, 7188331, 7188332, 7188333, 7188334, 7188335, 7188336, 7188337,
    7319307, 7319308, 7319309, 7319310, 7319311, 7319312, 7319313, 7319314,
    7512043, 7512044, 7512045, 7512046, 7512047, 7512048, 7512049, 7512050,
    8134848, 8134849, 8134850, 8134851, 8134852, 8134853, 8134854, 8134855,
  ],
  other: [
    1005638, 102127, 1029604, 1037995, 1051073, 1092644, 1127580, 1166644,
    1191710, 1226398, 1252890, 1323712, 1416940, 1440722, 1473197, 1493612,
    1509428, 1526048, 1547932, 1579708, 159711, 160107, 160954, 161640,
    1629236, 1647962, 1666021, 1684187, 1694900, 1707820, 1722268, 1735014,
    1742370, 1757338, 1761279, 1779487, 1809342, 18105, 1829360, 1838560,
    1848565, 1851164, 186461, 1878293, 1883386, 189349, 190819, 1916820,
    192725, 1930037, 194094, 1957477, 196645, 1976149, 1983038, 1991371,
  ],
};

const THEMES: Record<Cat, { theme: string; note: string; place?: string }[]> = {
  fashion: [
    { theme: "今日のコーデ", note: "淡色ニットとデニムの通学コーデ" },
    { theme: "ストリートスナップ", note: "街角で撮ったレイヤードスタイル" },
    { theme: "きれいめカジュアル", note: "シャツとスラックスのオフィス寄り" },
    { theme: "韓国っぽコーデ", note: "オーバーサイズとショート丈の組み合わせ" },
    { theme: "古着ミックス", note: "ヴィンテージデニムに新作トップス" },
    { theme: "デート服", note: "柔らかめのスカートとミュール" },
    { theme: "スニーカーコーデ", note: "白スニーカーで足元を軽く" },
    { theme: "バッグコーデ", note: "小さめショルダーが主役の一枚" },
  ],
  beauty: [
    { theme: "ナチュラルメイク", note: "ベース薄め、リップだけ色味" },
    { theme: "コスメ購入品", note: "ドラッグストアで見つけた新色" },
    { theme: "スキンケア", note: "朝の化粧水と乳液のセット" },
    { theme: "リップ特集", note: "血色よく見えるコーラル" },
    { theme: "韓国コスメ", note: "クッションファンデの仕上がり" },
    { theme: "ネイル", note: "短めネイルのラメグラデ" },
    { theme: "アイメイク", note: "涙袋とブラウンシャドウ" },
    { theme: "ポーチの中身", note: "持ち歩きミニコスメだけ厳選" },
  ],
  food: [
    { theme: "カフェ", note: "ラテアートと窓際の席", place: "中目黒" },
    { theme: "スイーツ", note: "季節のショートケーキ断面", place: "表参道" },
    { theme: "ランチ", note: "定食より少し贅沢なワンプレート", place: "下北沢" },
    { theme: "抹茶", note: "抹茶ラテとわらび餅", place: "京都風カフェ" },
    { theme: "韓国フード", note: "チーズタッカルビのとろけ感", place: "新大久保" },
    { theme: "コンビニスイーツ", note: "夜に食べたいプリン", place: "近所のコンビニ" },
    { theme: "ラーメン", note: "湯気の立つ一杯", place: "渋谷" },
    { theme: "パン", note: "焼きたてメロンパン", place: "吉祥寺" },
  ],
  lifestyle: [
    { theme: "部屋", note: "朝日が入るデスク周り" },
    { theme: "休日", note: "のんびりした午後のソファ時間" },
    { theme: "購入品", note: "今月のちょっと良い買い物" },
    { theme: "バッグの中身", note: "必要最低限のポーチ整理" },
    { theme: "推し活", note: "推し色で揃えた小物たち" },
    { theme: "大学生活", note: "講義前のノートとコーヒー" },
    { theme: "朝支度", note: "出かける前の身支度スペース" },
    { theme: "読書", note: "週末の文庫本タイム" },
  ],
  travel: [
    { theme: "東京観光", note: "交差点のにぎわいとネオン", place: "渋谷" },
    { theme: "週末トリップ", note: "駅前からの街並み", place: "鎌倉" },
    { theme: "神社巡り", note: "参道の木漏れ日", place: "明治神宮" },
    { theme: "夜景", note: "ビルの明かりが続く夜", place: "東京駅周辺" },
    { theme: "海沿い", note: "晴れた日の海岸線", place: "湘南" },
    { theme: "温泉街", note: "湯けむりと木造の街並み", place: "箱根" },
    { theme: "紅葉", note: "秋の公園の色づき", place: "京都" },
    { theme: "桜", note: "春の並木道", place: "上野" },
  ],
  tech: [
    { theme: "ガジェット", note: "デスクに並ぶ新しいデバイス" },
    { theme: "イヤホン", note: "通勤用のワイヤレス" },
    { theme: "スマホまわり", note: "ケースと充電器のセット" },
    { theme: "ノートPC", note: "カフェ作業用の薄いマシン" },
    { theme: "キーボード", note: "打鍵感が良い配列" },
    { theme: "スマートウォッチ", note: "通知を静かに確認" },
  ],
  home: [
    { theme: "部屋づくり", note: "余白を残したリビング" },
    { theme: "デスク周り", note: "勉強しやすい高さの机" },
    { theme: "収納", note: "引き出しの中を見直した" },
    { theme: "照明", note: "間接照明で落ち着いた夜" },
    { theme: "観葉植物", note: "窓辺のグリーン" },
    { theme: "寝具", note: "シーツを替えたばかりのベッド" },
  ],
  other: [
    { theme: "今日のひとコマ", note: "ふと目に入った景色" },
    { theme: "気になったもの", note: "店頭で手が止まったアイテム" },
    { theme: "雑貨", note: "小さくて使いやすい日用品" },
    { theme: "文房具", note: "新しいノートとペン" },
  ],
};

const NEED: Record<Cat, number> = {
  fashion: 95,
  beauty: 85,
  food: 85,
  lifestyle: 90,
  travel: 65,
  tech: 45,
  home: 50,
  other: 40,
};

function unsplashUrl(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
}

function pexelsUrl(id: number) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return true;
    const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

function metaFor(cat: Cat, i: number) {
  const pool = THEMES[cat];
  return pool[i % pool.length]!;
}

async function validateBatch(urls: string[], concurrency = 20) {
  const ok = new Set<string>();
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx]!;
      if (await headOk(url)) ok.add(url);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return ok;
}

async function main() {
  const globalUsed = new Set<string>();
  const byCat: Record<Cat, Asset[]> = {
    fashion: [],
    beauty: [],
    food: [],
    lifestyle: [],
    travel: [],
    tech: [],
    home: [],
    other: [],
  };

  const candidates: Array<{ cat: Cat; key: string; url: string }> = [];

  for (const cat of Object.keys(NEED) as Cat[]) {
    for (const id of [...EXISTING[cat], ...EXTRA[cat]]) {
      if (!id || id.includes("0e0e0e0e") || id.includes("d0d0d0d0") || id.includes("c0c0c0c0")) continue;
      const key = `u:${id}`;
      candidates.push({ cat, key, url: unsplashUrl(id) });
    }
    for (const id of PEXELS[cat]) {
      const key = `p:${id}`;
      candidates.push({ cat, key, url: pexelsUrl(id) });
    }
  }

  // de-dupe by key globally while preserving first category assignment preference
  const seenKey = new Set<string>();
  const uniqueCandidates = candidates.filter((c) => {
    if (seenKey.has(c.key)) return false;
    seenKey.add(c.key);
    return true;
  });

  console.log(`candidates: ${uniqueCandidates.length}`);
  const okUrls = await validateBatch(uniqueCandidates.map((c) => c.url));
  console.log(`reachable: ${okUrls.size}`);

  for (const c of uniqueCandidates) {
    if (!okUrls.has(c.url)) continue;
    if (globalUsed.has(c.key)) continue;
    if (byCat[c.cat].length >= NEED[c.cat]) continue;
    globalUsed.add(c.key);
    const m = metaFor(c.cat, byCat[c.cat].length);
    byCat[c.cat].push({
      id: c.key,
      theme: m.theme,
      note: m.note,
      place: m.place,
      // store url in note? better add url field
    } as Asset & { url?: string });
    (byCat[c.cat][byCat[c.cat].length - 1] as Asset & { url: string }).url = c.url;
  }

  // fill short categories from leftover ok candidates of any cat
  const leftovers = uniqueCandidates.filter(
    (c) => okUrls.has(c.url) && !globalUsed.has(c.key),
  );
  for (const cat of Object.keys(NEED) as Cat[]) {
    while (byCat[cat].length < NEED[cat] && leftovers.length > 0) {
      const c = leftovers.shift()!;
      if (globalUsed.has(c.key)) continue;
      globalUsed.add(c.key);
      const m = metaFor(cat, byCat[cat].length);
      byCat[cat].push({
        id: c.key,
        theme: m.theme,
        note: m.note,
        place: m.place,
      } as Asset & { url: string });
      (byCat[cat][byCat[cat].length - 1] as Asset & { url: string }).url = c.url;
    }
  }

  for (const cat of Object.keys(NEED) as Cat[]) {
    console.log(cat, byCat[cat].length, "/", NEED[cat]);
  }

  const short = (Object.keys(NEED) as Cat[]).filter((c) => byCat[c].length < NEED[c]);
  if (short.length) {
    console.warn("WARNING short categories:", short.map((c) => `${c}=${byCat[c].length}`).join(", "));
  }

  const outPath = join(process.cwd(), "lib", "seed-jp-images.ts");
  const serialize = (arr: Array<Asset & { url: string }>) =>
    arr
      .map(
        (a) =>
          `  { id: ${JSON.stringify(a.id)}, url: ${JSON.stringify(a.url)}, theme: ${JSON.stringify(a.theme)}, note: ${JSON.stringify(a.note)}${a.place ? `, place: ${JSON.stringify(a.place)}` : ""} },`,
      )
      .join("\n");

  const body = `/** Auto-generated by scripts/build-jp-image-catalog.ts — unique JP feed images. */
export type JpImageAsset = {
  id: string;
  url: string;
  theme: string;
  note: string;
  place?: string;
};

export const JP_FASHION_IMAGES: JpImageAsset[] = [
${serialize(byCat.fashion as Array<Asset & { url: string }>)}
];

export const JP_BEAUTY_IMAGES: JpImageAsset[] = [
${serialize(byCat.beauty as Array<Asset & { url: string }>)}
];

export const JP_FOOD_IMAGES: JpImageAsset[] = [
${serialize(byCat.food as Array<Asset & { url: string }>)}
];

export const JP_LIFESTYLE_IMAGES: JpImageAsset[] = [
${serialize(byCat.lifestyle as Array<Asset & { url: string }>)}
];

export const JP_TRAVEL_IMAGES: JpImageAsset[] = [
${serialize(byCat.travel as Array<Asset & { url: string }>)}
];

export const JP_TECH_IMAGES: JpImageAsset[] = [
${serialize(byCat.tech as Array<Asset & { url: string }>)}
];

export const JP_HOME_IMAGES: JpImageAsset[] = [
${serialize(byCat.home as Array<Asset & { url: string }>)}
];

export const JP_OTHER_IMAGES: JpImageAsset[] = [
${serialize(byCat.other as Array<Asset & { url: string }>)}
];

export const JP_IMAGES_BY_CATEGORY = {
  fashion: JP_FASHION_IMAGES,
  beauty: JP_BEAUTY_IMAGES,
  food: JP_FOOD_IMAGES,
  lifestyle: JP_LIFESTYLE_IMAGES,
  travel: JP_TRAVEL_IMAGES,
  tech: JP_TECH_IMAGES,
  home: JP_HOME_IMAGES,
  other: JP_OTHER_IMAGES,
  sports: JP_OTHER_IMAGES,
} as const;

export function assertJpImageUniqueness() {
  const all = [
    ...JP_FASHION_IMAGES,
    ...JP_BEAUTY_IMAGES,
    ...JP_FOOD_IMAGES,
    ...JP_LIFESTYLE_IMAGES,
    ...JP_TRAVEL_IMAGES,
    ...JP_TECH_IMAGES,
    ...JP_HOME_IMAGES,
    ...JP_OTHER_IMAGES,
  ];
  const urls = all.map((a) => a.url);
  const ids = all.map((a) => a.id);
  if (new Set(urls).size !== urls.length) {
    throw new Error("Duplicate JP image URLs in catalog");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate JP image ids in catalog");
  }
}
`;

  writeFileSync(outPath, body, "utf8");
  console.log("wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
