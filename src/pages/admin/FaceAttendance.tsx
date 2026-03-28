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

const PUNCH_COOLDOWN = 60_000;
const MIN_FACE_SIZE = 120; // minimum face box width to consider "close enough"
const RESULT_DISPLAY_DURATION = 4000;

type ResultState = {
  type: 'success' | 'not_found' | 'too_far';
  employeeName?: string;
  employeeCode?: string;
  photoURL?: string;
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

  const recentPunchesRef = useRef<Map<string, number>>(new Map());
  const notFoundCooldownRef = useRef(0);

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
      return snap.docs[0].data().type === 'in' ? 'out' : 'in';
    } catch {
      return 'in';
    }
  };

  const markAttendance = async (known: KnownFace) => {
    const now = Date.now();
    const lastPunch = recentPunchesRef.current.get(known.employeeId);
    if (lastPunch && now - lastPunch < PUNCH_COOLDOWN) return;

    recentPunchesRef.current.set(known.employeeId, now);

    const punchType = await getPunchType(known.employeeId);
    const today = formatLocalDate(new Date());
    const isoTime = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString();

    try {
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
        }
      } else {
        if (!attendanceSnap.empty) {
          const attendanceDoc = attendanceSnap.docs[0];
          await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
            punchOut: isoTime,
            punchOutLocation: null,
          });
        }
      }

      showResult({
        type: 'success',
        employeeName: known.employeeName,
        employeeCode: known.employeeCode,
        photoURL: known.photoURL,
      });
      speak(`Thank you, ${known.employeeName}. Punch ${punchType} recorded.`);
    } catch (e) {
      console.error('Error marking attendance:', e);
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
                if (known) markAttendance(known);
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
                    : result.type === 'not_found'
                    ? 'rgba(220, 38, 38, 0.9)'
                    : 'rgba(217, 119, 6, 0.9)',
                }}>
                {result.type === 'success' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-white mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Thank You!</h2>
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
