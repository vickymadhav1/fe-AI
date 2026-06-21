export const isElectronRuntime = (): boolean => {
  return Boolean(
    window.interviewMateDesktop?.isElectron ||
      navigator.userAgent.toLowerCase().includes('electron'),
  )
}
