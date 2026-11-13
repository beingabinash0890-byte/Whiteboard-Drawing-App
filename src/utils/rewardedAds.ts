export const ADMOB_REWARDED_TEST_AD_UNIT_ID =
  'ca-app-pub-3940256099942544/5224354917';

const UNLOCK_STORAGE_KEY = 'smart_whiteboard_reward_unlock_until_v1';
const REWARD_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RewardResult {
  rewarded: boolean;
  source: 'android_bridge' | 'web_test_player';
  adUnitId: string;
  rewardType: string;
  rewardAmount: number;
}

declare global {
  interface Window {
    AndroidAds?: {
      showRewardedAd: (adUnitId: string) => void;
    };
    AndroidAdMob?: {
      showRewardedAd: (adUnitId: string) => void;
    };
    __onRewardedAdResult?: (granted: boolean, rewardType?: string, amount?: number) => void;
  }
}

export function hasNativeAndroidAdsBridge(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      (window.AndroidAds?.showRewardedAd || window.AndroidAdMob?.showRewardedAd)
  );
}

export function showNativeAndroidRewardedAd(
  adUnitId: string = ADMOB_REWARDED_TEST_AD_UNIT_ID
): Promise<RewardResult> {
  return new Promise((resolve) => {
    const bridge = window.AndroidAds ?? window.AndroidAdMob;
    if (!bridge?.showRewardedAd) {
      resolve({
        rewarded: false,
        source: 'android_bridge',
        adUnitId,
        rewardType: 'ultra_hd_export',
        rewardAmount: 0,
      });
      return;
    }

    const timeout = window.setTimeout(() => {
      delete window.__onRewardedAdResult;
      resolve({
        rewarded: false,
        source: 'android_bridge',
        adUnitId,
        rewardType: 'ultra_hd_export',
        rewardAmount: 0,
      });
    }, 60_000);

    window.__onRewardedAdResult = (
      granted: boolean,
      rewardType = 'ultra_hd_export',
      amount = 1
    ) => {
      window.clearTimeout(timeout);
      delete window.__onRewardedAdResult;
      resolve({
        rewarded: granted,
        source: 'android_bridge',
        adUnitId,
        rewardType,
        rewardAmount: granted ? amount : 0,
      });
    };

    bridge.showRewardedAd(adUnitId);
  });
}

export function isRewardUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function grantRewardUnlock(): number {
  const until = Date.now() + REWARD_DURATION_MS;
  try {
    localStorage.setItem(UNLOCK_STORAGE_KEY, String(until));
  } catch {
    // ignore storage errors
  }
  return until;
}
