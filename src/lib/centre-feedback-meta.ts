/**
 * The mentor's centre feedback form, in Hindi and English together.
 *
 * Every label carries both languages rather than hiding one behind a switch:
 * the mentors read English, the centre staff who are shown the feedback read
 * Hindi, and the same sheet has to work for both of them.
 */

export type Bi = { en: string; hi: string };

export const FEEDBACK_TEXT = {
  title:        { en: "Centre feedback", hi: "केंद्र फ़ीडबैक" },
  subtitle:     { en: "What the mentor saw at the centre",
                  hi: "मेंटर ने केंद्र में क्या देखा" },
  centre:       { en: "Centre", hi: "केंद्र" },
  visitedOn:    { en: "Date of visit", hi: "भ्रमण की तिथि" },
  rating:       { en: "Overall, how is the centre running?",
                  hi: "कुल मिलाकर केंद्र कैसा चल रहा है?" },
  topics:       { en: "What is this feedback about? (tick all that apply)",
                  hi: "यह फ़ीडबैक किस बारे में है? (जो लागू हो सब चुनें)" },
  workingWell:  { en: "What is working well", hi: "क्या अच्छा चल रहा है" },
  needsWork:    { en: "What needs attention", hi: "किस पर ध्यान देने की ज़रूरत है" },
  parentVoice:  { en: "What parents said", hi: "अभिभावकों ने क्या कहा" },
  urgent:       { en: "Needs urgent attention from the office",
                  hi: "कार्यालय के तुरंत ध्यान की ज़रूरत है" },
  share:        { en: "Share this with the centre",
                  hi: "यह फ़ीडबैक केंद्र के साथ साझा करें" },
  language:     { en: "Which language did you write in?",
                  hi: "आपने किस भाषा में लिखा?" },
  save:         { en: "Save feedback", hi: "फ़ीडबैक सहेजें" },
  history:      { en: "Feedback already given", hi: "पहले दिया गया फ़ीडबैक" },
  none:         { en: "No feedback yet", hi: "अभी कोई फ़ीडबैक नहीं" },
} as const;

export const FEEDBACK_TOPICS: { value: string; en: string; hi: string }[] = [
  { value: "teaching",   en: "Teaching quality",      hi: "पढ़ाई की गुणवत्ता" },
  { value: "attendance", en: "Children's attendance",  hi: "बच्चों की उपस्थिति" },
  { value: "punctuality", en: "Staff punctuality",     hi: "शिक्षकों की समयबद्धता" },
  { value: "space",      en: "Space and seating",      hi: "जगह और बैठने की व्यवस्था" },
  { value: "cleanliness", en: "Cleanliness and safety", hi: "सफ़ाई और सुरक्षा" },
  { value: "materials",  en: "Teaching materials",     hi: "पढ़ाई की सामग्री" },
  { value: "parents",    en: "Parent involvement",     hi: "अभिभावकों की भागीदारी" },
  { value: "community",  en: "Community issues",       hi: "समुदाय से जुड़ी बात" },
  { value: "other",      en: "Something else",         hi: "कुछ और" },
];

export const TOPIC_LABEL: Record<string, Bi> =
  Object.fromEntries(FEEDBACK_TOPICS.map((t) => [t.value, { en: t.en, hi: t.hi }]));

export const FEEDBACK_RATINGS: { value: number; en: string; hi: string }[] = [
  { value: 1, en: "Poor",       hi: "खराब" },
  { value: 2, en: "Needs work", hi: "सुधार चाहिए" },
  { value: 3, en: "Fair",       hi: "ठीक-ठाक" },
  { value: 4, en: "Good",       hi: "अच्छा" },
  { value: 5, en: "Very good",  hi: "बहुत अच्छा" },
];

export const RATING_TONE: Record<number, string> = {
  1: "bad", 2: "bad", 3: "warn", 4: "ok", 5: "ok",
};

export const LANGUAGES: { value: string; en: string; hi: string }[] = [
  { value: "en", en: "English", hi: "अंग्रेज़ी" },
  { value: "hi", en: "Hindi",   hi: "हिन्दी" },
];

export function isTopic(v: string) {
  return FEEDBACK_TOPICS.some((t) => t.value === v);
}

/** One label, both languages — "Centre / केंद्र". */
export const both = (t: Bi) => `${t.en} / ${t.hi}`;

/** The six parameters a mentor scores on a visit. 0 stored = "not observed". */
export const ASSESSMENT_PARAMS: { key: string; en: string; hi: string }[] = [
  { key: "teaching",    en: "Teaching Quality",              hi: "पढ़ाई की गुणवत्ता" },
  { key: "attendance",  en: "Children's Attendance",         hi: "बच्चों की उपस्थिति" },
  { key: "punctuality", en: "Teacher Punctuality",           hi: "शिक्षक की समयबद्धता" },
  { key: "engagement",  en: "Student Engagement",            hi: "बच्चों की सहभागिता" },
  { key: "safety",      en: "Cleanliness & Safety",          hi: "साफ़-सफ़ाई एवं सुरक्षा" },
  { key: "environment", en: "Learning Environment & Materials", hi: "सीखने का माहौल एवं सामग्री" },
];

export const SCORE_OPTIONS: { value: number; en: string; hi: string }[] = [
  { value: 3, en: "Good",       hi: "अच्छा" },
  { value: 2, en: "Average",    hi: "औसत" },
  { value: 1, en: "Below Avg",  hi: "औसत से कम" },
];

export type Ratings = Record<string, number>;

/** How many parameters must be rated before a consolidated rating means anything. */
export const MIN_RATED = 3;

/** Consolidated rating out of 3, from whichever parameters were observed. */
export function consolidate(ratings: Ratings) {
  const scores = ASSESSMENT_PARAMS.map((p) => ratings[p.key]).filter((v) => v >= 1 && v <= 3);
  const good = scores.filter((v) => v === 3).length;
  const average = scores.filter((v) => v === 2).length;
  const below = scores.filter((v) => v === 1).length;
  const score = scores.length ? scores.reduce((n, v) => n + v, 0) / scores.length : null;
  const band: "insufficient" | "good" | "average" | "below" =
    scores.length < MIN_RATED || score === null ? "insufficient"
    : score >= 2.5 ? "good" : score >= 1.75 ? "average" : "below";
  return { score, rated: scores.length, good, average, below, band };
}

export const BAND_LABEL: Record<string, Bi> = {
  insufficient: { en: "Insufficient Data", hi: "पर्याप्त डेटा नहीं" },
  good:         { en: "Good",              hi: "अच्छा" },
  average:      { en: "Average",           hi: "औसत" },
  below:        { en: "Below Average",     hi: "औसत से कम" },
};

export const BAND_TONE: Record<string, string> = {
  insufficient: "mute", good: "ok", average: "warn", below: "bad",
};

export type FeedbackRow = {
  status: string;
  ratings: Ratings;
  overall_score: string | null;
  id: number;
  center_id: number;
  center_name: string;
  mentor_name: string;
  visited_on: string;
  rating: number | null;
  topics: string[];
  working_well: string | null;
  needs_attention: string | null;
  parent_voice: string | null;
  urgent: boolean;
  share_with_centre: boolean;
  language: string;
  created_at: string;
};
