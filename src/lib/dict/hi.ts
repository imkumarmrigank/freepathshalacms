/**
 * Hindi.
 *
 * The key is the English line as it is written in the screen. A line that is
 * not here yet shows in English, so this file can grow a screen at a time
 * without anything breaking.
 *
 * Only the interface is translated. Names, notes and anything else people
 * type stay exactly as they were typed.
 */
const hi: Record<string, string> = {
  /* --- the chrome ----------------------------------------------------- */
  "Centre Management": "केंद्र प्रबंधन",
  "Sign out": "साइन आउट",
  "Sign in": "साइन इन",
  "All centres": "सभी केंद्र",
  "Language": "भाषा",
  "Loading…": "लोड हो रहा है…",
  "Close": "बंद करें",
  "Cancel": "रद्द करें",
  "Save": "सहेजें",
  "Save changes": "बदलाव सहेजें",
  "Back": "वापस",
  "Download": "डाउनलोड",
  "Search": "खोजें",
  "From": "से",
  "to": "तक",
  "Today": "आज",
  "Yesterday": "कल",
  "This week": "इस सप्ताह",
  "Last week": "पिछला सप्ताह",
  "This month": "इस महीने",
  "Last month": "पिछला महीना",
  "Day": "दिन",

  /* --- the menu ------------------------------------------------------- */
  "Dashboard": "डैशबोर्ड",
  "Centre today": "आज का केंद्र",
  "Students": "बच्चे",
  "All students": "सभी बच्चे",
  "New admission": "नया दाख़िला",
  "Attendance": "उपस्थिति",
  "Attendance dashboard": "उपस्थिति डैशबोर्ड",
  "Student register": "बच्चों का रजिस्टर",
  "My check-in": "मेरी हाज़िरी",
  "My leave": "मेरी छुट्टी",
  "Staff attendance": "स्टाफ़ उपस्थिति",
  "Leave requests": "छुट्टी के आवेदन",
  "Teaching": "पढ़ाई",
  "Timetable": "समय-सारणी",
  "Parents & support": "अभिभावक और सहयोग",
  "Centre audits": "केंद्र ऑडिट",
  "Audit reports": "ऑडिट रिपोर्ट",
  "Visits & standing": "दौरे और स्थिति",
  "Suggestions": "सुझाव",
  "Sports": "खेल",
  "Calendar": "कैलेंडर",
  "Supplies": "सामग्री",
  "Insights": "जानकारी",
  "Reports": "रिपोर्ट",
  "Administration": "प्रशासन",
  "People": "लोग",
  "Staff": "स्टाफ़",
  "Staff training": "स्टाफ़ प्रशिक्षण",
  "Training Manual": "प्रशिक्षण पुस्तिका",
  "My test": "मेरा टेस्ट",
  "Day book": "दैनिक डायरी",
  "Home": "होम",
  "More": "और",

  /* --- signing in ------------------------------------------------------ */
  "Email": "ईमेल",
  "Password": "पासवर्ड",
  "One place for every centre, every student, every session.":
    "हर केंद्र, हर बच्चे, हर सत्र के लिए एक जगह।",
  "Wrong email or password.": "ईमेल या पासवर्ड ग़लत है।",

  "Use the credentials issued by your administrator.":
    "अपने प्रशासक से मिली लॉगिन जानकारी का उपयोग करें।",
  "Incorrect email or password, or the account is inactive.":
    "ईमेल या पासवर्ड ग़लत है, या खाता निष्क्रिय है।",
  "Session-wise enrolment with automatic promotion":
    "सत्र-वार दाख़िला, अपने आप अगली कक्षा में",
  "Daily student attendance marked by teachers":
    "शिक्षकों द्वारा रोज़ की उपस्थिति",
  "Geofenced staff check-in at the centre":
    "केंद्र पर स्टाफ़ की जगह-आधारित हाज़िरी",
  "Parent-teacher meetings and follow-ups":
    "अभिभावक-शिक्षक बैठकें और फ़ॉलो-अप",
  "On a phone?": "फ़ोन पर हैं?",
  "Get the Android app": "एंड्रॉइड ऐप लें",

  /* --- the register ---------------------------------------------------- */
  "Present": "उपस्थित",
  "Absent": "अनुपस्थित",
  "Leave": "छुट्टी",
  "Class": "कक्षा",
  "Centre": "केंद्र",
  "Children": "बच्चे",
  "children": "बच्चे",
  "Mark all present": "सभी को उपस्थित करें",
  "Reason": "कारण",
  "Remarks": "टिप्पणी",
  "Saved": "सहेज लिया",
  "Nothing to show": "दिखाने के लिए कुछ नहीं",

  /* --- check-in -------------------------------------------------------- */
  "Check in": "हाज़िरी लगाएँ",
  "Check out": "छुट्टी दर्ज करें",
  "Checked in": "हाज़िरी लग गई",
  "You are too far from the centre.": "आप केंद्र से बहुत दूर हैं।",

  /* --- the audit ------------------------------------------------------- */
  "Good": "अच्छा",
  "Fair": "ठीक",
  "Weak": "कमज़ोर",
  "Poor": "ख़राब",
  "Not applicable": "लागू नहीं",
  "Mark": "अंक",
  "Verdict": "नतीजा",
  "Auditor": "ऑडिटर",
  "Mentor": "मेंटर",
  "Teacher": "शिक्षक",
  "Sports Teacher": "खेल शिक्षक",
  "Super Admin": "सुपर एडमिन",
  "Admin": "एडमिन",

  /* --- the words the system itself uses, wherever they appear ---------- */
  "Centre Manager": "केंद्र प्रभारी",
  "Backup Teacher": "स्थानापन्न शिक्षक",
  "Rider": "राइडर",

  "Scheduled visit": "निर्धारित दौरा",
  "Follow-up visit": "फ़ॉलो-अप दौरा",
  "Special visit": "औचक दौरा",
  "Planned": "निर्धारित",
  "In progress": "चल रहा है",
  "Filed": "जमा",
  "Cancelled": "रद्द",
  "Healthy": "ठीक-ठाक",
  "Needs attention": "ध्यान चाहिए",
  "Support required": "मदद चाहिए",
  "Immediate intervention": "तुरंत कार्रवाई",
  "Not started": "शुरू नहीं हुआ",
  "Being worked on": "काम चल रहा है",
  "Centre says done": "केंद्र कहता है हो गया",
  "Verified by auditor": "ऑडिटर ने जाँचा",
  "Not done": "नहीं हुआ",
  "Withdrawn": "वापस लिया",
  "Done properly": "ठीक से हुआ",
  "Partly done": "आंशिक रूप से हुआ",
  "Critical": "अत्यावश्यक",
  "High": "ज़रूरी",
  "Medium": "मध्यम",
  "Low": "कम",
  "Action needed": "कार्रवाई चाहिए",
  "Watch": "नज़र रखें",
  "On track": "सही राह पर",
  "Excellent": "बहुत अच्छा",

  "Awaiting mentor": "मेंटर की प्रतीक्षा",
  "Counselling under way": "काउंसलिंग जारी",
  "Closed": "बंद",
  "Picked up": "उठाया गया",
  "Followed up": "फ़ॉलो-अप हुआ",
  "Reopened": "फिर से खोला",
  "Urgent": "अत्यावश्यक",

  /* --- table headings -------------------------------------------------- */
  "Visited on": "दौरे की तारीख़",
  "Visit": "दौरा",
  "Name": "नाम",
  "Role": "भूमिका",
  "Date": "तारीख़",
  "Status": "स्थिति",
  "Score": "अंक",
  "Children present": "उपस्थित बच्चे",
  "Weakest checks": "सबसे कमज़ोर बिंदु",
  "Asks": "माँगें",
  "Last login": "अंतिम लॉगिन",
  "Actions": "कार्रवाई",
  "Total": "कुल",

  /* --- Centre today ---------------------------------------------------- */
  "centres open": "केंद्र खुले",
  "centre open": "केंद्र खुला",
  "staff checked in": "स्टाफ़ की हाज़िरी",
  "centres with nothing yet": "केंद्र जहाँ अब तक कुछ नहीं",
  "centre with nothing yet": "केंद्र जहाँ अब तक कुछ नहीं",
  "children marked": "बच्चे दर्ज",
  "staff in": "स्टाफ़ अंदर",
  "classes marked": "कक्षाएँ दर्ज",
  "Nothing yet": "अब तक कुछ नहीं",
  "nothing else recorded": "और कुछ दर्ज नहीं",
  "present": "उपस्थित",
  "No centres": "कोई केंद्र नहीं",
  "The meetings, child by child": "बैठकें, बच्चा-दर-बच्चा",
  "Flagged for counselling": "काउंसलिंग के लिए चिह्नित",
  "In their own words": "उनके अपने शब्दों में",
  "Asked of the centre": "केंद्र से क्या कहा गया",
  "no check-in": "हाज़िरी नहीं",
  "still in": "अब भी अंदर",
  "by hand": "हाथ से",
  "Checked in, but nothing recorded against the day.":
    "हाज़िरी लगी, पर दिन के लिए कुछ दर्ज नहीं हुआ।",
  "Nobody checked in and nothing was recorded at this centre on this day.":
    "इस दिन इस केंद्र पर न कोई हाज़िर हुआ, न कुछ दर्ज हुआ।",

  "from {at}": "{at} से",
  "{n} not marked": "{n} दर्ज नहीं",
  "{n} parent meeting": "{n} अभिभावक बैठक",
  "{n} parent meetings": "{n} अभिभावक बैठकें",
  "Audit visit": "ऑडिट दौरा",
  "Sports session": "खेल सत्र",
  "{n} flagged": "{n} चिह्नित",
  "{n} written up": "{n} ने लिखा",
  "Children marked present, against the children whose register was filled":
    "उपस्थित दर्ज बच्चे, उन बच्चों में से जिनका रजिस्टर भरा गया",
  "The centre's own staff who checked in, against the staff on its books":
    "केंद्र के अपने स्टाफ़ की हाज़िरी, उसके कुल स्टाफ़ में से",
  "Classes whose attendance register was filled, against the classes the centre runs":
    "जिन कक्षाओं का रजिस्टर भरा गया, केंद्र की कुल कक्षाओं में से",
  "Today · {d}": "आज · {d}",
  "of {n} children present": "{n} में से उपस्थित",
  "Add a centre before this page has anything to show.":
    "इस पेज पर कुछ दिखने से पहले एक केंद्र जोड़ें।",

  /* --- Audit reports --------------------------------------------------- */
  "Reports filed": "जमा रिपोर्ट",
  "Average mark": "औसत अंक",
  "Needing help": "मदद चाहिए",
  "Asks raised": "उठाई गई माँगें",
  "Every centre": "हर केंद्र",
  "Your centre": "आपका केंद्र",
  "Every auditor": "हर ऑडिटर",
  "The dates are the days the centres were visited. Only filed reports appear here.":
    "तारीख़ें वे दिन हैं जब केंद्रों का दौरा हुआ। यहाँ केवल जमा रिपोर्ट दिखती हैं।",
  "What the auditor wrote": "ऑडिटर ने क्या लिखा",
  "The form, check by check": "फ़ॉर्म, बिंदु-दर-बिंदु",
  "What was asked of the centre": "केंद्र से क्या कहा गया",
  "children present": "बच्चे उपस्थित",
  "staff present": "स्टाफ़ उपस्थित",
  "Does not apply — left out of the score": "लागू नहीं — अंकों में नहीं गिना गया",
  "nothing marked weak": "कुछ भी कमज़ोर दर्ज नहीं",

  /* --- my check-in ----------------------------------------------------- */
  "My attendance": "मेरी उपस्थिति",
  "You are not assigned to a centre, so check-in is unavailable.":
    "आप किसी केंद्र से नहीं जुड़े हैं, इसलिए हाज़िरी उपलब्ध नहीं है।",
  "Check in from inside {centre} — your location is verified against the centre.":
    "{centre} के भीतर से हाज़िरी लगाएँ — आपकी जगह केंद्र से मिलाकर जाँची जाती है।",
  "your centre": "आपका केंद्र",
  "Days present": "उपस्थित दिन",
  "Late arrivals": "देर से पहुँचे",
  "Hours logged": "दर्ज घंटे",
  "this month": "इस महीने",
  "Recent days": "हाल के दिन",
  "No check-ins yet": "अभी कोई हाज़िरी नहीं",
  "Your daily punches will be listed here.": "आपकी रोज़ की हाज़िरी यहाँ दिखेगी।",
  "In": "आगमन",
  "Out": "प्रस्थान",
  "Hours": "घंटे",
  "Distance": "दूरी",
  "Late": "देर से",
  "Holiday": "अवकाश",
  "This device cannot report its location.": "यह उपकरण अपनी जगह नहीं बता सकता।",
  "Location permission is blocked. Enable it for this site and try again.":
    "जगह की अनुमति बंद है। इस साइट के लिए चालू करके दोबारा कोशिश करें।",
  "Could not read your location. Move to an open area and retry.":
    "आपकी जगह नहीं पढ़ी जा सकी। खुली जगह पर जाकर दोबारा कोशिश करें।",
  "You are": "आप",
  "from {centre} · check-in works within {r} m":
    "{centre} से · हाज़िरी {r} मीटर के भीतर लगती है",
  "Checked out": "छुट्टी दर्ज",
  "{m} m from centre": "केंद्र से {m} मीटर",
  "not marked": "दर्ज नहीं",
  "Currently checked in": "अभी हाज़िर हैं",
  "{h} logged today": "आज {h} दर्ज",
  "Today’s spells": "आज की पारियाँ",
  "Confirm check-in": "हाज़िरी पक्की करें",
  "Confirm check-out": "छुट्टी पक्की करें",
  "Reading location…": "जगह पढ़ी जा रही है…",
  "You are {d} from {centre} — almost there. Walk up to the centre and check in; the circle is {r} m wide.":
    "आप {centre} से {d} दूर हैं — लगभग पहुँच गए। केंद्र तक चलकर हाज़िरी लगाएँ; घेरा {r} मीटर का है।",
  "You are {d} from {centre}. A day this far from the centre is marked by your centre manager, with the reason, not from here.":
    "आप {centre} से {d} दूर हैं। इतनी दूर का दिन आपके केंद्र प्रभारी कारण सहित दर्ज करते हैं, यहाँ से नहीं।",
  "Away from {centre}? Enter it by hand": "{centre} से दूर हैं? हाथ से दर्ज करें",
  "This only appears because you are outside the {r} m circle. Say where you are; your administrator sees the reason and the distance beside the punch.":
    "यह इसलिए दिख रहा है क्योंकि आप {r} मीटर के घेरे से बाहर हैं। बताइए आप कहाँ हैं; आपके प्रशासक को कारण और दूरी हाज़िरी के साथ दिखती है।",
  "Location ready (±{a} m). This is only possible within {r} m of {centre}.":
    "जगह मिल गई (±{a} मीटर)। यह केवल {centre} से {r} मीटर के भीतर ही हो सकता है।",
  "Both check-in and check-out must be done within {r} m of {centre}.":
    "हाज़िरी और छुट्टी दोनों {centre} से {r} मीटर के भीतर ही दर्ज हो सकती हैं।",
  "Why you are not at the centre": "आप केंद्र पर क्यों नहीं हैं",
  "Where you are *": "आप कहाँ हैं *",
  "Anything to add": "कुछ और कहना है",
  "Home visits in Nathupur with the mentor": "मेंटर के साथ नाथूपुर में घर-भेंट",
  "Check in by hand": "हाथ से हाज़िरी",
  "Check out by hand": "हाथ से छुट्टी",
  "Not now — I will try again at the centre": "अभी नहीं — केंद्र पहुँचकर कोशिश करूँगा",
  "Home visits in the community": "समुदाय में घर-भेंट",
  "At another centre today": "आज दूसरे केंद्र पर",
  "Training or a meeting": "प्रशिक्षण या बैठक",
  "Travelling for the organisation": "संस्था के काम से यात्रा",
  "Centre's pin on the map looks wrong": "नक़्शे पर केंद्र की जगह ग़लत लगती है",
  "Other — written below": "अन्य — नीचे लिखा है",
};

export default hi;
