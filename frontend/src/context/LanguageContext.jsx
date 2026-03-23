import { createContext, useMemo, useState } from 'react';

export const LanguageContext = createContext(null);

const dictionary = {
  en: {
    appName: 'HealthBot',
    dashboard: 'Dashboard',
    chat: 'Chat',
    symptomChecker: 'Symptom Checker',
    history: 'Health History',
    reports: 'Reports',
    profile: 'Profile',
    healthTips: 'Health Tips',
    hospitals: 'Hospitals',
    admin: 'Admin',
    login: 'Login',
    logout: 'Logout',
    landingEyebrow: 'Health awareness platform',
    landingTitle: 'Understand symptoms, assess risk, and find the right care faster.',
    landingBody: 'AI-powered health awareness platform that helps users understand symptoms, assess risk levels, track health history, and find nearby hospitals.',
    getStarted: 'Get Started',
    tryChatbot: 'Try Chatbot',
    whatPlatformDoes: 'What this platform does',
    guidedTriage: 'Guided symptom triage',
    historyTracking: 'Health history tracking',
    riskReports: 'Risk-based reports',
    hospitalRecommendation: 'Hospital recommendation',
    howItWorks: 'How it Works',
    howStep1: '1. Create your account and update profile details.',
    howStep2: '2. Use chatbot or symptom checker for guided health awareness.',
    howStep3: '3. Review your report, monitor alerts, and find hospitals by specialty.',
    features: 'Platform Features',
    feature1: 'Chatbot with structured response format',
    feature2: 'Symptom checker with risk scoring',
    feature3: 'Reports with trends and charts',
    feature4: 'Admin management for hospitals and diseases',
    chatbotTitle: 'Health Chatbot',
    chatbotSubtext: 'Start a fresh health check whenever you want a clean assessment trail.',
    newAssessment: 'Start New Health Assessment',
    askPlaceholder: 'Ask symptoms or health awareness question',
    askAi: 'Ask AI',
    generating: 'Generating...',
    summary: 'Health Assessment Summary',
    symptomsDetected: 'Symptoms detected',
    riskLevel: 'Risk Level',
    recommendedAction: 'Recommended Action',
    highAction: 'Seek urgent medical help and use the recommended hospitals below.',
    mediumAction: 'Monitor symptoms closely and book a doctor consultation if they continue.',
    lowAction: 'Rest, hydration, and observation are recommended for now.',
    nextSteps: 'Next Steps',
    nextStepsBody: 'Monitor symptoms for 2 to 3 days, or act sooner if warning signs appear.',
    chatHistory: 'Chat History',
    noChats: 'No chats yet.',
    possibleCauses: 'Possible Causes',
    prevention: 'Prevention',
    consultDoctor: 'When to Consult Doctor',
    recommendedHospitals: 'Recommended Hospitals',
    languageToggle: 'EN / HI',
    liveUpdate: 'Latest assessment synced in real time.',
    confidence: 'Confidence',
    promptVersion: 'Prompt Version'
  },
  hi: {
    appName: 'हेल्थबॉट',
    dashboard: 'डैशबोर्ड',
    chat: 'चैट',
    symptomChecker: 'लक्षण जांच',
    history: 'स्वास्थ्य इतिहास',
    reports: 'रिपोर्ट्स',
    profile: 'प्रोफाइल',
    healthTips: 'हेल्थ टिप्स',
    hospitals: 'अस्पताल',
    admin: 'एडमिन',
    login: 'लॉगिन',
    logout: 'लॉगआउट',
    landingEyebrow: 'स्वास्थ्य जागरूकता प्लेटफॉर्म',
    landingTitle: 'लक्षण समझें, जोखिम जानें, और सही इलाज तक जल्दी पहुंचें।',
    landingBody: 'यह एआई आधारित स्वास्थ्य जागरूकता प्लेटफॉर्म लक्षण समझने, जोखिम स्तर देखने, स्वास्थ्य इतिहास ट्रैक करने और नजदीकी अस्पताल ढूंढने में मदद करता है।',
    getStarted: 'शुरू करें',
    tryChatbot: 'चैटबॉट आजमाएं',
    whatPlatformDoes: 'यह प्लेटफॉर्म क्या करता है',
    guidedTriage: 'गाइडेड लक्षण ट्रायज',
    historyTracking: 'स्वास्थ्य इतिहास ट्रैकिंग',
    riskReports: 'जोखिम आधारित रिपोर्ट्स',
    hospitalRecommendation: 'अस्पताल सुझाव',
    howItWorks: 'यह कैसे काम करता है',
    howStep1: '1. अकाउंट बनाएं और प्रोफाइल विवरण अपडेट करें।',
    howStep2: '2. चैटबॉट या लक्षण जांच का उपयोग करें।',
    howStep3: '3. रिपोर्ट देखें, अलर्ट मॉनिटर करें और स्पेशलिटी के हिसाब से अस्पताल खोजें।',
    features: 'मुख्य फीचर्स',
    feature1: 'स्ट्रक्चर्ड रिस्पॉन्स वाला चैटबॉट',
    feature2: 'रिस्क स्कोर वाला लक्षण जांच',
    feature3: 'ट्रेंड्स और चार्ट्स वाली रिपोर्ट्स',
    feature4: 'अस्पताल और बीमारी डेटा के लिए एडमिन पैनल',
    chatbotTitle: 'हेल्थ चैटबॉट',
    chatbotSubtext: 'जब चाहें नई हेल्थ असेसमेंट शुरू करें ताकि रिकॉर्ड साफ रहे।',
    newAssessment: 'नई हेल्थ असेसमेंट शुरू करें',
    askPlaceholder: 'लक्षण या स्वास्थ्य से जुड़ा सवाल पूछें',
    askAi: 'एआई से पूछें',
    generating: 'उत्तर बनाया जा रहा है...',
    summary: 'हेल्थ असेसमेंट सारांश',
    symptomsDetected: 'पहचाने गए लक्षण',
    riskLevel: 'जोखिम स्तर',
    recommendedAction: 'सुझावित कार्रवाई',
    highAction: 'तुरंत चिकित्सा सहायता लें और नीचे दिए गए अस्पताल सुझाव देखें।',
    mediumAction: 'लक्षणों पर नजर रखें और जारी रहने पर डॉक्टर से परामर्श लें।',
    lowAction: 'अभी आराम, पानी और निगरानी की सलाह दी जाती है।',
    nextSteps: 'अगले कदम',
    nextStepsBody: '2 से 3 दिन तक लक्षण देखें, या चेतावनी संकेत हों तो तुरंत कार्रवाई करें।',
    chatHistory: 'चैट इतिहास',
    noChats: 'अभी कोई चैट नहीं है।',
    possibleCauses: 'संभावित कारण',
    prevention: 'बचाव',
    consultDoctor: 'डॉक्टर से कब मिलें',
    recommendedHospitals: 'सुझावित अस्पताल',
    languageToggle: 'EN / HI',
    liveUpdate: 'नया असेसमेंट रियल टाइम में सिंक हुआ है।',
    confidence: 'विश्वास स्तर',
    promptVersion: 'प्रॉम्प्ट वर्जन'
  }
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

  const changeLanguage = (nextLanguage) => {
    localStorage.setItem('language', nextLanguage);
    setLanguage(nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage: changeLanguage,
      t: dictionary[language] || dictionary.en
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
