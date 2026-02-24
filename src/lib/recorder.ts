let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunkList: Blob[] = [];

function detectSupportedMimeType(): string {
  const candidateList = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidateList) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export async function initializeMicrophone(): Promise<void> {
  if (mediaStream) return;
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    },
  });
}

export function startRecording(): void {
  if (!mediaStream) {
    throw new Error(
      "Microphone not initialized. Call initializeMicrophone() first.",
    );
  }

  audioChunkList = [];
  const mimeType = detectSupportedMimeType();

  mediaRecorder = new MediaRecorder(mediaStream, {
    ...(mimeType ? { mimeType } : {}),
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunkList.push(event.data);
    }
  };

  mediaRecorder.start();
}

export function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      reject(new Error("No active recording to stop."));
      return;
    }

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder?.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunkList, { type: mimeType });
      audioChunkList = [];
      resolve(audioBlob);
    };

    mediaRecorder.onerror = () => {
      reject(new Error("MediaRecorder error during stop."));
    };

    mediaRecorder.stop();
  });
}
