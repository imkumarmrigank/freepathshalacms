-- Syllabus tracking: topics per subject/class/month/week, and centre-level
-- completion marks so teachers can record what has been taught.

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id          BIGSERIAL PRIMARY KEY,
  subject     TEXT        NOT NULL,                 -- 'Hindi', 'Maths', 'English', 'General'
  class_level TEXT        NOT NULL,                 -- 'Nursery', 'KG', 'Class 1' … 'Class 4'
  month_no    SMALLINT    NOT NULL,                 -- 1–4
  week_no     SMALLINT,                             -- 1–4; NULL = whole-month topic
  title       TEXT        NOT NULL,
  description TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS syllabus_completions (
  id         BIGSERIAL PRIMARY KEY,
  topic_id   BIGINT      NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  center_id  BIGINT      NOT NULL REFERENCES centers(id)         ON DELETE CASCADE,
  session_id BIGINT      NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  marked_by  BIGINT      REFERENCES users(id),
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note       TEXT,
  UNIQUE (topic_id, center_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_topics_class
  ON syllabus_topics (class_level, subject, month_no, week_no);

CREATE INDEX IF NOT EXISTS idx_syllabus_completions_center
  ON syllabus_completions (center_id, session_id, topic_id);

-- ─────────────────────────────────────────────────────────────────── SEED DATA

-- ── Hindi Class 1 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Hindi','Class 1',1,1,'पाठ 1 – मीना का परिवार','स्वर और व्यंजन की पहचान, अक्षर पहचान एवं लेखन, चित्र देखकर अक्षर/शब्द बोलना, मौखिक प्रश्न–उत्तर',10),
('Hindi','Class 1',1,2,'पाठ 2 – दादी माँ','अक्षर लेखन का अभ्यास, 2 अक्षर वाले सरल शब्द, चित्र देखकर शब्द बोलना, पाठ से जुड़े मौखिक प्रश्न–उत्तर',20),
('Hindi','Class 1',1,3,'स्वर और व्यंजन','स्वर–व्यंजन की पहचान एवं लेखन, 2 अक्षर वाले शब्द पढ़ना और लिखना, शब्दों का मौखिक अभ्यास',30),
('Hindi','Class 1',1,4,'पुनरावृत्ति – माह 1','अक्षर पहचान, लेखन, 2 अक्षर वाले शब्द, चित्र देखकर शब्द बोलना, मौखिक प्रश्न–उत्तर, मासिक मूल्यांकन',40),
('Hindi','Class 1',2,1,'पाठ 3 – रीना का दिन','आ (ा) की मात्रा की पहचान, मात्रा लगाकर शब्द बनाना, पढ़ना एवं लिखना',50),
('Hindi','Class 1',2,2,'पाठ 4 – रानी की कहानी','इ (ि) की मात्रा की पहचान, मात्रा वाले सरल शब्द, शब्द पढ़ना और लिखना',60),
('Hindi','Class 1',2,3,'पाठ 5 – मिट्ठू','आ और इ की मात्राओं का अभ्यास, सरल वाक्य पढ़ना एवं लिखना, श्रुतलेख',70),
('Hindi','Class 1',2,4,'पुनरावृत्ति – माह 2','मात्रा वाले शब्दों का अभ्यास, चित्र देखकर शब्द/वाक्य बोलना, कहानी सुनाना, मासिक मूल्यांकन',80),
('Hindi','Class 1',3,1,'पाठ 6 – तीन साथी','पाठ वाचन, मात्राओं का अभ्यास, 2–3 अक्षर वाले शब्द पढ़ना और लिखना',90),
('Hindi','Class 1',3,2,'पाठ 7 – वाह! मेरे घोड़े','शब्द पहचान, 2–4 अक्षर वाले शब्द, शब्दों का लेखन, कविता पाठ',100),
('Hindi','Class 1',3,3,'पाठ 8 – खतरे में साँप','मात्राओं की पुनरावृत्ति, शब्दों से सरल वाक्य बनाना, प्रश्न–उत्तर',110),
('Hindi','Class 1',3,4,'समेकित अभ्यास – माह 3','2–4 अक्षर वाले शब्द, वाक्य पढ़ना, वाक्य बनाना, प्रश्न–उत्तर, कविता पाठ, मासिक मूल्यांकन',120),
('Hindi','Class 1',4,1,'पाठ 9 – आलू की सड़क','पाठ वाचन, सीखी हुई मात्राओं की पुनरावृत्ति, शब्द एवं वाक्य लेखन',130),
('Hindi','Class 1',4,2,'पाठ 10 – झूला','Reading practice, श्रुतलेख, सरल वाक्य पढ़ना एवं लिखना, कविता पाठ',140),
('Hindi','Class 1',4,3,'पाठ 11 – भुट्टे','चित्र वर्णन, चित्र देखकर 2–3 वाक्य बोलना, शब्द एवं वाक्य लेखन',150),
('Hindi','Class 1',4,4,'पूर्ण पुनरावृत्ति – माह 4','सभी पाठों एवं मात्राओं की पुनरावृत्ति, Reading, श्रुतलेख, कविता पाठ, चित्र वर्णन एवं मासिक मूल्यांकन',160);

-- ── Hindi Class 2 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Hindi','Class 2',1,1,'पाठ 1 – नीमा की दादी','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर',10),
('Hindi','Class 2',1,2,'पाठ 2 – घर','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, रिक्त स्थान',20),
('Hindi','Class 2',1,3,'पाठ 3 – माला की चाँदी की पायल','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, सही/गलत',30),
('Hindi','Class 2',1,4,'पुनरावृत्ति – माह 1','विलोम शब्द, संज्ञा, वाक्य बनाओ, श्रुतलेख',40),
('Hindi','Class 2',2,1,'पाठ 4 – माँ','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर',50),
('Hindi','Class 2',2,2,'पाठ 5 – थाथू और मैं','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, पर्यायवाची शब्द',60),
('Hindi','Class 2',2,3,'पाठ 6 – चींटा','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, लिंग बदलो',70),
('Hindi','Class 2',2,4,'पुनरावृत्ति – माह 2','पर्यायवाची, लिंग, एकवचन–बहुवचन, श्रुतलेख',80),
('Hindi','Class 2',3,1,'पाठ 7 – टिल्लू जी','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर',90),
('Hindi','Class 2',3,2,'पाठ 8 – तीन दोस्त','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, विलोम शब्द',100),
('Hindi','Class 2',3,3,'पाठ 9 – दुनिया रंग-बिरंगी','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, पर्यायवाची शब्द',110),
('Hindi','Class 2',3,4,'पुनरावृत्ति – माह 3','रिक्त स्थान, वाक्य बनाओ, विलोम, पर्यायवाची, श्रुतलेख',120),
('Hindi','Class 2',4,1,'पाठ 10 – कौन','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर',130),
('Hindi','Class 2',4,2,'पाठ 11 – बैंगनी जोजो','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, लिंग, वचन',140),
('Hindi','Class 2',4,3,'लेखन कार्य – माह 4','मेरा विद्यालय, प्रार्थना-पत्र, वाक्य बनाओ, संज्ञा',150),
('Hindi','Class 2',4,4,'संपूर्ण पुनरावृत्ति','सभी व्याकरण topics, श्रुतलेख, अभ्यास एवं Assessment',160);

-- ── Hindi Class 3 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Hindi','Class 3',1,1,'पाठ 1 – सीखो','पाठ वाचन एवं समझ, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, पाठ से संबंधित मौखिक चर्चा',10),
('Hindi','Class 3',1,2,'पाठ 2 – चींटी','पाठ वाचन, कठिन शब्द एवं शब्दार्थ, प्रश्न–उत्तर, रिक्त स्थान भरो, विलोम शब्द',20),
('Hindi','Class 3',1,3,'पाठ 3 – कितने पैर?','पाठ वाचन, शब्द ज्ञान, प्रश्न–उत्तर, रिक्त स्थान, संज्ञा की पहचान एवं सरल वाक्य',30),
('Hindi','Class 3',1,4,'पुनरावृत्ति एवं व्याकरण – माह 1','पाठ 1–3 की पुनरावृत्ति, संज्ञा, एकवचन–बहुवचन, विलोम शब्द, वाक्य बनाओ, मासिक मूल्यांकन',40),
('Hindi','Class 3',2,1,'पाठ 4 – बया हमारी चिड़िया रानी!','पाठ वाचन, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, रिक्त स्थान, पक्षियों के बारे में चर्चा',50),
('Hindi','Class 3',2,2,'पाठ 5 – आम का पेड़','पाठ वाचन, शब्दार्थ, प्रश्न–उत्तर, पर्यायवाची शब्द, लिंग बदलो',60),
('Hindi','Class 3',2,3,'पाठ 6 – बीरबल की खिचड़ी','पाठ वाचन, कठिन शब्द, प्रश्न–उत्तर, सर्वनाम की पहचान, एकवचन–बहुवचन, वाक्य बनाओ',70),
('Hindi','Class 3',2,4,'पुनरावृत्ति एवं व्याकरण – माह 2','पाठ 4–6 की पुनरावृत्ति, पर्यायवाची शब्द, लिंग बदलो, सर्वनाम, एकवचन–बहुवचन, मासिक मूल्यांकन',80),
('Hindi','Class 3',3,1,'पाठ 7 – मित्र को पत्र','पाठ वाचन, पत्र का परिचय, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, सरल वाक्य लिखना',90),
('Hindi','Class 3',3,2,'पाठ 8 – चतुर गीदड़','पाठ वाचन, कहानी समझना, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, विलोम एवं पर्यायवाची शब्द',100),
('Hindi','Class 3',3,3,'पाठ 9 – प्रकृति पर्व – फूलदेई','पाठ वाचन, शब्दार्थ, प्रश्न–उत्तर, रिक्त स्थान, संज्ञा एवं सर्वनाम की पहचान',110),
('Hindi','Class 3',3,4,'पुनरावृत्ति एवं रचनात्मक लेखन – माह 3','पाठ 7–9 की पुनरावृत्ति, विलोम, पर्यायवाची, लिंग, वचन, वाक्य बनाओ, निबंध, मासिक मूल्यांकन',120),
('Hindi','Class 3',4,1,'पाठ 10 – रस्साकशी','पाठ वाचन, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, रिक्त स्थान, विलोम एवं पर्यायवाची शब्द',130),
('Hindi','Class 3',4,2,'पाठ 11 – एक जादुई पिटारा','पाठ वाचन, शब्दार्थ, प्रश्न–उत्तर, संज्ञा एवं सर्वनाम की पहचान, लिंग एवं वचन, वाक्य बनाओ',140),
('Hindi','Class 3',4,3,'लेखन एवं रचनात्मक कार्य – माह 4','गाय पर निबंध, गर्मी की छुट्टी पर पत्र, वाक्य निर्माण, संज्ञा एवं सर्वनाम का अभ्यास',150),
('Hindi','Class 3',4,4,'संपूर्ण पुनरावृत्ति','पाठ 1–11 की पुनरावृत्ति, कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर, व्याकरण, श्रुतलेख, मूल्यांकन',160);

-- ── Hindi Class 4 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Hindi','Class 4',1,1,'पाठ 1 – चिड़िया का गीत','पाठ का पठन, सही उच्चारण, पाठ का अर्थ समझना, कठिन शब्द एवं शब्दार्थ',10),
('Hindi','Class 4',1,2,'पाठ 2 – बगीचे का घोंघा','पाठ का पठन, प्रश्न–उत्तर, नए शब्दों का प्रयोग तथा सरल वाक्य निर्माण',20),
('Hindi','Class 4',1,3,'पाठ 3 – नीम','पाठ का पठन एवं समझ, कठिन शब्द, शब्दार्थ तथा प्रश्न–उत्तर',30),
('Hindi','Class 4',1,4,'व्याकरण एवं पुनरावृत्ति – माह 1','विलोम शब्द, पर्यायवाची शब्द, लिंग परिवर्तन, एकवचन–बहुवचन एवं विशेषण का परिचय; मासिक पुनरावृत्ति',40),
('Hindi','Class 4',2,1,'पाठ 4 – हमारा आहार','पाठ का पठन एवं समझ, कठिन शब्दों के अर्थ तथा प्रश्न–उत्तर लिखने का अभ्यास',50),
('Hindi','Class 4',2,2,'पाठ 5 – आसमान गिरा','पाठ का पठन, शब्दार्थ, प्रश्न–उत्तर एवं नए शब्दों से वाक्य निर्माण',60),
('Hindi','Class 4',2,3,'पाठ 6 – जयपुर से पत्र','पठन एवं समझ, कठिन शब्द, शब्दार्थ तथा वाक्य निर्माण का अभ्यास',70),
('Hindi','Class 4',2,4,'व्याकरण एवं लेखन – माह 2','लिंग, वचन, विलोम, पर्यायवाची, विशेषण एवं क्रिया की पहचान; प्रार्थना-पत्र एवं अनुच्छेद लेखन',80),
('Hindi','Class 4',3,1,'पाठ 7 – नकली हीरे','पठन कौशल, कठिन शब्द, शब्दार्थ एवं प्रश्न–उत्तर',90),
('Hindi','Class 4',3,2,'पाठ 8 – ओणम के रंग','पाठ का अर्थ समझना, शब्द ज्ञान एवं लिखित अभिव्यक्ति का अभ्यास',100),
('Hindi','Class 4',3,3,'पाठ 9 – मिठाइयों का सम्मेलन','कठिन शब्द, शब्दार्थ, प्रश्न–उत्तर तथा दिए गए शब्दों से अर्थपूर्ण वाक्य',110),
('Hindi','Class 4',3,4,'रचनात्मक लेखन – माह 3','विशेषण, क्रिया, लिंग, वचन, विलोम एवं पर्यायवाची; कहानी लेखन, अनुच्छेद लेखन एवं मेरा विद्यालय',120),
('Hindi','Class 4',4,1,'पाठ 10 – कैमरा','पाठ का पठन, अर्थ समझना, कठिन शब्द, शब्दार्थ एवं प्रश्न–उत्तर',130),
('Hindi','Class 4',4,2,'पाठ 11 – कविता का कमाल','पाठ का पठन एवं समझ, प्रश्न–उत्तर, रिक्त स्थान एवं वाक्य निर्माण',140),
('Hindi','Class 4',4,3,'व्याकरण पुनरावृत्ति – माह 4','विलोम, पर्यायवाची, लिंग, एकवचन–बहुवचन, विशेषण एवं क्रिया की पुनरावृत्ति',150),
('Hindi','Class 4',4,4,'लेखन एवं समग्र पुनरावृत्ति','प्रार्थना-पत्र, पत्र लेखन, अनुच्छेद लेखन, कहानी लेखन, मेरा विद्यालय तथा चार माह के पाठ्यक्रम का मूल्यांकन',160);

-- ── Maths Class 1 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Maths','Class 1',1,NULL,'Numbers 1–10','Number recognition, counting, number names, number writing, counting objects, before and after, more and less, big and small',10),
('Maths','Class 1',2,NULL,'Numbers 11–20','Counting 11–20, number names, number writing, before/after/between, greater and smaller, introduction to addition',20),
('Maths','Class 1',3,NULL,'Addition & Subtraction','Addition up to 10, subtraction up to 10, using objects and pictures, number line, simple word problems',30),
('Maths','Class 1',4,NULL,'Shapes, Measurement & Patterns','Circle, square, triangle, rectangle; long/short, tall/short, heavy/light, near/far, inside/outside, simple patterns, revision',40);

-- ── Maths Class 2 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Maths','Class 2',1,NULL,'Numbers and Number Sense','Numbers up to 100, number names, counting forward/backward, before/after/between, ascending/descending order, comparing numbers, ones and tens, introduction to addition',10),
('Maths','Class 2',2,NULL,'Addition and Subtraction','Addition up to 100 with/without carrying, subtraction with/without borrowing, word problems, mental maths, number patterns',20),
('Maths','Class 2',3,NULL,'Multiplication, Division, Measurement and Time','Multiplication as repeated addition, tables of 2/3/5/10, introduction to division, equal sharing, length, weight, capacity, time – hours and half hours, days and months',30),
('Maths','Class 2',4,NULL,'Shapes, Money and Revision','2-D and 3-D shapes, sides and corners, money (rupees and paise), coins and notes, revision of measurement, time, addition, subtraction, multiplication and division',40);

-- ── Maths Class 3 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Maths','Class 3',1,NULL,'Numbers and Addition','Numbers up to 500 and beyond, place value (ones, tens, hundreds), expanded form, ascending/descending order, addition of 3-digit numbers with carry, word problems',10),
('Maths','Class 3',2,NULL,'Subtraction, Multiplication and Division','Subtraction of 3-digit numbers with borrowing, multiplication using groups, tables 2–15, introduction to division, word problems',20),
('Maths','Class 3',3,NULL,'Shapes, Measurement, Fractions and Time','Basic shapes, measurement of length/weight/capacity, introduction to fractions (half and quarter), reading time from a clock, calendar',30),
('Maths','Class 3',4,NULL,'Money, Data Handling and Revision','Money (rupees and paise), addition of money, revision of all topics, mixed word problems, mental maths',40);

-- ── Maths Class 4 ────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
('Maths','Class 4',1,NULL,'Numbers, Place Value, Addition and Subtraction','4-digit numbers, place value, comparing numbers, odd and even numbers, addition/subtraction of 4-digit numbers, word problems',10),
('Maths','Class 4',2,NULL,'Multiplication and Division','Tables 12–20, multiplication of 4-digit numbers, division with and without remainder, word problems, mental maths',20),
('Maths','Class 4',3,NULL,'Fractions, H.C.F. and Time','Fractions of a whole, simple addition of fractions, H.C.F. of small numbers, reading time from a clock, A.M. and P.M.',30),
('Maths','Class 4',4,NULL,'Revision and Application','Revision of all 4-digit operations, tables 12–20, fractions, H.C.F., time, mixed word problems, mental maths',40);

-- ── Nursery ──────────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
-- English: letters grouped into monthly batches (doc has 24 weekly slots)
('English','Nursery',1,1,'A, G, M, S, Y – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (A–Apple, G–Goat, M–Mango, S–Snake, Y–Yak)',10),
('English','Nursery',1,2,'B, H, N, T, Z – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (B–Ball, H–Horse, N–Nest, T–Tiger, Z–Zebra)',20),
('English','Nursery',1,3,'C, I, O, U – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (C–Cat, I–Ice cream, O–Orange, U–Umbrella)',30),
('English','Nursery',1,4,'D, J, P, V – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (D–Dog, J–Jacket, P–Pumpkin, V–Van)',40),
('English','Nursery',2,1,'E, K, Q, W – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (E–Egg, K–Kangaroo, Q–Queen, W–Watermelon)',50),
('English','Nursery',2,2,'F, L, R, X – Letter Recognition','Capital letter recognition and oral practice; 3 words per letter (F–Fan, L–Lion, R–Rose, X–X-ray)',60),
('English','Nursery',2,3,'A–Z Writing Practice','Writing capital letters A to Z; introduction to small letters from Week 7 onwards',70),
('English','Nursery',2,4,'Vocabulary Revision – A to Z','Revise 3 words per letter; oral practice, recognise words from pictures',80),
-- Hindi: स्वर and व्यंजन
('Hindi','Nursery',1,1,'स्वर – अ, आ, इ, ई, उ','स्वर की पहचान, लेखन, और हर स्वर से 3 शब्द मौखिक रूप से बोलना',10),
('Hindi','Nursery',1,2,'स्वर – ऊ, ऋ, ए, ऐ, ओ','स्वर की पहचान, लेखन, और हर स्वर से 3 शब्द',20),
('Hindi','Nursery',1,3,'स्वर – औ, अं, अः + व्यंजन क, ख','स्वर पूर्ण, व्यंजन परिचय, हर अक्षर से 3 शब्द',30),
('Hindi','Nursery',1,4,'व्यंजन – ग, घ, ड, च, छ','व्यंजन पहचान और लेखन, प्रत्येक से 3 शब्द',40),
('Hindi','Nursery',2,1,'व्यंजन – ज, झ, ञ, ट, ठ','व्यंजन पहचान और लेखन, प्रत्येक से 3 शब्द',50),
('Hindi','Nursery',2,2,'व्यंजन – ड, ढ, ण, त, थ','व्यंजन पहचान और लेखन, प्रत्येक से 3 शब्द (क से त तक पूर्ण)',60),
('Hindi','Nursery',2,3,'स्वर–व्यंजन पुनरावृत्ति','अ से अः तक स्वर, क से त तक व्यंजन; मौखिक एवं लिखित अभ्यास',70),
('Hindi','Nursery',2,4,'शब्दावली अभ्यास','हर स्वर और व्यंजन के 3 शब्द बोलना और पहचानना',80),
-- Numbers
('Maths','Nursery',1,1,'Numbers 1–10 – Recognition & Writing','Writing 1–10, counting objects, number recognition, standing/sleeping/slanting lines',10),
('Maths','Nursery',1,2,'Numbers 1–15 – Counting & Shapes','Counting 1–15, circle, square, triangle',20),
('Maths','Nursery',1,3,'Numbers 1–20 – Writing & Patterns','Counting and writing 1–20, slanting lines, pattern introduction',30),
('Maths','Nursery',1,4,'Numbers 1–25 – Revision & Shapes','Counting 1–25, revision of shapes, curves',40),
('Maths','Nursery',2,1,'Numbers 1–30 – Completion','Counting and writing 1–30, zig zag patterns, heart shape',50),
('Maths','Nursery',2,2,'Shapes – Circle, Square, Triangle, Rectangle, Star, Heart','Identify, draw, and colour all shapes; big and small',60),
('Maths','Nursery',2,3,'Colours','All colours – red, yellow, blue, green, white, black, pink, purple, brown, grey, orange',70),
('Maths','Nursery',2,4,'Revision – Numbers, Shapes, Colours','Revision of all numbers, shapes, and colours',80),
-- General
('General','Nursery',1,NULL,'Self-Introduction & Vocabulary','My name, age, school, family; land animals, birds, water animals, fruits, vegetables, days, months',10),
('General','Nursery',2,NULL,'Rhymes & Stories','ABCD rhyme, Baba Black Sheep, Chubby Cheeks, 1-2 Buckle My Shoe, Rain Rain Go Away; Hindi rhymes; simple moral stories',20);

-- ── KG ───────────────────────────────────────────────────────────────────────
INSERT INTO syllabus_topics (subject, class_level, month_no, week_no, title, description, sort_order) VALUES
-- English
('English','KG',1,1,'Aa–Ee – Capital and Small Letters','Writing and reading capital + small letters Aa–Ee, 5 words per letter',10),
('English','KG',1,2,'Ff–Jj – Capital and Small Letters','Writing and reading Ff–Jj, 5 words per letter',20),
('English','KG',1,3,'Kk–Oo – Capital and Small Letters','Writing and reading Kk–Oo, 5 words per letter',30),
('English','KG',1,4,'Pp–Tt – Capital and Small Letters','Writing and reading Pp–Tt, 5 words per letter',40),
('English','KG',2,1,'Uu–Zz – Capital and Small Letters','Writing and reading Uu–Zz, 5 words per letter; complete alphabet revision',50),
('English','KG',2,2,'Two Letter Words','at, as, am, an, be, me, we, it, if, is, to, do, go, so, up – writing, reading, dictation; 5 per day',60),
('English','KG',2,3,'Three Letter Words – Series 1','Cat/bat/hat/mat/rat; pet/let/bet; bit/fit/kit – one series per day, writing, reading, dictation',70),
('English','KG',2,4,'Three Letter Words – Series 2','Cot/dot/hot/lot; but/cut/nut; ban/can/fan/man; bin/din/pin/tin – writing, reading, dictation',80),
('English','KG',3,1,'Three Letter Words – Series 3','Bun/fun/gun/run/sun; bad/dad/mad/sad; bed/fed/led/red – writing, reading, dictation',90),
('English','KG',3,2,'Four Letter Words – Set 1','5 words per day from the shared four-letter word list; writing, reading, dictation',100),
('English','KG',3,3,'Four Letter Words – Set 2','Continue four-letter words; revision of two and three letter words',110),
('English','KG',3,4,'Vocabulary & Body Parts','Body parts: eyes, ears, nose, neck, head; number names one–ten; colour names; animal names',120),
-- Hindi
('Hindi','KG',1,1,'पूरा वर्णमाला – द, ध, न, प, फ, ब, भ, म','व्यंजन पहचान और लेखन; मात्राएं – क की बारहखड़ी शुरू',10),
('Hindi','KG',1,2,'वर्णमाला – य, र, ल, व, श, ष, स, ह','व्यंजन लेखन; ख की बारहखड़ी',20),
('Hindi','KG',1,3,'संयुक्त अक्षर – क्ष, त्र, ज्ञ, श्र','संयुक्त अक्षर परिचय और लेखन; ग की बारहखड़ी',30),
('Hindi','KG',1,4,'पूर्ण वर्णमाला पुनरावृत्ति','सभी स्वर और व्यंजन का लेखन एवं मौखिक अभ्यास; घ की बारहखड़ी',40),
('Hindi','KG',2,1,'दो अक्षर वाले शब्द','कम, बस, चल, दम, घर, जल, रस – लेखन, पढ़ना, श्रुतलेख; 5 शब्द प्रतिदिन',50),
('Hindi','KG',2,2,'तीन अक्षर वाले शब्द – भाग 1','कलम, गजन, जनक, धरम, सड़क, कदर – लेखन, पढ़ना, श्रुतलेख',60),
('Hindi','KG',2,3,'तीन अक्षर वाले शब्द – भाग 2','नगर, समय, नमक, हवन, पवन, भगत – लेखन, पढ़ना, श्रुतलेख',70),
('Hindi','KG',2,4,'चार अक्षर वाले शब्द','बरगद, पनघट, जलधर, बचपन, रंगघर – लेखन, पढ़ना, श्रुतलेख; 5 शब्द प्रतिदिन',80),
('Hindi','KG',3,1,'स्वर – शब्द सूची (5 शब्द प्रति स्वर)','अ, आ, इ, ई, उ, ऊ, ए, ऐ, ओ, औ, अं, अः – 5 शब्द प्रत्येक',90),
('Hindi','KG',3,2,'व्यंजन – शब्द सूची (5 शब्द प्रति अक्षर)','क से ज्ञ तक – 5 शब्द प्रत्येक; मौखिक एवं लिखित',100),
('Hindi','KG',3,3,'मात्राएं – बारहखड़ी अभ्यास','च की बारहखड़ी; सभी मात्राओं का अभ्यास; मात्रा वाले शब्द लिखना',110),
('Hindi','KG',3,4,'पूर्ण हिंदी पुनरावृत्ति','वर्णमाला, मात्राएं, 2/3/4 अक्षर वाले शब्द; श्रुतलेख और मौखिक अभ्यास',120),
-- Maths
('Maths','KG',1,1,'Numbers 1–70 + Shapes','Count and write 1–70; introduce pyramid; revise nursery shapes (circle, square, triangle, rectangle)',10),
('Maths','KG',1,2,'Numbers 1–100 + Shapes','Count and write 1–100; introduce rhombus; oral and writing worksheets',20),
('Maths','KG',1,3,'Skip Counting – Odd Numbers','Skip count 1, 3, 5 … up to 50; write and practise; introduce oval',30),
('Maths','KG',1,4,'Skip Counting – Even Numbers','Skip count 2, 4, 6 … up to 50; write and practise; introduce semi-circle',40),
('Maths','KG',2,1,'Skip Counting 1–100 (Odd & Even)','Skip count odd and even numbers up to 100; introduce pentagon, hexagon',50),
('Maths','KG',2,2,'Backward Counting 20–1','Backward counting 10–1 and 20–1; shapes drawing and colouring; big/small shapes',60),
('Maths','KG',2,3,'Before / After / Greater Than / Smaller Than','Dodging, before/after worksheets; greater than/smaller than; introduce cylinder',70),
('Maths','KG',2,4,'Numbers Revision','Revision of 1–100, skip counting, backward counting, all shapes; oral and written assessment',80),
-- General
('General','KG',1,NULL,'Rhymes – English & Hindi','Teddy Bear, Five Little Monkeys, One Two Three Four Five, Humpty Dumpty, Cold Cold Winter; Hindi rhymes: हम सब बच्चे, आलू बोला, छह साल की छोकरी',10),
('General','KG',2,NULL,'Storytelling & Make-a-Book','Simple moral stories; each student makes their own textbook with numbered pages; physical exercise routine',20);
