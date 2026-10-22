export type Lang = 'en' | 'hi';

const en = {
  viewingAs: 'Viewing as',
  capacity: 'units/month',
  workers: 'workers',
  verified: 'Verified',
  declared: 'Self-declared',
  noCerts: 'No certifications yet',
  demandTitle: 'Demand for what you make',
  demandLine: (buyers: number, units: string, from: string, region: string) =>
    `${buyers} buyers need about ${units} units a month from ${from}, in ${region}.`,
  demandNote: 'Buyer names stay hidden until a buyer invites you.',
  readinessTitle: 'Are you ready to supply?',
  readyNow: 'You qualify today for this requirement.',
  almost: (n: number) => `You meet most requirements. ${n} step${n > 1 ? 's' : ''} left:`,
  total: (cost: string, months: number) => `Total about ${cost}, ready in about ${months} months.`,
  help: 'Support',
  teamTitle: 'Team up to supply larger orders',
  teamLine: (partner: string, place: string, cap: string) => `With ${partner} (${place}) you reach ${cap} units a month together.`,
  noTeam: 'You can supply the full volume on your own.',
  lakh: 'lakh',
  months: 'months',
  requirement: 'Requirement',
};

const hi: typeof en = {
  viewingAs: 'इस रूप में देख रहे हैं',
  capacity: 'यूनिट/माह',
  workers: 'कामगार',
  verified: 'सत्यापित',
  declared: 'स्व-घोषित',
  noCerts: 'अभी कोई प्रमाणन नहीं',
  demandTitle: 'आपके उत्पाद की मांग',
  demandLine: (buyers, units, from, region) =>
    `${buyers} खरीदारों को ${from} से ${region} में लगभग ${units} यूनिट प्रति माह चाहिए।`,
  demandNote: 'खरीदार के आमंत्रण तक उनके नाम गुप्त रहते हैं।',
  readinessTitle: 'क्या आप आपूर्ति के लिए तैयार हैं?',
  readyNow: 'आप आज ही इस आवश्यकता के योग्य हैं।',
  almost: (n) => `आप अधिकांश शर्तें पूरी करते हैं। ${n} कदम बाकी:`,
  total: (cost, months) => `कुल लगभग ${cost}, लगभग ${months} महीनों में तैयार।`,
  help: 'सहायता',
  teamTitle: 'बड़े ऑर्डर के लिए साझेदारी करें',
  teamLine: (partner, place, cap) => `${partner} (${place}) के साथ मिलकर आप ${cap} यूनिट प्रति माह तक पहुँचते हैं।`,
  noTeam: 'आप पूरी मात्रा अकेले आपूर्ति कर सकते हैं।',
  lakh: 'लाख',
  months: 'महीने',
  requirement: 'आवश्यकता',
};

export const strings = { en, hi };

export const processHi: Record<string, string> = {
  'Wire drawing': 'तार खींचना',
  'Connector making': 'कनेक्टर निर्माण',
  'Harness assembly': 'हार्नेस असेंबली',
  'Polymer extrusion': 'पॉलिमर एक्सट्रूज़न',
  'Injection moulding': 'इंजेक्शन मोल्डिंग',
  Packaging: 'पैकेजिंग',
};
