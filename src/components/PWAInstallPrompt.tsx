import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (navigator as any).standalone === true;
    setIsAlreadyInstalled(isStandalone);

    if (isStandalone) {
      return;
    }

    // Detect if device is iOS (iPhone/iPad)
    const iosDetection = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosDetection);

    // If iOS, show after 4 seconds (as there is no beforeinstallprompt)
    if (iosDetection) {
      const shownBefore = localStorage.getItem('pwa-prompt-dismissed');
      if (!shownBefore) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }

    // Handle beforeinstallprompt on supported browsers (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      const shownBefore = localStorage.getItem('pwa-prompt-dismissed');
      if (!shownBefore) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember dismissal for 15 days to not annoy the user
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (isAlreadyInstalled || !isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-18 md:bottom-6 left-0 right-0 z-[100] px-4 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-slate-900/95 backdrop-blur-xl border border-teal-500/30 text-white rounded-2xl shadow-2xl p-4.5 flex flex-col gap-3.5 relative overflow-hidden"
        >
          {/* Subtle glowing PWA design accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content info */}
          <div className="flex items-start gap-3.5 pr-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
              <img 
                src="/pwa-icon.jpg" 
                alt="EduFlow" 
                className="w-10 h-10 rounded-lg object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-bold text-sm text-teal-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-teal-400" />
                <span>এডুফ্লো অ্যাপ ইনস্টল করুন</span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                মোবাইল স্ক্রিনে সরাসরি একটি অ্যাপের মতো দ্রুত ও নিরাপদে ব্যবহার করতে এখনই ইনস্টল করুন!
              </p>
            </div>
          </div>

          {/* Interactive Install Guideline based on iOS / Android */}
          <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-4 mt-1">
            {isIOS ? (
              <div className="flex items-center gap-2 bg-slate-800/40 px-3 py-2 rounded-xl w-full text-[11px] text-slate-200">
                <Share className="w-4 h-4 text-teal-400 animate-pulse shrink-0" />
                <span className="leading-normal">
                  আইফোনে ইনস্টল করতে সাফারি ব্রাউজারের নিচে <strong className="text-white">Share (শেয়ার)</strong> বাটনে ক্লিক করে <strong className="text-white">'Add to Home Screen'</strong> সিলেক্ট করুন।
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  পরে করব
                </button>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={!deferredPrompt}
                  className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-97 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>এখনই ইনস্টল করুন</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
