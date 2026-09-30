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

  /* --- the student register -------------------------------------------- */
  "Student attendance": "बच्चों की उपस्थिति",
  "No academic session is open.": "कोई सत्र खुला नहीं है।",
  "You are not assigned to a centre yet.": "आप अभी किसी केंद्र से नहीं जुड़े हैं।",
  "Session {s}": "सत्र {s}",
  "{n} of {total} already marked for this date": "{total} में से {n} इस तारीख़ के लिए दर्ज",
  "Choose a class": "कक्षा चुनें",
  "Pick the centre, class and date above to load the roster.":
    "ऊपर केंद्र, कक्षा और तारीख़ चुनें ताकि सूची आए।",
  "No students in this class": "इस कक्षा में कोई बच्चा नहीं",
  "Nobody is enrolled in this class for the selected centre and session.":
    "चुने गए केंद्र और सत्र में इस कक्षा में कोई दाख़िल नहीं है।",
  "Select centre": "केंद्र चुनें",
  "Select class": "कक्षा चुनें",
  "Section": "वर्ग",
  "Both sections": "दोनों वर्ग",
  "Section {s}": "वर्ग {s}",
  "Older marks": "पुराने दर्ज",
  "Reason for every absent student": "हर अनुपस्थित बच्चे का कारण",
  "Reason for all {n} absent…": "सभी {n} अनुपस्थित का कारण…",
  "Reason for every student on leave": "छुट्टी पर हर बच्चे का कारण",
  "Reason for all {n} on leave…": "छुट्टी पर सभी {n} का कारण…",
  "Mark all absent": "सभी को अनुपस्थित करें",
  "Roll": "क्रमांक",
  "Student": "बच्चा",
  "Already flagged for counselling — open the referral":
    "पहले से काउंसलिंग के लिए चिह्नित — रेफ़रल खोलें",
  "Flag for counselling": "काउंसलिंग के लिए चिह्नित करें",
  "Recorded before the register was simplified — press P or A to change it":
    "रजिस्टर सरल होने से पहले दर्ज — बदलने के लिए P या A दबाएँ",
  "{mark} can only be marked on the day itself": "{mark} केवल उसी दिन दर्ज हो सकता है",
  "Reason for {name}": "{name} का कारण",
  "Reason for leave": "छुट्टी का कारण",
  "Reason for absence": "अनुपस्थिति का कारण",
  "(optional)": "(वैकल्पिक)",
  "Choose a reason for the child marked absent or on leave.":
    "अनुपस्थित या छुट्टी पर दर्ज बच्चे का कारण चुनें।",
  "Choose a reason for {n} children marked absent or on leave.":
    "अनुपस्थित या छुट्टी पर दर्ज {n} बच्चों का कारण चुनें।",
  "Save attendance": "उपस्थिति सहेजें",
  "This day is closed — present can only be given on the day itself.":
    "यह दिन बंद है — उपस्थित केवल उसी दिन दर्ज हो सकता है।",
  "Saving again for the same date overwrites the earlier entry.":
    "उसी तारीख़ के लिए दोबारा सहेजने पर पहले की प्रविष्टि बदल जाती है।",
  "Half day": "आधा दिन",
  "Sick": "बीमार",
  "Didn't wake up": "समय पर नहीं उठा",
  "Distance issue": "दूरी की समस्या",
  "Parents allowed it": "अभिभावकों ने अनुमति दी",
  "Siblings responsibility": "भाई-बहन की ज़िम्मेदारी",
  "Visiting Hometown": "गाँव गए हैं",
  "Need Followup": "फ़ॉलो-अप चाहिए",
  "Parents not aware": "अभिभावकों को पता नहीं",
  "Drop": "पढ़ाई छोड़ दी",
  "Approved leave": "स्वीकृत छुट्टी",
  "Festival": "त्योहार",
  "Marriage": "शादी",

  /* --- the classes, as the centres name them --------------------------- */
  "Class 1": "कक्षा 1",
  "Class 2": "कक्षा 2",
  "Class 3": "कक्षा 3",
  "Class 4": "कक्षा 4",
  "Class 5": "कक्षा 5",
  "Class 6": "कक्षा 6",
  "Class 7": "कक्षा 7",
  "Class 8": "कक्षा 8",
  "Class 9": "कक्षा 9",
  "Class 10": "कक्षा 10",
  "Class 11": "कक्षा 11",
  "Class 12": "कक्षा 12",
  "Nursery": "नर्सरी",
  "KG": "केजी",
  "Register": "रजिस्टर",

  /* --- the teacher's day book ------------------------------------------ */
  "My day book": "मेरी दैनिक डायरी",
  "what you did today, in your own words": "आज आपने क्या किया, आपके अपने शब्दों में",
  "← Day before": "← पिछला दिन",
  "Day after →": "अगला दिन →",
  "You checked in": "आपकी हाज़िरी",
  "You checked out": "आपकी छुट्टी",
  "entered by hand": "हाथ से दर्ज",
  "{m} m from the centre": "केंद्र से {m} मीटर",
  "not checked in": "हाज़िरी नहीं लगी",
  "{h}h {m}m at the centre": "केंद्र पर {h} घंटे {m} मिनट",
  "still open": "अभी खुला",
  "Children absent": "अनुपस्थित बच्चे",
  "{n} class marked": "{n} कक्षा दर्ज",
  "{n} classes marked": "{n} कक्षाएँ दर्ज",
  "{n} reason given": "{n} कारण दिया",
  "{n} reasons given": "{n} कारण दिए",
  "no reasons given": "कोई कारण नहीं दिया",
  "Your register on {d}": "{d} का आपका रजिस्टर",
  "Marked at": "दर्ज समय",
  "Why they were away:": "वे क्यों नहीं आए:",
  "Write up the day": "दिन लिखें",
  "What you wrote": "आपने क्या लिखा",
  "Change it": "बदलें",
  "Save the day": "दिन सहेजें",
  "The whole day": "पूरा दिन",
  "saved {at}": "{at} पर सहेजा",
  "Taught": "पढ़ाया",
  "Homework": "गृहकार्य",
  "Used": "इस्तेमाल किया",
  "Beyond the class": "कक्षा के अलावा",
  "Also did": "यह भी किया",
  "Help needed": "मदद चाहिए",
  "Your last thirty days": "आपके पिछले तीस दिन",
  "Your days appear here as you check in and write them up.":
    "जैसे-जैसे आप हाज़िरी लगाएँगे और दिन लिखेंगे, वे यहाँ दिखेंगे।",
  "Written up": "लिखा गया",
  "written": "लिखा",
  "not written": "नहीं लिखा",
  "Open": "खोलें",
  "Which class": "कौन-सी कक्षा",
  "leave blank for the day as a whole": "पूरे दिन के लिए ख़ाली छोड़ें",
  "Subject": "विषय",
  "हिंदी या English": "हिंदी या English",
  "Mathematics / गणित": "गणित / Mathematics",
  "What you taught today — the chapter or topic": "आज आपने क्या पढ़ाया — पाठ या विषय",
  "Chapter 4: Addition with carrying / पाठ 4: हासिल के साथ जोड़":
    "पाठ 4: हासिल के साथ जोड़ / Chapter 4: Addition with carrying",
  "How it went, in detail": "कैसा रहा, विस्तार से",
  "what the children understood, what they did not": "बच्चों को क्या समझ आया, क्या नहीं",
  "Most followed the carrying step; six children still count on fingers…":
    "ज़्यादातर बच्चे हासिल समझ गए; छह अब भी उँगलियों पर गिनते हैं…",
  "Homework given": "दिया गया गृहकार्य",
  "Sums 1–10 from page 23 / पेज 23 के सवाल 1–10": "पेज 23 के सवाल 1–10",
  "Homework, in detail": "गृहकार्य, विस्तार से",
  "what exactly, and by when": "ठीक क्या, और कब तक",
  "To be brought tomorrow; parents asked to sign the notebook":
    "कल लाना है; अभिभावकों से कॉपी पर हस्ताक्षर कराने को कहा",
  "Equipment or teaching aid used": "इस्तेमाल किया गया सामान या शिक्षण सामग्री",
  "Counting beads, blackboard chart / गिनती की मालाएँ": "गिनती की मालाएँ, ब्लैकबोर्ड चार्ट",
  "What it showed": "इससे क्या पता चला",
  "did it help, and how you could tell": "क्या मदद मिली, और कैसे पता चला",
  "Children who struggled with sums managed them with the beads":
    "जिन बच्चों को सवाल कठिन लगते थे, उन्होंने मालाओं से कर लिए",
  "Anything else you did today": "आज आपने और क्या किया",
  "a home visit, a parent who came, a repair, a meeting":
    "घर-भेंट, कोई अभिभावक आए, मरम्मत, बैठक",
  "Went to Ramu's house; his mother will send him from Monday":
    "रामू के घर गए; उसकी माँ सोमवार से भेजेंगी",
  "Anything beyond the usual class": "रोज़ की कक्षा से अलग कुछ",
  "A community meeting, a child taken to the clinic, a rehearsal, a survey, a visitor at the centre — work that was not the lesson.":
    "समुदाय की बैठक, किसी बच्चे को अस्पताल ले जाना, पूर्वाभ्यास, सर्वे, केंद्र पर कोई आगंतुक — वह काम जो पाठ नहीं था।",
  "What it was": "क्या था",
  "Took Sunita to the clinic / सुनीता को अस्पताल ले गए": "सुनीता को अस्पताल ले गए",
  "What came of it": "उसका क्या नतीजा रहा",
  "how long it took, who was with you, what happened":
    "कितना समय लगा, कौन साथ था, क्या हुआ",
  "Two hours; her mother came along; medicine given, back tomorrow":
    "दो घंटे; उसकी माँ साथ आईं; दवा मिली, कल वापस",
  "Help you need": "आपको क्या मदद चाहिए",
  "what your centre manager should know": "आपके केंद्र प्रभारी को क्या पता होना चाहिए",
  "The blackboard is broken on one side / ब्लैकबोर्ड एक तरफ से टूटा है":
    "ब्लैकबोर्ड एक तरफ से टूटा है",
  "That is what the system recorded of your day. The rest is yours to write.":
    "आपके दिन का इतना सिस्टम ने दर्ज किया। बाक़ी आपको लिखना है।",
  "Meetings written up": "लिखी गई बैठकें",
  "Children referred": "भेजे गए बच्चे",
  "Counselling steps": "काउंसलिंग के क़दम",
  "Visits filed": "जमा दौरे",
  "Suggestions raised": "उठाए गए सुझाव",
  "Replies written": "लिखे गए जवाब",
  "Centre visits": "केंद्र दौरे",
  "Children seen": "देखे गए बच्चे",
  "Registers marked": "दर्ज रजिस्टर",

  /* --- the dashboard ---------------------------------------------------- */
  "Good morning": "सुप्रभात",
  "Good afternoon": "नमस्कार",
  "Good evening": "शुभ संध्या",
  "Total students": "कुल बच्चे",
  "Active": "सक्रिय",
  "Inactive": "निष्क्रिय",
  "Suspended": "निलंबित",
  "Dropped": "छोड़ चुके",
  "Passed out": "आगे स्कूल गए",
  "Transferred": "स्थानांतरित",
  "Graduated": "आगे स्कूल गए",
  "on the books": "रजिस्टर पर",
  "on the roll": "उपस्थिति सूची में",
  "not attending": "नहीं आ रहे",
  "may come back": "लौट सकते हैं",
  "left for good": "पूरी तरह छोड़ दिया",
  "to formal school": "औपचारिक स्कूल में",
  "Enrolled this session": "इस सत्र में दाख़िल",
  "enrolled this session": "इस सत्र में दाख़िल",
  "Attendance today": "आज की उपस्थिति",
  "{n} of {total} marked": "{total} में से {n} दर्ज",
  "not marked yet": "अभी दर्ज नहीं",
  "PTMs this month": "इस महीने की अभिभावक बैठकें",
  "Follow-ups": "फ़ॉलो-अप",
  "{n} overdue · {d} due today": "{n} समय बीत चुके · {d} आज देय",
  "{d} due today · {w} later this week": "{d} आज देय · {w} इस सप्ताह बाद में",
  "{w} due this week": "{w} इस सप्ताह देय",
  "nothing pending": "कुछ बाक़ी नहीं",
  "Counselling": "काउंसलिंग",
  "{n} urgent · {w} not picked up": "{n} अत्यावश्यक · {w} किसी ने नहीं लिए",
  "{w} not picked up yet": "{w} अब तक किसी ने नहीं लिए",
  "Record Parent Interaction": "अभिभावक बातचीत दर्ज करें",
  "View Interaction History": "पिछली बातचीत देखें",
  "Mark student attendance": "बच्चों की उपस्थिति दर्ज करें",
  "Add student": "बच्चा जोड़ें",
  "Falling behind in tests — worth a parent meeting":
    "टेस्ट में पीछे — अभिभावक बैठक ज़रूरी",
  "Scored": "अंक मिले",
  "Needed to pass": "पास होने के लिए चाहिए",
  "Last PTM": "पिछली बैठक",
  "Counselling open": "काउंसलिंग खुली",
  "never": "कभी नहीं",
  "Arrange PTM": "बैठक तय करें",
  "Recent interactions": "हाल की बातचीत",
  "No interactions yet": "अभी कोई बातचीत नहीं",
  "Parent-teacher conversations you record will show up here.":
    "आपके दर्ज किए गए अभिभावक-शिक्षक संवाद यहाँ दिखेंगे।",
  "Upcoming follow-ups": "आने वाले फ़ॉलो-अप",
  "Nothing pending": "कुछ बाक़ी नहीं",
  "Follow-ups you flag during a PTM appear here.":
    "बैठक के दौरान चिह्नित फ़ॉलो-अप यहाँ दिखते हैं।",
  "Overdue": "समय बीत चुका",
  "follow-up": "फ़ॉलो-अप",
  "Centres the auditor flagged": "ऑडिटर ने जिन केंद्रों को चिह्नित किया",
  "suggestion from the auditor still to deal with": "ऑडिटर का सुझाव अब भी बाक़ी",
  "suggestions from the auditor still to deal with": "ऑडिटर के सुझाव अब भी बाक़ी",
  "{n} past the date": "{n} तय तारीख़ से आगे",
  "Nothing outstanding from the auditor.": "ऑडिटर की ओर से कुछ बाक़ी नहीं।",
  "Last visit {d}": "पिछला दौरा {d}",
  "No visit yet": "अभी कोई दौरा नहीं",
  "next {d}": "अगला {d}",
  "Open suggestions": "सुझाव खोलें",

  /* --- the students list ------------------------------------------------ */
  "{n} student": "{n} बच्चा",
  "{n} students": "{n} बच्चे",
  "in {s}": "{s} में",
  "+ Add student": "+ बच्चा जोड़ें",
  "Search by name, enrolment no. or phone": "नाम, दाख़िला नंबर या फ़ोन से खोजें",
  "All sections": "सभी वर्ग",
  "All statuses": "सभी स्थितियाँ",
  "No students found": "कोई बच्चा नहीं मिला",
  "Try a different filter, or add the first student for this centre.":
    "कोई और फ़िल्टर आज़माएँ, या इस केंद्र का पहला बच्चा जोड़ें।",
  "Try a different filter. The centre manager admits new students.":
    "कोई और फ़िल्टर आज़माएँ। नए बच्चों का दाख़िला केंद्र प्रभारी करते हैं।",
  "Enrolment no.": "दाख़िला नंबर",
  "Admitted": "दाख़िला",
  "Status changed": "स्थिति बदली",
  "Not enrolled": "दाख़िल नहीं",
  "Active since admission": "दाख़िले से सक्रिय",
  "Not recorded": "दर्ज नहीं",
  "student": "बच्चा",
  "(current)": "(वर्तमान)",
  "All classes": "सभी कक्षाएँ",
  "Both Parents": "माता-पिता दोनों",
  "Mother": "माता",
  "Father": "पिता",
  "Guardian": "अभिभावक",
  "Attentive and engaged": "ध्यान से जुड़े रहे",
  "Neutral": "सामान्य",
  "Resistant or disengaged": "अनिच्छुक या अलग-थलग",
  "In Person": "आमने-सामने",
  "Phone": "फ़ोन",
  "Home Visit": "घर-भेंट",

  /* --- a child's page --------------------------------------------------- */
  "This student belongs to another centre.": "यह बच्चा किसी दूसरे केंद्र का है।",
  "Student saved. Enrolment number": "बच्चा सहेजा गया। दाख़िला नंबर",
  "has been allotted.": "आवंटित हुआ है।",
  "Progress report": "प्रगति रिपोर्ट",
  "Transfer centre": "केंद्र बदलें",
  "Profile": "विवरण",
  "Admission record": "दाख़िला रिकॉर्ड",
  "Test results": "टेस्ट के नतीजे",
  "Printable progress report →": "छापने योग्य प्रगति रिपोर्ट →",
  "No marks recorded yet": "अभी कोई अंक दर्ज नहीं",
  "Results appear here once a teacher enters them against a test.":
    "जब शिक्षक किसी टेस्ट के अंक भरेंगे, वे यहाँ दिखेंगे।",
  "Test": "टेस्ट",
  "Marks": "अंक",
  "Grade": "श्रेणी",
  "Parent interactions": "अभिभावकों से बातचीत",
  "No interactions recorded": "कोई बातचीत दर्ज नहीं",
  "{who} present": "{who} उपस्थित",
  "Follow-up {d}": "फ़ॉलो-अप {d}",
  "Days marked": "दर्ज दिन",
  "Enrolment history": "दाख़िले का इतिहास",
  "Not enrolled in any session yet.": "अभी किसी सत्र में दाख़िल नहीं।",
  "Current": "वर्तमान",
  "Promotions": "अगली कक्षा में",
  "Promoted": "अगली कक्षा में गए",
  "Retained": "उसी कक्षा में रखा",

  /* --- the child's profile form ----------------------------------------- */
  "First name": "नाम",
  "Last name": "उपनाम",
  "Admission no.": "दाख़िला नंबर",
  "Set at admission and not editable — the roster is matched on it.":
    "दाख़िले के समय तय, बदला नहीं जा सकता — सूची इसी से मिलाई जाती है।",
  "Registration no.": "पंजीकरण नंबर",
  "Date of birth": "जन्म तिथि",
  "Place of birth": "जन्म स्थान",
  "Gender": "लिंग",
  "Select": "चुनें",
  "Male": "पुरुष",
  "Female": "महिला",
  "Other": "अन्य",
  "Blood group": "रक्त समूह",
  "Nationality": "राष्ट्रीयता",
  "Indian": "भारतीय",
  "Religion": "धर्म",
  "Hindu": "हिंदू",
  "Muslim": "मुस्लिम",
  "Christian": "ईसाई",
  "Sikh": "सिख",
  "Buddhist": "बौद्ध",
  "Jain": "जैन",
  "Caste": "जाति",
  "Category": "श्रेणी",
  "General": "सामान्य",
  "Medium of study": "पढ़ाई का माध्यम",
  "APAAR ID": "अपार आईडी",
  "Aadhaar number": "आधार नंबर",
  "Aadhaar card": "आधार कार्ड",
  "Has a disability": "कोई दिव्यांगता",
  "No": "नहीं",
  "Yes": "हाँ",
  "Disability details": "दिव्यांगता का विवरण",
  "Contact & address": "संपर्क और पता",
  "Primary phone": "मुख्य फ़ोन",
  "WhatsApp": "व्हाट्सऐप",
  "Alternate phone": "वैकल्पिक फ़ोन",
  "House / block": "मकान / ब्लॉक",
  "City": "शहर",
  "State": "राज्य",
  "Pincode": "पिनकोड",
  "Country": "देश",
  "India": "भारत",
  "Address": "पता",
  "Qualification": "शिक्षा",
  "Uneducated": "अशिक्षित",
  "3rd Pass": "तीसरी पास",
  "5th Pass": "पाँचवीं पास",
  "8th Pass": "आठवीं पास",
  "10th Pass": "दसवीं पास",
  "Intermediate": "इंटरमीडिएट",
  "Graduate": "स्नातक",
  "Post Graduate": "स्नातकोत्तर",
  "Occupation": "व्यवसाय",
  "Annual income": "वार्षिक आय",
  "Mobile": "मोबाइल",
  "Residential address": "घर का पता",
  "Official address": "कार्यालय का पता",
  "If other, which": "अन्य हो तो कौन-सा",
  "Notes": "टिप्पणियाँ",

  /* --- audit suggestions, as the centre reads them ---------------------- */
  "All suggestions": "सभी सुझाव",
  "{p} priority": "{p} प्राथमिकता",
  "Raised {d}": "{d} को उठाया",
  "by {who}": "{who} द्वारा",
  "due {d}": "{d} तक",
  "from that visit": "उसी दौरे से",
  "What the auditor asked for": "ऑडिटर ने क्या कहा",
  "The auditor’s verdict": "ऑडिटर का फ़ैसला",
  "What the centre did about it": "केंद्र ने इस पर क्या किया",
  "Nobody has answered yet.": "अभी किसी ने जवाब नहीं दिया।",
  "Someone": "कोई",
  "This one is closed. If it comes back, the auditor will raise it again at the next visit.":
    "यह बंद हो चुका है। दोबारा हुआ तो ऑडिटर अगले दौरे में फिर उठाएँगे।",
  "Answer this": "इसका जवाब दें",
  "Add a note": "टिप्पणी जोड़ें",
  "What have you done about it? *": "आपने इस पर क्या किया? *",
  "Note *": "टिप्पणी *",
  "Carpenter came on Tuesday and rehung the door; photo sent to the mentor.":
    "मंगलवार को बढ़ई आया और दरवाज़ा दोबारा लगाया; फ़ोटो मेंटर को भेज दी।",
  "Anything worth recording against this.": "इसके साथ दर्ज करने लायक़ कुछ भी।",
  "Where does this stand?": "यह कहाँ तक पहुँचा?",
  "We have started on it": "हमने शुरू कर दिया है",
  "It is done": "हो गया है",
  "Just a note — no change": "सिर्फ़ टिप्पणी — कोई बदलाव नहीं",
  "Send": "भेजें",
  "The auditor confirms this at their next visit. It counts towards your centre’s monthly score once they have.":
    "ऑडिटर अगले दौरे में इसकी पुष्टि करेंगे। पुष्टि के बाद ही यह आपके केंद्र के मासिक अंक में गिना जाता है।",
  "What auditors have asked centres to do": "ऑडिटरों ने केंद्रों से क्या करने को कहा",
  "What your centre has been asked to do": "आपके केंद्र से क्या करने को कहा गया",
  "Only outstanding": "केवल बाक़ी",
  "Include closed": "बंद भी दिखाएँ",
  "Raised by anyone": "किसी के भी द्वारा उठाए",
  "The dates are the days the suggestions were raised.":
    "तारीख़ें वे दिन हैं जब सुझाव उठाए गए।",
  "{n} outstanding": "{n} बाक़ी",
  "{n} overdue": "{n} समय बीत चुके",
  "next visit {d}": "अगला दौरा {d}",
  "One suggestion is past the date the auditor set.":
    "एक सुझाव ऑडिटर की तय तारीख़ से आगे निकल चुका है।",
  "{n} suggestions are past the date the auditor set.":
    "{n} सुझाव ऑडिटर की तय तारीख़ से आगे निकल चुके हैं।",
  "Nothing here yet": "अभी यहाँ कुछ नहीं",
  "Nothing outstanding": "कुछ बाक़ी नहीं",
  "Suggestions appear here after an auditor files a report.":
    "ऑडिटर के रिपोर्ट जमा करने के बाद सुझाव यहाँ दिखते हैं।",
  "Everything an auditor asked for has been dealt with.":
    "ऑडिटर ने जो कहा था, सब पूरा हो चुका है।",
  "no date": "कोई तारीख़ नहीं",
  "raised by {who}": "{who} ने उठाया",
  "{n} reply": "{n} जवाब",
  "{n} replies": "{n} जवाब",
  "no reply yet": "अभी कोई जवाब नहीं",

  /* --- audit reports, as the centre reads them -------------------------- */
  "{n}% of the points these visits could score":
    "इन दौरों के कुल संभावित अंकों का {n}%",
  "on this page: {n}": "इस पेज पर: {n}",
  "support required or immediate": "मदद चाहिए या तुरंत कार्रवाई",
  "on the reports shown": "दिखाई गई रिपोर्ट पर",
  "No reports in this period": "इस अवधि में कोई रिपोर्ट नहीं",
  "A report appears here the moment the auditor files the visit.":
    "ऑडिटर के दौरा जमा करते ही रिपोर्ट यहाँ दिखती है।",
  "Read the report": "रिपोर्ट पढ़ें",
  "report": "रिपोर्ट",
  "Fetching the report…": "रिपोर्ट लाई जा रही है…",
  "of {n}": "{n} में से",
  "No checks were recorded against this visit.":
    "इस दौरे में कोई बिंदु दर्ज नहीं हुआ।",

  /* --- leave, follow-ups and counselling -------------------------------- */
  "A teacher flags a child from their profile, and it appears here.": "शिक्षक बच्चे के पन्ने से उसे चिह्नित करते हैं, और वह यहाँ दिखता है।",
  "A teacher flags a child from their profile. Try a wider period or another centre.": "शिक्षक बच्चे के पन्ने से चिह्नित करते हैं। बड़ी अवधि या दूसरा केंद्र आज़माएँ।",
  "Any mentor": "कोई भी मेंटर",
  "Any reason": "कोई भी कारण",
  "Any stage": "कोई भी चरण",
  "Any urgency": "कोई भी प्राथमिकता",
  "Anything you ask for appears here with the office's answer.":
    "आपका हर आवेदन कार्यालय के जवाब सहित यहाँ दिखेगा।",
  "Apply for leave": "छुट्टी के लिए आवेदन",
  "Ask for time off, and see what was answered": "छुट्टी माँगें, और जवाब देखें",
  "Assigned to": "किसे सौंपा",
  "Completed": "पूरा हुआ",
  "Cover": "स्थानापन्न",
  "Dated this week": "इस सप्ताह की तारीख़",
  "Dates": "तारीख़ें",
  "Days": "दिन",
  "Due": "देय",
  "Fever since yesterday, seeing the doctor in the morning.": "कल से बुख़ार है, सुबह डॉक्टर को दिखाना है।",
  "First or repeat": "पहली बार या दोबारा",
  "Flagged by anyone": "किसी के भी द्वारा चिह्नित",
  "Flagged more than once": "एक से अधिक बार चिह्नित",
  "Flagged on": "चिह्नित तारीख़",
  "Flagged students": "चिह्नित बच्चे",
  "Flagged": "चिह्नित",
  "Follow-ups flagged while recording a parent interaction show up on this page.": "अभिभावक बातचीत दर्ज करते समय चिह्नित फ़ॉलो-अप इस पेज पर दिखते हैं।",
  "From *": "से *",
  "From PTM": "बैठक से",
  "Half day only": "केवल आधा दिन",
  "How": "कैसे",
  "Kind of leave *": "छुट्टी का प्रकार *",
  "Kind": "प्रकार",
  "Leave blank for a single day": "एक दिन के लिए ख़ाली छोड़ें",
  "Mentor's action": "मेंटर की कार्रवाई",
  "No flagged children here": "यहाँ कोई चिह्नित बच्चा नहीं",
  "No leave requested yet": "अभी कोई छुट्टी नहीं माँगी",
  "Normal only": "केवल सामान्य",
  "Not closed yet": "अभी बंद नहीं",
  "Nothing done yet": "अभी कुछ नहीं हुआ",
  "Nothing here": "यहाँ कुछ नहीं",
  "Nothing waiting": "कुछ प्रतीक्षा में नहीं",
  "Office:": "कार्यालय:",
  "Open in total": "कुल खुले",
  "Past the promised date": "वादे की तारीख़ बीत चुकी",
  "Pending": "प्रतीक्षित",
  "Reason *": "कारण *",
  "Seen by the administrator who answers it": "जवाब देने वाले प्रशासक को दिखता है",
  "Send request": "आवेदन भेजें",
  "Stage": "चरण",
  "The office approves or refuses it. Until then your register is untouched.": "कार्यालय इसे स्वीकार या अस्वीकार करता है। तब तक आपका रजिस्टर अछूता रहता है।",
  "Times flagged": "कितनी बार चिह्नित",
  "Until": "तक",
  "Urgent only": "केवल अत्यावश्यक",
  "Urgent, still open": "अत्यावश्यक, अब भी खुले",
  "Why, and who flagged it": "क्यों, और किसने चिह्नित किया",
  "Withdraw": "वापस लें",
  "children with an earlier referral too": "जिन बच्चों का पहले भी रेफ़रल है",
  "flagged student": "चिह्नित बच्चा",
  "matching these filters": "इन फ़िल्टर से मेल खाते",
  "next 7 days": "अगले 7 दिन",
  "promised date has gone by": "वादे की तारीख़ बीत चुकी है",
  "referral": "रेफ़रल",
  "{n} request with the office": "कार्यालय के पास {n} आवेदन",
  "{n} requests with the office": "कार्यालय के पास {n} आवेदन",
  "Casual leave": "आकस्मिक छुट्टी",
  "Sick leave": "बीमारी की छुट्टी",
  "Emergency": "आपातकाल",
  "Planned / personal": "पूर्व-नियोजित / निजी",
  "Unpaid leave": "बिना वेतन छुट्टी",
  "Awaiting approval": "स्वीकृति की प्रतीक्षा",
  "Approved": "स्वीकृत",
  "Rejected": "अस्वीकृत",
  "Commitments made to parents during a PTM": "बैठक में अभिभावकों से किए गए वादे",
  "still pending": "अब भी बाक़ी",
  "in this period": "इस अवधि में",
  "What happened?": "क्या हुआ?",
  "Done": "हो गया",
  "Reopen": "फिर से खोलें",
  "Unassigned": "किसी को नहीं सौंपा",

  /* --- parent meetings --------------------------------------------------- */
  "1 = not confident, 5 = very confident":
    "1 = भरोसा नहीं, 5 = पूरा भरोसा",
  "1. Admission Number":
    "1. दाख़िला नंबर",
  "2. Student Name *":
    "2. बच्चे का नाम *",
  "3. Learning Centre *":
    "3. शिक्षण केंद्र *",
  "4. Grade":
    "4. कक्षा",
  "5. Date of Interaction *":
    "5. बातचीत की तारीख़ *",
  "6. PTM Mentor Name *":
    "6. बैठक करने वाले मेंटर का नाम *",
  "7. Mode of Interaction *":
    "7. बातचीत का तरीक़ा *",
  "8. Who attended? *":
    "8. कौन आया? *",
  "9. Parent Engagement Level *":
    "9. अभिभावक की भागीदारी *",
  "10. What were the key concerns discussed? (Select all that apply) *":
    "10. किन मुख्य बातों पर चर्चा हुई? (जो भी लागू हों चुनें) *",
  "11. Brief Notes":
    "11. संक्षिप्त टिप्पणी",
  "12. What commitments did the parent make? *":
    "12. अभिभावक ने क्या वादे किए? *",
  "13. Additional Commitment Notes":
    "13. वादों के बारे में और टिप्पणी",
  "14. Is a follow-up needed? *":
    "14. क्या फ़ॉलो-अप चाहिए? *",
  "15. Follow-up Priority *":
    "15. फ़ॉलो-अप की प्राथमिकता *",
  "16. Next Follow-up Date *":
    "16. अगले फ़ॉलो-अप की तारीख़ *",
  "17. Follow-up Owner":
    "17. फ़ॉलो-अप किसका",
  "18. How confident do you feel about this family’s progress? *":
    "18. इस परिवार की प्रगति पर आपको कितना भरोसा है? *",
  "19. Any support needed from the Freepathshala team?":
    "19. फ़्रीपाठशाला टीम से कोई मदद चाहिए?",
  "Ad-hoc interaction":
    "अलग से हुई बातचीत",
  "Agenda":
    "कार्यसूची",
  "All engagement":
    "सभी भागीदारी",
  "All {n} of them. Pick another day above to check that one.":
    "सभी {n}। ऊपर से कोई और दिन चुनकर देखें।",
  "Assign the follow-up to":
    "फ़ॉलो-अप किसे सौंपें",
  "Attend next PTM":
    "अगली बैठक में आएँ",
  "Attentive":
    "ध्यान देने वाले",
  "Behaviour":
    "व्यवहार",
  "Both parents came":
    "माता-पिता दोनों आए",
  "Centre Teacher":
    "केंद्र के शिक्षक",
  "Children expected":
    "अपेक्षित बच्चे",
  "Choose a student to see their results.":
    "नतीजे देखने के लिए बच्चा चुनें।",
  "Commitments and follow-up":
    "वादे और फ़ॉलो-अप",
  "Complete admission-related tasks":
    "दाख़िले से जुड़े काम पूरे करें",
  "Completed, nothing recorded":
    "पूरा हुआ, कुछ दर्ज नहीं",
  "Concerns":
    "चिंताएँ",
  "Concerns discussed":
    "जिन बातों पर चर्चा हुई",
  "Concerns: last 30 days":
    "चिंताएँ: पिछले 30 दिन",
  "Concerns: last 7 days":
    "चिंताएँ: पिछले 7 दिन",
  "Concerns: last 90 days":
    "चिंताएँ: पिछले 90 दिन",
  "Confidence":
    "भरोसा",
  "Confidence in progress":
    "प्रगति पर भरोसा",
  "Counsellor":
    "काउंसलर",
  "Details":
    "विवरण",
  "Each day's meetings, by who came to them":
    "हर दिन की बैठकें, कौन आया उसके हिसाब से",
  "Engagement":
    "भागीदारी",
  "Ensure regular attendance":
    "नियमित उपस्थिति सुनिश्चित करें",
  "Every PTM day was written up":
    "हर बैठक-दिवस लिखा गया",
  "Every family expected that day was seen":
    "उस दिन जिन परिवारों से मिलना था, सबसे मिले",
  "Every meeting on {d}":
    "{d} की सभी बैठकें",
  "Father came":
    "पिता आए",
  "Fills automatically":
    "अपने आप भर जाता है",
  "Financial Challenges":
    "आर्थिक कठिनाइयाँ",
  "Follow-up":
    "फ़ॉलो-अप",
  "Follow-up owner":
    "फ़ॉलो-अप किसका",
  "Follow-ups promised":
    "वादा किए गए फ़ॉलो-अप",
  "Guardian came":
    "अभिभावक आए",
  "Health":
    "स्वास्थ्य",
  "High (within one week)":
    "ज़रूरी (एक सप्ताह में)",
  "Homework Support":
    "गृहकार्य में मदद",
  "How it went":
    "कैसा रहा",
  "If “Other”, what was it?":
    "अगर “अन्य”, तो क्या?",
  "Inform Freepathshala before relocation":
    "जगह बदलने से पहले फ़्रीपाठशाला को बताएँ",
  "Interaction":
    "बातचीत",
  "Interaction recorded.":
    "बातचीत दर्ज हो गई।",
  "Keep with me":
    "अपने पास रखें",
  "Last 30 days":
    "पिछले 30 दिन",
  "Last sat down with":
    "आख़िरी बार कब बैठे",
  "Learning Progress":
    "पढ़ाई की प्रगति",
  "Leave blank for all classes":
    "सभी कक्षाओं के लिए ख़ाली छोड़ें",
  "Low (next PTM)":
    "कम (अगली बैठक में)",
  "Marked as":
    "किस रूप में दर्ज",
  "Medium (within one month)":
    "मध्यम (एक महीने में)",
  "Meeting was on":
    "बैठक की तारीख़",
  "Meetings can still be recorded — a PTM day only sets the expectation.":
    "बैठकें फिर भी दर्ज हो सकती हैं — बैठक-दिवस सिर्फ़ अपेक्षा तय करता है।",
  "Meetings held":
    "हुई बैठकें",
  "Meetings held, against the children on each centre's roll":
    "हुई बैठकें, हर केंद्र के रजिस्टर के बच्चों के मुक़ाबले",
  "Mode":
    "तरीक़ा",
  "Monitor school progress":
    "स्कूल की प्रगति पर नज़र रखें",
  "Mother came":
    "माता आईं",
  "Never met":
    "कभी नहीं मिले",
  "No PTM day scheduled for today":
    "आज के लिए कोई बैठक-दिवस तय नहीं",
  "No PTMs scheduled":
    "कोई बैठक तय नहीं",
  "No day in the diary over the last {n} days passed without a meeting recorded against it.":
    "पिछले {n} दिनों में डायरी का कोई दिन ऐसा नहीं गया जिस पर बैठक दर्ज न हुई हो।",
  "No follow-up required":
    "फ़ॉलो-अप की ज़रूरत नहीं",
  "No meetings recorded that day":
    "उस दिन कोई बैठक दर्ज नहीं",
  "No test marks recorded for this student yet.":
    "इस बच्चे के अभी कोई टेस्ट अंक दर्ज नहीं।",
  "Nobody was expected that day":
    "उस दिन किसी से मिलना तय नहीं था",
  "None recorded.":
    "कुछ दर्ज नहीं।",
  "Not required":
    "ज़रूरत नहीं",
  "Nothing recorded":
    "कुछ दर्ज नहीं",
  "Nothing recorded yet":
    "अभी कुछ दर्ज नहीं",
  "Nothing was entered on this day":
    "इस दिन कुछ दर्ज नहीं हुआ",
  "Open the full progress report →":
    "पूरी प्रगति रिपोर्ट खोलें →",
  "Optional":
    "वैकल्पिक",
  "Optional — leave blank to keep it yourself":
    "वैकल्पिक — अपने पास रखने के लिए ख़ाली छोड़ें",
  "Overall":
    "कुल मिलाकर",
  "PTM Mentor Interaction":
    "मेंटर की अभिभावक बातचीत",
  "PTM dashboard":
    "बैठक डैशबोर्ड",
  "PTM days in the diary today":
    "आज डायरी में बैठक-दिवस",
  "PTM details":
    "बैठक का विवरण",
  "PTM interactions":
    "अभिभावक बातचीत",
  "Parent":
    "अभिभावक",
  "Parent Employment":
    "अभिभावक का रोज़गार",
  "Parents":
    "अभिभावक",
  "Parents engaged":
    "भागीदार अभिभावक",
  "Part of":
    "किसका हिस्सा",
  "Part of a scheduled PTM":
    "किसी तय बैठक का हिस्सा",
  "Pick a centre first":
    "पहले केंद्र चुनें",
  "Pick another day above, or open All interactions.":
    "ऊपर से कोई और दिन चुनें, या सभी बातचीत खोलें।",
  "Principal":
    "प्रधानाचार्य",
  "Priority":
    "प्राथमिकता",
  "Progress so far":
    "अब तक की प्रगति",
  "Record what was discussed with a parent, and the follow-up it needs.":
    "अभिभावक से क्या बात हुई और आगे क्या करना है, दर्ज करें।",
  "Recorded":
    "दर्ज किया",
  "Recorded so far":
    "अब तक दर्ज",
  "Relocation":
    "जगह बदलना",
  "Resistant":
    "अनिच्छुक",
  "Same Mentor":
    "वही मेंटर",
  "Save interaction":
    "बातचीत सहेजें",
  "Schedule a PTM day so mentors can log each parent conversation against it.":
    "बैठक-दिवस तय करें ताकि मेंटर हर अभिभावक बातचीत उसके साथ दर्ज कर सकें।",
  "Scheduled PTMs":
    "तय बैठकें",
  "School Admission":
    "स्कूल में दाख़िला",
  "Search student or mentor":
    "बच्चा या मेंटर खोजें",
  "Select student":
    "बच्चा चुनें",
  "Student Attendance":
    "बच्चे की उपस्थिति",
  "Student profile":
    "बच्चे का विवरण",
  "Summarise the discussion in 2–3 sentences.":
    "चर्चा को 2–3 वाक्यों में लिखें।",
  "Support homework at home":
    "घर पर गृहकार्य में मदद करें",
  "Support needed from the team":
    "टीम से चाहिए मदद",
  "The interaction is recorded on its own — nothing will appear on the follow-ups list.":
    "बातचीत अपने आप में दर्ज होगी — फ़ॉलो-अप सूची में कुछ नहीं आएगा।",
  "The mentor recorded that nothing was left outstanding after this conversation.":
    "मेंटर ने दर्ज किया कि इस बातचीत के बाद कुछ बाक़ी नहीं रहा।",
  "This is the day's work at the keyboard, not the meetings held that day — a mentor who wrote nothing up appears here as empty.":
    "यह उस दिन कीबोर्ड पर हुआ काम है, उस दिन हुई बैठकें नहीं — जिस मेंटर ने कुछ नहीं लिखा, वह यहाँ ख़ाली दिखता है।",
  "This list fills once a PTM day is in the diary for a centre, or a meeting is recorded there.":
    "जैसे ही किसी केंद्र के लिए बैठक-दिवस डायरी में आता है, या वहाँ बैठक दर्ज होती है, यह सूची भरने लगती है।",
  "This record belongs to another centre.":
    "यह रिकॉर्ड किसी दूसरे केंद्र का है।",
  "Time":
    "समय",
  "Title":
    "शीर्षक",
  "To":
    "तक",
  "Video Call":
    "वीडियो कॉल",
  "What happened when you called or visited":
    "फ़ोन या मुलाक़ात पर क्या हुआ",
  "What was planned":
    "क्या तय था",
  "Who attended":
    "कौन आया",
  "Who came":
    "कौन आया",
  "Who came, and on what number":
    "कौन आया, और कितने",
  "Written up by":
    "किसने लिखा",
  "Yes — something was promised":
    "हाँ — कुछ वादा हुआ है",
  "day after →":
    "अगला दिन →",
  "interaction":
    "बातचीत",
  "neither parent":
    "माता-पिता में से कोई नहीं",
  "next day":
    "अगले दिन",
  "none recorded":
    "कुछ दर्ज नहीं",
  "on her own":
    "अकेली",
  "on his own":
    "अकेले",
  "same day":
    "उसी दिन",
  "{a} neutral · {b} resistant":
    "{a} सामान्य · {b} अनिच्छुक",
  "{how} on {d}":
    "{d} को {how}",
  "{n} centre":
    "{n} केंद्र",
  "{n} centres":
    "{n} केंद्र",
  "{n} children":
    "{n} बच्चे",
  "{n} days later":
    "{n} दिन बाद",
  "{n} needed none":
    "{n} को ज़रूरत नहीं थी",
  "{n} of 5":
    "5 में से {n}",
  "{pct}% ({present} of {marked} days)":
    "{pct}% ({marked} में से {present} दिन)",
  "{s} of meetings":
    "बैठकों का {s}",
  "{who} (me)":
    "{who} (मैं)",
};

export default hi;
