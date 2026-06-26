export interface CaptureFrame {
  image: Blob
  width: number
  height: number
  capturedAt: string
  debugPath: string
  changed: boolean
  blank: boolean
  likelyTechnical: boolean
  sourceName: string
  sourceId: string
}

export interface CaptureSource {
  id: string
  name: string
  displayId: string
  thumbnailDataUrl: string
}

type CaptureGate = () => boolean | Promise<boolean>

class ScreenAnalyzerService {
  private stream: MediaStream | null = null
  private timer = 0
  private video: HTMLVideoElement | null = null
  private previousHash = ''
  private backgroundCaptureRunning = false
  private captureInFlight = false

  private assessTechnicalLayout(image: ImageData): boolean {
    const { data, width, height } = image
    const xStep = Math.max(4, Math.floor(width / 160))
    const yStep = Math.max(4, Math.floor(height / 100))
    let samples = 0
    let horizontalTransitions = 0
    let highContrastSamples = 0

    for (let y = 0; y < height; y += yStep) {
      let previous = -1
      for (let x = 0; x < width; x += xStep) {
        const index = (y * width + x) * 4
        const luminance =
          (data[index]! * 0.299) +
          (data[index + 1]! * 0.587) +
          (data[index + 2]! * 0.114)
        if (previous >= 0 && Math.abs(luminance - previous) > 45) horizontalTransitions += 1
        if (luminance < 45 || luminance > 215) highContrastSamples += 1
        previous = luminance
        samples += 1
      }
    }

    const transitionDensity = horizontalTransitions / Math.max(1, samples)
    const contrastDensity = highContrastSamples / Math.max(1, samples)
    return transitionDensity > 0.045 && contrastDensity > 0.2
  }

  async startBackground(
    onFrame: (frame: CaptureFrame) => void,
    shouldCapture: CaptureGate = () => true,
  ): Promise<boolean> {
    console.log('[CAPTURE MODE] startBackground');
    
    if (!window.interviewMateDesktop?.capture.getVisibleScreen) return false
    this.stop()
    this.backgroundCaptureRunning = true
    console.info('[ScreenIntelligence] started')

    const capture = async () => {
      if (!this.backgroundCaptureRunning || this.captureInFlight) return
      this.captureInFlight = true
      try {
        if (!(await shouldCapture())) return
        const result = await window.interviewMateDesktop!.capture.getVisibleScreen()
        if (!result.available || !result.bytes || !result.width || !result.height) {
          this.backgroundCaptureRunning = false
          return
        }
        const imageBuffer = new ArrayBuffer(result.bytes.byteLength)
        new Uint8Array(imageBuffer).set(result.bytes)
        const blob = new Blob([imageBuffer], { type: 'image/png' })
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return
        context.drawImage(bitmap, 0, 0)
        bitmap.close()
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const likelyTechnical = this.assessTechnicalLayout(imageData)
        const bytes = await blob.arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        const hash = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        const changed = hash !== this.previousHash
        this.previousHash = hash
        onFrame({
          image: blob,
          width: result.width,
          height: result.height,
          capturedAt: result.capturedAt ?? new Date().toISOString(),
          debugPath: result.debugPath ?? '',
          changed,
          blank: false,
          likelyTechnical,
          sourceName: result.sourceName ?? 'Visible screen',
          sourceId: '',
        })
      } finally {
        this.captureInFlight = false
      }
    }

    await capture()
    if (!this.backgroundCaptureRunning) return false
    this.timer = window.setInterval(() => void capture(), 2_000)
    return true
  }

  async listSources(): Promise<CaptureSource[]> {
    return (await window.interviewMateDesktop?.capture.listSources()) ?? []
  }

  async start(
    source: CaptureSource,
    onFrame: (frame: CaptureFrame) => void,
    onUnavailable?: () => void,
    shouldCapture: CaptureGate = () => true,
  ): Promise<MediaStream> {
    console.log('[CAPTURE MODE] start', {
    sourceName: source.name,
    sourceId: source.id,
  })
    if (/interview mate(?: ai)?/i.test(source.name)) {
      throw new Error('Interview Mate windows cannot be captured')
    }
    console.info('[ScreenCapture] started', { source: source.name, sourceId: source.id })
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
        },
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          maxFrameRate: 2,
        },
      },
    } as unknown as MediaStreamConstraints
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      console.warn('[Voice] System audio unavailable; falling back to video-only capture', error)
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: constraints.video,
      } as unknown as MediaStreamConstraints)
    }
    this.video = document.createElement('video')
    this.video.srcObject = this.stream
    this.video.muted = true
    await this.video.play()

    const capture = async () => {
      if (!(await shouldCapture())) return
      if (!this.video || this.video.videoWidth === 0) return
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 2560 / this.video.videoWidth)
      canvas.width = Math.round(this.video.videoWidth * scale)
      canvas.height = Math.round(this.video.videoHeight * scale)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) return
      context.imageSmoothingEnabled = false
      context.drawImage(this.video, 0, 0, canvas.width, canvas.height)
      const sample = context.getImageData(0, 0, canvas.width, canvas.height).data
      let minimum = 255
      let maximum = 0
      const stride = Math.max(4, Math.floor(sample.length / 8_000 / 4) * 4)
      for (let index = 0; index < sample.length; index += stride) {
        const luminance = (sample[index]! + sample[index + 1]! + sample[index + 2]!) / 3
        minimum = Math.min(minimum, luminance)
        maximum = Math.max(maximum, luminance)
      }
      const blank = maximum - minimum < 3
      if (blank) console.warn('[ScreenCapture] captured frame appears blank')
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const bytes = await blob.arrayBuffer()
        const debugPath =
          (await window.interviewMateDesktop?.capture.saveDebug(
            new Uint8Array(bytes),
            canvas.width,
            canvas.height,
          )) ?? ''
        console.info('[ScreenCapture] screenshot captured')
        console.info(`[ScreenCapture] dimensions ${canvas.width}x${canvas.height}`)
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        const hash = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        const changed = hash !== this.previousHash
        this.previousHash = hash
        onFrame({
          image: blob,
          width: canvas.width,
          height: canvas.height,
          capturedAt: new Date().toISOString(),
          debugPath,
          changed,
          blank,
          likelyTechnical: true,
          sourceName: source.name,
          // sourceName: source.name,
          sourceId: source.id,
        })
      }, 'image/png')
    }

    capture()
    this.timer = window.setInterval(() => void capture(), 2_000)
    this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stop()
      onUnavailable?.()
    })
    return this.stream
  }

  stop() {
    this.backgroundCaptureRunning = false
    this.captureInFlight = false
    window.clearInterval(this.timer)
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.video) this.video.srcObject = null
    this.stream = null
    this.video = null
    this.previousHash = ''
  }
}

export const screenAnalyzerService = new ScreenAnalyzerService()
