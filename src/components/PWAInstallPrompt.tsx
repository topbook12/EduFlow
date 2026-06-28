import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Share, CheckCircle2, ChevronRight, Info } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(false);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (navigator as any).standalone === true;
    setIsAlreadyInstalled(isStandalone);

    if (isStandalone) {
      return;
    }

    // Detect if device is iOS (iPhone/iPad)
    const ua = navigator.userAgent;
    const iosDetection = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(iosDetection);

    // Detect general mobile
    const mobileDetection = /Mobi|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsMobile(mobileDetection || iosDetection);

    // Check if user dismissed prompt previously (within 3 days)
    const dismissTime = localStorage.getItem('pwa-prompt-dismiss-time');
    const isDismissedRecently = dismissTime && (Date.now() - parseInt(dismissTime, 10) < 3 * 24 * 60 * 60 * 1000);

    if (isDismissedRecently) {
      return;
    }

    // Universal Fallback: Show the customized manual install instructions after 6 seconds
    // if the native beforeinstallprompt doesn't fire (common on iOS, Brave, Firefox, or custom webviews)
    const fallbackTimer = setTimeout(() => {
      setIsVisible((prev) => {
        // If already visible via native event, keep it. Otherwise, show it now as a fallback
        return true;
      });
    }, 6000);

    // Handle beforeinstallprompt on supported browsers (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      if (!isDismissedRecently) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no native prompt is available (e.g. Chrome on some devices, Firefox, Brave),
      // toggle the gorgeous manual installation guide
      setShowManualGuide(true);
      return;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);

      // We've used the prompt, and can't use it again
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch (err) {
      console.warn("Native PWA installation prompt failed, switching to manual guide:", err);
      setShowManualGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember dismissal for 3 days to respect user's choice
    localStorage.setItem('pwa-prompt-dismiss-time', Date.now().toString());
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
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {!showManualGuide ? (
            <>
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
                    <Smartphone className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>এডুফ্লো অ্যাপ ইনস্টল করুন</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                    আপনার মোবাইলের হোম স্ক্রিনে সরাসরি অ্যাপের মতো ব্যবহার করতে এখনই ইন্সটল করুন। এটি অত্যন্ত দ্রুত, নিরাপদ ও অফলাইনেও কাজ করে!
                  </p>
                </div>
              </div>

              {/* Interactive Install Guideline based on iOS / Android */}
              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-4 mt-1">
                {isIOS ? (
                  <div className="flex items-center gap-2.5 bg-teal-950/40 border border-teal-900/40 px-3 py-2.5 rounded-xl w-full text-[11px] text-slate-200">
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
                      className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-97 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{deferredPrompt ? 'এখনই ইনস্টল করুন' : 'কীভাবে ইনস্টল করবেন'}</span>
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            /* Elegant manual installation step-by-step guidance */
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-400 shrink-0" />
                <h4 className="font-display font-bold text-sm text-teal-300">
                  ম্যানুয়াল ইনস্টলেশন গাইড
                </h4>
              </div>

              <div className="text-xs text-slate-300 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {isMobile ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-200">মোবাইলে ইনস্টল করতে:</p>
                    <ol className="list-decimal list-inside space-y-1.5 pl-1">
                      <li>আপনার ব্রাউজারের ডানদিকের উপরের কোণায় থাকা <strong className="text-teal-400">তিনটি ডট (⋮)</strong> মেনুতে ক্লিক করুন।</li>
                      <li>সেখান থেকে <strong className="text-white">"Install app"</strong> অথবা <strong className="text-white">"Add to Home Screen"</strong> অপশনটি সিলেক্ট করুন।</li>
                      <li>কনফার্ম করতে <strong className="text-teal-400">"Install"</strong> বাটনে ক্লিক করুন।</li>
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-200">ডেস্কটপে ইনস্টল করতে:</p>
                    <ol className="list-decimal list-inside space-y-1.5 pl-1">
                      <li>ক্রোম বা এজ ব্রাউজারের অ্যাড্রেস বারের ডান কোণে থাকা <strong className="text-teal-400">⊕ (ইনস্টল)</strong> আইকনে ক্লিক করুন।</li>
                      <li>অথবা ব্রাউজার মেনু <strong className="text-teal-400">(⋮)</strong> থেকে <strong className="text-white">"Save and share"</strong> সিলেক্ট করে <strong className="text-white">"Install app"</strong>-এ ক্লিক করুন।</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowManualGuide(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  বুঝেছি
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
