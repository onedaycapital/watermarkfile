export type WatermarkMode = 'logo' | 'text'
export type Template = 'diagonal-center' | 'repeating-pattern' | 'footer-tag'
export type Scope = 'all-pages' | 'first-page-only'

export interface WatermarkOptions {
  mode: WatermarkMode
  text?: string
  logoFile?: File
  template: Template
  scope: Scope
}

export interface ProcessedFile {
  id: string
  name: string
  status: 'success' | 'error'
  downloadUrl?: string
  errorMessage?: string
}

export type PipelinePhase = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

export interface PipelineState {
  phase: PipelinePhase
  currentStep: number
  totalFiles: number
  processedCount: number
  fileErrors: Array<{ fileName: string; message: string }>
}
