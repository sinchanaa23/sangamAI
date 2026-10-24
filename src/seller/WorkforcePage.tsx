// Workforce and fair work (feature F5): the supplier's skills, wages, hours and
// safety, with the Fair Work grade (feature F4) recomputed live as fields change.
// Built for a cooperative or MSME manager on a phone: large fields, little text,
// every question answerable by voice in Hindi, Kannada or Tamil, and typed input
// always available. Workers are stored by skill and wage band only - never by
// name, phone or Aadhaar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { districts, sellers } from '../data';
import { GRADE_LABEL, FAIR_WORK_RULES, labourFromProfile, livingWageFor, minimumWageFor, scoreProfile } from '../fairwork';
import type { WorkforceProfile, WorkforceSkill } from '../fairwork';
import FairWorkBadge, { GRADE_GLOW } from '../components/FairWorkBadge';
import Src from '../components/Src';
import TextReveal from '../components/motion/TextReveal';
import GradientText from '../components/motion/GradientText';
import CountUp from '../components/motion/CountUp';
import Reveal from '../components/motion/Reveal';
import SpotlightCard from '../components/motion/SpotlightCard';
import ClickSpark from '../components/motion/ClickSpark';
import DotGrid from '../components/motion/DotGrid';
import Waves from '../components/motion/Waves';
import Magnetic from '../components/motion/Magnetic';
import SlideTabs from '../components/motion/SlideTabs';
import ShinyText from '../components/motion/ShinyText';
import { loadWorkforce, saveWorkforce } from './workforce';
import type { WorkforceSource } from './workforce';
import { listenOnce, matchChoice, parseNumber, speak, speechSupported, stopSpeaking } from '../voice';
import type { ListenHandle, VoiceLang } from '../voice';
import { VOICE_LANGS } from '../voice';
import { useUi } from '../ui';

type UiLang = 'en' | VoiceLang;

const L = {
  en: {
    intro: 'Buyers see this as the Fair Work grade on every quote. Workers are stored by skill and wage band only - no names, phones or Aadhaar.',
    viewingAs: 'Viewing as', district: 'District', skills: 'Skills and headcount', skill: 'Skill', headcount: 'Workers',
    wage: 'Wage per worker-day (₹)', hours: 'Hours per day', overtime: 'Overtime hours a week', safety: 'Safety record',
    complete: 'Complete', partial: 'Partial', none: 'None', training: 'Training hours a year', women: 'Women employed',
    grievances: 'Open grievances', childFlag: 'Child or forced-labour flag (blocks every deal)',
    addSkill: 'Add a skill', remove: 'Remove', save: 'Save workforce', saving: 'Saving…',
    savedServer: 'Saved to Sangam - buyer agents now see this grade.', savedDevice: 'Saved on this device (the server is offline); it will sync when Sangam is back.',
    gradeTitle: 'Fair Work grade', gradeNote: 'The grade updates as you type.',
    benchmark: 'Living-wage benchmark', minimum: 'State minimum wage', noMinimum: 'Not on file yet for this state - add the notified rate before quoting it.',
    womenShare: "Women's share", workers: 'workers', perDay: '/day',
    voiceTitle: 'Fill by voice', voiceIntro: 'Sangam asks one question at a time and fills the form. Typed answers always work too.',
    voiceStart: 'Start voice questions', stop: 'Stop', skip: 'Skip', listening: 'Listening…',
    heard: 'Heard', notUnderstood: 'Did not catch a number - please type it.', voiceDone: 'Voice answers filled in. Check and correct anything, then save.',
    voiceUnsupported: 'Voice needs the Chrome browser. Typed input always works.',
  },
  'hi-IN': {
    intro: 'खरीदार हर कोटेशन पर इसे फेयर वर्क ग्रेड के रूप में देखते हैं। कर्मचारी केवल कौशल और मज़दूरी दर से जुड़े हैं - नाम, फ़ोन या आधार नहीं।',
    viewingAs: 'इस रूप में', district: 'ज़िला', skills: 'कौशल और कर्मचारी संख्या', skill: 'कौशल', headcount: 'कामगार',
    wage: 'एक दिन की मज़दूरी (₹)', hours: 'एक दिन के घंटे', overtime: 'हफ़्ते के ओवरटाइम घंटे', safety: 'सुरक्षा रिकॉर्ड',
    complete: 'पूरा', partial: 'आंशिक', none: 'नहीं', training: 'सालाना प्रशिक्षण घंटे', women: 'कार्यरत महिलाएँ',
    grievances: 'खुली शिकायतें', childFlag: 'बाल या बंधुआ मज़दूरी का चिह्न (हर सौदा रोकता है)',
    addSkill: 'कौशल जोड़ें', remove: 'हटाएँ', save: 'सहेजें', saving: 'सहेज रहे हैं…',
    savedServer: 'संगम में सहेजा गया - खरीदार एजेंट अब यह ग्रेड देखते हैं।', savedDevice: 'इस डिवाइस पर सहेजा गया (सर्वर बंद है); संगम लौटने पर सिंक होगा।',
    gradeTitle: 'फेयर वर्क ग्रेड', gradeNote: 'टाइप करते ही ग्रेड बदलता है।',
    benchmark: 'लिविंग वेज मानक', minimum: 'राज्य न्यूनतम मज़दूरी', noMinimum: 'इस राज्य के लिए अभी दर्ज नहीं है - बताने से पहले अधिसूचित दर जोड़ें।',
    womenShare: 'महिलाओं की हिस्सेदारी', workers: 'कामगार', perDay: '/दिन',
    voiceTitle: 'बोलकर भरें', voiceIntro: 'संगम एक बार में एक सवाल पूछता है और फ़ॉर्म भरता है। टाइप करके भी हमेशा जवाब दे सकते हैं।',
    voiceStart: 'सवाल सुनकर जवाब दें', stop: 'रोकें', skip: 'छोड़ें', listening: 'सुन रहे हैं…',
    heard: 'सुना गया', notUnderstood: 'अंक नहीं समझ आया - कृपया टाइप करें।', voiceDone: 'जवाब भर दिए गए। जाँच कर सुधारें, फिर सहेजें।',
    voiceUnsupported: 'आवाज़ के लिए Chrome ब्राउज़र चाहिए। टाइप करना हमेशा चलता है।',
  },
  'kn-IN': {
    intro: 'ಖರೀದಿದಾರರು ಪ್ರತಿ ಉಲ್ಲೇಖದಲ್ಲಿ ಇದನ್ನು ಫೇರ್ ವರ್ಕ್ ಗ್ರೇಡ್ ಆಗಿ ನೋಡುತ್ತಾರೆ. ಕಾರ್ಮಿಕರನ್ನು ಕೌಶಲ ಮತ್ತು ಕೂಲಿ ವ್ಯಾಪ್ತಿಯಿಂದ ಮಾತ್ರ ದಾಖಲಿಸಲಾಗುತ್ತದೆ - ಹೆಸರು, ಫೋನ್ ಅಥವಾ ಆಧಾರ್ ಇಲ್ಲ.',
    viewingAs: 'ಇವರಾಗಿ ನೋಡುತ್ತಿದ್ದೀರಿ', district: 'ಜಿಲ್ಲೆ', skills: 'ಕೌಶಲ ಮತ್ತು ಕಾರ್ಮಿಕರ ಸಂಖ್ಯೆ', skill: 'ಕೌಶಲ', headcount: 'ಕಾರ್ಮಿಕರು',
    wage: 'ದಿನದ ಕೂಲಿ (₹)', hours: 'ದಿನದ ಗಂಟೆಗಳು', overtime: 'ವಾರದ ಹೆಚ್ಚುವರಿ ಗಂಟೆ', safety: 'ಸುರಕ್ಷತಾ ದಾಖಲೆ',
    complete: 'ಪೂರ್ಣ', partial: 'ಭಾಗಶಃ', none: 'ಇಲ್ಲ', training: 'ವಾರ್ಷಿಕ ತರಬೇತಿ ಗಂಟೆ', women: 'ಕೆಲಸದಲ್ಲಿರುವ ಮಹಿಳೆಯರು',
    grievances: 'ತೆರೆದ ದೂರುಗಳು', childFlag: 'ಬಾಲ ಅಥವಾ ಬಲವಂತದ ಕಾರ್ಮಿಕತ್ವ ಗುರುತು (ಎಲ್ಲಾ ಒಪ್ಪಂದ ನಿಲ್ಲುತ್ತದೆ)',
    addSkill: 'ಕೌಶಲ ಸೇರಿಸಿ', remove: 'ತೆಗೆದುಹಾಕಿ', save: 'ಉಳಿಸಿ', saving: 'ಉಳಿಸುತ್ತಿದ್ದೀರಿ…',
    savedServer: 'ಸಂಗಮದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ - ಖರೀದಿದಾರ ಏಜೆಂಟ್‌ಗಳು ಈಗ ಈ ಗ್ರೇಡ್ ನೋಡುತ್ತಾರೆ.', savedDevice: 'ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ (ಸರ್ವರ್ ಆಫ್); ಸಂಗಮ ಬಂದಾಗ ಸಿಂಕ್ ಆಗುತ್ತದೆ.',
    gradeTitle: 'ಫೇರ್ ವರ್ಕ್ ಗ್ರೇಡ್', gradeNote: 'ಟೈಪ್ ಮಾಡುವಾಗಲೇ ಗ್ರೇಡ್ ಬದಲಾಗುತ್ತದೆ.',
    benchmark: 'ಜೀವನ ಕೂಲಿ ಮಾನದಂಡ', minimum: 'ರಾಜ್ಯ ಕನಿಷ್ಠ ಕೂಲಿ', noMinimum: 'ಈ ರಾಜ್ಯಕ್ಕೆ ಇನ್ನೂ ದಾಖಲಾಗಿಲ್ಲ - ಹೇಳುವ ಮೊದಲು ಅಧಿಸೂಚಿತ ದರ ಸೇರಿಸಿ.',
    womenShare: 'ಮಹಿಳೆಯರ ಪಾಲು', workers: 'ಕಾರ್ಮಿಕರು', perDay: '/ದಿನ',
    voiceTitle: 'ಧ್ವನಿಯಿಂದ ತುಂಬಿಸಿ', voiceIntro: 'ಸಂಗಮ ಒಂದು ಬಾರಿಗೆ ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳಿ ಫಾರ್ಮ್ ತುಂಬುತ್ತದೆ. ಟೈಪ್ ಮಾಡಿ ಉತ್ತರಿಸುವುದೂ ಯಾವಾಗಲೂ ಸಾಧ್ಯ.',
    voiceStart: 'ಪ್ರಶ್ನೆ ಕೇಳಿ ಉತ್ತರಿಸಿ', stop: 'ನಿಲ್ಲಿಸಿ', skip: 'ಬಿಟ್ಟುಬಿಡಿ', listening: 'ಆಲಿಸುತ್ತಿದ್ದೇವೆ…',
    heard: 'ಕೇಳಿಸಿತು', notUnderstood: 'ಸಂಖ್ಯೆ ಅರ್ಥವಾಗಲಿಲ್ಲ - ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.', voiceDone: 'ಉತ್ತರಗಳು ತುಂಬಿವೆ. ಪರಿಶೀಲಿಸಿ, ತಿದ್ದಿ, ಉಳಿಸಿ.',
    voiceUnsupported: 'ಧ್ವನಿಗೆ Chrome ಬ್ರೌಸರ್ ಬೇಕು. ಟೈಪ್ ಮಾಡುವುದು ಯಾವಾಗಲೂ ಸಾಧ್ಯ.',
  },
  'ta-IN': {
    intro: 'ஒவ்வொரு மேற்கோளிலும் வாங்குபவர்கள் இதை ஃபேர் வொர்க் தரமாகக் காண்கிறார்கள். தொழிலாளர்கள் திறன் மற்றும் கூலி வகைப்படி மட்டுமே பதிவாகிறார்கள் - பெயர், தொலைபேசி அல்லது ஆதார் இல்லை.',
    viewingAs: 'இவராக பார்க்கிறீர்கள்', district: 'மாவட்டம்', skills: 'திறன்கள் மற்றும் தொழிலாளர் எண்ணிக்கை', skill: 'திறன்', headcount: 'தொழிலாளர்கள்',
    wage: 'ஒரு நாள் கூலி (₹)', hours: 'நாள் மணி நேரம்', overtime: 'வாராந்திர கூடுதல் நேரம்', safety: 'பாதுகாப்பு பதிவு',
    complete: 'முழுமை', partial: 'பகுதி', none: 'இல்லை', training: 'ஆண்டு பயிற்சி நேரம்', women: 'வேலையில் உள்ள பெண்கள்',
    grievances: 'திறந்த புகார்கள்', childFlag: 'குழந்தை அல்லது வலுக்கட்டாய வேலை கொடி (ஒவ்வொரு ஒப்பந்தமும் நிறுத்தப்படும்)',
    addSkill: 'திறன் சேர்', remove: 'நீக்கு', save: 'சேமி', saving: 'சேமிக்கிறது…',
    savedServer: 'சங்கத்தில் சேமிக்கப்பட்டது - வாங்கும் முகவர்கள் இப்போது இந்த தரத்தைக் காண்கிறார்கள்.', savedDevice: 'இந்த சாதனத்தில் சேமிக்கப்பட்டது (சேவையகம் இயங்கவில்லை); சங்கம் திரும்பியதும் ஒத்திசைக்கும்.',
    gradeTitle: 'ஃபேர் வொர்க் தரம்', gradeNote: 'தட்டச்சு செய்யும்போதே தரம் மாறும்.',
    benchmark: 'வாழ்க்கை கூலி அளவுகோல்', minimum: 'மாநில குறைந்தபட்ச கூலி', noMinimum: 'இந்த மாநிலத்திற்கு இன்னும் பதிவு இல்லை - சொல்வதற்கு முன் அறிவிக்கப்பட்ட விகிதத்தைச் சேர்க்கவும்.',
    womenShare: 'பெண்களின் பங்கு', workers: 'தொழிலாளர்கள்', perDay: '/நாள்',
    voiceTitle: 'குரலால் நிரப்பு', voiceIntro: 'சங்கம் ஒரு நேரத்தில் ஒரு கேள்வி கேட்டு படிவத்தை நிரப்பும். தட்டச்சு பதிலும் எப்போதும் வேலை செய்யும்.',
    voiceStart: 'கேள்வியைக் கேட்டு பதிலளி', stop: 'நிறுத்து', skip: 'தவிர்', listening: 'கேட்கிறோம்…',
    heard: 'கேட்கப்பட்டது', notUnderstood: 'எண் புரியவில்லை - தயவுசெய்து தட்டச்சு செய்யுங்கள்.', voiceDone: 'பதில்கள் நிரப்பப்பட்டன. சரிபார்த்து திருத்தவும், பின் சேமிக்கவும்.',
    voiceUnsupported: 'குரலுக்கு Chrome உலாவி தேவை. தட்டச்சு எப்போதும் வேலை செய்யும்.',
  },
} as const;

// One question at a time, in the three languages (English shows in the UI too).
interface VoiceQuestion {
  field: keyof Pick<WorkforceProfile, 'hoursPerDay' | 'overtimeHoursPerWeek' | 'trainingHoursPerYear' | 'womenEmployed' | 'openGrievances'> | 'headcount' | 'wage' | 'safety' | 'skill';
  ask: Record<VoiceLang, string>;
}
const QUESTIONS: VoiceQuestion[] = [
  { field: 'headcount', ask: { 'hi-IN': 'काम पर कितने कर्मचारी हैं?', 'kn-IN': 'ಕೆಲಸದಲ್ಲಿ ಎಷ್ಟು ಕಾರ್ಮಿಕರಿದ್ದಾರೆ?', 'ta-IN': 'வேலையில் எத்தனை தொழிலாளர்கள் உள்ளனர்?' } },
  { field: 'skill', ask: { 'hi-IN': 'उनका मुख्य काम क्या है?', 'kn-IN': 'ಅವರ ಮುಖ್ಯ ಕೆಲಸ ಏನು?', 'ta-IN': 'அவர்களின் முக்கிய வேலை என்ன?' } },
  { field: 'wage', ask: { 'hi-IN': 'एक दिन की मज़दूरी कितनी है?', 'kn-IN': 'ಒಂದು ದಿನದ ಕೂಲಿ ಎಷ್ಟು?', 'ta-IN': 'ஒரு நாள் கூலி எவ்வளவு?' } },
  { field: 'hoursPerDay', ask: { 'hi-IN': 'एक दिन में कितने घंटे काम होता है?', 'kn-IN': 'ಒಂದು ದಿನಕ್ಕೆ ಎಷ್ಟು ಗಂಟೆ ಕೆಲಸ?', 'ta-IN': 'ஒரு நாளில் எத்தனை மணி நேரம் வேலை?' } },
  { field: 'overtimeHoursPerWeek', ask: { 'hi-IN': 'हफ़्ते में कितने घंटे ओवरटाइम है?', 'kn-IN': 'ವಾರಕ್ಕೆ ಎಷ್ಟು ಗಂಟೆ ಹೆಚ್ಚುವರಿ ಕೆಲಸ?', 'ta-IN': 'வாரத்திற்கு எத்தனை மணி நேரம் கூடுதல் வேலை?' } },
  { field: 'safety', ask: { 'hi-IN': 'सुरक्षा रिकॉर्ड पूरा है, आंशिक है, या नहीं है?', 'kn-IN': 'ಸುರಕ್ಷತಾ ದಾಖಲೆ ಪೂರ್ಣವೋ, ಭಾಗಶಃವೋ ಅಥವಾ ಇಲ್ಲವೋ?', 'ta-IN': 'பாதுகாப்பு பதிவு முழுமையானதா, பகுதியானதா, அல்லது இல்லையா?' } },
  { field: 'womenEmployed', ask: { 'hi-IN': 'कितनी महिलाएँ काम करती हैं?', 'kn-IN': 'ಎಷ್ಟು ಮಹಿಳೆಯರು ಕೆಲಸ ಮಾಡುತ್ತಾರೆ?', 'ta-IN': 'எத்தனை பெண்கள் வேலை செய்கிறார்கள்?' } },
  { field: 'trainingHoursPerYear', ask: { 'hi-IN': 'साल में कितने घंटे प्रशिक्षण मिलता है?', 'kn-IN': 'ವರ್ಷಕ್ಕೆ ಎಷ್ಟು ಗಂಟೆ ತರಬೇತಿ?', 'ta-IN': 'ஆண்டுக்கு எத்தனை மணி நேரம் பயிற்சி?' } },
  { field: 'openGrievances', ask: { 'hi-IN': 'कोई शिकायत खुली है? कितनी?', 'kn-IN': 'ಯಾವುದೇ ದೂರು ತೆರೆದಿದೆಯೇ? ಎಷ್ಟು?', 'ta-IN': 'எந்த புகார் திறந்திருக்கிறதா? எத்தனை?' } },
];
const SAFETY_WORDS = {
  complete: ['पूरा', 'पूरी', 'ಪೂರ್ಣ', 'முழு'],
  partial: ['आंशिक', 'अधूरा', 'ಭಾಗಶಃ', 'பகுதி'],
  none: ['नहीं', 'इल्ल', 'ಇಲ್ಲ', 'இல்லை'],
} as const;

const BLANK = (district: string): WorkforceProfile => ({
  supplierId: '', district, skills: [{ skill: '', headcount: 0, wagePerWorkerDay: 0 }],
  hoursPerDay: 8, overtimeHoursPerWeek: 0, safetyRecord: 'complete', trainingHoursPerYear: 0,
  womenEmployed: 0, childOrForcedLabourFlag: false, openGrievances: 0, updatedAt: '',
});

export default function WorkforcePage() {
  const { actingSeller, setActingSeller } = useUi();
  const seller = sellers.find((s) => s.id === actingSeller) ?? sellers[0];
  const [lang, setLang] = useState<UiLang>('en');
  const t = L[lang];
  const [profile, setProfile] = useState<WorkforceProfile>(() => BLANK(seller ? districts.find((d) => d.id === seller.districtId)?.name ?? '' : ''));
  const [source, setSource] = useState<WorkforceSource>('blank');
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>('hi-IN');
  const [voiceStep, setVoiceStep] = useState<number | null>(null); // index into QUESTIONS while running
  const [heard, setHeard] = useState('');
  const listenRef = useRef<ListenHandle | null>(null);
  const canVoice = speechSupported();

  // load when the acting seller changes: server, then this device, then demo seed
  useEffect(() => {
    if (!seller) return;
    let alive = true;
    setLoading(true);
    setSaveMsg('');
    loadWorkforce(seller.id, seller.name).then(({ profile: p, source: s }) => {
      if (!alive) return;
      setSource(s);
      setProfile(p ?? BLANK(districts.find((d) => d.id === seller.districtId)?.name ?? ''));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [seller?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof WorkforceProfile>(key: K, value: WorkforceProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const setSkill = (i: number, patch: Partial<WorkforceSkill>) =>
    setProfile((p) => ({ ...p, skills: p.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const score = useMemo(() => (profile.skills.length ? scoreProfile(profile) : null), [profile]);
  const labour = useMemo(() => labourFromProfile(profile), [profile]);
  const living = useMemo(() => livingWageFor(profile.district), [profile.district]);
  const min = useMemo(() => minimumWageFor(profile.district), [profile.district]);

  const stopVoice = useCallback(() => {
    listenRef.current?.stop();
    listenRef.current = null;
    stopSpeaking();
    setVoiceStep(null);
    setHeard('');
  }, []);

  useEffect(() => stopVoice, [stopVoice]); // stop on unmount

  // ask one question, wait for the answer, fill the field, move to the next
  const askQuestion = useCallback((idx: number) => {
    if (idx >= QUESTIONS.length) {
      stopSpeaking();
      setVoiceStep(null);
      setSaveMsg(t.voiceDone);
      return;
    }
    const q = QUESTIONS[idx];
    setVoiceStep(idx);
    setHeard('');
    speak(q.ask[voiceLang], voiceLang);
    // wait for speech to finish (or a beat) before opening the mic
    const wait = setTimeout(() => {
      listenRef.current = listenOnce(voiceLang, {
        onPartial: setHeard,
        onFinal: (text) => {
          setHeard(text);
          if (q.field === 'safety') {
            const pick = matchChoice(text, SAFETY_WORDS);
            if (pick) set('safetyRecord', pick);
          } else if (q.field === 'skill') {
            if (text) setSkill(0, { skill: text });
          } else if (q.field === 'headcount') {
            const n = parseNumber(text);
            if (n != null) setSkill(0, { headcount: Math.max(0, Math.round(n)) });
          } else if (q.field === 'wage') {
            const n = parseNumber(text);
            if (n != null) setSkill(0, { wagePerWorkerDay: Math.max(0, Math.round(n)) });
          } else {
            const n = parseNumber(text);
            if (n != null) set(q.field as 'hoursPerDay', Math.max(0, Math.round(n)));
          }
          setTimeout(() => askQuestion(idx + 1), 600);
        },
        onError: () => { /* stay on this question; the user can repeat by voice or type */ },
      });
    }, 900);
    return () => clearTimeout(wait);
  }, [voiceLang, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!seller) return;
    setSaving(true);
    setSaveMsg('');
    const { supplierId: _id, updatedAt: _u, ...input } = profile;
    const where = await saveWorkforce(seller.id, input);
    setSaving(false);
    setSource(where === 'server' ? 'server' : 'device');
    setSaveMsg(where === 'server' ? t.savedServer : t.savedDevice);
  };

  if (!seller) return null;
  const totalWorkers = labour.workers;

  return (
    <div className="stack" style={{ position: 'relative' }}>
      <DotGrid dim={0.1} spacing={28} />
      <div>
        <TextReveal as="h1" className="lead" text={`${t.gradeTitle} · ${t.skills}`} />
        <p className="muted" style={{ marginTop: 6 }}>{t.intro}</p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small">{t.viewingAs}</span>
          <select className="sector-pick" value={seller.id} aria-label={t.viewingAs} onChange={(e) => setActingSeller(e.target.value)}>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="row" style={{ gap: 4 }}>
            {(['en', ...VOICE_LANGS.map((v) => v.code)] as UiLang[]).map((code) => (
              <button key={code} className={`pill ${lang === code ? 'on' : ''}`} onClick={() => setLang(code)}>
                {code === 'en' ? 'EN' : VOICE_LANGS.find((v) => v.code === code)!.native}
              </button>
            ))}
          </span>
        </div>
        {source !== 'blank' && (
          <p className="tiny" style={{ margin: 0 }}>
            {source === 'seed' && <>Demo workforce from the EV story, tagged </>}
            {source === 'device' && <>Workforce saved on this device, tagged </>}
            {source === 'server' && <>Workforce from the Sangam server, tagged </>}
            <Src kind={source === 'seed' ? 'simulated' : source === 'server' ? 'verified' : 'declared'} />
          </p>
        )}
      </div>

      {/* live grade */}
      <div style={{ position: 'relative' }}>
        <Waves opacity={0.3} />
        <SpotlightCard className="card"><div className="stack fw-glass fw-glow" style={{ gap: 10, '--fw-glow-color': score ? GRADE_GLOW[score.grade] : undefined } as CSSProperties}>
        <div className="section-title" style={{ margin: 0 }}>{t.gradeTitle}</div>
        {loading ? <p className="muted">…</p> : score && (
          <>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <FairWorkBadge score={score} />
              <span className="muted small"><GradientText>{GRADE_LABEL[score.grade]}</GradientText> · {t.gradeNote}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
              {score.reasons.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
            </ul>
            <div className="row small" style={{ gap: 14, flexWrap: 'wrap' }}>
              <span>
                {t.benchmark}: {living ? <><CountUp value={living.perDayInr} />{t.perDay} <Src kind={score.benchmarkTag} /> ({living.region})</> : '—'}
              </span>
              <span>
                {t.minimum}: {min ? <><CountUp value={min.perDayInr} />{t.perDay} ({min.asNotified})</> : <span className="muted">{t.noMinimum}</span>}
              </span>
              <span>{t.womenShare}: <span className="fw-grad-text"><CountUp value={Math.round(labour.womenShare * 100)} format={(n) => `${n}%`} /></span></span>
              <span>{t.headcount}: <span className="fw-grad-text"><CountUp value={totalWorkers} /></span></span>
            </div>
          </>
        )}
      </div></SpotlightCard>
      </div>

      {/* the form: typed input always available */}
      <Reveal>
      <div className="card stack" style={{ gap: 14 }}>
        <label className="field">{t.district}
          <select value={profile.district} onChange={(e) => set('district', e.target.value)}>
            {districts.map((d) => <option key={d.id} value={d.name}>{d.name}, {d.state}</option>)}
          </select>
        </label>

        <div>
          <div className="section-title" style={{ margin: 0 }}>{t.skills}</div>
          <table>
            <thead><tr><th>{t.skill}</th><th>{t.headcount}</th><th>{t.wage}</th><th /></tr></thead>
            <tbody>
              {profile.skills.map((s, i) => (
                <tr key={i}>
                  <td><input className="cell" value={s.skill} onChange={(e) => setSkill(i, { skill: e.target.value })} /></td>
                  <td><input className="cell" type="number" min={0} value={s.headcount} onChange={(e) => setSkill(i, { headcount: Number(e.target.value) })} /></td>
                  <td><input className="cell" type="number" min={0} value={s.wagePerWorkerDay} onChange={(e) => setSkill(i, { wagePerWorkerDay: Number(e.target.value) })} /></td>
                  <td>
                    {profile.skills.length > 1 && (
                      <button className="btn small" onClick={() => set('skills', profile.skills.filter((_, j) => j !== i))}>{t.remove}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn small" style={{ marginTop: 8 }}
            onClick={() => set('skills', [...profile.skills, { skill: '', headcount: 0, wagePerWorkerDay: 0 }])}>{t.addSkill}</button>
        </div>

        <div className="form-grid">
          <label className="field">{t.hours}<input type="number" min={0} max={24} step={0.5} value={profile.hoursPerDay} onChange={(e) => set('hoursPerDay', Number(e.target.value))} /></label>
          <label className="field">{t.overtime}<input type="number" min={0} max={80} value={profile.overtimeHoursPerWeek} onChange={(e) => set('overtimeHoursPerWeek', Number(e.target.value))} /></label>
          <label className="field">{t.training}<input type="number" min={0} value={profile.trainingHoursPerYear} onChange={(e) => set('trainingHoursPerYear', Number(e.target.value))} /></label>
          <label className="field">{t.women}<input type="number" min={0} value={profile.womenEmployed} onChange={(e) => set('womenEmployed', Number(e.target.value))} /></label>
          <label className="field">{t.grievances}<input type="number" min={0} value={profile.openGrievances} onChange={(e) => set('openGrievances', Number(e.target.value))} /></label>
        </div>

        <div className="field">
          <div className="section-title" style={{ margin: 0 }}>{t.safety}</div>
          <SlideTabs<'complete' | 'partial' | 'none'>
            items={[
              { id: 'complete', label: t.complete },
              { id: 'partial', label: t.partial },
              { id: 'none', label: t.none },
            ]}
            value={profile.safetyRecord}
            onChange={(v) => set('safetyRecord', v)}
          />
        </div>

        <label className="row" style={{ gap: 8, alignItems: 'center', color: '#9f2f2d', fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={profile.childOrForcedLabourFlag} onChange={(e) => set('childOrForcedLabourFlag', e.target.checked)} />
          <span>{t.childFlag}</span>
        </label>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Magnetic>
            <ClickSpark>
              <button className="btn primary" disabled={saving || !profile.district || !profile.skills.some((s) => s.headcount > 0)} onClick={save}>
                <ShinyText>{saving ? t.saving : t.save}</ShinyText>
              </button>
            </ClickSpark>
          </Magnetic>
          {saveMsg && <span className="small">{saveMsg}</span>}
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Legal hours ceiling {FAIR_WORK_RULES.maxHoursPerDay}/day and {FAIR_WORK_RULES.maxOvertimeHoursPerWeek} h/week overtime; a missing safety record or an open grievance lowers the grade one step; a child- or forced-labour flag blocks every deal.
        </p>
      </div>
      </Reveal>

      {/* voice: one question at a time */}
      <Reveal>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>{t.voiceTitle}</div>
        <p className="muted small" style={{ margin: 0 }}>{t.voiceIntro}</p>
        {!canVoice && <div className="note">{t.voiceUnsupported}</div>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="sector-pick" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as VoiceLang)} aria-label="Voice language">
            {VOICE_LANGS.map((v) => <option key={v.code} value={v.code}>{v.native} ({v.english})</option>)}
          </select>
          {voiceStep == null ? (
            <Magnetic>
              <ClickSpark>
                <button className="btn primary" disabled={!canVoice} onClick={() => askQuestion(0)}><ShinyText>{t.voiceStart}</ShinyText></button>
              </ClickSpark>
            </Magnetic>
          ) : (
            <>
              <button className="btn" onClick={stopVoice}>{t.stop}</button>
              <button className="btn" onClick={() => { listenRef.current?.stop(); askQuestion((voiceStep ?? 0) + 1); }}>{t.skip}</button>
            </>
          )}
        </div>
        {voiceStep != null && (
          <div className="note">
            <b>{QUESTIONS[voiceStep].ask[voiceLang]}</b>
            <div className="muted small" style={{ marginTop: 4 }}>
              {heard ? <>{t.heard}: “{heard}”</> : t.listening}
            </div>
          </div>
        )}
      </div>
      </Reveal>
    </div>
  );
}
