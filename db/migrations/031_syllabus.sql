-- The syllabus: what is to be taught, month by month, decided centrally.
--
-- Teaching plans were the other way round — each teacher wrote their own list
-- for their own centre, so twelve centres teaching Class 1 Hindi could be
-- teaching twelve different things, and nobody could see whether a centre was
-- behind. The syllabus is set once by an administrator for a class and subject;
-- every centre works the same months, and a teacher records how far their own
-- centre has got.

CREATE TABLE IF NOT EXISTS syllabus_units (
  id             BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL,
  -- the teaching month, 1 for the first month of the session and so on. Not a
  -- calendar month: a session starting in April has April as month 1.
  month_no       INTEGER NOT NULL CHECK (month_no BETWEEN 1 AND 12),
  heading        TEXT,           -- "Unit 1", "पाठ 1–2"
  outcome        TEXT,           -- what a child should be able to do by the end
  created_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, class_level_id, subject, month_no)
);
CREATE INDEX IF NOT EXISTS idx_syllabus_scope
  ON syllabus_units (session_id, class_level_id, subject, month_no);

CREATE TABLE IF NOT EXISTS syllabus_items (
  id        BIGSERIAL PRIMARY KEY,
  unit_id   BIGINT NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  text      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_syllabus_items ON syllabus_items (unit_id, position, id);

-- How far one centre has got with one month. The teacher's own record; the
-- syllabus itself is not theirs to change.
CREATE TABLE IF NOT EXISTS syllabus_progress (
  id           BIGSERIAL PRIMARY KEY,
  unit_id      BIGINT NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
  center_id    BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'not_started'
                 CHECK (status IN ('not_started','in_progress','completed')),
  completed_on DATE,
  remarks      TEXT,
  marked_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, center_id)
);
CREATE INDEX IF NOT EXISTS idx_syllabus_progress ON syllabus_progress (center_id, status);

-- A single line ticked off. Optional detail underneath the monthly mark: a
-- month with thirty-one items is worked through over weeks, and a teacher
-- wants to see where they are.
CREATE TABLE IF NOT EXISTS syllabus_item_ticks (
  item_id   BIGINT NOT NULL REFERENCES syllabus_items(id) ON DELETE CASCADE,
  center_id BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  done_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  marked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (item_id, center_id)
);


-- ----------------------------------------------------------------- the seed
-- Class 1 English, Hindi and Mathematics, taken from the syllabus document.
-- Seeded only if nothing is there, so an edit made in the app is never undone
-- by a redeploy.
DO $seed$
DECLARE
  v_session BIGINT;
  v_class   BIGINT;
  v_unit    BIGINT;
BEGIN
  SELECT id INTO v_session FROM academic_sessions WHERE is_current LIMIT 1;
  SELECT id INTO v_class   FROM class_levels WHERE name = 'Class 1' LIMIT 1;
  IF v_session IS NULL OR v_class IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM syllabus_units WHERE session_id = v_session AND class_level_id = v_class)
  THEN RETURN; END IF;


  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'English', 1, 'Unit 1', NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Please note - Teacher is expected to explain everything in Hindi. Reading practice has to be encouraged for everything in the unit.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'Alphabet song on page 10 (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'Letter sounds (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'Learn spellings of words from unit. This is a writing activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'Punctuation – use of capital letters and full stop. Introduction to question words from the unit (oral activity) what - क्या');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'How - कैसे');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'Which - कौन सा');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'Who - कौन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 9, 'Sentences which ask a question end with a question mark. Find sentences in the unit which end with a full stop/question mark (oral activity).');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 10, 'Practice punctuation in class. Some examples are given below.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 11, 'what is your name');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 12, 'i live in gurugram');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 13, 'i clap with my hands');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 14, 'how old are you');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 15, 'Sight words - These are commonly used words in English language. Some sight words used in the unit are one, to, and, they, them. The students should be encouraged to find these words. This is an oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 16, 'Body parts – Learn names in English with Hindi meaning Answer the following questions. (Writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 17, 'What do I do with my eyes? I see with my eyes.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 18, 'What do I do with my ears? I hear with my ears.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 19, 'What do I do with my mouth? I eat with my mouth.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 20, 'What do I do with my skin? I feel (महसूस करना) with my skin.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 21, 'Conversation/picture reading - oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 22, 'Action words - oral activity - actions should be practised also for proper understanding.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 23, '- Students should learn to form sentences with five action words.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 24, 'My Family/The sparrow family - Read and understand both - oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 25, 'Difficult/new words from the chapter - learn English to Hindi and vice versa - writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 26, 'Answer the following questions (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 27, 'Who all are there in your family? Father, mother, brother, sister');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 28, 'What is your father''s name?');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 29, 'What is your mother''s name?');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 30, 'What is your name?');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 31, 'If you were the baby sparrow, where would you fly? I would fly into the big blue sky.');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'English', 2, 'Unit 2', NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Focus on reading, understanding meanings of words in Hindi, conversation (sentence formation), spellings, dictation.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'Poems - the unit has four poems as below.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'Fun with numbers, oral activity, learn to write it also).');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'Five little monkeys (oral activity) - sing, learn, read');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'Butterflies (oral activity) - sing, learn, actions');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'A farm (oral activity) - learn, notice animal sounds');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'The cap-seller and the monkeys - read and understand, teacher to explain in Hindi. Answer the following questions (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'Do you have a cap? Yes, i have a cap.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 9, 'What is the colour of your cap? My cap isin colour.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 10, 'What did the man carry in his basket? The man carried caps in his basket.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 11, 'Let us read');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 12, 'Action words: understand and practise actions from the Unit.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 13, 'Form sentences with the following action words: eat, sleep, run, clap, jump (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 14, 'Opposites - understand and practise opposites from the Unit (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 15, 'Sight words - these are commonly used words in English language - each, is, and, on, now, then, also, did, they, his, her (encourage students to find these sight words in the unit).. oral activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 16, 'Conversation - between teacher and child - oral activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 17, 'Rhyming words - go/so, bite/right, tree/knee, five/alive, fat/cat/sat/mat/hat (find the rhyming words in the poems will be oral activity. Can be writing activity in test also. Example, write one word that rhymes with go, five, knee etc)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 18, 'Letter sounds');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 19, 'Spellings - new words from the unit - learn, write, dictation, English to Hindi and vice versa (writing activity)');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'English', 3, 'Unit 3', NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'This is a relatively small unit. Focus on reading, understanding meanings of words, conversation (sentence formation), spellings, dictation.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'Chapter 1 - Picture Reading. Following learning outcomes are expected from this chapter.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'Five fruits with colour association, writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'Five vegetables with colour association, writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'Questions and answers - writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'Which is your favourite fruit? (Full sentence answer)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'Do you eat vegetables? (Full sentence answer)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'Singular/plural from the Unit (one/many) - oral activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 9, 'Poem - fruits for all - students must learn the full poem for oral activity and learn to write the first 6 lines for writing activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 10, 'Use of ‘for'' and ''on''');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 11, 'A visit to the market: learn to read whole chapter for oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 12, 'use of his/her');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 13, 'Questions and answers for writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 14, 'What does a farmer do? A farmer grows vegetables on his farm.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 15, 'Where does the farmer sell his vegetables? The farmer sells his vegetables in the market.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 16, 'Is there a market near your house? Yes there is a market near my house.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 17, 'Write the names of two flowers. Marigold, jasmine.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 18, 'Name one big fruit. Watermelon');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 19, 'Name one small fruit. Orange');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 20, 'Conversation, oral activity - use of this/these, yes/no');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 21, 'The Food we Eat - learn to read the pictures.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 22, 'Answer the following questions - writing activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 23, 'Do you share food with your friends? Yes, I share food with my friends (if it is a ''no'' answer, please modify suitably)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 24, 'Where do you sit when you have lunch at school? I sit on a mat under the tree when I have lunch at school.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 25, 'What does a cow give us? A cow gives us milk(दूध), curd(दही), butter(मक्खन), paneer(पनीर)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 26, 'What does a honey bee(मधु मक्खी) give us? Honeybee gives us honey (शहद).');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 27, 'Opposites from the Unit (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 28, 'Matching everyday objects to their shapes (circle, square, triangle) Circle – Roti, Bangle, Coin');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 29, 'Triangle – Samosa, Pizza slice, Ice cream cone Square – Bread, Cushion, Chess board');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 30, 'New concept - raw food/(कच्चा खाना)/cooked food (पका खाना (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 31, 'One syllable/two syllable words - oral activity');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 32, 'Animal names with colour association (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 33, 'English to Hindi of fruits, vegetables, flowers, colours, animals and birds from the Unit (writing activity)');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'English', 4, 'Unit 4', NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'As you will notice, the unit seems small by number of pages. However, difficulty level is much higher vis a vis reading and comprehension.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'Please ensure that as you read to the class, you do a Hindi translation for each sentence alongside. Same practice should be followed when the children practice reading - they must say the meaning of each sentence in Hindi. Teaching them to understand as they read is our main objective.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'Chapter 1 - the four seasons: learn to read, understand in Hindi and sing (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'New words from the chapter with meanings in Hindi (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'Answer the following questions (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'what do you wear in summer? We wear light, cotton clothes in summer.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'What do you wear in winter? We wear heavy, woollen clothes in winter.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'Picture reading for oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 9, 'Let us read - read and understand in Hindi for oral activity.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 10, 'New words with Hindi meanings (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 11, 'Picture reading - (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 12, 'Answer the following question (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 13, 'write the names of any three clothes that we wear. We wear pant, t-shirt, cap.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 14, 'Let us sing - learn to sing both poems and understand their meanings (oral activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 15, 'New words with meanings in Hindi (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 16, 'Write three words that come to your mind when you say the following words.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 17, 'Summer - hot, icecream, cold drink Winter - cold, jacket, socks Monsoon - rain, umbrella, clouds Spring - flowers, colours, new leaves');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 18, 'Chapter 2 - Anandi''s Rainbow - learn to read the whole chapter and understand the meaning of what you are reading.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 19, 'New words with meanings in Hindi (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 20, 'Answer the following questions (writing activity)');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 21, 'Have you seen a rainbow? Yes, I have seen a rainbow/ No, I have not seen a rainbow.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 22, 'Where can you see a rainbow? I can see a rainbow in the sky.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 23, 'Can you see clouds in the sky? Yes, I can see clouds in the sky.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 24, 'Colours of rainbow (oral activity) - VIBGYOR - violet, indigo, blue, green, yellow, orange, red');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 25, 'Introduction to Essay writing - write five lines on Myself.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 26, 'My name is ...... I am a boy/girl.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 27, 'I amyears old.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 28, 'I study in Free Pathshala. My favourite colour is......');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 29, 'English Language to be taught parallelly from Month 1');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 30, 'Our Class 1 students are prepared for admission to formal schools. To that end, the following English language skills need to be developed alongside the unit from Mridang.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 31, 'Punctuation as given in unit 1.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 32, 'Opposites from Unit 2. Teacher may feel free to add more at his/her discretion.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 33, 'Five lines on Myself.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 34, 'Use of are - help students to find are in Mridang, and read and understand the sentence. Teach them to make simple sentences with are - we are playing/what are you doing...etc');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 35, 'Use of is - help students to find is in Mridang and read and understand the sentence. Teach them to make simple sentences with is - this is a bag/that is an orange etc.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 36, 'Use of am - am has only been used in the riddles on page 105 of Mridang. You can do these riddles with the students. Teach them to make simple sentences with am - I am a boy(girl)/I am sleeping etc.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 37, 'A few sample unseen passages and accompanying questions with answers to prepare students for admission to formal schools are given below. The teacher may add her own passages also for practice.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 38, 'Passage 1');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 39, 'A fat cat sat on a mat. A little rat saw her and jumped in a hat. The cat ran to catch the rat. The rat ran and hid in a box.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 40, 'Where did a fat cat sit? A fat cat sat on a mat.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 41, 'Who saw the fat cat? A little rat saw the fat cat.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 42, 'Who ran to catch the rat? The cat ran to catch the rat.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 43, 'Where did the rat hide? The rat hid in a box.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 44, 'Passage 2');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 45, 'When I meet someone i say ''Namaste''. When I meet someone in the morning I say ''Good morning ''. When I meet someone in the afternoon I say ''Good afternoon ''. When I meet someone in the evening I say ''Good evening''.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 46, 'What do you say when you meet someone in the morning? We say good morning.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 47, 'What do you say when you meet someone in the afternoon? We say good afternoon.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 48, 'What do you say when you meet someone in the evening? We say good evening.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 49, 'Passage 3');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 50, 'I have a big red dog. His name is Sam. Sam is very fast. He can run and hop. Sam likes to play with his blue ball. He can sit on the soft green mat. I give him a big hug. Sam is a good pet. We like to go to the park to play. He is my best pal.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 51, 'What color is the dog? The dog is red.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 52, 'What is the dog''s name? His name is Sam.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 53, 'What does Sam like to play with? Sam likes to play with his blue ball.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 54, 'Where do they go to play? They go to the park to play.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 55, 'Passage 4');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 56, 'I have a cute grey cat. Her name is Lulu. Lulu is very soft. She can jump and play. She likes to nap in the sun. I give her some milk. She is a fun pet. We like to play with a red string. She is my dear friend.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 57, 'What is the name of the cat? Her name is Lulu.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 58, 'What color is the cat? The cat is grey.');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 59, 'Where does Lulu like to nap? She likes to nap in the sun. What does Lulu play with? She plays with a red string.');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Hindi', 1, NULL, NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'पाठ 1 – मीना का पररवार');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'पाठ 2 – दादी मााँ');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'स्वर और व्यंजन की पहचान');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'अक्षर पहचान एवं लेखन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, '2 अक्षर वाले सरल शब्द');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'चचत्र देखकर शब्द बोलना');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'मौखखक प्रश्न–उत्तर');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Hindi', 2, NULL, NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'पाठ 3 – रीना का दिन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'पाठ 4 – रानी की कहानी');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'पाठ 5 – मिट्ठू');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'आ (ाा) और इ (चा) की मात्रा');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'मात्रा वाले शब्द');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'सरल वाक्य पढ़ना और चलखना');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'श्रुतलेख');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'कहानी/चचत्र देखकर बोलना');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Hindi', 3, NULL, NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'पाठ 6 – तीन साथी');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'पाठ 7 – वाह! मेरे घोडे');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'पाठ 8 – खतरे में सााँप');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'मात्राओं का अभ्यास');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, '2–4 अक्षर वाले शब्द');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'शब्दों से वाक्य बनाना');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'प्रश्न–उत्तर');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'कचवता पाठ');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Hindi', 4, NULL, NULL)
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'पाठ 9 – आलू की सडक');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 2, 'पाठ 10 – झूला');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 3, 'पाठ 11 – भुट्टे');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 4, 'सीखी हुई मात्राओं की पुनरावृचत्त');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 5, 'शब्द एवं वाक्य लेखन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 6, 'श्रुतलेख');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 7, 'Reading practice');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 8, 'चचत्र वर्णन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 9, 'पाठों की पुनरावृचत्त एवं माचसक मूल्ांकन');
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 10, 'बच्चों को अक्षर पहचान मात्रा पहचान, सरल शब्द पढ़ना-लिखना, छोटे वाक्य पढ़ना, श्रुतलेख, कहवता पाठ और चित्र देखकर 2–3 वाक्य बोलना आ जाना चाहिए');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Mathematics', 1, NULL, 'Students will be able to recognize, count and write numbers 1–10.')
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Numbers 1–10: Number recognition, counting, number names, number writing, counting objects, before and after, more and less, big and small.');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Mathematics', 2, NULL, 'Students will be able to recognize, count and write numbers 11–20 and compare numbers.')
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Numbers 11–20: Counting 11–20, number names, number writing, before, after and between, greater and smaller, inton to adon');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Mathematics', 3, NULL, 'Students will be able to solve simple addition and subtraction problems up to 10.')
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Addition & Subtraction: Addition up to 10, subtraction up to 10, addition and subtraction using objects and pictures, number line, simple word problems.');

  INSERT INTO syllabus_units (session_id, class_level_id, subject, month_no, heading, outcome)
  VALUES (v_session, v_class, 'Mathematics', 4, NULL, 'Students will be able to identify basic shapes, understand simple measurements and patterns, and revise the complete syllabus.')
  RETURNING id INTO v_unit;
  INSERT INTO syllabus_items (unit_id, position, text) VALUES (v_unit, 1, 'Shapes, Measurement & Patterns: Circle, square, triangle and rectangle; long/short, tall/short, heavy/light, near/far, inside/outside, simple patterns, and revision');

END
$seed$;

