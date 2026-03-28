import { useState, useRef, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableEmployeeSelect, Employee } from '@/components/ui/searchable-employee-select';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { loadFaceModels, descriptorToArray } from '@/lib/faceRecognitionService';
import * as faceapi from 'face-api.js';
import { toast } from 'sonner';
import { Camera, CheckCircle2, Loader2, AlertCircle, UserCheck, RefreshCw } from 'lucide-react';

const FaceEnrollment = () => {
  const { organizationId } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [enrolled, setEnrolled] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [existingEnrollment, setExistingEnrollment] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const REQUIRED_CAPTURES = 3;

  // Load employees
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!organizationId) return;
      try {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        const snapshot = await getDocs(q);
        const emps: Employee[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().fullName || `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim(),
          employeeCode: d.data().employeeCode || d.data().employeeId || '',
          userId: d.data().userId || '',
        }));
        setEmployees(emps);
      } catch (e) {
        console.error('Error fetching employees:', e);
      }
    };
    fetchEmployees();
  }, [organizationId]);

  // Load face-api models
  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels();
        setModelsReady(true);
      } catch (e) {
        console.error('Error loading face models:', e);
        toast.error('Failed to load face recognition models.');
      } finally {
        setLoadingModels(false);
      }
    };
    init();
  }, []);

  // Check existing enrollment when employee changes
  useEffect(() => {
    const checkEnrollment = async () => {
      if (!selectedEmployeeId) {
        setExistingEnrollment(false);
        return;
      }
      try {
        const faceDoc = await getDoc(doc(db, 'face_data', selectedEmployeeId));
        setExistingEnrollment(faceDoc.exists());
      } catch {
        setExistingEnrollment(false);
      }
    };
    checkEnrollment();
    setEnrolled(false);
    setCaptureCount(0);
  }, [selectedEmployeeId]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setVideoReady(false);
        
        // Wait for video to actually be playing
        videoRef.current.onloadeddata = () => {
          setVideoReady(true);
          setCameraActive(true);
        };
      }
    } catch (e) {
      console.error('Camera error:', e);
      toast.error('Could not access camera. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
    setVideoReady(false);
  }, []);

  // Real-time face detection overlay
  useEffect(() => {
    if (!cameraActive || !modelsReady || !videoReady) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;
      
      try {
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        
        setFaceDetected(!!result);

        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (result) {
              const { x, y, width, height } = result.detection.box;
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y, width, height);
              ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
              ctx.fillRect(x, y, width, height);
            }
          }
        }
      } catch (e) {
        console.warn('Detection frame error:', e);
      }
    }, 600);

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [cameraActive, modelsReady, videoReady]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureFace = async () => {
    if (!videoRef.current || !modelsReady || !selectedEmployeeId) return;

    // Check video is ready
    if (videoRef.current.readyState < 4 || videoRef.current.videoWidth === 0) {
      toast.error('Camera not ready. Please wait a moment.');
      return;
    }

    setCapturing(true);
    try {
      // Create a canvas snapshot from the video for more reliable detection
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        toast.error('Canvas error. Please try again.');
        setCapturing(false);
        return;
      }
      tempCtx.drawImage(videoRef.current, 0, 0);

      const result = await faceapi
        .detectSingleFace(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        toast.error('No face detected. Please ensure good lighting and face the camera directly.');
        setCapturing(false);
        return;
      }

      const descriptorArray = descriptorToArray(result.descriptor);
      const newCount = captureCount + 1;

      // Store face data
      const faceDocRef = doc(db, 'face_data', selectedEmployeeId);
      const existing = await getDoc(faceDocRef);
      const existingDescriptors: { values: number[] }[] = existing.exists()
        ? Array.isArray(existing.data().descriptors)
          ? existing.data().descriptors
              .map((item: unknown) => {
                if (Array.isArray(item)) {
                  return { values: item as number[] };
                }

                if (
                  item &&
                  typeof item === 'object' &&
                  'values' in item &&
                  Array.isArray((item as { values?: unknown }).values)
                ) {
                  return { values: (item as { values: number[] }).values };
                }

                return null;
              })
              .filter((item): item is { values: number[] } => item !== null)
          : []
        : [];

      // If re-enrolling and this is the first capture, clear old data
      if (newCount === 1 && existingEnrollment) {
        existingDescriptors.length = 0;
      }

      existingDescriptors.push({ values: descriptorArray });

      const emp = employees.find((e) => e.id === selectedEmployeeId);

      await setDoc(faceDocRef, {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || '',
        employeeCode: emp?.employeeCode || '',
        userId: emp?.userId || '',
        organizationId,
        descriptors: existingDescriptors,
        enrolledAt: existing.exists() ? existing.data().enrolledAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setCaptureCount(newCount);

      if (newCount >= REQUIRED_CAPTURES) {
        toast.success(`Face enrollment complete for ${emp?.name}!`);
        setEnrolled(true);
        stopCamera();
      } else {
        toast.success(`Capture ${newCount}/${REQUIRED_CAPTURES} saved. Slightly change angle for next capture.`);
      }
    } catch (e: any) {
      console.error('Error capturing face:', e);
      toast.error(`Capture failed: ${e?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setCapturing(false);
    }
  };

  const resetEnrollment = () => {
    setEnrolled(false);
    setCaptureCount(0);
    setSelectedEmployeeId('');
  };

  return (
    <Layout pageTitle="Face Enrollment">
      <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
        {loadingModels && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Loading face recognition models... This may take a moment on first load.
              </span>
            </CardContent>
          </Card>
        )}

        {!loadingModels && !modelsReady && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">
                Face recognition models failed to load. Please ensure model files are in <code>/public/models/</code>.
              </span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Employee Face Enrollment
            </CardTitle>
            <CardDescription>
              Select an employee and capture their face from multiple angles for accurate recognition.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Employee</label>
              <SearchableEmployeeSelect
                employees={employees}
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                placeholder="Search and select employee..."
                disabled={cameraActive}
              />
            </div>

            {selectedEmployeeId && existingEnrollment && !enrolled && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                This employee already has face data enrolled. Capturing again will replace their data.
              </div>
            )}
          </CardContent>
        </Card>

        {selectedEmployeeId && modelsReady && !enrolled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Face Capture
              </CardTitle>
              <CardDescription>
                Capture {REQUIRED_CAPTURES} images from slightly different angles for best accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <p className="font-medium">Instructions:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Ensure good lighting on the face</li>
                  <li>Look directly at the camera</li>
                  <li>Keep a neutral expression</li>
                  <li>After each capture, slightly tilt or turn your head</li>
                </ul>
              </div>

              <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-w-lg mx-auto">
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

                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button onClick={startCamera} size="lg" className="gap-2">
                      <Camera className="h-5 w-5" />
                      Start Camera
                    </Button>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute top-3 left-3">
                    <Badge variant={faceDetected ? 'default' : 'destructive'} className="gap-1">
                      {faceDetected ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Face Detected
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          No Face Detected
                        </>
                      )}
                    </Badge>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary">
                      {captureCount}/{REQUIRED_CAPTURES} Captured
                    </Badge>
                  </div>
                )}
              </div>

              {cameraActive && (
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={captureFace}
                    disabled={!faceDetected || capturing}
                    size="lg"
                    className="gap-2"
                  >
                    {capturing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        Capture Face ({captureCount + 1}/{REQUIRED_CAPTURES})
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {enrolled && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                  Enrollment Complete!
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {employees.find((e) => e.id === selectedEmployeeId)?.name}'s face has been successfully enrolled.
                </p>
              </div>
              <Button onClick={resetEnrollment} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Enroll Another Employee
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default FaceEnrollment;
