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
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
        className="w-full mb-6"
      >
        <div className="bg-teal-600 rounded-xl shadow-sm px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative">
          
          {/* Close button for mobile (absolute top right) */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute sm:hidden top-3 right-3 text-teal-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {!showManualGuide ? (
            <>
              {/* Content info */}
              <div className="flex items-center gap-3 pr-8 sm:pr-0">
                <div className="w-10 h-10 rounded-lg bg-teal-700/50 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    এডুফ্লো অ্যাপটি ফোনে ডাউনলোড করুন!
                  </h4>
                  <p className="text-teal-100 text-xs mt-0.5">
                    হোম স্ক্রিনে সরাসরি ইনস্টল করে কোচিংয়ের আপডেট পান সহজে।
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 sm:flex-none bg-white text-teal-700 hover:bg-teal-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ডাউনলোড</span>
                </button>
                
                {/* Close button for Desktop */}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="hidden sm:block text-teal-100 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            /* Manual installation guide inline */
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-teal-200 shrink-0 mt-0.5" />
                <div className="text-xs text-teal-50">
                  <h4 className="font-bold text-white text-sm mb-1">কীভাবে ইনস্টল করবেন</h4>
                  {isMobile ? (
                    <p>আপনার ব্রাউজারের <strong className="text-white">তিনটি ডট (⋮)</strong> মেনু থেকে <strong className="text-white">"Install app"</strong> বা <strong className="text-white">"Add to Home Screen"</strong> সিলেক্ট করুন।</p>
                  ) : (
                    <p>ব্রাউজারের অ্যাড্রেস বারের ডান কোণে থাকা <strong className="text-white">⊕ (ইনস্টল)</strong> আইকনে ক্লিক করুন।</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowManualGuide(false)}
                  className="text-teal-100 hover:text-white text-xs font-bold px-3 py-2 cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="bg-teal-700 text-white hover:bg-teal-800 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  বুঝেছি
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
