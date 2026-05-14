import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns the current network connectivity state.
 * `isOnline` is true when the device has an active internet connection.
 * Uses `isInternetReachable !== false` so that `null` (unknown) is treated
 * as online to avoid blocking operations on uncertain state.
 */
export function useNetworkState(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Seed initial state immediately
    NetInfo.fetch().then(s => {
      setIsOnline(s.isConnected !== false && s.isInternetReachable !== false);
    });

    const unsub = NetInfo.addEventListener(s => {
      setIsOnline(s.isConnected !== false && s.isInternetReachable !== false);
    });

    return unsub;
  }, []);

  return { isOnline };
}
