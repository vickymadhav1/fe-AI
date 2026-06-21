class AudioCaptureService {
  private streams: MediaStream[] = []
  private recorder: MediaRecorder | null = null
  private recordingStream: MediaStream | null = null
  private chunkTimer = 0
  private active = false
  private onChunk: ((audio: Blob) => void) | null = null
  private mimeType = 'audio/webm'

  async start(
    preferSystemAudio: boolean,
    onChunk: (audio: Blob) => void,
    sharedDisplayStream?: MediaStream | null,
  ) {
    let recordingStream: MediaStream | null = null
    const sharedAudioTracks = sharedDisplayStream?.getAudioTracks() ?? []

    if (preferSystemAudio && sharedAudioTracks.length) {
      recordingStream = new MediaStream(sharedAudioTracks.map((track) => track.clone()))
      this.streams.push(recordingStream)
    }

    if (!recordingStream?.getAudioTracks().length) {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      this.streams.push(microphone)
      recordingStream = microphone
    }

    this.mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    this.recordingStream = recordingStream
    this.onChunk = onChunk
    this.active = true
    this.startSegment()
  }

  private startSegment() {
    if (!this.active || !this.recordingStream) return

    const chunks: Blob[] = []
    const recorder = new MediaRecorder(this.recordingStream, { mimeType: this.mimeType })
    this.recorder = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onstop = () => {
      window.clearTimeout(this.chunkTimer)
      const audio = new Blob(chunks, { type: this.mimeType })
      if (audio.size > 10_000) this.onChunk?.(audio)
      if (this.active) this.startSegment()
    }
    recorder.start()
    this.chunkTimer = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, 5_000)
  }

  stop() {
    this.active = false
    window.clearTimeout(this.chunkTimer)
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
    this.recorder = null
    this.recordingStream = null
    this.onChunk = null
    this.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    this.streams = []
  }
}

export const audioCaptureService = new AudioCaptureService()
