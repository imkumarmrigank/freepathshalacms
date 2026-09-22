-- The audit form in Hindi as well as English. The auditor reads both; the
-- answer that is stored — a band, a reason — stays the English wording, so every
-- report and score reads exactly as before.
ALTER TABLE audit_criteria
  ADD COLUMN IF NOT EXISTS section_hi     TEXT,
  ADD COLUMN IF NOT EXISTS title_hi       TEXT,
  ADD COLUMN IF NOT EXISTS question_hi    TEXT,
  ADD COLUMN IF NOT EXISTS band_labels_hi TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reasons_hi     TEXT[] NOT NULL DEFAULT '{}';

-- Translations for the starting checklist. Each part is filled only where the
-- English is still the seeded wording and no Hindi has been written yet — a
-- question the super admin has reworded keeps no translation rather than a
-- wrong one.

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Children' AND section_hi IS NULL THEN 'बच्चे' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'उपस्थिति' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'How was today''s attendance?' AND question_hi IS NULL THEN 'आज की उपस्थिति कैसी रही?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['90% or more of the roll present','75–89% present','50–74% present','Below 50% present']::text[] AND band_labels_hi = '{}' THEN ARRAY['रजिस्टर के 90% या अधिक बच्चे उपस्थित','75–89% उपस्थित','50–74% उपस्थित','50% से कम उपस्थित']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Children absent regularly','Late arrival','Family or work reasons','Weather or local issue','Centre timing issue','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['बच्चे अक्सर अनुपस्थित रहते हैं','देर से आना','परिवार या काम की वजह','मौसम या स्थानीय समस्या','केंद्र के समय की समस्या','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Attendance';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Children' AND section_hi IS NULL THEN 'बच्चे' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'समय की पाबंदी' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Did children arrive and settle on time?' AND question_hi IS NULL THEN 'क्या बच्चे समय पर आए और बैठ गए?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Nearly all on time','A few latecomers','Many arrived late','Class started very late']::text[] AND band_labels_hi = '{}' THEN ARRAY['लगभग सभी समय पर','कुछ बच्चे देर से आए','कई बच्चे देर से आए','कक्षा बहुत देर से शुरू हुई']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Distance from home','Parents'' work hours','Weather or local issue','No reminder from centre','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['घर से दूरी','माता-पिता के काम का समय','मौसम या स्थानीय समस्या','केंद्र की ओर से याद नहीं दिलाया गया','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Punctuality';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Children' AND section_hi IS NULL THEN 'बच्चे' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'स्वच्छता' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'How well did children follow hygiene practices?' AND question_hi IS NULL THEN 'बच्चों ने स्वच्छता के नियमों का कितना पालन किया?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Clean, handwashing followed','Mostly followed','Followed by some','Not followed']::text[] AND band_labels_hi = '{}' THEN ARRAY['साफ़-सुथरे, हाथ धोने का पालन','ज़्यादातर पालन','कुछ ही बच्चों ने पालन किया','पालन नहीं हुआ']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['No water or soap','Not taught recently','No routine in place','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['पानी या साबुन नहीं','हाल में सिखाया नहीं गया','कोई नियमित आदत नहीं','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Hygiene';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Centre' AND section_hi IS NULL THEN 'केंद्र' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'केंद्र खुलना' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'How was the centre when class started?' AND question_hi IS NULL THEN 'कक्षा शुरू होते समय केंद्र की स्थिति कैसी थी?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Open on time, ready','Open, some setting up left','Opened late','Not open at the stated time']::text[] AND band_labels_hi = '{}' THEN ARRAY['समय पर खुला, पूरी तैयारी','खुला, कुछ तैयारी बाकी','देर से खुला','तय समय पर खुला ही नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Teacher arrived late','Key or access problem','Cleaning not done','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['शिक्षक देर से आए','चाबी या प्रवेश की समस्या','सफ़ाई नहीं हुई','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Opening';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Centre' AND section_hi IS NULL THEN 'केंद्र' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'साफ़-सफ़ाई' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Was the teaching space clean and usable?' AND question_hi IS NULL THEN 'क्या पढ़ाई की जगह साफ़ और इस्तेमाल लायक थी?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Clean and tidy throughout','Broadly clean','Visibly dirty in places','Unfit to teach in']::text[] AND band_labels_hi = '{}' THEN ARRAY['हर जगह साफ़-सुथरी','कुल मिलाकर साफ़','कहीं-कहीं साफ़ तौर पर गंदी','पढ़ाने लायक नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['No cleaning staff','Materials left out','Waterlogging or dust','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['सफ़ाई कर्मचारी नहीं','सामान बिखरा पड़ा','पानी भराव या धूल','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Cleanliness';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Centre' AND section_hi IS NULL THEN 'केंद्र' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'सुरक्षा' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Is the space safe for children?' AND question_hi IS NULL THEN 'क्या जगह बच्चों के लिए सुरक्षित है?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['No hazards seen','Minor hazards, easily fixed','Real hazards present','Unsafe — children at risk']::text[] AND band_labels_hi = '{}' THEN ARRAY['कोई खतरा नहीं दिखा','छोटे खतरे, आसानी से ठीक होने वाले','असली खतरे मौजूद','असुरक्षित — बच्चों को खतरा']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Exposed wiring','Broken furniture','Unsafe entry or stairs','Open water or drain','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['खुले बिजली के तार','टूटा फ़र्नीचर','असुरक्षित प्रवेश या सीढ़ियाँ','खुला पानी या नाली','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Safety';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Learning' AND section_hi IS NULL THEN 'पढ़ाई' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'पढ़ाई चल रही थी' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Was teaching actually happening during the visit?' AND question_hi IS NULL THEN 'क्या भ्रमण के दौरान सच में पढ़ाई हो रही थी?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Full class engaged','Teaching on, some children idle','Little teaching seen','No teaching happening']::text[] AND band_labels_hi = '{}' THEN ARRAY['पूरी कक्षा पढ़ाई में लगी','पढ़ाई चल रही, कुछ बच्चे खाली','बहुत कम पढ़ाई दिखी','कोई पढ़ाई नहीं हो रही थी']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Teacher absent','No plan prepared','Children unsettled','Materials missing','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['शिक्षक अनुपस्थित','कोई योजना तैयार नहीं','बच्चे बेचैन','सामग्री नहीं','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Teaching in progress';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Learning' AND section_hi IS NULL THEN 'पढ़ाई' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'शिक्षण योजना का पालन' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Was the day''s teaching plan being followed?' AND question_hi IS NULL THEN 'क्या आज की शिक्षण योजना के अनुसार पढ़ाया जा रहा था?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Followed and up to date','Followed loosely','Plan exists but not followed','No plan for the day']::text[] AND band_labels_hi = '{}' THEN ARRAY['पालन हुआ और योजना अद्यतन है','थोड़ा-बहुत पालन','योजना है पर पालन नहीं','आज की कोई योजना नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Plan not written','Teacher new to the class','Syllabus behind','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['योजना लिखी नहीं गई','शिक्षक कक्षा में नए हैं','पाठ्यक्रम पीछे चल रहा है','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Teaching plan followed';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Learning' AND section_hi IS NULL THEN 'पढ़ाई' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'मदद की ज़रूरत वाले बच्चे' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Were children needing support identified and helped?' AND question_hi IS NULL THEN 'क्या मदद की ज़रूरत वाले बच्चों को पहचाना गया और उनकी मदद हुई?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Identified and being helped','Identified, help not started','Not identified','Struggling children ignored']::text[] AND band_labels_hi = '{}' THEN ARRAY['पहचाने गए और मदद हो रही है','पहचाने गए, मदद शुरू नहीं','पहचाने नहीं गए','कमज़ोर बच्चों को नज़रअंदाज़ किया गया']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Class too large','No assessment done','Teacher unaware','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['कक्षा बहुत बड़ी','कोई आकलन नहीं हुआ','शिक्षक को जानकारी नहीं','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Children needing support';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Teacher' AND section_hi IS NULL THEN 'शिक्षक' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'शिक्षक की उपस्थिति' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Were the expected teachers present?' AND question_hi IS NULL THEN 'क्या अपेक्षित शिक्षक उपस्थित थे?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['All present','One absent, covered','One absent, not covered','More than one absent']::text[] AND band_labels_hi = '{}' THEN ARRAY['सभी उपस्थित','एक अनुपस्थित, उनकी जगह कोई था','एक अनुपस्थित, उनकी जगह कोई नहीं','एक से अधिक अनुपस्थित']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Illness','Leave not informed','Cover not arranged','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['बीमारी','छुट्टी की सूचना नहीं दी','किसी और की व्यवस्था नहीं हुई','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Teacher presence';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Teacher' AND section_hi IS NULL THEN 'शिक्षक' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'रिकॉर्ड अद्यतन' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Are the register and records current?' AND question_hi IS NULL THEN 'क्या रजिस्टर और रिकॉर्ड अद्यतन हैं?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['All current','A day or two behind','More than a week behind','Not maintained']::text[] AND band_labels_hi = '{}' THEN ARRAY['सब अद्यतन','एक-दो दिन पीछे','एक हफ़्ते से ज़्यादा पीछे','रखे ही नहीं जाते']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Teacher unfamiliar with system','No phone or network','Time pressure','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['शिक्षक सिस्टम से परिचित नहीं','फ़ोन या नेटवर्क नहीं','समय की कमी','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Records up to date';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Teacher' AND section_hi IS NULL THEN 'शिक्षक' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'बच्चों के साथ व्यवहार' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'How did staff speak to and handle children?' AND question_hi IS NULL THEN 'कर्मचारी बच्चों से कैसे बात और व्यवहार करते हैं?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Warm and encouraging','Correct but distant','Sharp or dismissive','Harsh — needs intervention']::text[] AND band_labels_hi = '{}' THEN ARRAY['स्नेहपूर्ण और प्रोत्साहित करने वाला','ठीक, पर दूरी वाला','रूखा या अनदेखी करने वाला','कठोर — हस्तक्षेप ज़रूरी']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Class overcrowded','Staff under strain','Needs training','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['कक्षा में बहुत भीड़','कर्मचारियों पर दबाव','प्रशिक्षण की ज़रूरत','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Conduct with children';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Facilities' AND section_hi IS NULL THEN 'सुविधाएँ' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'पीने का पानी' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Was safe drinking water available?' AND question_hi IS NULL THEN 'क्या पीने का सुरक्षित पानी उपलब्ध था?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Available and clean','Available, storage poor','Available irregularly','Not available']::text[] AND band_labels_hi = '{}' THEN ARRAY['उपलब्ध और साफ़','उपलब्ध, पर रखने की व्यवस्था खराब','कभी-कभी उपलब्ध','उपलब्ध नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Supply failure','No storage vessel','Not refilled','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['आपूर्ति बंद','रखने का बर्तन नहीं','दोबारा भरा नहीं गया','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Drinking water';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Facilities' AND section_hi IS NULL THEN 'सुविधाएँ' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'शौचालय' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Was a usable toilet available?' AND question_hi IS NULL THEN 'क्या इस्तेमाल लायक शौचालय उपलब्ध था?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Clean and usable','Usable, needs cleaning','Barely usable','Not usable or not available']::text[] AND band_labels_hi = '{}' THEN ARRAY['साफ़ और इस्तेमाल लायक','इस्तेमाल लायक, सफ़ाई चाहिए','मुश्किल से इस्तेमाल लायक','इस्तेमाल लायक नहीं या उपलब्ध नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['No water','Not cleaned','Broken or locked','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['पानी नहीं','सफ़ाई नहीं हुई','टूटा हुआ या बंद','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Toilet';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Facilities' AND section_hi IS NULL THEN 'सुविधाएँ' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'पढ़ाई की सामग्री' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Were books and materials sufficient?' AND question_hi IS NULL THEN 'क्या किताबें और सामग्री पर्याप्त थीं?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Sufficient for every child','Enough to share','Short for the class','Largely missing']::text[] AND band_labels_hi = '{}' THEN ARRAY['हर बच्चे के लिए पर्याप्त','मिल-बाँटकर चलाने लायक','कक्षा के लिए कम','ज़्यादातर नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Stock not dispatched','Damaged or lost','Numbers grew','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['सामान भेजा नहीं गया','खराब या खो गया','बच्चों की संख्या बढ़ गई','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Teaching materials';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Community' AND section_hi IS NULL THEN 'समुदाय' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'अभिभावकों से संपर्क' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Is the centre keeping parents engaged?' AND question_hi IS NULL THEN 'क्या केंद्र अभिभावकों को जोड़े रख रहा है?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Regular contact, PTMs held','Some contact','Little contact','No contact']::text[] AND band_labels_hi = '{}' THEN ARRAY['नियमित संपर्क, PTM होती हैं','कुछ संपर्क','बहुत कम संपर्क','कोई संपर्क नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Parents work long hours','No follow-up done','Language barrier','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['अभिभावक देर तक काम करते हैं','फ़ॉलो-अप नहीं हुआ','भाषा की दिक्कत','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Parent contact';

UPDATE audit_criteria SET
  section_hi     = CASE WHEN section = 'Community' AND section_hi IS NULL THEN 'समुदाय' ELSE section_hi END,
  title_hi       = CASE WHEN title_hi IS NULL THEN 'पढ़ाई छोड़ने वालों का फ़ॉलो-अप' ELSE title_hi END,
  question_hi    = CASE WHEN question = 'Are absent and dropped-out children being chased?' AND question_hi IS NULL THEN 'क्या अनुपस्थित और पढ़ाई छोड़ चुके बच्चों से संपर्क किया जा रहा है?' ELSE question_hi END,
  band_labels_hi = CASE WHEN band_labels = ARRAY['Followed up and recorded','Followed up informally','Rarely followed up','Not followed up']::text[] AND band_labels_hi = '{}' THEN ARRAY['फ़ॉलो-अप हुआ और दर्ज है','अनौपचारिक रूप से फ़ॉलो-अप','कभी-कभार फ़ॉलो-अप','फ़ॉलो-अप नहीं']::text[] ELSE band_labels_hi END,
  reasons_hi     = CASE WHEN reasons = ARRAY['Family moved','No contact number','No time','Other']::text[] AND reasons_hi = '{}' THEN ARRAY['परिवार कहीं और चला गया','संपर्क नंबर नहीं','समय नहीं','अन्य']::text[] ELSE reasons_hi END
WHERE title = 'Dropout follow-up';
