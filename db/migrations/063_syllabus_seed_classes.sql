-- Seed syllabus units and items for Classes 2, 3, 4, Nursery and KG
-- into the existing syllabus_units / syllabus_items tables.
-- Session 2 = 2026-27 (current session).
-- Class level IDs: 1=Class1, 2=Class2, 3=Class3, 4=Class4, 13=Nursery, 14=KG

-- Also drop the redundant tables created by migration 062 (different schema,
-- superseded by the existing syllabus_units/items system).
DROP TABLE IF EXISTS syllabus_completions;
DROP TABLE IF EXISTS syllabus_topics;

-- ─────────────────────────────────────────── HELPER: insert unit + items
-- We use a DO block so we can capture the inserted unit id and reuse it.

DO $$
DECLARE u BIGINT;
BEGIN

-- ════════════════════════════════════════════════════════ Hindi Class 2

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Hindi',1,'माह 1 – पाठ 1 से 3') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 1 – नीमा की दादी'),(u,2,'पाठ 2 – घर'),(u,3,'पाठ 3 – माला की चाँदी की पायल'),
  (u,4,'कठिन शब्द एवं शब्दार्थ'),(u,5,'प्रश्न–उत्तर'),(u,6,'सही/गलत, रिक्त स्थान'),
  (u,7,'विलोम शब्द, संज्ञा, वाक्य बनाओ, श्रुतलेख');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Hindi',2,'माह 2 – पाठ 4 से 6') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 4 – माँ'),(u,2,'पाठ 5 – थाथू और मैं'),(u,3,'पाठ 6 – चींटा'),
  (u,4,'कठिन शब्द एवं शब्दार्थ'),(u,5,'प्रश्न–उत्तर'),
  (u,6,'पर्यायवाची, लिंग बदलो'),(u,7,'एकवचन–बहुवचन, श्रुतलेख');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Hindi',3,'माह 3 – पाठ 7 से 9') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 7 – टिल्लू जी'),(u,2,'पाठ 8 – तीन दोस्त'),(u,3,'पाठ 9 – दुनिया रंग-बिरंगी'),
  (u,4,'कठिन शब्द एवं शब्दार्थ'),(u,5,'प्रश्न–उत्तर'),
  (u,6,'विलोम, पर्यायवाची शब्द'),(u,7,'रिक्त स्थान, वाक्य बनाओ, श्रुतलेख');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Hindi',4,'माह 4 – पाठ 10 से 11 + पुनरावृत्ति') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 10 – कौन'),(u,2,'पाठ 11 – बैंगनी जोजो'),
  (u,3,'लेखन कार्य – मेरा विद्यालय, प्रार्थना-पत्र'),
  (u,4,'वाक्य बनाओ, संज्ञा'),(u,5,'लिंग, वचन'),
  (u,6,'संपूर्ण पाठ्यक्रम की पुनरावृत्ति'),(u,7,'श्रुतलेख, अभ्यास एवं Assessment');

-- ════════════════════════════════════════════════════════ Hindi Class 3

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Hindi',1,'माह 1 – पाठ 1 से 3') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 1 – सीखो'),(u,2,'पाठ 2 – चींटी'),(u,3,'पाठ 3 – कितने पैर?'),
  (u,4,'पाठ वाचन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर, रिक्त स्थान'),
  (u,6,'संज्ञा – परिभाषा एवं उदाहरण, एकवचन–बहुवचन'),
  (u,7,'विलोम शब्द, वाक्य बनाओ, मासिक मूल्यांकन');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Hindi',2,'माह 2 – पाठ 4 से 6') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 4 – बया हमारी चिड़िया रानी!'),(u,2,'पाठ 5 – आम का पेड़'),(u,3,'पाठ 6 – बीरबल की खिचड़ी'),
  (u,4,'पाठ वाचन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर, रिक्त स्थान'),
  (u,6,'पर्यायवाची शब्द, लिंग बदलो'),(u,7,'सर्वनाम, एकवचन–बहुवचन, मासिक मूल्यांकन');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Hindi',3,'माह 3 – पाठ 7 से 9') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 7 – मित्र को पत्र'),(u,2,'पाठ 8 – चतुर गीदड़'),(u,3,'पाठ 9 – प्रकृति पर्व – फूलदेई'),
  (u,4,'पाठ वाचन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर, रिक्त स्थान'),
  (u,6,'विलोम एवं पर्यायवाची शब्द'),(u,7,'लिंग, वचन, वाक्य बनाओ, निबंध, मासिक मूल्यांकन');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Hindi',4,'माह 4 – पाठ 10 से 11 + पुनरावृत्ति') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 10 – रस्साकशी'),(u,2,'पाठ 11 – एक जादुई पिटारा'),
  (u,3,'लेखन एवं रचनात्मक कार्य – गाय पर निबंध, पत्र'),
  (u,4,'संज्ञा एवं सर्वनाम का अभ्यास'),(u,5,'लिंग एवं वचन'),
  (u,6,'संपूर्ण पुनरावृत्ति पाठ 1–11'),(u,7,'व्याकरण, श्रुतलेख, मूल्यांकन');

-- ════════════════════════════════════════════════════════ Hindi Class 4

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Hindi',1,'माह 1 – पाठ 1 से 3') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 1 – चिड़िया का गीत'),(u,2,'पाठ 2 – बगीचे का घोंघा'),(u,3,'पाठ 3 – नीम'),
  (u,4,'पाठ का पठन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर'),
  (u,6,'विलोम शब्द, पर्यायवाची शब्द, लिंग परिवर्तन'),
  (u,7,'एकवचन–बहुवचन, विशेषण का परिचय; मासिक पुनरावृत्ति');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Hindi',2,'माह 2 – पाठ 4 से 6') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 4 – हमारा आहार'),(u,2,'पाठ 5 – आसमान गिरा'),(u,3,'पाठ 6 – जयपुर से पत्र'),
  (u,4,'पाठ का पठन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर, वाक्य निर्माण'),
  (u,6,'लिंग, वचन, विलोम, पर्यायवाची, विशेषण एवं क्रिया'),
  (u,7,'प्रार्थना-पत्र एवं अनुच्छेद लेखन');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Hindi',3,'माह 3 – पाठ 7 से 9') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 7 – नकली हीरे'),(u,2,'पाठ 8 – ओणम के रंग'),(u,3,'पाठ 9 – मिठाइयों का सम्मेलन'),
  (u,4,'पाठ का पठन, कठिन शब्द, शब्दार्थ'),(u,5,'प्रश्न–उत्तर, वाक्य निर्माण'),
  (u,6,'विशेषण, क्रिया, लिंग, वचन'),(u,7,'कहानी लेखन, अनुच्छेद लेखन, मेरा विद्यालय');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Hindi',4,'माह 4 – पाठ 10 से 11 + पुनरावृत्ति') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'पाठ 10 – कैमरा'),(u,2,'पाठ 11 – कविता का कमाल'),
  (u,3,'व्याकरण पुनरावृत्ति – विलोम, पर्यायवाची, लिंग, एकवचन–बहुवचन'),
  (u,4,'विशेषण एवं क्रिया की पुनरावृत्ति'),(u,5,'प्रार्थना-पत्र, पत्र लेखन'),
  (u,6,'अनुच्छेद लेखन, कहानी लेखन, मेरा विद्यालय'),
  (u,7,'चार माह के पाठ्यक्रम का मूल्यांकन');

-- ════════════════════════════════════════════════════════ Maths Class 2

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Mathematics',1,'Numbers and Number Sense') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Numbers up to 100, number names'),(u,2,'Counting forward and backward; before, after, between'),
  (u,3,'Ascending and descending order; comparing numbers (>, <, =)'),
  (u,4,'Ones and Tens; number formation'),(u,5,'Introduction to addition using objects and pictures');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Mathematics',2,'Addition and Subtraction') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Addition up to 100 – without and with carrying'),
  (u,2,'Subtraction up to 100 – without and with borrowing'),
  (u,3,'Word problems – addition and subtraction'),(u,4,'Mental Maths; number patterns');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Mathematics',3,'Multiplication, Division, Measurement and Time') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Multiplication as repeated addition; tables of 2, 3, 5 and 10'),
  (u,2,'Simple multiplication sums and word problems'),
  (u,3,'Introduction to division; equal sharing; word problems'),
  (u,4,'Measurement – long/short, heavy/light, more/less'),
  (u,5,'Time – hours and half hours; days of the week; months of the year');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,2,'Mathematics',4,'Shapes, Money and Revision') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'2-D shapes – Circle, Square, Triangle, Rectangle; sides and corners'),
  (u,2,'Introduction to 3-D shapes'),(u,3,'Money – Rupees and Paise; coins and notes'),
  (u,4,'Revision of measurement, time, addition, subtraction, multiplication, division'),
  (u,5,'Patterns, Mental Maths, word problems');

-- ════════════════════════════════════════════════════════ Maths Class 3

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Mathematics',1,'Numbers and Addition') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Numbers up to 500 and beyond; number names'),
  (u,2,'Place Value – Ones, Tens, Hundreds; expanded form'),
  (u,3,'Ascending and Descending Order'),(u,4,'Addition of 3-digit numbers with carry'),
  (u,5,'Simple addition word problems; Mental Maths');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Mathematics',2,'Subtraction, Multiplication and Division') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Subtraction of 3-digit numbers with borrowing; word problems'),
  (u,2,'Multiplication as repeated addition; tables from 2 to 15'),
  (u,3,'Simple multiplication sums and word problems'),
  (u,4,'Introduction to Division; simple division sums and word problems');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Mathematics',3,'Shapes, Measurement, Fractions and Time') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Basic shapes; measurement of length, weight, capacity'),
  (u,2,'Introduction to Fractions – equal parts, half and quarter'),
  (u,3,'Reading time from a clock; hours and minutes'),
  (u,4,'Days of the week, months of the year; reading and using a calendar');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,3,'Mathematics',4,'Money, Data Handling and Revision') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Money – Rupees and Paise; addition of money; word problems'),
  (u,2,'Revision – Numbers, Place Value, Addition, Subtraction'),
  (u,3,'Revision – Multiplication, Division, Tables, Fractions'),
  (u,4,'Revision – Time, Calendar, Shapes, Measurement; Mixed Word Problems');

-- ════════════════════════════════════════════════════════ Maths Class 4

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Mathematics',1,'Numbers, Place Value, Addition and Subtraction') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'4-digit numbers; number names; place value and face value'),
  (u,2,'Comparing numbers (>, <, =); ascending and descending order'),
  (u,3,'Odd and even numbers'),
  (u,4,'Addition of 4-digit numbers with carry; subtraction with borrowing'),
  (u,5,'Word problems – addition and subtraction');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Mathematics',2,'Multiplication and Division') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Tables from 12 to 20'),(u,2,'Multiplication of 4-digit numbers with carry; word problems'),
  (u,3,'Division of 3-digit and 4-digit numbers – with and without remainder'),
  (u,4,'Division word problems; Mental Maths');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Mathematics',3,'Fractions, H.C.F. and Time') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Introduction to fractions; fractions of a whole'),
  (u,2,'Simple addition of fractions'),
  (u,3,'H.C.F. – introduction and finding H.C.F. of small numbers'),
  (u,4,'Reading time from a clock; A.M. and P.M.; hours and minutes');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,4,'Mathematics',4,'Revision and Application') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Revision – 4-digit numbers, place value, odd/even, comparing numbers'),
  (u,2,'Revision – Addition and subtraction of 4-digit numbers'),
  (u,3,'Revision – Multiplication and division; tables 12–20'),
  (u,4,'Revision – Fractions, H.C.F., time'),
  (u,5,'Mixed word problems; Mental Maths');

-- ════════════════════════════════════════════════════════ Nursery

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'English',1,'Letters A–Z: Recognition & Oral Practice') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'A, G, M, S, Y – letter recognition and 3 words each'),
  (u,2,'B, H, N, T, Z – letter recognition and 3 words each'),
  (u,3,'C, I, O, U – letter recognition and 3 words each'),
  (u,4,'D, J, P, V – letter recognition and 3 words each'),
  (u,5,'E, K, Q, W – letter recognition and 3 words each'),
  (u,6,'F, L, R, X – letter recognition and 3 words each'),
  (u,7,'Capital letter writing A–Z; introduction to small letters'),
  (u,8,'Vocabulary revision A–Z – oral practice, word–picture matching');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'English',2,'Vocabulary & Rhymes') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'A–Z vocabulary: 3 words per letter (Ant/Apple/Aeroplane … Zebra/Zipper/Zoo)'),
  (u,2,'English rhymes: ABCD, Baba Black Sheep, Chubby Cheeks, 1-2 Buckle My Shoe, Rain Rain Go Away'),
  (u,3,'Hindi rhymes: हाथी राजा, भालू बैठा रेल में, आम फलों का राजा, सेब है न्यारा'),
  (u,4,'Oral topics: self-introduction, land animals, birds, water animals, fruits, vegetables, days, months');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'Hindi',1,'स्वर अ–अः') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'अ, आ, इ, ई, उ – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,2,'ऊ, ऋ, ए, ऐ, ओ – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,3,'औ, अं, अः – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,4,'सभी स्वरों की पुनरावृत्ति – मौखिक एवं लिखित');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'Hindi',2,'व्यंजन क–त') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'क, ख, ग, घ, ड – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,2,'च, छ, ज, झ, ञ – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,3,'ट, ठ, ड, ढ, ण – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,4,'त, थ – पहचान, लेखन, प्रत्येक से 3 शब्द'),
  (u,5,'स्वर एवं व्यंजन (क–त) की संपूर्ण पुनरावृत्ति');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'Mathematics',1,'Numbers 1–15 & Shapes') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Numbers 1–10: writing, counting, recognition; standing lines'),(u,2,'Numbers 1–15: counting objects; circle, square; sleeping line'),
  (u,3,'Numbers 1–20: writing and counting; triangle; slanting line'),
  (u,4,'Shapes: circle, square, triangle – draw and colour; big and small');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,13,'Mathematics',2,'Numbers 1–30, Shapes, Colours') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Numbers 1–25: counting; rectangle; curves'),(u,2,'Numbers 1–30: counting and writing; zig zag; heart shape'),
  (u,3,'All shapes: circle, square, triangle, rectangle, star, heart – draw, colour, big/small'),
  (u,4,'All colours: red, yellow, blue, green, white, black, pink, purple, brown, grey, orange');

-- ════════════════════════════════════════════════════════ KG

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'English',1,'Capital & Small Letters Aa–Zz + 2-letter words') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Aa–Ee: writing capital and small letters; 5 words each'),
  (u,2,'Ff–Jj: writing capital and small letters; 5 words each'),
  (u,3,'Kk–Oo: writing capital and small letters; 5 words each'),
  (u,4,'Pp–Tt: writing capital and small letters; 5 words each'),
  (u,5,'Uu–Zz: writing capital and small letters; 5 words each; full alphabet revision'),
  (u,6,'Two letter words (at, as, am, an, be, me, we, it, is, to, do, go…) – 5 per day; writing, reading, dictation');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'English',2,'Three & Four Letter Words') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Three letter words – series 1: cat/bat/hat/mat, pet/let/bet, bit/fit/kit – writing, reading, dictation'),
  (u,2,'Three letter words – series 2: cot/dot/hot, but/cut/nut, ban/can/fan, bin/din/pin'),
  (u,3,'Three letter words – series 3: bun/fun/run/sun, bad/dad/mad/sad, bed/fed/led/red'),
  (u,4,'Four letter words – set 1: 5 per day from shared list; writing, reading, dictation'),
  (u,5,'Four letter words – set 2: continue; revision of 2-letter and 3-letter words'),
  (u,6,'Vocabulary: body parts, number names one–ten, colour names, animal names');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'Hindi',1,'पूरा वर्णमाला + बारहखड़ी') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'व्यंजन द, ध, न, प, फ, ब, भ, म – पहचान, लेखन; क की बारहखड़ी'),
  (u,2,'व्यंजन य, र, ल, व, श, ष, स, ह – पहचान, लेखन; ख की बारहखड़ी'),
  (u,3,'संयुक्त अक्षर क्ष, त्र, ज्ञ, श्र – पहचान, लेखन; ग की बारहखड़ी'),
  (u,4,'पूर्ण वर्णमाला पुनरावृत्ति; घ एवं च की बारहखड़ी'),
  (u,5,'स्वर–व्यंजन पहचान: 5 शब्द प्रत्येक (अनार, आम, इमली…; कलम, खाट, गाना…)');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'Hindi',2,'2, 3, 4 अक्षर वाले शब्द') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'दो अक्षर वाले शब्द – कम, बस, चल, दम, घर, जल, रस (5 प्रतिदिन; लेखन, पढ़ना, श्रुतलेख)'),
  (u,2,'तीन अक्षर वाले शब्द – भाग 1: कलम, गजन, जनक, धरम, सड़क, कदर'),
  (u,3,'तीन अक्षर वाले शब्द – भाग 2: नगर, समय, नमक, हवन, पवन, भगत'),
  (u,4,'चार अक्षर वाले शब्द – बरगद, पनघट, जलधर, बचपन, रंगघर (5 प्रतिदिन)'),
  (u,5,'मात्राएं – बारहखड़ी का संपूर्ण अभ्यास; सभी मात्राओं वाले शब्द लिखना'),
  (u,6,'पूर्ण हिंदी पुनरावृत्ति – वर्णमाला, मात्राएं, 2/3/4 अक्षर के शब्द; श्रुतलेख');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'Mathematics',1,'Numbers 1–100, Skip Counting & Shapes') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Count and write 1–70; introduce pyramid; revise nursery shapes'),
  (u,2,'Count and write 1–100; introduce rhombus; oral and writing worksheets'),
  (u,3,'Skip counting – odd numbers 1, 3, 5 … 50; write and practise; introduce oval'),
  (u,4,'Skip counting – even numbers 2, 4, 6 … 50; write and practise; introduce semi-circle'),
  (u,5,'Skip counting odd and even numbers 1–100; introduce pentagon, hexagon');

INSERT INTO syllabus_units (session_id,class_level_id,subject,month_no,heading)
  VALUES (2,14,'Mathematics',2,'Backward Counting, Comparison & Revision') RETURNING id INTO u;
INSERT INTO syllabus_items (unit_id,position,text) VALUES
  (u,1,'Backward counting 10–1 and 20–1; shapes drawing and colouring; big/small shapes'),
  (u,2,'Before / After / Greater than / Smaller than worksheets; introduce cylinder'),
  (u,3,'Numbers revision – 1–100, skip counting, backward counting, all shapes'),
  (u,4,'Oral and written assessment');

END $$;
