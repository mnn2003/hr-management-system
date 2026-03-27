import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginCharacterProps {
  isPasswordFocused: boolean;
  isUsernameFocused: boolean;
  usernameValue: string;
  isPeeking?: boolean;
  variant?: 'main' | 'assistant' | 'helper';
  size?: 'sm' | 'md' | 'lg';
  emotion?: 'neutral' | 'success' | 'error';
  isWaving?: boolean;
}

const LoginCharacter = ({ 
  isPasswordFocused, 
  isUsernameFocused, 
  usernameValue,
  isPeeking = false,
  variant = 'main',
  size = 'lg',
  emotion = 'neutral',
  isWaving = false
}: LoginCharacterProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [handsAnimating, setHandsAnimating] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [breathScale, setBreathScale] = useState(1);
  const characterRef = useRef<HTMLDivElement>(null);
  const blinkTimeoutRef = useRef<NodeJS.Timeout>();

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-44 h-44'
  };

  // Blinking animation - random intervals
  useEffect(() => {
    if (prefersReducedMotion || isPasswordFocused) return;

    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6 seconds
      blinkTimeoutRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [prefersReducedMotion, isPasswordFocused]);

  // Breathing animation - subtle continuous
  useEffect(() => {
    if (prefersReducedMotion) return;

    let animationFrame: number;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      // Subtle sine wave for breathing (1.5 second cycle)
      const scale = 1 + Math.sin(elapsed / 1500) * 0.008;
      setBreathScale(scale);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion]);

  // Animate hands when password field is focused
  useEffect(() => {
    if (isPasswordFocused) {
      setHandsAnimating(true);
    } else {
      const timer = setTimeout(() => setHandsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isPasswordFocused]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Smooth head rotation toward cursor
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (prefersReducedMotion || isPasswordFocused) return;
    
    if (characterRef.current) {
      const rect = characterRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const normalizedX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)));
      const normalizedY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)));
      
      setMousePosition({ x: normalizedX, y: normalizedY });
      // Smooth head rotation (max ±8 degrees)
      setHeadRotation({ 
        x: normalizedY * 5, 
        y: normalizedX * 8 
      });
    }
  }, [prefersReducedMotion, isPasswordFocused]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setEyePosition({ x: 0, y: 0 });
      setHeadRotation({ x: 0, y: 0 });
      return;
    }

    if (isPasswordFocused) {
      setEyePosition({ x: 0, y: 0 });
      setHeadRotation({ x: 0, y: 0 });
    } else if (isUsernameFocused) {
      const textOffset = Math.min(usernameValue.length * 0.1, 1.5);
      setEyePosition({ x: 3 + textOffset, y: 2 });
      setHeadRotation({ x: 2, y: 5 + textOffset });
    } else {
      setEyePosition({ x: mousePosition.x * 4, y: mousePosition.y * 3 });
    }
  }, [mousePosition, isPasswordFocused, isUsernameFocused, usernameValue, prefersReducedMotion]);

  // Color schemes for different variants
  const colorSchemes = {
    main: {
      shirt: 'hsl(162, 73%, 46%)',
      shirtLight: 'hsl(162, 73%, 52%)',
      hair: '#4A3728',
      hairDark: '#3D2B1F',
      skin: '#FFE4C4',
      skinLight: '#FFDAB9',
      iris: '#3D5A80',
      eyebrow: '#2C1810' // Added eyebrow color
    },
    assistant: {
      shirt: 'hsl(200, 95%, 55%)',
      shirtLight: 'hsl(200, 95%, 62%)',
      hair: '#8B4513',
      hairDark: '#6B3510',
      skin: '#DEB887',
      skinLight: '#D2B48C',
      iris: '#228B22',
      eyebrow: '#5D4037' // Added eyebrow color
    },
    helper: {
      shirt: 'hsl(280, 65%, 55%)',
      shirtLight: 'hsl(280, 65%, 62%)',
      hair: '#2C1810',
      hairDark: '#1A0F0A',
      skin: '#FFDAB9',
      skinLight: '#FFE4C4',
      iris: '#8B4513',
      eyebrow: '#1A0F0A' // Added eyebrow color
    }
  };

  const colors = colorSchemes[variant];

  // Emotion-based mouth paths - FIXED: Always return valid string
  const getMouthPath = (): string => {
    if (emotion === 'success') {
      return "M 85 125 Q 100 145 115 125"; // Big smile
    }
    if (emotion === 'error') {
      return "M 85 135 Q 100 122 115 135"; // Frown
    }
    if (isPasswordFocused) {
      return "M 85 130 Q 100 125 115 130"; // Neutral/focused
    }
    if (isUsernameFocused) {
      return "M 85 130 Q 100 140 115 130"; // Slight smile
    }
    return "M 85 128 Q 100 138 115 128"; // Default smile
  };

  // Emotion-based eyebrow adjustments
  const getEyebrowOffset = () => {
    if (emotion === 'success') return -3;
    if (emotion === 'error') return 4;
    return 0;
  };

  // Emotion-based blush opacity
  const getBlushOpacity = () => {
    if (emotion === 'success') return 0.6;
    if (emotion === 'error') return 0.2;
    return 0.4;
  };

  // Calculate eye height for blinking - FIXED: Always return a number
  const getEyeHeight = (baseHeight: number): number => {
    if (isBlinking) return 1;
    if (isPasswordFocused && !isPeeking) return 2;
    return baseHeight;
  };

  // Get eye Y position for left eye
  const getLeftEyeY = (): number => {
    if (variant === 'assistant') return 92;
    if (variant === 'helper') return 94;
    return 90;
  };

  // Get eye Y position for right eye
  const getRightEyeY = (): number => {
    if (variant === 'assistant') return 92;
    if (variant === 'helper') return 94;
    return 90;
  };

  // Get base eye height for each variant
  const getBaseEyeHeight = (): number => {
    if (variant === 'assistant') return 13;
    if (variant === 'helper') return 10;
    return 12;
  };

  // Get left eye X position
  const getLeftEyeX = (): number => {
    if (variant === 'assistant') return 78;
    if (variant === 'helper') return 75;
    return 75;
  };

  // Get right eye X position
  const getRightEyeX = (): number => {
    if (variant === 'assistant') return 122;
    if (variant === 'helper') return 125;
    return 125;
  };

  // Get left eyebrow path - FIXED: More visible and better positioned
  const getLeftEyebrowPath = (): string => {
    const eyebrowOffset = getEyebrowOffset();
    const eyeY = getLeftEyeY();
    
    if (emotion === 'error') {
      return `M ${getLeftEyeX() - 10} ${eyeY - 18 + eyebrowOffset} Q ${getLeftEyeX()} ${eyeY - 10 + eyebrowOffset} ${getLeftEyeX() + 10} ${eyeY - 20 + eyebrowOffset}`;
    }
    
    if (emotion === 'success') {
      return `M ${getLeftEyeX() - 12} ${eyeY - 22 + eyebrowOffset} Q ${getLeftEyeX()} ${eyeY - 25 + eyebrowOffset} ${getLeftEyeX() + 12} ${eyeY - 22 + eyebrowOffset}`;
    }
    
    if (isPasswordFocused) {
      return `M ${getLeftEyeX() - 10} ${eyeY - 15 + eyebrowOffset} Q ${getLeftEyeX()} ${eyeY - 12 + eyebrowOffset} ${getLeftEyeX() + 10} ${eyeY - 15 + eyebrowOffset}`;
    }
    
    if (isUsernameFocused) {
      return `M ${getLeftEyeX() - 10} ${eyeY - 18 + eyebrowOffset} Q ${getLeftEyeX()} ${eyeY - 20 + eyebrowOffset} ${getLeftEyeX() + 10} ${eyeY - 18 + eyebrowOffset}`;
    }
    
    // Default relaxed eyebrow
    return `M ${getLeftEyeX() - 10} ${eyeY - 20 + eyebrowOffset} Q ${getLeftEyeX()} ${eyeY - 22 + eyebrowOffset} ${getLeftEyeX() + 10} ${eyeY - 20 + eyebrowOffset}`;
  };

  // Get right eyebrow path - FIXED: More visible and better positioned
  const getRightEyebrowPath = (): string => {
    const eyebrowOffset = getEyebrowOffset();
    const eyeY = getRightEyeY();
    
    if (emotion === 'error') {
      return `M ${getRightEyeX() - 10} ${eyeY - 20 + eyebrowOffset} Q ${getRightEyeX()} ${eyeY - 10 + eyebrowOffset} ${getRightEyeX() + 10} ${eyeY - 18 + eyebrowOffset}`;
    }
    
    if (emotion === 'success') {
      return `M ${getRightEyeX() - 12} ${eyeY - 22 + eyebrowOffset} Q ${getRightEyeX()} ${eyeY - 25 + eyebrowOffset} ${getRightEyeX() + 12} ${eyeY - 22 + eyebrowOffset}`;
    }
    
    if (isPasswordFocused) {
      return `M ${getRightEyeX() - 10} ${eyeY - 15 + eyebrowOffset} Q ${getRightEyeX()} ${eyeY - 12 + eyebrowOffset} ${getRightEyeX() + 10} ${eyeY - 15 + eyebrowOffset}`;
    }
    
    if (isUsernameFocused) {
      return `M ${getRightEyeX() - 10} ${eyeY - 18 + eyebrowOffset} Q ${getRightEyeX()} ${eyeY - 20 + eyebrowOffset} ${getRightEyeX() + 10} ${eyeY - 18 + eyebrowOffset}`;
    }
    
    // Default relaxed eyebrow
    return `M ${getRightEyeX() - 10} ${eyeY - 20 + eyebrowOffset} Q ${getRightEyeX()} ${eyeY - 22 + eyebrowOffset} ${getRightEyeX() + 10} ${eyeY - 20 + eyebrowOffset}`;
  };

  // Get eyebrow stroke width - thicker for better visibility
  const getEyebrowStrokeWidth = (): number => {
    if (variant === 'helper') return 4;
    if (variant === 'assistant') return 3;
    return 3.5;
  };

  // Shadow parallax offset based on head rotation
  const shadowOffset = {
    dx: headRotation.y * 0.5,
    dy: 4 + headRotation.x * 0.3
  };

  // Render function for each variant with optimized layers
  const renderCharacter = () => {
    const eyebrowOffset = getEyebrowOffset();
    const blushOpacity = getBlushOpacity();
    const leftEyeY = getLeftEyeY();
    const rightEyeY = getRightEyeY();
    const baseEyeHeight = getBaseEyeHeight();
    const leftEyeX = getLeftEyeX();
    const rightEyeX = getRightEyeX();
    const eyebrowStrokeWidth = getEyebrowStrokeWidth();

    return (
      <motion.div 
        ref={characterRef}
        className={`relative ${sizeClasses[size]} mx-auto`}
        style={{ 
          transform: `scale(${breathScale})`,
          willChange: 'transform'
        }}
        aria-hidden="true"
      >
        <motion.svg 
          viewBox="0 0 200 200" 
          className="w-full h-full"
          style={{ 
            transform: `perspective(1000px) rotateX(${headRotation.x}deg) rotateY(${headRotation.y}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform'
          }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <defs>
            <linearGradient id={`bgGradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.shirt} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colors.shirtLight} stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id={`faceGradient-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.skin} />
              <stop offset="100%" stopColor={colors.skinLight} />
            </linearGradient>
            <linearGradient id={`hairGradient-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.hair} />
              <stop offset="100%" stopColor={colors.hairDark} />
            </linearGradient>
            {/* Dynamic shadow with parallax */}
            <filter id={`shadow-${variant}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow 
                dx={shadowOffset.dx} 
                dy={shadowOffset.dy} 
                stdDeviation="4" 
                floodOpacity="0.18" 
              />
            </filter>
            {/* Glow filter for success state */}
            <filter id={`glow-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background with emotion-based glow */}
          <motion.circle 
            cx="100" 
            cy="100" 
            r="90" 
            fill={`url(#bgGradient-${variant})`}
            animate={{
              filter: emotion === 'success' ? `url(#glow-${variant})` : 'none'
            }}
          />

          {/* Body/Shirt - GPU optimized layer */}
          <g style={{ willChange: 'transform' }}>
            {variant === 'assistant' ? (
              <>
                <ellipse cx="100" cy="185" rx="50" ry="35" fill={colors.shirt} filter={`url(#shadow-${variant})`} />
                <ellipse cx="100" cy="182" rx="45" ry="30" fill={colors.shirtLight} />
              </>
            ) : variant === 'helper' ? (
              <>
                <ellipse cx="100" cy="188" rx="52" ry="38" fill={colors.shirt} filter={`url(#shadow-${variant})`} />
                <ellipse cx="100" cy="183" rx="47" ry="32" fill={colors.shirtLight} />
                {/* Tie */}
                <path d="M 97 158 L 100 175 L 103 158 L 100 155 Z" fill="#C44569" />
                <polygon points="95,175 105,175 102,195 98,195" fill="#C44569" />
              </>
            ) : (
              <>
                <ellipse cx="100" cy="190" rx="55" ry="35" fill={colors.shirt} filter={`url(#shadow-${variant})`} />
                <ellipse cx="100" cy="185" rx="50" ry="30" fill={colors.shirtLight} />
              </>
            )}
          </g>

          {/* Neck */}
          <rect 
            x={variant === 'helper' ? 87 : variant === 'assistant' ? 88 : 85} 
            y={variant === 'helper' ? 140 : variant === 'assistant' ? 142 : 140} 
            width={variant === 'helper' ? 26 : variant === 'assistant' ? 24 : 30} 
            height={variant === 'helper' ? 22 : 22} 
            fill={colors.skin} 
          />

          {/* Face */}
          <ellipse 
            cx="100" 
            cy={variant === 'helper' ? 95 : variant === 'assistant' ? 98 : 95} 
            rx={variant === 'helper' ? 52 : variant === 'assistant' ? 50 : 55} 
            ry={variant === 'helper' ? 58 : variant === 'assistant' ? 55 : 60} 
            fill={`url(#faceGradient-${variant})`} 
            filter={`url(#shadow-${variant})`} 
          />

          {/* Hair styles per variant */}
          {variant === 'assistant' ? (
            <>
              <ellipse cx="100" cy="60" rx="48" ry="32" fill={colors.hair} />
              <path d="M 52 75 Q 55 50 100 42 Q 145 50 148 75" fill={colors.hairDark} />
              <ellipse cx="50" cy="110" rx="10" ry="40" fill={colors.hair} />
              <ellipse cx="150" cy="110" rx="10" ry="40" fill={colors.hair} />
            </>
          ) : variant === 'helper' ? (
            <>
              <ellipse cx="100" cy="52" rx="50" ry="28" fill={colors.hair} />
              <path d="M 50 65 Q 55 40 100 35 Q 145 40 150 65" fill={colors.hairDark} />
              <ellipse cx="48" cy="80" rx="6" ry="12" fill={colors.hair} />
              <ellipse cx="152" cy="80" rx="6" ry="12" fill={colors.hair} />
            </>
          ) : (
            <>
              <ellipse cx="100" cy="55" rx="50" ry="30" fill={`url(#hairGradient-${variant})`} />
              <path d="M 50 70 Q 55 45 100 40 Q 145 45 150 70" fill={`url(#hairGradient-${variant})`} />
              <ellipse cx="52" cy="85" rx="8" ry="15" fill={`url(#hairGradient-${variant})`} />
              <ellipse cx="148" cy="85" rx="8" ry="15" fill={`url(#hairGradient-${variant})`} />
            </>
          )}

          {/* Ears */}
          {variant === 'assistant' ? (
            <>
              <ellipse cx="50" cy="100" rx="6" ry="10" fill={colors.skinLight} />
              <ellipse cx="150" cy="100" rx="6" ry="10" fill={colors.skinLight} />
              <circle cx="50" cy="112" r="4" fill="#FFD700" />
              <circle cx="150" cy="112" r="4" fill="#FFD700" />
            </>
          ) : variant === 'helper' ? (
            <>
              <ellipse cx="48" cy="98" rx="7" ry="11" fill={colors.skinLight} />
              <ellipse cx="152" cy="98" rx="7" ry="11" fill={colors.skinLight} />
            </>
          ) : (
            <>
              <ellipse cx="45" cy="100" rx="8" ry="12" fill={colors.skinLight} />
              <ellipse cx="155" cy="100" rx="8" ry="12" fill={colors.skinLight} />
            </>
          )}

          {/* Glasses for helper variant */}
          {variant === 'helper' && (
            <>
              <rect x="58" y="82" rx="5" ry="5" width="34" height="24" fill="none" stroke="#333" strokeWidth="2.5" />
              <rect x="108" y="82" rx="5" ry="5" width="34" height="24" fill="none" stroke="#333" strokeWidth="2.5" />
              <path d="M 92 94 L 108 94" stroke="#333" strokeWidth="2" />
              <path d="M 58 92 L 48 88" stroke="#333" strokeWidth="2" />
              <path d="M 142 92 L 152 88" stroke="#333" strokeWidth="2" />
            </>
          )}

          {/* Eyebrows - FIXED: Much more visible with darker color and better positioning */}
          <path 
            d={getLeftEyebrowPath()}
            stroke={colors.eyebrow} 
            strokeWidth={eyebrowStrokeWidth} 
            fill="none" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path 
            d={getRightEyebrowPath()}
            stroke={colors.eyebrow} 
            strokeWidth={eyebrowStrokeWidth} 
            fill="none" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eyelashes for assistant variant */}
          {variant === 'assistant' && !isPasswordFocused && !isBlinking && (
            <>
              <path d="M 65 85 L 62 80" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 70 82 L 68 77" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 86 82 L 88 77" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 91 85 L 94 80" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 109 85 L 106 80" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 114 82 L 112 77" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 130 82 L 132 77" stroke={colors.hairDark} strokeWidth="1.5" />
              <path d="M 135 85 L 138 80" stroke={colors.hairDark} strokeWidth="1.5" />
            </>
          )}

          {/* Eyes with blinking animation */}
          <g className="eyes" style={{ willChange: 'transform' }}>
            {/* Left eye */}
            <motion.ellipse 
              cx={leftEyeX} 
              cy={leftEyeY} 
              rx={variant === 'assistant' ? 14 : variant === 'helper' ? 12 : 15}
              fill="white"
              animate={{
                ry: getEyeHeight(baseEyeHeight)
              }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
            />
            {/* Right eye */}
            <motion.ellipse 
              cx={rightEyeX} 
              cy={rightEyeY} 
              rx={variant === 'assistant' ? 14 : variant === 'helper' ? 12 : 15}
              fill="white"
              animate={{
                ry: isPasswordFocused && !isPeeking 
                  ? 2 
                  : getEyeHeight(baseEyeHeight)
              }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
            />
            
            {/* Iris and pupils - only when eyes are open */}
            <AnimatePresence>
              {!isPasswordFocused && !isBlinking && (
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  {/* Left iris */}
                  <circle 
                    cx={leftEyeX + eyePosition.x} 
                    cy={leftEyeY + eyePosition.y} 
                    r={variant === 'helper' ? 6 : 8} 
                    fill={colors.iris} 
                  />
                  <circle 
                    cx={leftEyeX + eyePosition.x} 
                    cy={leftEyeY + eyePosition.y} 
                    r={variant === 'helper' ? 3 : 4} 
                    fill="#1a1a2e" 
                  />
                  <circle 
                    cx={leftEyeX + eyePosition.x - 2} 
                    cy={leftEyeY + eyePosition.y - 3} 
                    r={variant === 'helper' ? 1.5 : 2} 
                    fill="white" 
                  />
                  {/* Right iris */}
                  <circle 
                    cx={rightEyeX + eyePosition.x} 
                    cy={rightEyeY + eyePosition.y} 
                    r={variant === 'helper' ? 6 : 8} 
                    fill={colors.iris} 
                  />
                  <circle 
                    cx={rightEyeX + eyePosition.x} 
                    cy={rightEyeY + eyePosition.y} 
                    r={variant === 'helper' ? 3 : 4} 
                    fill="#1a1a2e" 
                  />
                  <circle 
                    cx={rightEyeX + eyePosition.x - 2} 
                    cy={rightEyeY + eyePosition.y - 3} 
                    r={variant === 'helper' ? 1.5 : 2} 
                    fill="white" 
                  />
                </motion.g>
              )}
            </AnimatePresence>

            {/* Peeking eye - right eye opens when peeking during password focus */}
            {isPasswordFocused && isPeeking && !isBlinking && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <circle 
                  cx={rightEyeX + 3} 
                  cy={rightEyeY + 2} 
                  r={variant === 'helper' ? 6 : 8} 
                  fill={colors.iris} 
                />
                <circle 
                  cx={rightEyeX + 3} 
                  cy={rightEyeY + 2} 
                  r={variant === 'helper' ? 3 : 4} 
                  fill="#1a1a2e" 
                />
                <circle 
                  cx={rightEyeX + 1} 
                  cy={rightEyeY - 1} 
                  r={variant === 'helper' ? 1.5 : 2} 
                  fill="white" 
                />
              </motion.g>
            )}
          </g>

          {/* Nose */}
          <ellipse 
            cx="100" 
            cy={variant === 'helper' ? 112 : variant === 'assistant' ? 108 : 108} 
            rx={variant === 'assistant' ? 4 : variant === 'helper' ? 5 : 6} 
            ry={variant === 'assistant' ? 6 : variant === 'helper' ? 7 : 8} 
            fill="#D4A574" 
            opacity={variant === 'helper' ? 0.5 : 0.6} 
          />
          {variant === 'main' && (
            <path d="M 94 108 Q 100 118 106 108" fill="none" stroke="#D4A574" strokeWidth="1.5" />
          )}

          {/* Mouth with emotion states */}
          <motion.path 
            d={getMouthPath()}
            stroke={variant === 'assistant' ? '#C44569' : '#C9756B'} 
            strokeWidth="3" 
            fill={emotion === 'success' ? 'none' : 'none'} 
            strokeLinecap="round"
            animate={{
              d: getMouthPath()
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />

          {/* Success teeth visible */}
          {emotion === 'success' && (
            <motion.rect
              x="92"
              y="128"
              width="16"
              height="8"
              rx="2"
              fill="white"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: 0.1 }}
            />
          )}

          {/* Blush */}
          <motion.ellipse 
            cx={variant === 'assistant' ? 60 : 55} 
            cy={variant === 'assistant' ? 108 : 110} 
            rx={variant === 'assistant' ? 8 : 10} 
            ry={variant === 'assistant' ? 5 : 6} 
            fill="#FFB6C1" 
            animate={{ opacity: blushOpacity }}
            transition={{ duration: 0.3 }}
          />
          <motion.ellipse 
            cx={variant === 'assistant' ? 140 : 145} 
            cy={variant === 'assistant' ? 108 : 110} 
            rx={variant === 'assistant' ? 8 : 10} 
            ry={variant === 'assistant' ? 5 : 6} 
            fill="#FFB6C1" 
            animate={{ opacity: blushOpacity }}
            transition={{ duration: 0.3 }}
          />

          {/* Stubble for helper variant */}
          {variant === 'helper' && (
            <>
              <ellipse cx="85" cy="138" rx="12" ry="6" fill={colors.hairDark} opacity="0.1" />
              <ellipse cx="115" cy="138" rx="12" ry="6" fill={colors.hairDark} opacity="0.1" />
            </>
          )}

          {/* Hands covering eyes with smooth animation */}
          <motion.g 
            animate={{ 
              y: isPasswordFocused ? 0 : 50,
              opacity: handsAnimating || isPasswordFocused ? 1 : 0
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 300, 
              damping: 25,
              opacity: { duration: 0.15 }
            }}
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Left hand (stays covering) */}
            <g>
              <ellipse cx={variant === 'helper' ? 72 : variant === 'assistant' ? 73 : 70} cy={variant === 'helper' ? 96 : variant === 'assistant' ? 94 : 92} rx={variant === 'helper' ? 24 : 22} ry={variant === 'helper' ? 18 : 16} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 54 : variant === 'assistant' ? 56 : 52} cy={variant === 'helper' ? 94 : variant === 'assistant' ? 92 : 90} rx="5" ry={variant === 'helper' ? 9 : 8} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 60 : variant === 'assistant' ? 62 : 58} cy={variant === 'helper' ? 85 : variant === 'assistant' ? 84 : 81} rx="5" ry={variant === 'helper' ? 11 : 10} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 70 : variant === 'assistant' ? 71 : 68} cy={variant === 'helper' ? 80 : variant === 'assistant' ? 80 : 76} rx="5" ry={variant === 'helper' ? 13 : 11} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 80 : variant === 'assistant' ? 80 : 78} cy={variant === 'helper' ? 85 : variant === 'assistant' ? 84 : 81} rx="5" ry={variant === 'helper' ? 11 : 10} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 88 : variant === 'assistant' ? 88 : 86} cy={variant === 'helper' ? 92 : variant === 'assistant' ? 90 : 88} rx="4" ry={variant === 'helper' ? 8 : 7} fill={colors.skinLight} />
            </g>
            
            {/* Right hand (moves away when peeking) */}
            <motion.g
              animate={{
                x: isPasswordFocused && isPeeking ? 65 : 0,
                y: isPasswordFocused && isPeeking ? 35 : 0
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <ellipse cx={variant === 'helper' ? 128 : variant === 'assistant' ? 127 : 130} cy={variant === 'helper' ? 96 : variant === 'assistant' ? 94 : 92} rx={variant === 'helper' ? 24 : 22} ry={variant === 'helper' ? 18 : 16} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 146 : variant === 'assistant' ? 144 : 148} cy={variant === 'helper' ? 94 : variant === 'assistant' ? 92 : 90} rx="5" ry={variant === 'helper' ? 9 : 8} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 140 : variant === 'assistant' ? 138 : 142} cy={variant === 'helper' ? 85 : variant === 'assistant' ? 84 : 81} rx="5" ry={variant === 'helper' ? 11 : 10} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 130 : variant === 'assistant' ? 129 : 132} cy={variant === 'helper' ? 80 : variant === 'assistant' ? 80 : 76} rx="5" ry={variant === 'helper' ? 13 : 11} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 120 : variant === 'assistant' ? 120 : 122} cy={variant === 'helper' ? 85 : variant === 'assistant' ? 84 : 81} rx="5" ry={variant === 'helper' ? 11 : 10} fill={colors.skinLight} />
              <ellipse cx={variant === 'helper' ? 112 : variant === 'assistant' ? 112 : 114} cy={variant === 'helper' ? 92 : variant === 'assistant' ? 90 : 88} rx="4" ry={variant === 'helper' ? 8 : 7} fill={colors.skinLight} />
            </motion.g>
          </motion.g>

          {/* Waving arm animation */}
          <AnimatePresence>
            {isWaving && !isPasswordFocused && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Waving arm - right side */}
                <motion.g
                  style={{ transformOrigin: '160px 150px' }}
                  animate={{
                    rotate: [0, -15, 25, -15, 25, -10, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    ease: 'easeInOut',
                  }}
                >
                  {/* Arm */}
                  <ellipse 
                    cx="175" 
                    cy="130" 
                    rx="12" 
                    ry="25" 
                    fill={colors.skinLight}
                  />
                  {/* Hand */}
                  <ellipse 
                    cx="180" 
                    cy="105" 
                    rx="14" 
                    ry="12" 
                    fill={colors.skinLight}
                  />
                  {/* Fingers */}
                  <ellipse cx="170" cy="95" rx="4" ry="8" fill={colors.skinLight} />
                  <ellipse cx="178" cy="92" rx="4" ry="9" fill={colors.skinLight} />
                  <ellipse cx="186" cy="94" rx="4" ry="8" fill={colors.skinLight} />
                  <ellipse cx="192" cy="98" rx="3" ry="6" fill={colors.skinLight} />
                </motion.g>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Success sparkles */}
          <AnimatePresence>
            {emotion === 'success' && (
              <>
                <motion.circle
                  cx="45"
                  cy="60"
                  r="3"
                  fill="#FFD700"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                />
                <motion.circle
                  cx="155"
                  cy="55"
                  r="4"
                  fill="#FFD700"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                />
                <motion.circle
                  cx="170"
                  cy="100"
                  r="2.5"
                  fill="#FFD700"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: 0.6 }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.svg>
      </motion.div>
    );
  };

  return renderCharacter();
};

export default LoginCharacter;
