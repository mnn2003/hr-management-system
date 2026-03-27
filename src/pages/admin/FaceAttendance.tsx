import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { collection, getDocs, query, where, addDoc, orderBy, limit, Timestamp } from 'firebase/firestore';
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
  LogIn,
  LogOut,
} from 'lucide-react';

interface KnownFace {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  descriptors: Float32Array[];
}

interface AttendanceLog {
  id: string;
  employeeName: string;
  employeeCode: string;
  type: 'in' | 'out';
  time: string;
}

const PUNCH_COOLDOWN = 60_000;

const FaceAttendance = () => {
  const { organizationId } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [knownFaces, setKnownFaces] = useState<KnownFace[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const recentPunchesRef = useRef<Map<string, number>>(new Map());

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
          .filter((d) => d.data().descriptors?.length > 0)
          .map((d) => ({
            employeeId: d.data().employeeId,
            employeeName: d.data().employeeName,
            employeeCode: d.data().employeeCode,
            descriptors: d.data().descriptors.map((arr: number[]) => arrayToDescriptor(arr)),
          }));
        setKnownFaces(faces);
      } catch (e) {
        console.error('Error loading face data:', e);
      }
    };
    loadFaces();
  }, [organizationId]);

  // Auto-start camera when models + faces are ready
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadeddata = () => {
          setCameraActive(true);
          setStatusMessage('Camera started. Scanning for faces...');
          setStatusType('info');
        };
      }
    } catch {
      setStatusMessage('Could not access camera. Please allow camera permissions.');
      setStatusType('error');
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

  // Auto-start camera
  useEffect(() => {
    if (modelsReady && knownFaces.length > 0 && !cameraActive) {
      startCamera();
    }
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

  const markAttendance = async (employeeId: string, employeeName: string, employeeCode: string) => {
    const now = Date.now();
    const lastPunch = recentPunchesRef.current.get(employeeId);
    if (lastPunch && now - lastPunch < PUNCH_COOLDOWN) return;

    recentPunchesRef.current.set(employeeId, now);

    const punchType = await getPunchType(employeeId);
    const today = formatLocalDate(new Date());
    const timeStr = new Date().toLocaleTimeString();

    try {
      await addDoc(collection(db, 'face_attendance'), {
        employeeId,
        employeeName,
        employeeCode,
        organizationId,
        date: today,
        time: timeStr,
        timestamp: Timestamp.now(),
        type: punchType,
      });

      const logEntry: AttendanceLog = {
        id: `${employeeId}-${now}`,
        employeeName,
        employeeCode,
        type: punchType,
        time: timeStr,
      };

      setAttendanceLogs((prev) => [logEntry, ...prev].slice(0, 50));
      setStatusMessage(`✅ ${employeeName} — Punch ${punchType.toUpperCase()} at ${timeStr}`);
      setStatusType('success');
      toast.success(`${employeeName} punched ${punchType} successfully`);
    } catch (e) {
      console.error('Error marking attendance:', e);
    }
  };

  // Continuous face scanning
  useEffect(() => {
    if (!cameraActive || !modelsReady || knownFaces.length === 0) return;

    setScanning(true);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      if (videoRef.current.videoWidth === 0) return;

      try {
        // Use canvas snapshot for reliable detection
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

              const matchResult = matchFace(
                det.descriptor,
                knownFaces.map((kf) => ({ label: kf.employeeId, descriptors: kf.descriptors }))
              );

              if (matchResult) {
                const known = knownFaces.find((kf) => kf.employeeId === matchResult.label);
                // Green box for recognized
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 16px sans-serif';
                const label = known?.employeeName || 'Known';
                const textWidth = ctx.measureText(label).width;
                ctx.fillRect(x, y - 28, textWidth + 12, 28);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, x + 6, y - 8);

                if (known) {
                  markAttendance(known.employeeId, known.employeeName, known.employeeCode);
                }
              } else {
                // Red box for unknown
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillRect(x, y - 28, 100, 28);
                ctx.fillStyle = '#fff';
                ctx.fillText('Unknown', x + 6, y - 8);
              }
            }
          }
        }

        if (detections.length === 0) {
          setStatusMessage('Scanning... Waiting for someone to approach.');
          setStatusType('info');
        }
      } catch (e) {
        console.warn('Scan frame error:', e);
      }
    }, 1500);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [cameraActive, modelsReady, knownFaces, organizationId]);

  // Cleanup
  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">
      <Sonner />

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <ScanFace className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">Face Attendance</h1>
          {knownFaces.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {knownFaces.length} enrolled
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {scanning && (
            <Badge className="gap-1 bg-green-600 text-white">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning
            </Badge>
          )}
          <div className="text-right">
            <div className="text-2xl font-mono font-bold">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-xs text-gray-400">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loadingModels && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg text-gray-300">Loading face recognition models...</p>
          </div>
        </div>
      )}

      {/* No faces enrolled */}
      {!loadingModels && modelsReady && knownFaces.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">No Faces Enrolled</h2>
            <p className="text-gray-400">
              Please enroll employee faces from the admin panel before using this attendance scanner.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loadingModels && modelsReady && knownFaces.length > 0 && (
        <div className="flex-1 flex min-h-0">
          {/* Camera Area */}
          <div className="flex-1 relative">
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

            {/* Status Overlay */}
            {statusMessage && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <div className={`px-6 py-3 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg ${
                  statusType === 'success' ? 'bg-green-600/90 text-white' :
                  statusType === 'error' ? 'bg-red-600/90 text-white' :
                  'bg-gray-800/90 text-gray-200'
                }`}>
                  {statusMessage}
                </div>
              </div>
            )}

            {/* Center guide overlay when no face detected */}
            {cameraActive && !scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-dashed border-white/30 rounded-2xl w-64 h-80 flex items-center justify-center">
                  <p className="text-white/50 text-sm">Position your face here</p>
                </div>
              </div>
            )}
          </div>

          {/* Attendance Log Sidebar */}
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="font-semibold text-sm">Today's Attendance Log</span>
              </div>
            </div>

            {attendanceLogs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-sm text-gray-500 text-center">
                  No entries yet. Stand in front of the camera to mark attendance.
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {attendanceLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 text-sm">
                      {log.type === 'in' ? (
                        <div className="h-8 w-8 rounded-full bg-green-600/20 flex items-center justify-center shrink-0">
                          <LogIn className="h-4 w-4 text-green-400" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
                          <LogOut className="h-4 w-4 text-red-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white">{log.employeeName}</p>
                        <p className="text-xs text-gray-400">
                          {log.employeeCode} • {log.time}
                        </p>
                      </div>
                      <Badge
                        className={`text-xs ${log.type === 'in' ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30'}`}
                      >
                        {log.type === 'in' ? 'IN' : 'OUT'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="px-4 py-3 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-500">
                {attendanceLogs.length} entries today • 60s cooldown between punches
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceAttendance;
