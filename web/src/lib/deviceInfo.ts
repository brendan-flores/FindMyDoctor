export interface DeviceDescription {
  browser: string;
  platform: string;
  deviceType: string;
  label: string;
}

/**
 * Turn a User-Agent string into the same browser/platform labels shown in the
 * trusted-browser settings and the post-login device-trust prompt.
 */
export function describeDevice(deviceInfo: string | null | undefined): DeviceDescription {
  if (!deviceInfo) {
    return {
      browser: 'Unknown browser',
      platform: 'Unknown platform',
      deviceType: 'Unknown device',
      label: 'Unknown device',
    };
  }

  let browser = 'Browser';
  let platform = 'Unknown platform';
  let deviceType = 'Desktop';

  if (/Edg\//i.test(deviceInfo)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(deviceInfo)) browser = 'Opera';
  else if (/Chrome\//i.test(deviceInfo)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(deviceInfo)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(deviceInfo)) browser = 'Safari';

  if (/Windows/i.test(deviceInfo)) platform = 'Windows';
  else if (/Android/i.test(deviceInfo)) platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(deviceInfo)) platform = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(deviceInfo)) platform = 'macOS';
  else if (/Linux/i.test(deviceInfo)) platform = 'Linux';

  if (/iPad|Tablet/i.test(deviceInfo)) deviceType = 'Tablet';
  else if (/Mobi|Android|iPhone|iPod/i.test(deviceInfo)) deviceType = 'Mobile';

  return { browser, platform, deviceType, label: `${browser} on ${platform}` };
}
