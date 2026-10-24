import { useRef } from 'react';
import { useUiLang } from '../i18n';
import type { ReactNode } from 'react';
import type { Workspace } from '../ui';
import Confluence from '../components/Confluence';
import WaveDivider from '../components/WaveDivider';
import { gsap, MOTION_OK, NO_MOTION, ScrollTrigger, SplitText, useGSAP } from '../gsapSetup';

type Tri = { en: string; hi: string; kn: string };
const t3 = (en: string, hi: string, kn: string): Tri => ({ en, hi, kn });

const DOORS: { w: Workspace; page: string; title: Tri; who: Tri; does: Tri; shortcuts?: { page: string; label: Tri }[] }[] = [
  { w: 'buyer', page: 'today', title: t3('I need parts or products', 'मुझे पार्ट्स या उत्पाद चाहिए', 'ನನಗೆ ಭಾಗಗಳು ಅಥವಾ ಉತ್ಪನ್ನಗಳು ಬೇಕು'), who: t3('Manufacturers, builders, food processors, public buyers', 'निर्माता, बिल्डर, खाद्य प्रोसेसर, सार्वजनिक खरीदार', 'ತಯಾರಕರು, ನಿರ್ಮಾಣದವರು, ಆಹಾರ ಸಂಸ್ಕರಣೆಗಾರರು, ಸಾರ್ವಜನಿಕ ಖರೀದಿದಾರರು'), does: t3('See which inputs depend on one country, get ranked Indian supply chains and a switch-over plan, and let your agent negotiate the order.', 'देखें कौन-सा इनपुट किस देश पर निर्भर है, रैंक की हुई भारतीय सप्लाई चेन और स्विचओवर योजना पाएँ, और ऑर्डर पर बातचीत आपके एजेंट करे।', 'ಯಾವ ಇನ್‌ಪುಟ್ ಯಾವ ದೇಶವನ್ನು ಅವಲಂಬಿಸಿದೆ ಎಂದು ನೋಡಿ, ಶ್ರೇಣೀಕೃತ ಭಾರತೀಯ ಸರಪಳಿಗಳು ಮತ್ತು ಬದಲಾವಣೆ ಯೋಜನೆ ಪಡೆಯಿರಿ, ಆರ್ಡರ್ ಮಾತುಕತೆ ನಿಮ್ಮ ಏಜೆಂಟ್ ಮಾಡಲಿ.'), shortcuts: [{ page: 'today', label: t3('Supply chain today', 'आज की सप्लाई चेन', 'ಇಂದಿನ ಪೂರೈಕೆ ಸರಪಳಿ') }, { page: 'india', label: t3('Indian options', 'भारतीय विकल्प', 'ಭಾರತೀಯ ಆಯ್ಕೆಗಳು') }, { page: 'network', label: t3('Future network', 'भविष्य का नेटवर्क', 'ಭವಿಷ್ಯದ ಜಾಲ') }, { page: 'negotiate', label: t3('Agent negotiation', 'एजेंट बातचीत', 'ಏಜೆಂಟ್ ಮಾತುಕತೆ') }] },
  { w: 'supplier', page: 'overview', title: t3('I make things', 'मैं चीज़ें बनाता/बनाती हूँ', 'ನಾನು ವಸ್ತುಗಳನ್ನು ಮಾಡುತ್ತೇನೆ'), who: t3('MSMEs, FPOs, SHGs, cooperatives, ODOP clusters', 'एमएसएमई, एफपीओ, स्वयं सहायता समूह, सहकारी समितियाँ, ओडीओपी क्लस्टर', 'ಎಂಎಸ್‌ಎಂಇ, ಎಫ್‌ಪಿಒ, ಸ್ವಯಂ ಸಹಾಯ ಗುಂಪುಗಳು, ಸಹಕಾರಿ ಸಂಘಗಳು, ಒಡಿಒಪಿ ಸಮೂಹಗಳು'), does: t3('See pooled demand for what you make, close gaps with scheme support, team up in consortia, and let your agent quote for you.', 'अपने बनाए प्रोडक्ट की पूल की हुई मांग देखें, योजना सहायता से कमियाँ पूरी करें, संघ बनाएँ, और कोटेशन आपका एजेंट भेजे।', 'ನೀವು ಮಾಡುವ ವಸ್ತುಗಳ ಒಟ್ಟುಗೂಡಿದ ಬೇಡಿಕೆ ನೋಡಿ, ಯೋಜನೆ ಬೆಂಬಲದೊಂದಿಗೆ ಕೊರತೆ ತುಂಬಿಸಿ, ಒಕ್ಕೂಟ ಮಾಡಿ, ಉಲ್ಲೇಖ ನಿಮ್ಮ ಏಜೆಂಟ್ ಕಳುಹಿಸಲಿ.') },
  { w: 'ecosystem', page: 'negotiate', title: t3('We deal and build together', 'हम मिलकर सौदा और निर्माण करते हैं', 'ನಾವು ಜೊತೆಯಾಗಿ ವ್ಯವಹರಿಸಿ ನಿರ್ಮಾಣ ಮಾಡುತ್ತೇವೆ'), who: t3('Buyers, suppliers and the Sangam team', 'खरीदार, सप्लायर और संगम टीम', 'ಖರೀದಿದಾರರು, ಪೂರೈಕೆದಾರರು ಮತ್ತು ಸಂಗಮ ತಂಡ'), does: t3('Let agents negotiate an order, plan a new supply chain, explore skill clusters, rate each other after real orders, check signed credentials and track SDG 8 impact.', 'एजेंट ऑर्डर पर बातचीत करें, नई सप्लाई चेन की योजना बनाएँ, स्किल क्लस्टर देखें, असली ऑर्डर के बाद रेटिंग दें, हस्ताक्षरित प्रमाणपत्र जाँचें और SDG 8 प्रभाव देखें।', 'ಏಜೆಂಟ್‌ಗಳು ಆರ್ಡರ್ ಮಾತುಕತೆ ಮಾಡಲಿ, ಹೊಸ ಸರಪಳಿ ಯೋಜಿಸಿ, ಕೌಶಲ ಸಮೂಹ ನೋಡಿ, ನಿಜವಾದ ಆರ್ಡರ್ ನಂತರ ರೇಟಿಂಗ್ ನೀಡಿ, ಸಹಿ ಹಾಕಿದ ಪ್ರಮಾಣಪತ್ರ ಪರಿಶೀಲಿಸಿ ಮತ್ತು SDG 8 ಪರಿಣಾಮ ನೋಡಿ.'), shortcuts: [{ page: 'architect', label: t3('AI Supply Chain Architect', 'एआई सप्लाई चेन आर्किटेक्ट', 'ಎಐ ಸರಪಳಿ ವಾಸ್ತುಶಿಲ್ಪಿ') }, { page: 'clusters', label: t3('Skill clusters', 'स्किल क्लस्टर', 'ಕೌಶಲ ಸಮೂಹ') }, { page: 'reviews', label: t3('Reviews', 'समीक्षाएँ', 'ವಿಮರ್ಶೆಗಳು') }] },
];

// One step per river, then the meeting. The scroll animation draws each river as its step comes into view.
const STEPS: { name: Tri; text: Tri }[] = [
  { name: t3('Buyers', 'खरीदार', 'ಖರೀದಿದಾರರು'), text: t3('A company’s demand, broken into parts and process steps, with India’s real imports for each.', 'एक कंपनी की मांग, पार्ट्स और प्रोसेस चरणों में टूटी हुई, हर चरण के साथ भारत की असली इंपोर्ट।', 'ಒಂದು ಕಂಪನಿಯ ಬೇಡಿಕೆ, ಭಾಗಗಳು ಮತ್ತು ಪ್ರಕ್ರಿಯೆ ಹಂತಗಳಾಗಿ ವಿಭಜಿತ, ಪ್ರತಿ ಹಂತದೊಂದಿಗೆ ಭಾರತದ ನಿಜವಾದ ಆಮದು.') },
  { name: t3('Producers', 'उत्पादक', 'ಉತ್ಪಾದಕರು'), text: t3('Cooperatives, SHGs and MSMEs with real capacity, marked ready, potential with named gaps, or a true gap, and mapped against each district’s climate, power and freight links.', 'असली क्षमता वाली सहकारी समितियाँ, स्वयं सहायता समूह और एमएसएमई — तैयार, नाम वाली कमियों वाले संभावित, या सच्ची कमी — और हर ज़िले के जलवायु, बिजली और ढुलाई लिंक के साथ मैप।', 'ನಿಜವಾದ ಸಾಮರ್ಥ್ಯದ ಸಹಕಾರಿ ಸಂಘಗಳು, ಸ್ವಯಂ ಸಹಾಯ ಗುಂಪುಗಳು ಮತ್ತು ಎಂಎಸ್‌ಎಂಇ — ಸಿದ್ಧ, ಹೆಸರಿಸಿದ ಕೊರತೆಯ ಸಾಮರ್ಥ್ಯ, ಅಥವಾ ನಿಜವಾದ ಕೊರತೆ — ಮತ್ತು ಪ್ರತಿ ಜಿಲ್ಲೆಯ ಹವಾಮಾನ, ವಿದ್ಯುತ್ ಮತ್ತು ಸಾರಿಗೆ ಸಂಪರ್ಕಗಳೊಂದಿಗೆ ನಕ್ಷೆ.') },
  { name: t3('Fair work', 'निष्पक्ष कार्य', 'ನ್ಯಾಯಯುತ ಕೆಲಸ'), text: t3('The river you do not see: a living-wage floor for every district and an auditor that no negotiation can pass below.', 'जो नदी आपको दिखती नहीं: हर ज़िले के लिए लिविंग-वेज़ फ़्लोर, और एक ऑडिटर जिसके नीचे कोई बातचीत नहीं जा सकती।', 'ನಿಮಗೆ ಕಾಣದ ನದಿ: ಪ್ರತಿ ಜಿಲ್ಲೆಗೂ ಜೀವನ-ವೇತನ ನೆಲಹಾಸು, ಮತ್ತು ಯಾವ ಮಾತುಕತೆಯೂ ಅದರ ಕೆಳಗೆ ಹೋಗದಂತೆ ತಡೆಯುವ ಆಡಿಟರ್.') },
  { name: t3('The confluence', 'संगम', 'ಸಂಗಮ'), text: t3('An agent on each side negotiates, the auditor grades wages, hours and safety, and one signed deal carries all three.', 'हर तरफ़ एक एजेंट बातचीत करता है, ऑडिटर मज़दूरी, घंटे और सुरक्षा ग्रेड करता है, और एक हस्ताक्षरित सौदा तीनों साथ लाता है।', 'ಪ್ರತಿ ಪಕ್ಷದಲ್ಲೂ ಒಬ್ಬ ಏಜೆಂಟ್ ಮಾತುಕತೆ ನಡೆಸುತ್ತಾನೆ, ಆಡಿಟರ್ ವೇತನ, ಗಂಟೆಗಳು ಮತ್ತು ಸುರಕ್ಷತೆಯನ್ನು ಗ್ರೇಡ್ ಮಾಡುತ್ತಾನೆ, ಒಂದು ಸಹಿ ಹಾಕಿದ ಒಪ್ಪಂದ ಮೂರನ್ನೂ ಒಯ್ಯುತ್ತದೆ.') },
];

/** `allowed` limits the doors to the workspaces the signed-in account may open; `signIn` is the sign-in panel for visitors who have not. */
export default function HomePage({ go, allowed, signIn }: { go: (w: Workspace, page: string) => void; allowed?: Workspace[]; signIn?: ReactNode }) {
  const { lang } = useUiLang();
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
          <h1>{lang === 'hi' ? 'भारत के हाथ से बनी सप्लाई चेन, और ऐसी मज़दूरी जिस पर इंसान जी सके।' : lang === 'kn' ? 'ಭಾರತ ಕಟ್ಟುವ ಸರಪಳಿಗಳು, ಜನ ಉದ್ಯಕ್ಕೆ ಸಾಲಿಯಾಗಿ.' : 'Supply chains India can build, with wages people can live on.'}</h1>
          <p className="lede">
            {lang === 'hi' ? 'संगम का मतलब है वह जगह जहाँ नदियाँ मिलती हैं। यहाँ खरीदार और उत्पादक मिलते हैं, और दोनों के नीचे एक तीसरी धारा बहती है: संगम—जीवन-मज़दूरी। हर तरफ़ एक एजेंट ऑर्डर पर बातचीत करता है, और कोई अनुबंध तय न्यूनतम से कम भुगतान नहीं कर सकता।' : lang === 'kn' ? 'ಸಂಗಮ ಎಂದರೆ ನದಿಗಳು ಸೇರುವ ಸ್ಥಳ. ಇಲ್ಲಿ ಖರೀದಿದಾರರು ಮತ್ತು ಉತ್ಪಾದಕರು ಸೇರುತ್ತಾರೆ, ಮತ್ತು ಅವರ ಕೆಳಗೆ ಮೂರನೇ ಧಾರೆ ಹರಿಯುತ್ತದೆ: ಜೀವನ-ವೇತನ. ಪ್ರತಿ ಪಕ್ಷದಲ್ಲೂ ಒಬ್ಬ ಏಜೆಂಟ್ ಆರ್ಡರ್ ಮಾತುಕತೆ ನಡೆಸುತ್ತಾನೆ, ಮತ್ತು ಯಾವ ಒಪ್ಪಂದವೂ ನೆಲಹಾಸಿಗಿಂತ ಕಡಿಮೆ ಪಾವತಿಸುವುದಿಲ್ಲ.' : 'Sangam means the place where rivers meet. Here, buyers and producers meet, with a third thing running beneath them both: a living wage. An agent on each side negotiates the order, and no contract can pay below the floor.'}
          </p>
          <div className="home-actions">
            <button className="btn primary" onClick={() => go('buyer', 'negotiate')}>{lang === 'hi' ? 'एजेंट बातचीत देखें' : lang === 'kn' ? 'ಏಜೆಂಟ್ ಮಾತುಕತೆ ವೀಕ್ಷಿಸಿ' : 'Watch an agent negotiation'}</button>
            <button className="link-btn" onClick={() => go('ecosystem', 'impact')}>{lang === 'hi' ? 'SDG 8 का असर देखें' : lang === 'kn' ? 'SDG 8 ಪರಿಣಾಮ ನೋಡಿ' : 'See the SDG 8 impact'}</button>
          </div>
          <div className="home-meta">{[{ en: 'Manufacturing', hi: 'निर्माण', kn: 'ಉತ್ಪಾದನೆ' }, { en: 'Construction materials', hi: 'निर्माण सामग्री', kn: 'ನಿರ್ಮಾಣ ಸಾಮಗ್ರಿ' }, { en: 'Agri and food processing', hi: 'कृषि और खाद्य प्रसंस्करण', kn: 'ಕೃಷಿ ಮತ್ತು ಆಹಾರ ಸಂಸ್ಕರಣೆ' }].map((x) => <span key={x.en}>{x[lang]}</span>)}</div>
        </div>
        <div className="home-hero-art"><Confluence mode="intro" /></div>
      </section>

      {signIn && <section className="home-signin" aria-label="Sign in">{signIn}</section>}

      <section className="home-doors" aria-label="Choose where to start">
        {DOORS.filter((d) => !allowed || allowed.includes(d.w)).map((d, i) => (
          <div key={d.w} className={`door${i === 0 ? ' first' : ''}`}>
            <button className="door-main" onClick={() => go(d.w, d.page)}>
              <div>
                <span className="idx">0{i + 1}</span>
                <h2>{d.title[lang]}</h2>
                <div className="who">{d.who[lang]}</div>
                <p>{d.does[lang]}</p>
              </div>
              <span className="go">{lang === 'hi' ? 'खोलें' : lang === 'kn' ? 'ತೆರೆಯಿರಿ' : 'Open'} <span aria-hidden="true">→</span></span>
            </button>
            {d.shortcuts && (
              <ul className="door-links" aria-label="Jump to">
                {d.shortcuts.map((x) => <li key={x.page}><button className="door-link" onClick={() => go(d.w, x.page)}>{x.label[lang]}<span aria-hidden="true">→</span></button></li>)}
              </ul>
            )}
          </div>
        ))}
      </section>

      <WaveDivider />

      <section className="home-steps" ref={stepsRef}>
        <div className="home-steps-left">
          <h2>{lang === 'hi' ? 'नदियाँ कैसे मिलती हैं' : lang === 'kn' ? 'ನದಿಗಳು ಹೇಗೆ ಸೇರುತ್ತವೆ' : 'How the rivers meet'}</h2>
          <p className="home-caption">{lang === 'hi' ? 'प्रयागराज के त्रिवेणी संगम जैसा, जहाँ गंगा और यमुना मिलती हैं और कहा जाता है कि सरस्वती अदृश्य रूप से जुड़ती है।' : lang === 'kn' ? 'ಪ್ರಯಾಗರಾಜದ ತ್ರಿವೇಣಿ ಸಂಗಮದಂತೆ, ಅಲ್ಲಿ ಗಂಗಾ ಮತ್ತು ಯಮುನೆ ಸೇರುತ್ತವೆ ಮತ್ತು ಸರಸ್ವತಿ ಅಗೋಚರವಾಗಿ ಸೇರುತ್ತಾಳೆಂದು ನಂಬಲಾಗಿದೆ.' : 'Like the Triveni Sangam at Prayagraj, where the Ganga and Yamuna meet and the Saraswati is said to join unseen.'}</p>
          <Confluence mode="scrub" trigger={listRef} className="cf-small" />
        </div>
        <ol ref={listRef}>
          {STEPS.map((s) => <li key={s.name.en}><div><b>{s.name[lang]}</b><span>{s.text[lang]}</span></div></li>)}
        </ol>
      </section>

      <WaveDivider />

      <section className="home-sdg">
        <div>
          <h2>{lang === 'hi' ? 'SDG 8 की डिसेंट-वर्क परत' : lang === 'kn' ? 'SDG 8 ಡಿಸೆಂಟ್-ವರ್ಕ್ ಪದರ' : 'The SDG 8 decent-work layer'} <span className="chip ready">UN SDG 8</span></h2>
          <p>
            {lang === 'hi' ? 'चेन डिज़ाइन होते ही, खरीदार और हर सप्लायर के एजेंट बातचीत करते हैं, और कोई ऑफ़र ज़िले की लिविंग वेज़ से कम भुगतान नहीं कर सकता। एक ऑडिटर एजेंट मज़दूरी, घंटे और सुरक्षा ग्रेड करता है, संगम अनुबंध और कामगारों के स्किल पर हस्ताक्षर करता है, और हर सौदा रोज़गार, निष्पक्ष वेतन और ग्रामीण आय में गिना जाता है।' : lang === 'kn' ? 'ಸರಪಳಿ ವಿನ್ಯಾಸಗೊಂಡ ನಂತರ, ಖರೀದಿದಾರ ಮತ್ತು ಪ್ರತಿ ಪೂರೈಕೆದಾರರ ಏಜೆಂಟ್‌ಗಳು ಮಾತುಕತೆ ನಡೆಸುತ್ತವೆ, ಮತ್ತು ಯಾವ ಪ್ರಸ್ತಾಪವೂ ಜಿಲ್ಲೆಯ ಜೀವನ-ವೇತನಕ್ಕಿಂತ ಕಡಿಮೆ ಪಾವತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ಆಡಿಟರ್ ಏಜೆಂಟ್ ವೇತನ, ಗಂಟೆಗಳು ಮತ್ತು ಸುರಕ್ಷತೆಯನ್ನು ಗ್ರೇಡ್ ಮಾಡುತ್ತಾನೆ, ಸಂಗಮ ಒಪ್ಪಂದ ಮತ್ತು ಕಾರ್ಮಿಕರ ಕೌಶಲ್ಯಗಳಿಗೆ ಸಹಿ ಹಾಕುತ್ತದೆ, ಪ್ರತಿ ಒಪ್ಪಂದವೂ ಉದ್ಯೋಗ, ನ್ಯಾಯಯುತ ವೇತನ ಮತ್ತು ಗ್ರಾಮೀಣ ಆದಾಯಕ್ಕೆ ಎಣಿಕೆಯಾಗುತ್ತದೆ.' : 'Once the chain is designed, agents for the buyer and each supplier negotiate, and no offer may pay below the district&rsquo;s living wage. An Auditor Agent grades wages, hours and safety, Sangam signs the contract and the workers&rsquo; skills, and every deal counts towards jobs, fair pay and rural income.'}
          </p>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go('buyer', 'negotiate')}>{lang === 'hi' ? 'एजेंट बातचीत' : lang === 'kn' ? 'ಏಜೆಂಟ್ ಮಾತುಕತೆ' : 'Agent negotiation'}</button>
          <button className="btn" onClick={() => go('ecosystem', 'impact')}>{lang === 'hi' ? 'SDG 8 प्रभाव' : lang === 'kn' ? 'SDG 8 ಪರಿಣಾಮ' : 'SDG 8 impact'}</button>
        </div>
      </section>
    </div>
  );
}
