/**
 * Hinglish spellings a teacher actually types, against the Devanagari they mean.
 *
 * The rules in hindi.ts cannot settle vowel length or retroflexion — "matra" is
 * मात्रा or मत्रा, "paath" is पाठ or पाथ — because Roman Hindi does not record
 * the difference. This list settles it for the words that come up in a Hindi
 * teaching plan, and everything else falls through to the rules with the
 * alternatives offered as a choice.
 *
 * Keys are lowercase and stripped of spaces, so "paryayvachi" and "paryaayvaachi"
 * can both point at the same word. Shared by server and client.
 */

export const WORDS: Record<string, string> = {
  // ------------------------------------------------------ Hindi grammar terms
  vyakaran: "व्याकरण", vyakran: "व्याकरण",
  varnamala: "वर्णमाला", varnmala: "वर्णमाला",
  swar: "स्वर", vyanjan: "व्यंजन", matra: "मात्रा", matrayen: "मात्राएँ",
  sangya: "संज्ञा", sarvanam: "सर्वनाम", kriya: "क्रिया", visheshan: "विशेषण",
  kriyavisheshan: "क्रियाविशेषण", samuchchayabodhak: "समुच्चयबोधक",
  ling: "लिंग", vachan: "वचन", kaal: "काल",
  karak: "कारक", sandhi: "संधि", samas: "समास", upsarg: "उपसर्ग", pratyay: "प्रत्यय",
  vilom: "विलोम", vilomshabd: "विलोम शब्द",
  paryayvachi: "पर्यायवाची", paryayvachishabd: "पर्यायवाची शब्द",
  anekarthi: "अनेकार्थी", muhavare: "मुहावरे", muhavara: "मुहावरा",
  lokokti: "लोकोक्ति", shabd: "शब्द", shabdkosh: "शब्दकोश",
  vakya: "वाक्य", vakyarachna: "वाक्य रचना", viram: "विराम", viramchinh: "विराम चिह्न",
  sarvanaam: "सर्वनाम", visheshya: "विशेष्य", padbandh: "पदबंध",
  shudh: "शुद्ध", ashudh: "अशुद्ध", shudhi: "शुद्धि",

  // -------------------------------------------------------------- what is set
  paath: "पाठ", path: "पाठ", adhyay: "अध्याय",
  kavita: "कविता", kahani: "कहानी", kahaani: "कहानी",
  nibandh: "निबंध", anuched: "अनुच्छेद", anuchhed: "अनुच्छेद",
  patra: "पत्र", patralekhan: "पत्र लेखन", lekhan: "लेखन",
  shrutlekh: "श्रुतलेख", srutlekh: "श्रुतलेख", imla: "इमला",
  doha: "दोहा", chaupai: "चौपाई", chhand: "छंद", alankar: "अलंकार",
  ras: "रस", sahitya: "साहित्य", gadya: "गद्य", padya: "पद्य",
  sansmaran: "संस्मरण", jeevani: "जीवनी", ekanki: "एकांकी", natak: "नाटक",
  samvad: "संवाद", varnan: "वर्णन", chitravarnan: "चित्र वर्णन",

  // --------------------------------------------------------- classroom basics
  abhyas: "अभ्यास", grihkarya: "गृहकार्य", homework: "गृहकार्य",
  parikshan: "परीक्षण", pariksha: "परीक्षा", test: "परीक्षा",
  mulyankan: "मूल्यांकन", prashn: "प्रश्न", uttar: "उत्तर",
  padhna: "पढ़ना", likhna: "लिखना", bolna: "बोलना", sunna: "सुनना",
  samajhna: "समझना", yaad: "याद", dohrana: "दोहराना", punaravriti: "पुनरावृत्ति",
  vidyarthi: "विद्यार्थी", chatra: "छात्र", chhatra: "छात्र", chhatri: "छात्रा",
  adhyapak: "अध्यापक", adhyapika: "अध्यापिका", shikshak: "शिक्षक", guru: "गुरु",
  kaksha: "कक्षा", vidyalaya: "विद्यालय", pathshala: "पाठशाला",
  pustak: "पुस्तक", kitab: "किताब", copy: "कॉपी", blackboard: "श्यामपट",
  shyampat: "श्यामपट", chak: "चॉक", samay: "समय", din: "दिन", saptah: "सप्ताह",
  mahina: "महीना", varsh: "वर्ष", saal: "साल",

  // ------------------------------------------------------------ common speech
  namaste: "नमस्ते", dhanyavad: "धन्यवाद", kripya: "कृपया",
  bharat: "भारत", hindi: "हिंदी", angrezi: "अंग्रेज़ी", ganit: "गणित",
  vigyan: "विज्ञान", samajik: "सामाजिक", parichay: "परिचय",
  ghar: "घर", parivar: "परिवार", mata: "माता", pita: "पिता",
  bachche: "बच्चे", bachcha: "बच्चा", ladka: "लड़का", ladki: "लड़की",
  aaj: "आज", kal: "कल", abhi: "अभी", phir: "फिर", bahut: "बहुत",
  achha: "अच्छा", achchha: "अच्छा", theek: "ठीक", thik: "ठीक",
  kaam: "काम", baat: "बात", samasya: "समस्या", karan: "कारण",
  upasthit: "उपस्थित", anupasthit: "अनुपस्थित", chhutti: "छुट्टी",
  pehchan: "पहचान", pahchan: "पहचान", ginti: "गिनती", ank: "अंक",
  rang: "रंग", chitra: "चित्र", khel: "खेल", geet: "गीत", gaan: "गान",

  // verb forms where the rules would put a हलन्त the language does not want
  hamne: "हमने", unhone: "उन्होंने", isne: "इसने", usne: "उसने",
  karne: "करने", karna: "करना", kiya: "किया", kiye: "किये", karte: "करते",
  dene: "देने", lene: "लेने", jaane: "जाने", aane: "आने", hone: "होने",
  padhne: "पढ़ने", likhne: "लिखने", sikhne: "सीखने", samjhane: "समझाने",
  batane: "बताने", dikhane: "दिखाने", banane: "बनाने", sunane: "सुनाने",
};

/** "paryayvachi shabd" is looked up as one key, so multi-word entries work too. */
export const WORD_KEYS = Object.keys(WORDS);
