// UI chrome translations shared by every workspace: the sidebar navigation, the
// workspace tabs and common actions. Page bodies stay English for now (except
// the landing page and the seller pages, which carry their own dictionaries).
//
// Kannada (kn) is a first-class language here alongside Hindi. Any missing
// translation falls back to the English string that the caller already renders.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type UiLang = 'en' | 'hi' | 'kn';

export const UI_LANGS: { code: UiLang; native: string; english: string }[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिंदी', english: 'Hindi' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
];

const KEY = 'sangam-ui-lang';

// ---------- dictionaries ----------

/** Sidebar page ids → labels. `en` is the fallback the nav already renders. */
type Tri = { en: string; hi: string; kn: string };

export const NAV_LABELS: Record<string, Tri> = {
  // buyer
  today: { en: 'Supply chain today', hi: 'आज की सप्लाई चेन', kn: 'ಇಂದಿನ ಪೂರೈಕೆ ಸರಪಳಿ' },
  sim: { en: 'Simulator', hi: 'सिम्युलेटर', kn: 'ಸಿಮ್ಯುಲೇಟರ್' },
  routes: { en: 'Routes', hi: 'रूट', kn: 'ಮಾರ್ಗಗಳು' },
  india: { en: 'Indian options', hi: 'भारतीय विकल्प', kn: 'ಭಾರತೀಯ ಆಯ್ಕೆಗಳು' },
  ranking: { en: 'Find suppliers', hi: 'सप्लायर खोजें', kn: 'ಪೂರೈಕೆದಾರರನ್ನು ಹುಡುಕಿ' },
  network: { en: 'Future network', hi: 'भविष्य का नेटवर्क', kn: 'ಭವಿಷ್ಯದ ಜಾಲ' },
  location: { en: 'Location planner', hi: 'स्थान योजना', kn: 'ಸ್ಥಳ ಯೋಜನೆ' },
  requirements: { en: 'Requirements and quotes', hi: 'ज़रूरतें और कोटेशन', kn: 'ಅಗತ್ಯಗಳು ಮತ್ತು ಉಲ್ಲೇಖಗಳು' },
  negotiate: { en: 'Agent negotiation', hi: 'एजेंट बातचीत', kn: 'ಏಜೆಂಟ್ ಮಾತುಕತೆ' },
  funding: { en: 'Fund suppliers', hi: 'सप्लायरों को निधि', kn: 'ಪೂರೈಕೆದಾರರಿಗೆ ನಿಧಿ' },
  switch: { en: 'Switch-over plan', hi: 'स्विचओवर योजना', kn: 'ಬದಲಾವಣೆ ಯೋಜನೆ' },
  devel: { en: 'Supplier development', hi: 'सप्लायर विकास', kn: 'ಪೂರೈಕೆದಾರ ಅಭಿವೃದ್ಧಿ' },
  setup: { en: 'Company and parts', hi: 'कंपनी और पार्ट्स', kn: 'ಕಂಪನಿ ಮತ್ತು ಭಾಗಗಳು' },
  integrations: { en: 'Integrations', hi: 'इंटीग्रेशन', kn: 'ಏಕೀಕರಣ' },
  // supplier
  overview: { en: 'Overview', hi: 'सारांश', kn: 'ಅವಲೋಕನ' },
  opps: { en: 'Opportunities and quotes', hi: 'अवसर और कोटेशन', kn: 'ಅವಕಾಶಗಳು ಮತ್ತು ಉಲ್ಲೇಖಗಳು' },
  consortia: { en: 'Consortia', hi: 'संघ', kn: 'ಒಕ್ಕೂಟಗಳು' },
  architect: { en: 'AI Supply Chain Architect', hi: 'एआई सप्लाई चेन आर्किटेक्ट', kn: 'ಎಐ ಸರಪಳಿ ವಾಸ್ತುಶಿಲ್ಪಿ' },
  projects: { en: 'Development projects', hi: 'विकास परियोजनाएँ', kn: 'ಅಭಿವೃದ್ಧಿ ಯೋಜನೆಗಳು' },
  grow: { en: 'Future diversification', hi: 'भविष्य का विविधीकरण', kn: 'ಭವಿಷ್ಯದ ವೈವಿಧ್ಯೀಕರಣ' },
  workforce: { en: 'Workforce and fair work', hi: 'कार्यबल और निष्पक्ष कार्य', kn: 'ಕಾರ್ಮಿಕ ಮತ್ತು ನ್ಯಾಯಯುತ ಕೆಲಸ' },
  sustainability: { en: 'Sustainability', hi: 'स्थिरता', kn: 'ಸುಸ್ಥಿರತೆ' },
  profile: { en: 'Profile and documents', hi: 'प्रोफ़ाइल और दस्तावेज़', kn: 'ಪ್ರೊಫೈಲ್ ಮತ್ತು ದಸ್ತಾವೇಜುಗಳು' },
  reviews: { en: 'Reviews', hi: 'समीक्षाएँ', kn: 'ವಿಮರ್ಶೆಗಳು' },
  // ecosystem
  verify: { en: 'Verification desk', hi: 'सत्यापन डेस्क', kn: 'ಪರಿಶೀಲನಾ ಡೆಸ್ಕ್' },
  passport: { en: 'Skill Passports', hi: 'स्किल पासपोर्ट', kn: 'ಕೌಶಲ ಪಾಸ್‌ಪೋರ್ಟ್' },
  check: { en: 'Check a credential', hi: 'प्रमाणपत्र जाँचें', kn: 'ಪ್ರಮಾಣಪತ್ರ ಪರಿಶೀಲಿಸಿ' },
  impact: { en: 'SDG 8 impact', hi: 'SDG 8 प्रभाव', kn: 'SDG 8 ಪರಿಣಾಮ' },
  districts: { en: 'District dashboard', hi: 'ज़िला डैशबोर्ड', kn: 'ಜಿಲ್ಲಾ ಡ್ಯಾಶಬೋರ್ಡ್' },
  report: { en: 'Report a problem', hi: 'समस्या बताएँ', kn: 'ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ' },
  sources: { en: 'Data sources', hi: 'डेटा स्रोत', kn: 'ಡೇಟಾ ಮೂಲಗಳು' },
};

/** Sidebar group titles per workspace, keyed by the English title. */
export const GROUP_TITLES: Record<string, Tri> = {
  Understand: { en: 'Understand', hi: 'समझें', kn: 'ಅರ್ಥಮಾಡಿ' },
  Design: { en: 'Design', hi: 'डिज़ाइन', kn: 'ವಿನ್ಯಾಸ' },
  Act: { en: 'Act', hi: 'कदम', kn: 'ಕ್ರಮ' },
  'Set up': { en: 'Set up', hi: 'सेटअप', kn: 'ಸಿದ್ಧತೆ' },
  Today: { en: 'Today', hi: 'आज', kn: 'ಇಂದು' },
  Grow: { en: 'Grow', hi: 'बढ़ें', kn: 'ಬೆಳೆಯಿರಿ' },
  Trust: { en: 'Trust', hi: 'भरोसा', kn: 'ನಂಬಿಕೆ' },
  'Sangam team': { en: 'Sangam team', hi: 'संगम टीम', kn: 'ಸಂಗಮ ತಂಡ' },
  'Clusters and states': { en: 'Clusters and states', hi: 'क्लस्टर और राज्य', kn: 'ಸಮೂಹ ಮತ್ತು ರಾಜ್ಯಗಳು' },
  Workers: { en: 'Workers', hi: 'श्रमिक', kn: 'ಕಾರ್ಮಿಕರು' },
  'About the data': { en: 'About the data', hi: 'डेटा के बारे में', kn: 'ಡೇಟಾ ಬಗ್ಗೆ' },
};

/** The workspace tabs in the topbar. */
export const WORKSPACE_LABELS: Record<'buyer' | 'supplier' | 'ecosystem', Tri> = {
  buyer: { en: 'Buyer', hi: 'खरीदार', kn: 'ಖರೀದಿಗರು' },
  supplier: { en: 'Supplier', hi: 'सप्लायर', kn: 'ಪೂರೈಕೆದಾರ' },
  ecosystem: { en: 'Ecosystem', hi: 'इकोसिस्टम', kn: 'ಪರಿಸರ ವ್ಯವಸ್ಥೆ' },
};

/** Common action words used across pages. */
export const COMMON: Record<string, Tri> = {
  save: { en: 'Save', hi: 'सहेजें', kn: 'ಉಳಿಸಿ' },
  submit: { en: 'Submit', hi: 'जमा करें', kn: 'ಸಲ್ಲಿಸಿ' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', kn: 'ರದ್ದುಮಾಡಿ' },
  open: { en: 'Open', hi: 'खोलें', kn: 'ತೆರೆಯಿರಿ' },
};

// ---------- hook ----------

interface UiLangCtx { lang: UiLang; setLang: (l: UiLang) => void }
const Ctx = createContext<UiLangCtx | null>(null);

export function UiLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<UiLang>(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'hi' || v === 'kn' || v === 'en') return v;
    } catch { /* storage unavailable */ }
    return 'en';
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useUiLang(): UiLangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUiLang outside UiLangProvider');
  return c;
}

/** Translate a nav/group/workspace/common label; falls back to the English text. */
export function tr(lang: UiLang, table: Record<string, Tri>, key: string): string {
  const row = table[key];
  return row ? row[lang] : key;
}
