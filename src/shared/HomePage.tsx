import { useRef } from 'react';
import type { Workspace } from '../ui';
import Confluence from '../components/Confluence';
import WaveDivider from '../components/WaveDivider';
import { gsap, MOTION_OK, NO_MOTION, ScrollTrigger, SplitText, useGSAP } from '../gsapSetup';
import { useUiLang, type UiLang } from '../i18n';

// Landing-page strings per UI language. `en` is the original English copy.
type Strings = {
  headline: string;
  lede: string;
  ctaNegotiate: string;
  ctaImpact: string;
  sectors: [string, string, string];
  doorsAria: string;
  doors: { title: string; who: string; does: string; open: string; shortcuts?: { label: string }[] }[];
  linksAria: string;
  stepsTitle: string;
  stepsCaption: string;
  steps: { name: string; text: string }[];
  sdgTitle: string;
  sdgBody: string;
  sdgCtaNegotiate: string;
  sdgCtaImpact: string;
};

const STRINGS: Record<UiLang, Strings> = {
  en: {
    headline: 'Supply chains India can build, with wages people can live on.',
    lede: 'Sangam means the place where rivers meet. Here, buyers and producers meet, with a third thing running beneath them both: a living wage. An agent on each side negotiates the order, and no contract can pay below the floor.',
    ctaNegotiate: 'Watch an agent negotiation',
    ctaImpact: 'See the SDG 8 impact',
    sectors: ['Manufacturing', 'Construction materials', 'Agri and food processing'],
    doorsAria: 'Choose where to start',
    doors: [
      {
        title: 'I need parts or products',
        who: 'Manufacturers, builders, food processors, public buyers',
        does: 'See which inputs depend on one country, get ranked Indian supply chains and a switch-over plan, and let your agent negotiate the order.',
        open: 'Open',
        shortcuts: [{ label: 'Supply chain today' }, { label: 'Indian options' }, { label: 'Future network' }, { label: 'Agent negotiation' }],
      },
      {
        title: 'I make things',
        who: 'MSMEs, FPOs, SHGs, cooperatives, ODOP clusters',
        does: 'See pooled demand for what you make, close gaps with scheme support, team up in consortia, and let your agent quote for you.',
        open: 'Open',
      },
      {
        title: 'I build clusters and check claims',
        who: 'The Sangam team, districts and states',
        does: 'See where demand meets local capability, verify suppliers, sign skill and audit credentials, and track SDG 8 impact.',
        open: 'Open',
      },
    ],
    linksAria: 'Jump to',
    stepsTitle: 'How the rivers meet',
    stepsCaption: 'Like the Triveni Sangam at Prayagraj, where the Ganga and Yamuna meet and the Saraswati is said to join unseen.',
    steps: [
      { name: 'Buyers', text: 'A company’s demand, broken into parts and process steps, with India’s real imports for each.' },
      { name: 'Producers', text: 'Cooperatives, SHGs and MSMEs with real capacity, marked ready, potential with named gaps, or a true gap, and mapped against each district’s climate, power and freight links.' },
      { name: 'Fair work', text: 'The river you do not see: a living-wage floor for every district and an auditor that no negotiation can pass below.' },
      { name: 'The confluence', text: 'An agent on each side negotiates, the auditor grades wages, hours and safety, and one signed deal carries all three.' },
    ],
    sdgTitle: 'The SDG 8 decent-work layer',
    sdgBody: 'Once the chain is designed, agents for the buyer and each supplier negotiate, and no offer may pay below the district’s living wage. An Auditor Agent grades wages, hours and safety, Sangam signs the contract and the workers’ skills, and every deal counts towards jobs, fair pay and rural income.',
    sdgCtaNegotiate: 'Agent negotiation',
    sdgCtaImpact: 'SDG 8 impact',
  },
  hi: {
    headline: 'भारत के हाथ से बनी सप्लाई चेन, और ऐसी मज़दूरी जिस पर इंसान जी सके।',
    lede: 'संगम का मतलब है वह जगह जहाँ नदियाँ मिलती हैं। यहाँ खरीदार और उत्पादक मिलते हैं, और दोनों के नीचे एक तीसरी धारा बहती है: सम्मानजनक जीवन-मज़दूरी। हर तरफ़ एक एजेंट ऑर्डर पर बातचीत करता है, और कोई अनुबंध तय न्यूनतम से कम भुगतान नहीं कर सकता।',
    ctaNegotiate: 'एजेंट की बातचीत देखें',
    ctaImpact: 'SDG 8 का असर देखें',
    sectors: ['मैन्युफैक्चरिंग', 'निर्माण सामग्री', 'कृषि और खाद्य प्रसंस्करण'],
    doorsAria: 'शुरुआत कहाँ से करें, चुनें',
    doors: [
      {
        title: 'मुझे पार्ट्स या प्रोडक्ट चाहिए',
        who: 'मैन्युफैक्चरर, बिल्डर, खाद्य प्रोसेसर, सरकारी खरीदार',
        does: 'देखें कि कौन-से इनपुट किस एक देश पर निर्भर हैं, भारतीय सप्लाई चेन की रैंकिंग और स्विचओवर योजना पाएँ, और ऑर्डर की बातचीत अपने एजेंट से करवाएँ।',
        open: 'खोलें',
        shortcuts: [{ label: 'आज की सप्लाई चेन' }, { label: 'भारतीय विकल्प' }, { label: 'भविष्य का नेटवर्क' }, { label: 'एजेंट बातचीत' }],
      },
      {
        title: 'मैं चीज़ें बनाता हूँ',
        who: 'MSME, FPO, SHG, सहकारी समितियाँ, ODOP क्लस्टर',
        does: 'अपनी बनाई चीज़ों की पूल की हुई माँग देखें, योजना सहायता से कमियाँ पूरी करें, संघों में साथ जुड़ें, और कोटेशन देने का काम अपने एजेंट पर छोड़ें।',
        open: 'खोलें',
      },
      {
        title: 'मैं क्लस्टर बनाता हूँ और दावों की जाँच करता हूँ',
        who: 'संगम टीम, ज़िले और राज्य',
        does: 'देखें कि माँग कहाँ स्थानीय क्षमता से मिलती है, सप्लायर सत्यापित करें, स्किल और ऑडिट प्रमाणपत्र पर हस्ताक्षर करें, और SDG 8 के असर पर नज़र रखें।',
        open: 'खोलें',
      },
    ],
    linksAria: 'सीधे जाएँ',
    stepsTitle: 'नदियाँ कैसे मिलती हैं',
    stepsCaption: 'जैसे प्रयागराज का त्रिवेणी संगम, जहाँ गंगा और यमुना मिलती हैं और कहा जाता है कि सरस्वती अदृश्य रूप से उनसे जुड़ती है।',
    steps: [
      { name: 'खरीदार', text: 'एक कंपनी की माँग, पार्ट्स और प्रक्रिया के चरणों में बँटी हुई, और हर एक के लिए भारत की असली इम्पोर्ट।' },
      { name: 'उत्पादक', text: 'असली क्षमता वाले सहकारी समितियाँ, SHG और MSME — कुछ तैयार, कुछ नाम लेकर बताई गई कमियों के साथ संभावित, और कुछ में सचमुच कमी — सब हर ज़िले की जलवायु, बिजली और माल-परिवहन लिंक के साथ मैप।' },
      { name: 'निष्पक्ष कार्य', text: 'वह नदी जो दिखती नहीं: हर ज़िले के लिए जीवन-मज़दूरी की नींव, और एक ऑडिटर जिसके नीचे कोई बातचीत नहीं उतर सकती।' },
      { name: 'संगम', text: 'हर तरफ़ एक एजेंट बातचीत करता है, ऑडिटर मज़दूरी, घंटे और सुरक्षा पर ग्रेड देता है, और एक हस्ताक्षरित सौदा तीनों को साथ लाता है।' },
    ],
    sdgTitle: 'SDG 8 की सम्मानजनक कार्य परत',
    sdgBody: 'चेन डिज़ाइन होते ही खरीदार और हर सप्लायर के एजेंट बातचीत करते हैं, और कोई ऑफ़र ज़िले की जीवन-मज़दूरी से कम भुगतान नहीं कर सकता। एक ऑडिटर एजेंट मज़दूरी, घंटे और सुरक्षा पर ग्रेड देता है, संगम अनुबंध और श्रमिकों के स्किल पर हस्ताक्षर करता है, और हर सौदा रोज़गार, उचित मज़दूरी और ग्रामीण आय की ओर गिना जाता है।',
    sdgCtaNegotiate: 'एजेंट बातचीत',
    sdgCtaImpact: 'SDG 8 प्रभाव',
  },
  kn: {
    headline: 'ಭಾರತವು ಕಟ್ಟಬಲ್ಲ ಪೂರೈಕೆ ಸರಪಳಿಗಳು, ಜನ ಬದುಕಬಲ್ಲ ಕೂಲಿಯೊಂದಿಗೆ.',
    lede: 'ಸಂಗಮ ಎಂದರೆ ನದಿಗಳು ಸೇರುವ ಸ್ಥಳ. ಇಲ್ಲಿ ಖರೀದಿಗರು ಮತ್ತು ಉತ್ಪಾದಕರು ಸೇರುತ್ತಾರೆ, ಇಬ್ಬರ ಕೆಳಗೂ ಮೂರನೇ ಹರಿವು ಅಡಗಿರುತ್ತದೆ: ಗೌರವಾನ್ವಿತ ಬದುಕು-ಕೂಲಿ. ಪ್ರತಿ ಪಕ್ಷದಲ್ಲೂ ಒಬ್ಬ ಏಜೆಂಟ್ ಆರ್ಡರ್ ಬಗ್ಗೆ ಮಾತುಕತೆ ನಡೆಸುತ್ತಾನೆ, ಮತ್ತು ಯಾವ ಒಪ್ಪಂದವೂ ಕನಿಷ್ಠ ಮಿತಿಗಿಂತ ಕಡಿಮೆ ಪಾವತಿಸಲಾರದು.',
    ctaNegotiate: 'ಏಜೆಂಟ್ ಮಾತುಕತೆ ವೀಕ್ಷಿಸಿ',
    ctaImpact: 'SDG 8 ಪರಿಣಾಮ ನೋಡಿ',
    sectors: ['ಉತ್ಪಾದನೆ', 'ನಿರ್ಮಾಣ ಸಾಮಗ್ರಿ', 'ಕೃಷಿ ಮತ್ತು ಆಹಾರ ಸಂಸ್ಕರಣೆ'],
    doorsAria: 'ಎಲ್ಲಿಂದ ಶುರುಮಾಡಬೇಕೆಂದು ಆಯ್ಕೆ ಮಾಡಿ',
    doors: [
      {
        title: 'ನನಗೆ ಭಾಗಗಳು ಅಥವಾ ಉತ್ಪನ್ನಗಳು ಬೇಕು',
        who: 'ಉತ್ಪಾದಕರು, ಗುತ್ತಿಗೆದಾರರು, ಆಹಾರ ಸಂಸ್ಕರಣಗಾರರು, ಸಾರ್ವಜನಿಕ ಖರೀದಿಗರು',
        does: 'ಯಾವ ಇನ್‌ಪುಟ್‌ಗಳು ಒಂದೇ ದೇಶವನ್ನು ಅವಲಂಬಿಸಿವೆ ಎಂದು ನೋಡಿ, ಶ್ರೇಯಾಂಕಿತ ಭಾರತೀಯ ಪೂರೈಕೆ ಸರಪಳಿಗಳು ಮತ್ತು ಬದಲಾವಣೆ ಯೋಜನೆ ಪಡೆಯಿರಿ, ಆರ್ಡರ್‌ನ ಮಾತುಕತೆ ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ಬಿಡಿ.',
        open: 'ತೆರೆಯಿರಿ',
        shortcuts: [{ label: 'ಇಂದಿನ ಪೂರೈಕೆ ಸರಪಳಿ' }, { label: 'ಭಾರತೀಯ ಆಯ್ಕೆಗಳು' }, { label: 'ಭವಿಷ್ಯದ ಜಾಲ' }, { label: 'ಏಜೆಂಟ್ ಮಾತುಕತೆ' }],
      },
      {
        title: 'ನಾನು ವಸ್ತುಗಳನ್ನು ತಯಾರಿಸುತ್ತೇನೆ',
        who: 'MSME, FPO, SHG, ಸಹಕಾರ ಸಂಘಗಳು, ODOP ಸಮೂಹಗಳು',
        does: 'ನೀವು ತಯಾರಿಸುವುದರ ಒಟ್ಟುಗೂಡಿದ ಬೇಡಿಕೆಯನ್ನು ನೋಡಿ, ಯೋಜನಾ ನೆರವಿನಿಂದ ಕೊರತೆಗಳನ್ನು ತುಂಬಿ, ಒಕ್ಕೂಟಗಳಲ್ಲಿ ಸೇರಿ, ಉಲ್ಲೇಖ ನೀಡುವ ಕೆಲಸ ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ಬಿಡಿ.',
        open: 'ತೆರೆಯಿರಿ',
      },
      {
        title: 'ನಾನು ಸಮೂಹ ಕಟ್ಟುತ್ತೇನೆ, ಹೇಳಿಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ',
        who: 'ಸಂಗಮ ತಂಡ, ಜಿಲ್ಲೆಗಳು ಮತ್ತು ರಾಜ್ಯಗಳು',
        does: 'ಬೇಡಿಕೆ ಎಲ್ಲಿ ಸ್ಥಳೀಯ ಸಾಮರ್ಥ್ಯವನ್ನು ಸೇರುತ್ತದೆ ಎಂದು ನೋಡಿ, ಪೂರೈಕೆದಾರರನ್ನು ಪರಿಶೀಲಿಸಿ, ಕೌಶಲ ಮತ್ತು ಆಡಿಟ್ ಪ್ರಮಾಣಪತ್ರಗಳಿಗೆ ಸಹಿ ಹಾಕಿ, SDG 8 ಪರಿಣಾಮವನ್ನು ಗಮನಿಸಿ.',
        open: 'ತೆರೆಯಿರಿ',
      },
    ],
    linksAria: 'ನೇರವಾಗಿ ಹೋಗಿ',
    stepsTitle: 'ನದಿಗಳು ಹೇಗೆ ಸೇರುತ್ತವೆ',
    stepsCaption: 'ಪ್ರಯಾಗರಾಜದ ತ್ರಿವೇಣಿ ಸಂಗಮದಂತೆ, ಅಲ್ಲಿ ಗಂಗಾ ಮತ್ತು ಯಮುನೆ ಸೇರುತ್ತವೆ, ಸರಸ್ವತಿ ಕಾಣದೆ ಸೇರುತ್ತಾಳೆಂದು ನಂಬಲಾಗಿದೆ.',
    steps: [
      { name: 'ಖರೀದಿಗರು', text: 'ಒಂದು ಕಂಪನಿಯ ಬೇಡಿಕೆ, ಭಾಗಗಳು ಮತ್ತು ಪ್ರಕ್ರಿಯೆಯ ಹಂತಗಳಾಗಿ ವಿಭಜಿತವಾಗಿ, ಪ್ರತಿಯೊಂದಕ್ಕೂ ಭಾರತದ ನಿಜವಾದ ಆಮದುಗಳೊಂದಿಗೆ.' },
      { name: 'ಉತ್ಪಾದಕರು', text: 'ನಿಜವಾದ ಸಾಮರ್ಥ್ಯವುಳ್ಳ ಸಹಕಾರ ಸಂಘ, SHG ಮತ್ತು MSME ಗಳು — ಕೆಲವು ಸಿದ್ಧ, ಕೆಲವು ಹೆಸರಿಸಿದ ಕೊರತೆಗಳೊಂದಿಗೆ ಸಾಧ್ಯತೆ, ಇನ್ನು ಕೆಲವು ನಿಜವಾದ ಕೊರತೆ — ಎಲ್ಲವೂ ಪ್ರತಿ ಜಿಲ್ಲೆಯ ಹವಾಮಾನ, ವಿದ್ಯುತ್ ಮತ್ತು ಸಾರಿಗೆ ಸಂಪರ್ಕಗಳೊಂದಿಗೆ ನಕ್ಷೆಯಲ್ಲಿ.' },
      { name: 'ನ್ಯಾಯಯುತ ಕೆಲಸ', text: 'ನೋಡದ ನದಿ: ಪ್ರತಿ ಜಿಲ್ಲೆಗೂ ಬದುಕು-ಕೂಲಿಯ ಕನಿಷ್ಠ ಮಿತಿ, ಮತ್ತು ಯಾವ ಮಾತುಕತೆಯೂ ಕೆಳಗೆ ಇಳಿಯಲಾರದ ಆಡಿಟರ್.' },
      { name: 'ಸಂಗಮ', text: 'ಪ್ರತಿ ಪಕ್ಷದಲ್ಲೂ ಒಬ್ಬ ಏಜೆಂಟ್ ಮಾತುಕತೆ ನಡೆಸುತ್ತಾನೆ, ಆಡಿಟರ್ ಕೂಲಿ, ಗಂಟೆಗಳು ಮತ್ತು ಸುರಕ್ಷತೆಗೆ ಶ್ರೇಯಾಂಕ ನೀಡುತ್ತಾನೆ, ಮತ್ತು ಒಂದೇ ಸಹಿಯಾದ ಒಪ್ಪಂದ ಮೂರನ್ನೂ ಒಟ್ಟಿಗೆ ತರುತ್ತದೆ.' },
    ],
    sdgTitle: 'SDG 8 ಗೌರವಾನ್ವಿತ ಕಾರ್ಯ ಪದರ',
    sdgBody: 'ಸರಪಳಿ ವಿನ್ಯಾಸಗೊಂಡ ಕೂಡಲೇ ಖರೀದಿಗರ ಮತ್ತು ಪ್ರತಿ ಪೂರೈಕೆದಾರರ ಏಜೆಂಟ್‌ಗಳು ಮಾತುಕತೆ ನಡೆಸುತ್ತವೆ, ಮತ್ತು ಯಾವ ಪ್ರಸ್ತಾವವೂ ಜಿಲ್ಲೆಯ ಬದುಕು-ಕೂಲಿಗಿಂತ ಕಡಿಮೆ ಪಾವತಿಸಲಾರದು. ಒಬ್ಬ ಆಡಿಟರ್ ಏಜೆಂಟ್ ಕೂಲಿ, ಗಂಟೆಗಳು ಮತ್ತು ಸುರಕ್ಷತೆಗೆ ಶ್ರೇಯಾಂಕ ನೀಡುತ್ತಾನೆ, ಸಂಗಮ ಒಪ್ಪಂದ ಮತ್ತು ಕಾರ್ಮಿಕರ ಕೌಶಲಗಳಿಗೆ ಸಹಿ ಹಾಕುತ್ತದೆ, ಮತ್ತು ಪ್ರತಿ ಒಪ್ಪಂದವೂ ಉದ್ಯೋಗ, ಸಮರ್ಪಕ ಕೂಲಿ ಮತ್ತು ಗ್ರಾಮೀಣ ಆದಾಯದ ಕಡೆಗೆ ಎಣಿಸಲ್ಪಡುತ್ತದೆ.',
    sdgCtaNegotiate: 'ಏಜೆಂಟ್ ಮಾತುಕತೆ',
    sdgCtaImpact: 'SDG 8 ಪರಿಣಾಮ',
  },
};

// Door structure per language: the workspace/page wiring below never changes,
// only the strings above do.
const DOORS: { w: Workspace; page: string; shortcuts?: { page: string }[] }[] = [
  { w: 'buyer', page: 'today', shortcuts: [{ page: 'today' }, { page: 'india' }, { page: 'network' }, { page: 'negotiate' }] },
  { w: 'supplier', page: 'overview' },
  { w: 'ecosystem', page: 'districts' },
];

// One step per river, then the meeting. The scroll animation draws each river as its step comes into view.

export default function HomePage({ go }: { go: (w: Workspace, page: string) => void }) {
  const { lang } = useUiLang();
  const t = STRINGS[lang];
  const stepsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // The headline rises in word by word from behind each line, the rest follows; scrolling away lets the hero drift and fade
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      SplitText.create('h1', {
        type: 'lines, words', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.words, { yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.05, delay: 0.1 }),
      });
      gsap.from(['.eyebrow', '.lede', '.home-actions', '.home-meta'], { autoAlpha: 0, y: 18, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.45 });
      const away = { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.home-hero-text', { yPercent: -14, autoAlpha: 0.2, ease: 'none', scrollTrigger: away });
      gsap.to('.home-hero-art', { y: 90, scale: 0.92, ease: 'none', scrollTrigger: away });
    });
    return () => mm.revert();
  }, { scope: heroRef });

  // Each step lights up as it crosses the middle of the screen (all lit when motion is reduced)
  useGSAP(() => {
    const mm = gsap.matchMedia();
    const items = gsap.utils.toArray<HTMLElement>('li', listRef.current);
    mm.add(MOTION_OK, () => {
      items.forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 62%', end: 'bottom 62%', toggleClass: { targets: li, className: 'on' } }));
    });
    mm.add(NO_MOTION, () => { items.forEach((li) => li.classList.add('on')); });
    return () => mm.revert();
  }, { scope: stepsRef });

  return (
    <div className="home">
      <section className="home-hero" ref={heroRef}>
        <div className="home-hero-text">
          <div className="eyebrow">आत्मनिर्भर भारत · विकसित भारत</div>
          <h1>{t.headline}</h1>
          <p className="lede">{t.lede}</p>
          <div className="home-actions">
            <button className="btn primary" onClick={() => go('buyer', 'negotiate')}>{t.ctaNegotiate}</button>
            <button className="link-btn" onClick={() => go('ecosystem', 'impact')}>{t.ctaImpact}</button>
          </div>
          <div className="home-meta"><span>{t.sectors[0]}</span><span>{t.sectors[1]}</span><span>{t.sectors[2]}</span></div>
        </div>
        <div className="home-hero-art"><Confluence mode="intro" /></div>
      </section>

      <section className="home-doors" aria-label={t.doorsAria}>
        {DOORS.map((d, i) => {
          const s = t.doors[i];
          return (
            <div key={d.w} className={`door${i === 0 ? ' first' : ''}`}>
              <button className="door-main" onClick={() => go(d.w, d.page)}>
                <div>
                  <span className="idx">0{i + 1}</span>
                  <h2>{s.title}</h2>
                  <div className="who">{s.who}</div>
                  <p>{s.does}</p>
                </div>
                <span className="go">{s.open} <span aria-hidden="true">→</span></span>
              </button>
              {d.shortcuts && s.shortcuts && (
                <ul className="door-links" aria-label={t.linksAria}>
                  {d.shortcuts.map((x, j) => <li key={x.page}><button className="door-link" onClick={() => go(d.w, x.page)}>{s.shortcuts![j].label}<span aria-hidden="true">→</span></button></li>)}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <WaveDivider />

      <section className="home-steps" ref={stepsRef}>
        <div className="home-steps-left">
          <h2>{t.stepsTitle}</h2>
          <p className="home-caption">{t.stepsCaption}</p>
          <Confluence mode="scrub" trigger={listRef} className="cf-small" />
        </div>
        <ol ref={listRef}>
          {t.steps.map((s) => <li key={s.name}><div><b>{s.name}</b><span>{s.text}</span></div></li>)}
        </ol>
      </section>

      <WaveDivider />

      <section className="home-sdg">
        <div>
          <h2>{t.sdgTitle} <span className="chip ready">UN SDG 8</span></h2>
          <p>
            {t.sdgBody}
          </p>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go('buyer', 'negotiate')}>{t.sdgCtaNegotiate}</button>
          <button className="btn" onClick={() => go('ecosystem', 'impact')}>{t.sdgCtaImpact}</button>
        </div>
      </section>
    </div>
  );
}
