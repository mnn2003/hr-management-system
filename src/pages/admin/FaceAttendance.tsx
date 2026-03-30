import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadFaceModels,
  arrayToDescriptor,
  matchFace,
} from '@/lib/faceRecognitionService';
import * as faceapi from 'face-api.js';
import { formatLocalDate } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ScanFace,
  Clock,
  UserX,
  ZoomIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

interface KnownFace {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  userId: string;
  descriptors: Float32Array[];
  photoURL?: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  source?: string;
}

const normalizeStoredDescriptors = (descriptors: unknown): Float32Array[] => {
  if (!Array.isArray(descriptors)) return [];
  return descriptors
    .map((item: unknown) => {
      if (Array.isArray(item)) return arrayToDescriptor(item as number[]);
      if (item && typeof item === 'object' && 'values' in item && Array.isArray((item as { values?: unknown }).values)) {
        return arrayToDescriptor((item as { values: number[] }).values);
      }
      return null;
    })
    .filter((d): d is Float32Array => d !== null);
};

const PUNCH_COOLDOWN = 2000; // 2 seconds cooldown between scans to prevent duplicate processing
const MIN_PUNCH_DURATION = 10 * 60 * 1000; // 10 minutes minimum between punch in and punch out
const RESULT_DISPLAY_DURATION = 5000; // 5 seconds for error messages
const MIN_FACE_SIZE = 120; // minimum face box width to consider "close enough"

type ResultState = {
  type: 'success' | 'not_found' | 'too_far' | 'already_punched_in' | 'already_punched_out' | 'too_early_to_punch_out' | 'no_punch_in';
  employeeName?: string;
  employeeCode?: string;
  photoURL?: string;
  punchType?: 'in' | 'out';
  message?: string;
  remainingMinutes?: number;
} | null;

const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
};

const FaceAttendance = () => {
  const { organizationId } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [knownFaces, setKnownFaces] = useState<KnownFace[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [result, setResult] = useState<ResultState>(null);

  const processingRef = useRef<Set<string>>(new Set()); // Track employees being processed
  const lastScanTimeRef = useRef<Map<string, number>>(new Map()); // Track last scan time per employee
  const lastPunchOutAttemptRef = useRef<Map<string, number>>(new Map()); // Track last punch out attempt

  const showResult = useCallback((r: ResultState) => {
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    setResult(r);
    
    // Longer timeout for error messages
    const duration = r.type === 'success' ? RESULT_DISPLAY_DURATION : RESULT_DISPLAY_DURATION;
    resultTimeoutRef.current = setTimeout(() => setResult(null), duration);
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load models
  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels();
        setModelsReady(true);
      } catch (e) {
        console.error('Error loading models:', e);
      } finally {
        setLoadingModels(false);
      }
    };
    init();
  }, []);

  // Load known faces
  useEffect(() => {
    const loadFaces = async () => {
      if (!organizationId) return;
      try {
        const q = query(collection(db, 'face_data'), where('organizationId', '==', organizationId));
        const snapshot = await getDocs(q);
        const faces: KnownFace[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              employeeId: data.employeeId,
              employeeName: data.employeeName,
              employeeCode: data.employeeCode,
              userId: data.userId || '',
              descriptors: normalizeStoredDescriptors(data.descriptors),
              photoURL: data.photoURL || '',
            };
          })
          .filter((face) => face.descriptors.length > 0);
        setKnownFaces(faces);
      } catch (e) {
        console.error('Error loading face data:', e);
      }
    };
    loadFaces();
  }, [organizationId]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadeddata = () => setCameraActive(true);
      }
    } catch {
      toast.error('Could not access camera.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  useEffect(() => {
    if (modelsReady && knownFaces.length > 0 && !cameraActive) startCamera();
  }, [modelsReady, knownFaces, cameraActive, startCamera]);

  // Get today's attendance record from the main attendance collection
  const getTodayAttendance = async (employeeUserId: string, employeeId: string): Promise<AttendanceRecord | null> => {
    const today = formatLocalDate(new Date());
    try {
      // Try to find by userId first (for web/mobile punches)
      let q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employeeUserId),
        where('date', '==', today)
      );
      let snapshot = await getDocs(q);
      
      // If not found, try by employeeDocumentId (for face recognition)
      if (snapshot.empty) {
        q = query(
          collection(db, 'attendance'),
          where('employeeDocumentId', '==', employeeId),
          where('date', '==', today)
        );
        snapshot = await getDocs(q);
      }
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord;
      }
      return null;
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      return null;
    }
  };

  // Get the current attendance status
  const getAttendanceStatus = async (employeeUserId: string, employeeId: string): Promise<{
    hasPunchIn: boolean;
    hasPunchOut: boolean;
    attendanceRecord: AttendanceRecord | null;
    punchInTime: Date | null;
    punchOutTime: Date | null;
    minutesSincePunchIn: number | null;
  }> => {
    const attendance = await getTodayAttendance(employeeUserId, employeeId);
    
    if (!attendance || !attendance.punchIn) {
      return {
        hasPunchIn: false,
        hasPunchOut: false,
        attendanceRecord: null,
        punchInTime: null,
        punchOutTime: null,
        minutesSincePunchIn: null,
      };
    }
    
    const punchInTime = new Date(attendance.punchIn);
    const now = new Date();
    const minutesSincePunchIn = (now.getTime() - punchInTime.getTime()) / (1000 * 60);
    
    return {
      hasPunchIn: true,
      hasPunchOut: attendance.punchOut !== null,
      attendanceRecord: attendance,
      punchInTime,
      punchOutTime: attendance.punchOut ? new Date(attendance.punchOut) : null,
      minutesSincePunchIn,
    };
  };

  // Check if user can punch out (must be at least 10 minutes after punch in)
  const canPunchOut = (punchInTime: Date | null): { allowed: boolean; remainingMinutes: number } => {
    if (!punchInTime) {
      return { allowed: false, remainingMinutes: 0 };
    }
    
    const now = new Date();
    const timeDifference = now.getTime() - punchInTime.getTime();
    const minutesElapsed = Math.floor(timeDifference / (1000 * 60));
    
    if (timeDifference >= MIN_PUNCH_DURATION) {
      return { allowed: true, remainingMinutes: 0 };
    }
    
    const remainingMinutes = Math.ceil((MIN_PUNCH_DURATION - timeDifference) / (1000 * 60));
    return { allowed: false, remainingMinutes };
  };

  const captureCurrentFrame = (): string | null => {
    if (!videoRef.current || videoRef.current.readyState < 4) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      return null;
    }
  };

  const handlePunchIn = async (known: KnownFace) => {
    const today = formatLocalDate(new Date());
    const isoTime = new Date().toISOString();
    const attendanceUserId = known.userId || known.employeeId;
    const faceImage = captureCurrentFrame();
    
    // Create attendance record
    await addDoc(collection(db, 'attendance'), {
      employeeId: attendanceUserId,
      employeeDocumentId: known.employeeId,
      employeeName: known.employeeName,
      employeeCode: known.employeeCode,
      date: today,
      punchIn: isoTime,
      punchInLocation: 'Office Face Machine',
      punchInFaceImage: faceImage,
      punchOut: null,
      punchOutLocation: null,
      punchOutFaceImage: null,
      organizationId: organizationId || null,
      source: 'face_recognition',
    });
  };

  const handlePunchOut = async (known: KnownFace, attendanceRecord: AttendanceRecord) => {
    const isoTime = new Date().toISOString();
    const faceImage = captureCurrentFrame();
    
    await updateDoc(doc(db, 'attendance', attendanceRecord.id), {
      punchOut: isoTime,
      punchOutLocation: 'Office Face Machine',
      punchOutFaceImage: faceImage,
    });
  };

  const processAttendance = async (known: KnownFace) => {
    const now = Date.now();
    const employeeId = known.employeeId;
    const attendanceUserId = known.userId || known.employeeId;
    
    // Prevent multiple concurrent processing for same employee
    if (processingRef.current.has(employeeId)) {
      console.log(`Already processing ${employeeId}, skipping...`);
      return;
    }
    
    // Check cooldown to prevent processing the same face too frequently
    const lastScanTime = lastScanTimeRef.current.get(employeeId);
    if (lastScanTime && now - lastScanTime < PUNCH_COOLDOWN) {
      console.log(`Cooldown active for ${employeeId}`);
      return;
    }
    
    processingRef.current.add(employeeId);
    lastScanTimeRef.current.set(employeeId, now);
    
    try {
      // Get current attendance status from database
      const { hasPunchIn, hasPunchOut, attendanceRecord, punchInTime, minutesSincePunchIn } = 
        await getAttendanceStatus(attendanceUserId, employeeId);
      
      console.log(`Attendance status for ${known.employeeName}:`, {
        hasPunchIn,
        hasPunchOut,
        punchInTime: punchInTime?.toLocaleTimeString(),
        minutesSincePunchIn,
      });
      
      // Case 1: Already punched out for today
      if (hasPunchOut) {
        // Check if it's been more than 10 minutes since last punch out attempt
        const lastPunchOutAttempt = lastPunchOutAttemptRef.current.get(employeeId);
        if (!lastPunchOutAttempt || now - lastPunchOutAttempt > 10000) { // 10 second cooldown for showing message
          lastPunchOutAttemptRef.current.set(employeeId, now);
          showResult({
            type: 'already_punched_out',
            employeeName: known.employeeName,
            employeeCode: known.employeeCode,
            photoURL: known.photoURL,
            punchType: 'out',
            message: 'You have already completed your work day',
          });
          speak(`${known.employeeName}, you have already punched out for today. See you tomorrow!`);
        }
        return;
      }
      
      // Case 2: Has punched in and not punched out yet
      if (hasPunchIn && attendanceRecord && !hasPunchOut) {
        // Check if enough time has passed since punch in
        const { allowed, remainingMinutes } = canPunchOut(punchInTime);
        
        if (!allowed) {
          // Prevent punch out - too early
          const lastPunchOutAttempt = lastPunchOutAttemptRef.current.get(employeeId);
          if (!lastPunchOutAttempt || now - lastPunchOutAttempt > 10000) {
            lastPunchOutAttemptRef.current.set(employeeId, now);
            showResult({
              type: 'too_early_to_punch_out',
              employeeName: known.employeeName,
              employeeCode: known.employeeCode,
              photoURL: known.photoURL,
              punchType: 'out',
              message: `Please wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''} before punching out`,
              remainingMinutes,
            });
            speak(`${known.employeeName}, you punched in at ${punchInTime?.toLocaleTimeString()}. Please wait ${remainingMinutes} more minutes before punching out.`);
          }
          return;
        }
        
        // Perform punch out
        await handlePunchOut(known, attendanceRecord);
        
        // Record in face_attendance collection
        const today = formatLocalDate(new Date());
        await addDoc(collection(db, 'face_attendance'), {
          employeeId: known.employeeId,
          employeeName: known.employeeName,
          employeeCode: known.employeeCode,
          organizationId,
          date: today,
          time: new Date().toLocaleTimeString(),
          timestamp: Timestamp.now(),
          type: 'out',
          location: 'Office Face Machine',
          faceImage: captureCurrentFrame(),
        });
        
        showResult({
          type: 'success',
          employeeName: known.employeeName,
          employeeCode: known.employeeCode,
          photoURL: known.photoURL,
          punchType: 'out',
        });
        speak(`Thank you, ${known.employeeName}. You worked for ${Math.floor(minutesSincePunchIn!)} minutes. Punch out recorded. Have a great day!`);
        return;
      }
      
      // Case 3: No punch in yet today
      if (!hasPunchIn) {
        // Check for duplicate punch in attempts
        const lastPunchOutAttempt = lastPunchOutAttemptRef.current.get(employeeId);
        if (!lastPunchOutAttempt || now - lastPunchOutAttempt > 10000) {
          // Perform punch in
          await handlePunchIn(known);
          
          // Record in face_attendance collection
          const today = formatLocalDate(new Date());
          await addDoc(collection(db, 'face_attendance'), {
            employeeId: known.employeeId,
            employeeName: known.employeeName,
            employeeCode: known.employeeCode,
            organizationId,
            date: today,
            time: new Date().toLocaleTimeString(),
            timestamp: Timestamp.now(),
            type: 'in',
            location: 'Office Face Machine',
            faceImage: captureCurrentFrame(),
          });
          
          showResult({
            type: 'success',
            employeeName: known.employeeName,
            employeeCode: known.employeeCode,
            photoURL: known.photoURL,
            punchType: 'in',
          });
          speak(`Welcome, ${known.employeeName}. Punch in recorded at ${new Date().toLocaleTimeString()}. Have a great day!`);
        }
        return;
      }
      
      // Case 4: Should not reach here, but handle gracefully
      console.log('Unexpected attendance state:', { hasPunchIn, hasPunchOut });
      
    } catch (e) {
      console.error('Error processing attendance:', e);
      toast.error('Failed to process attendance');
    } finally {
      processingRef.current.delete(employeeId);
    }
  };
  
  // Continuous face scanning
  useEffect(() => {
    if (!cameraActive || !modelsReady || knownFaces.length === 0) return;
    setScanning(true);
    
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 4 || videoRef.current.videoWidth === 0) return;
      
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoRef.current.videoWidth;
        tempCanvas.height = videoRef.current.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        tempCtx.drawImage(videoRef.current, 0, 0);
        
        const detections = await faceapi
          .detectAllFaces(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        
        // Draw overlay
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (const det of detections) {
              const { x, y, width, height } = det.detection.box;
              
              // Check if face is too far
              if (width < MIN_FACE_SIZE) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                continue;
              }
              
              const matchResult = matchFace(
                det.descriptor,
                knownFaces.map((kf) => ({ label: kf.employeeId, descriptors: kf.descriptors }))
              );
              
              if (matchResult) {
                const known = knownFaces.find((kf) => kf.employeeId === matchResult.label);
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                
                if (known) {
                  await processAttendance(known);
                }
              } else {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Scan frame error:', e);
      }
    }, 3000); // Scan every 3 seconds to reduce load
    
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [cameraActive, modelsReady, knownFaces, organizationId]);
  
  useEffect(() => () => stopCamera(), [stopCamera]);
  
  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">
      <Sonner />
      
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <ScanFace className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-sm sm:text-lg font-bold">Face Attendance</h1>
          {scanning && (
            <Badge className="gap-1 bg-green-600 text-white text-[10px] sm:text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg sm:text-2xl font-mono font-bold">
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>
      
      {/* Loading state */}
      {loadingModels && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 px-4">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mx-auto" />
            <p className="text-sm sm:text-lg text-gray-300">Loading face recognition models...</p>
          </div>
        </div>
      )}
      
      {/* No faces enrolled */}
      {!loadingModels && modelsReady && knownFaces.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-amber-500 mx-auto" />
            <h2 className="text-lg sm:text-xl font-semibold">No Faces Enrolled</h2>
            <p className="text-sm text-gray-400">
              Please enroll employee faces from the admin panel before using this attendance scanner.
            </p>
          </div>
        </div>
      )}
      
      {/* Main Content - Camera */}
      {!loadingModels && modelsReady && knownFaces.length > 0 && (
        <div className="flex-1 relative min-h-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Result Overlay */}
          {result && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
              <div className="text-center px-6 py-8 sm:px-12 sm:py-10 max-w-sm sm:max-w-md mx-4 rounded-2xl animate-in fade-in zoom-in-95 duration-300"
                style={{
                  background: result.type === 'success'
                    ? 'rgba(22, 163, 74, 0.95)'
                    : result.type === 'too_early_to_punch_out'
                    ? 'rgba(245, 158, 11, 0.95)'
                    : result.type === 'already_punched_in'
                    ? 'rgba(245, 158, 11, 0.95)'
                    : result.type === 'already_punched_out'
                    ? 'rgba(107, 114, 128, 0.95)'
                    : result.type === 'no_punch_in'
                    ? 'rgba(220, 38, 38, 0.95)'
                    : 'rgba(217, 119, 6, 0.95)',
                }}>
                {result.type === 'success' && (
                  <>
                    {result.punchType === 'in' ? (
                      <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    ) : (
                      <LogOut className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    )}
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                      {result.punchType === 'in' ? 'Welcome!' : 'Goodbye!'}
                    </h2>
                    <p className="text-base sm:text-lg text-white mb-4">
                      {result.punchType === 'in' ? 'Punched In Successfully' : 'Punched Out Successfully'}
                    </p>
                    <div className="space-y-3">
                      {result.photoURL && (
                        <img
                          src={result.photoURL}
                          alt={result.employeeName}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto border-4 border-white/30 object-cover"
                        />
                      )}
                      {!result.photoURL && (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto border-4 border-white/30 bg-white/20 flex items-center justify-center">
                          <span className="text-3xl sm:text-4xl font-bold text-white">
                            {result.employeeName?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <p className="text-xl sm:text-2xl font-semibold text-white">{result.employeeName}</p>
                      <p className="text-sm sm:text-base text-white/80">ID: {result.employeeCode}</p>
                    </div>
                  </>
                )}
                
                {result.type === 'too_early_to_punch_out' && (
                  <>
                    <AlertTriangle className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Too Early to Punch Out!</h2>
                    <p className="text-base sm:text-lg text-white mb-2">
                      Please wait {result.remainingMinutes} more minute{result.remainingMinutes !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm sm:text-base text-white/80">
                      Minimum 10 minutes required between punches
                    </p>
                    <p className="text-xs text-white/60 mt-3">
                      {result.employeeName} (ID: {result.employeeCode})
                    </p>
                  </>
                )}
                
                {result.type === 'already_punched_in' && (
                  <>
                    <Clock className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Already Punched In!</h2>
                    <p className="text-base sm:text-lg text-white mb-2">
                      You are already checked in
                    </p>
                    <p className="text-sm sm:text-base text-white/80">
                      Please wait 10 minutes before punching out
                    </p>
                    <p className="text-xs text-white/60 mt-3">
                      {result.employeeName} (ID: {result.employeeCode})
                    </p>
                  </>
                )}
                
                {result.type === 'already_punched_out' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Day Complete!</h2>
                    <p className="text-base sm:text-lg text-white mb-2">
                      You have already punched out
                    </p>
                    <p className="text-sm sm:text-base text-white/80">
                      See you tomorrow!
                    </p>
                    <p className="text-xs text-white/60 mt-3">
                      {result.employeeName} (ID: {result.employeeCode})
                    </p>
                  </>
                )}
                
                {result.type === 'no_punch_in' && (
                  <>
                    <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">No Punch In Found</h2>
                    <p className="text-base sm:text-lg text-white mb-2">
                      Please punch in first
                    </p>
                    <p className="text-sm sm:text-base text-white/80">
                      {result.message || 'You need to punch in before punching out'}
                    </p>
                    <p className="text-xs text-white/60 mt-3">
                      {result.employeeName} (ID: {result.employeeCode})
                    </p>
                  </>
                )}
                
                {result.type === 'not_found' && (
                  <>
                    <UserX className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">User Not Found</h2>
                    <p className="text-sm sm:text-base text-white/80">Please contact HR for assistance.</p>
                  </>
                )}
                
                {result.type === 'too_far' && (
                  <>
                    <ZoomIn className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Please Come Closer</h2>
                    <p className="text-sm sm:text-base text-white/80">Move closer to the camera for recognition.</p>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Center guide when idle */}
          {cameraActive && !result && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-dashed border-white/20 rounded-2xl w-48 h-64 sm:w-64 sm:h-80 flex items-center justify-center">
                <p className="text-white/40 text-xs sm:text-sm text-center px-4">Position your face here</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FaceAttendance;
