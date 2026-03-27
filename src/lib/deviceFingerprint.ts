// Device fingerprinting utility for session management

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

// Generate a unique device fingerprint based on browser characteristics
export const generateDeviceFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.hardwareConcurrency || 'unknown',
    navigator.platform,
  ];
  
  // Create a hash from the components
  const fingerprint = components.join('|');
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Store in localStorage for consistency
  const storedId = localStorage.getItem('deviceId');
  if (storedId) {
    return storedId;
  }
  
  const deviceId = `device_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem('deviceId', deviceId);
  return deviceId;
};

// Get browser name from user agent
const getBrowserName = (): string => {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('MSIE') || ua.includes('Trident')) return 'Internet Explorer';
  
  return 'Unknown Browser';
};

// Get OS name from user agent
const getOSName = (): string => {
  const ua = navigator.userAgent;
  
  if (ua.includes('Windows NT 10')) return 'Windows 10';
  if (ua.includes('Windows NT 11') || (ua.includes('Windows NT 10') && ua.includes('Win64'))) return 'Windows 11';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  
  return 'Unknown OS';
};

// Get device type
const getDeviceType = (): 'desktop' | 'tablet' | 'mobile' => {
  const ua = navigator.userAgent;
  
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  
  return 'desktop';
};

// Get complete device info
export const getDeviceInfo = (): DeviceInfo => {
  const deviceId = generateDeviceFingerprint();
  const browser = getBrowserName();
  const os = getOSName();
  const deviceType = getDeviceType();
  
  return {
    deviceId,
    deviceName: `${browser} on ${os}`,
    browser,
    os,
    deviceType,
  };
};

// Get device icon name based on type
export const getDeviceIcon = (deviceType: string): 'Smartphone' | 'Tablet' | 'Monitor' => {
  switch (deviceType) {
    case 'mobile':
      return 'Smartphone';
    case 'tablet':
      return 'Tablet';
    default:
      return 'Monitor';
  }
};
