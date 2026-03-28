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
} from 'lucide-react';

interface KnownFace {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  userId: string;
  descriptors: Float32Array[];
  photoURL?: string;
}

interface RecentPunch {
  employeeId: string;
  type: 'in' | 'out';
  timestamp: number;
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

const PUNCH_COOLDOWN = 60_000; // 60 seconds cooldown between same employee punches
const DUPLICATE_PUNCH_WINDOW = 600_000; // 10 minutes window to prevent duplicate punch types
const MIN_FACE_SIZE = 120; // minimum face box width to consider "close enough"
const RESULT_DISPLAY_DURATION = 4000;

type ResultState = {
  type: 'success' | 'not_found' | 'too_far' | 'already_punched';
  employeeName?: string;
  employeeCode?: string;
  photoURL?: string;
  punchType?: 'in' | 'out';
  message?: string;
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

  const recentPunchesRef = useRef<Map<string, RecentPunch>>(new Map());
  const notFoundCooldownRef = useRef(0);
  const processingRef = useRef<Set<string>>(new Set()); // Track employees being processed

  const showResult = useCallback((r: ResultState) => {
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    setResult(r);
    resultTimeoutRef.current = setTimeout(() => setResult(null), RESULT_DISPLAY_DURATION);
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

  const getLastPunchOfToday = async (employeeId: string): Promise<{ type: 'in' | 'out'; timestamp: Date } | null> => {
    const today = formatLocalDate(new Date());
    try {
      const q = query(
        collection(db, 'face_attendance'),
        where('employeeId', '==', employeeId),
        where('date', '==', today),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      
      const data = snap.docs[0].data();
      return {
        type: data.type as 'in' | 'out',
        timestamp: data.timestamp.toDate(),
      };
    } catch (error) {
      console.error('Error fetching last punch:', error);
      return null;
    }
  };

  const checkDuplicatePunch = async (employeeId: string, punchType: 'in' | 'out'): Promise<boolean> => {
    const now = Date.now();
    const recentPunch = recentPunchesRef.current.get(employeeId);
    
    // Check in-memory cache first
    if (recentPunch && 
        recentPunch.type === punchType && 
        now - recentPunch.timestamp < DUPLICATE_PUNCH_WINDOW) {
      return true;
    }
    
    // Check database for recent punch of same type
    const lastPunch = await getLastPunchOfToday(employeeId);
    if (lastPunch && 
        lastPunch.type === punchType && 
        now - lastPunch.timestamp.getTime() < DUPLICATE_PUNCH_WINDOW) {
      // Update cache
      recentPunchesRef.current.set(employeeId, {
        employeeId,
        type: punchType,
        timestamp: lastPunch.timestamp.getTime(),
      });
      return true;
    }
    
    return false;
  };

  const getPunchType = async (employeeId: string): Promise<'in' | 'out'> => {
    const today = formatLocalDate(new Date());
    try {
      const q = query(
        collection(db, 'face_attendance'),
        where('employeeId', '==', employeeId),
        where('date', '==', today),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return 'in';
      const lastPunch = snap.docs[0].data();
      return lastPunch.type === 'in' ? 'out' : 'in';
    } catch {
      return 'in';
    }
  };

  const markAttendance = async (known: KnownFace) => {
    const now = Date.now();
    const employeeId = known.employeeId;
    
    // Prevent multiple concurrent processing for same employee
    if (processingRef.current.has(employeeId)) {
      console.log(`Already processing ${employeeId}, skipping...`);
      return;
    }
    
    processingRef.current.add(employeeId);
    
    try {
      // Check cooldown (prevent too frequent punches)
      const lastPunchTime = recentPunchesRef.current.get(employeeId)?.timestamp;
      if (lastPunchTime && now - lastPunchTime < PUNCH_COOLDOWN) {
        console.log(`Cooldown active for ${employeeId}`);
        return;
      }
      
      const punchType = await getPunchType(employeeId);
      
      // Check for duplicate punch of same type within 10 minutes
      const isDuplicate = await checkDuplicatePunch(employeeId, punchType);
      if (isDuplicate) {
        showResult({
          type: 'already_punched',
          employeeName: known.employeeName,
          employeeCode: known.employeeCode,
          photoURL: known.photoURL,
          punchType,
          message: `Already punched ${punchType === 'in' ? 'IN' : 'OUT'} within last 10 minutes`,
        });
        speak(`${known.employeeName}, you have already punched ${punchType === 'in' ? 'in' : 'out'} recently.`);
        return;
      }
      
      const today = formatLocalDate(new Date());
      const isoTime = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString();
      
      // Update in-memory cache before DB operation
      recentPunchesRef.current.set(employeeId, {
        employeeId,
        type: punchType,
        timestamp: now,
      });
      
      // Record in face_attendance collection
      await addDoc(collection(db, 'face_attendance'), {
        employeeId: known.employeeId,
        employeeName: known.employeeName,
        employeeCode: known.employeeCode,
        organizationId,
        date: today,
        time: timeStr,
        timestamp: Timestamp.now(),
        type: punchType,
      });
      
      // Update main attendance collection
      const attendanceUserId = known.userId || known.employeeId;
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', attendanceUserId),
        where('date', '==', today)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      
      if (punchType === 'in') {
        if (attendanceSnap.empty) {
          await addDoc(collection(db, 'attendance'), {
            employeeId: attendanceUserId,
            employeeDocumentId: known.employeeId,
            employeeName: known.employeeName,
            employeeCode: known.employeeCode,
            date: today,
            punchIn: isoTime,
            punchInLocation: null,
            punchOut: null,
            punchOutLocation: null,
            organizationId: organizationId || null,
            source: 'face_recognition',
          });
        } else {
          // Check if already punched in today
          const existingAttendance = attendanceSnap.docs[0].data();
          if (existingAttendance.punchIn && !existingAttendance.punchOut) {
            showResult({
              type: 'already_punched',
              employeeName: known.employeeName,
              employeeCode: known.employeeCode,
              photoURL: known.photoURL,
              punchType: 'in',
              message: 'You have already punched in today',
            });
            speak(`${known.employeeName}, you have already punched in today.`);
            return;
          }
        }
      } else {
        // Punch out
        if (!attendanceSnap.empty) {
          const attendanceDoc = attendanceSnap.docs[0];
          const existingAttendance = attendanceDoc.data();
          
          // Check if already punched out
          if (existingAttendance.punchOut) {
            showResult({
              type: 'already_punched',
              employeeName: known.employeeName,
              employeeCode: known.employeeCode,
              photoURL: known.photoURL,
              punchType: 'out',
              message: 'You have already punched out today',
            });
            speak(`${known.employeeName}, you have already punched out today.`);
            return;
          }
          
          await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
            punchOut: isoTime,
            punchOutLocation: null,
          });
        } else {
          // No punch in record found, but trying to punch out
          showResult({
            type: 'already_punched',
            employeeName: known.employeeName,
            employeeCode: known.employeeCode,
            photoURL: known.photoURL,
            punchType: 'out',
            message: 'No punch in record found for today',
          });
          speak(`${known.employeeName}, no punch in record found for today.`);
          return;
        }
      }
      
      // Success!
      showResult({
        type: 'success',
        employeeName: known.employeeName,
        employeeCode: known.employeeCode,
        photoURL: known.photoURL,
        punchType,
      });
      speak(`Thank you, ${known.employeeName}. Punch ${punchType} recorded.`);
      
    } catch (e) {
      console.error('Error marking attendance:', e);
      // Revert cache on error
      recentPunchesRef.current.delete(employeeId);
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
                if (Date.now() - notFoundCooldownRef.current > 3000) {
                  notFoundCooldownRef.current = Date.now();
                  showResult({ type: 'too_far' });
                  speak('Please come closer to the camera.');
                }
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
                if (known) await markAttendance(known);
              } else {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                if (Date.now() - notFoundCooldownRef.current > 5000) {
                  notFoundCooldownRef.current = Date.now();
                  showResult({ type: 'not_found' });
                  speak('User not found. Please contact HR.');
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Scan frame error:', e);
      }
    }, 1500);
    
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
                    ? 'rgba(22, 163, 74, 0.9)'
                    : result.type === 'already_punched'
                    ? 'rgba(245, 158, 11, 0.9)'
                    : result.type === 'not_found'
                    ? 'rgba(220, 38, 38, 0.9)'
                    : 'rgba(217, 119, 6, 0.9)',
                }}>
                {result.type === 'success' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Thank You!</h2>
                    <p className="text-base sm:text-lg text-white mb-4">
                      {result.punchType === 'in' ? 'Punched In' : 'Punched Out'}
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
                
                {result.type === 'already_punched' && (
                  <>
                    <Clock className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Already Punched!</h2>
                    <p className="text-base sm:text-lg text-white mb-2">
                      {result.punchType === 'in' ? 'Already punched IN' : 'Already punched OUT'}
                    </p>
                    <p className="text-sm sm:text-base text-white/80">
                      {result.message || 'Please wait before punching again'}
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
