import React, { useEffect, useState } from 'react';
import { Play, X, CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import {
  ADMOB_REWARDED_TEST_AD_UNIT_ID,
  RewardResult,
} from '../utils/rewardedAds';

interface RewardedAdModalProps {
  isOpen: boolean;
  rewardLabel: string;
  onComplete: (result: RewardResult) => void;
  onCancel: () => void;
}

const TEST_AD_DURATION_SEC = 5;

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  rewardLabel,
  onComplete,
  onCancel,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(TEST_AD_DURATION_SEC);
  const [confirmEarlyExit, setConfirmEarlyExit] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(TEST_AD_DURATION_SEC);
    setConfirmEarlyExit(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || confirmEarlyExit || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isOpen, confirmEarlyExit, secondsLeft]);

  if (!isOpen) return null;

  const completed = secondsLeft === 0;
  const progressPct =
    ((TEST_AD_DURATION_SEC - secondsLeft) / TEST_AD_DURATION_SEC) * 100;

  const handleCloseClick = () => {
    if (completed) {
      onComplete({
        rewarded: true,
        source: 'web_test_player',
        adUnitId: ADMOB_REWARDED_TEST_AD_UNIT_ID,
        rewardType: 'ultra_hd_export',
        rewardAmount: 1,
      });
    } else {
      setConfirmEarlyExit(true);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewarded-ad-title"
      >
        {/* Top Ad Header Bar */}
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide">
              Test Ad
            </span>
            <span className="text-slate-300 font-medium">
              Google AdMob Rewarded
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!completed ? (
              <span className="font-mono-tabular text-xs text-slate-300">
                Reward in {secondsLeft}s
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Reward granted
              </span>
            )}
            <button
              type="button"
              onClick={handleCloseClick}
              aria-label="Close ad"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-700 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Ad Content Preview */}
        {confirmEarlyExit ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Close rewarded ad early?
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                If you exit now, you will not unlock{' '}
                <span className="text-white font-medium">{rewardLabel}</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300"
              >
                Close &amp; Skip
              </button>
              <button
                type="button"
                onClick={() => setConfirmEarlyExit(false)}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white"
              >
                Resume Ad
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {completed ? (
                <Sparkles className="w-8 h-8 text-emerald-400" />
              ) : (
                <Play className="w-8 h-8 fill-current" />
              )}
            </div>

            <div>
              <h3
                id="rewarded-ad-title"
                className="font-display text-lg font-bold text-white"
              >
                {completed ? 'Reward Unlocked!' : 'AdMob Rewarded Test Video'}
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
                {completed
                  ? `You have earned: ${rewardLabel}`
                  : `Testing rewarded ad flow to unlock ${rewardLabel}.`}
              </p>
            </div>

            <div className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-left">
              <div className="text-[11px] text-slate-400">
                Configured AdMob Test Unit ID
              </div>
              <div className="font-mono-tabular text-xs text-blue-300 mt-0.5 break-all">
                {ADMOB_REWARDED_TEST_AD_UNIT_ID}
              </div>
            </div>

            <button
              type="button"
              disabled={!completed}
              onClick={() =>
                onComplete({
                  rewarded: true,
                  source: 'web_test_player',
                  adUnitId: ADMOB_REWARDED_TEST_AD_UNIT_ID,
                  rewardType: 'ultra_hd_export',
                  rewardAmount: 1,
                })
              }
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition-colors"
            >
              {completed
                ? `Claim ${rewardLabel}`
                : `Please wait ${secondsLeft}s…`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
