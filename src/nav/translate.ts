// Section and page names in the chosen language, using the shared dictionaries in src/i18n.tsx. A few names exist only in the
// section navigation (new sections, the Funding and Skill clusters pages), so their translations are added here. Anything
// missing falls back to the English label. These translations should be read by a native speaker before they are shown to users.
import { GROUP_TITLES, NAV_LABELS } from '../i18n';
import type { UiLang } from '../i18n';
import type { Workspace } from '../ui';
import type { NavGroup, NavItem } from './catalog';

type Tri = { en: string; hi: string; kn: string };

const GROUPS: Record<string, Tri> = {
  'Deal together': { en: 'Deal together', hi: 'साथ मिलकर सौदा', kn: 'ಒಟ್ಟಾಗಿ ವ್ಯವಹಾರ' },
  'Build and grow': { en: 'Build and grow', hi: 'बनाएँ और बढ़ें', kn: 'ಕಟ್ಟಿ ಬೆಳೆಯಿರಿ' },
  'Fair work and trust': { en: 'Fair work and trust', hi: 'निष्पक्ष कार्य और भरोसा', kn: 'ನ್ಯಾಯಯುತ ಕೆಲಸ ಮತ್ತು ನಂಬಿಕೆ' },
};

/** Page names the shared dictionary lacks, or that mean something different in one workspace (Funding for suppliers, Fund suppliers for buyers). */
const ITEMS: Record<string, Tri> = {
  'ecosystem:clusters': { en: 'Skill clusters', hi: 'स्किल क्लस्टर', kn: 'ಕೌಶಲ ಸಮೂಹಗಳು' },
  'supplier:funding': { en: 'Funding', hi: 'फंडिंग', kn: 'ಧನಸಹಾಯ' },
};

export function groupTitle(lang: UiLang, g: NavGroup): string {
  return GROUPS[g.title]?.[lang] ?? GROUP_TITLES[g.title]?.[lang] ?? g.title;
}

export function itemLabel(lang: UiLang, workspace: Workspace, it: NavItem): string {
  return ITEMS[`${workspace}:${it.id}`]?.[lang] ?? NAV_LABELS[it.id]?.[lang] ?? it.label;
}
