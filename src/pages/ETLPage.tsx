// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { SectionLabel } from '../components/SectionLabel'
import { Upload, Play, RefreshCw, CheckCircle, XCircle, Loader, Clock } from 'lucide-react'

type Source = {
  id: string
  label: string
  desc: string
  file_key: string | null
  accept: string | null
  etls: string[]
}

type Job = {
  id: string
  source_id: string
  name: string
  status: 'running' | 'success' | 'error'
  started_at: string
  finished_at: string | null
  rows: number
  error: string | null
  log: string
}

function StatusBadge({ status }: { status: Job['status'] }) {
  if (status === 'running')
    return <span className="flex items-center gap-1 text-sap-blue text-xs font-semibold"><Loader size={12} className="animate-spin" /> Running…</span>
  if (status === 'success')
    return <span className="flex items-center gap-1 text-sap-success text-xs font-semibold"><CheckCircle size={12} /> Completed</span>
  return <span className="flex items-center gap-1 text-sap-error text-xs font-semibold"><XCircle size={12} /> Error</span>
}

function fmtDuration(started: string, finished: string | null) {
  const end = finished ? new Date(finished) : new Date()
  const s = Math.round((end.getTime() - new Date(started).getTime()) / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function JobRow({ job, active, onClick }: { job: Job; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition text-sm ${
        active ? 'border-sap-blue bg-sap-blue-l' : 'border-sap-border hover:bg-sap-bg'
      }`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-semibold text-sap-text truncate max-w-[200px]">{job.name}</span>
        <StatusBadge status={job.status} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-sap-muted">
        <span><Clock size={10} className="inline mr-0.5" />{new Date(job.started_at).toLocaleTimeString()}</span>
        <span>{fmtDuration(job.started_at, job.finished_at)}</span>
        {job.rows > 0 && <span>{job.rows.toLocaleString()} rows</span>}
      </div>
    </button>
  )
}

export function ETLPage() {
  const qc = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<Record<string, File[]>>({})
  const [activeJob, setActiveJob] = useState<string | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const { data: sources = [] as Source[] } = useQuery({
    queryKey: ['etl-sources'],
    queryFn: () => api.get('/api/etl/sources').then(r => r.data),
    staleTime: Infinity,
  })

  const { data: jobs = [] as Job[] } = useQuery({
    queryKey: ['etl-jobs'],
    queryFn: () => api.get('/api/etl/jobs').then(r => r.data),
    refetchInterval: (query) => {
      const data = (query.state.data ?? []) as Job[]
      return data.some(j => j.status === 'running') ? 1500 : false
    },
  })

  // Poll active job log while running
  const activeJobData = jobs.find(j => j.id === activeJob) ?? null
  const isRunning = activeJobData?.status === 'running'

  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['etl-jobs'] })
    }, 1500)
    return () => clearInterval(t)
  }, [isRunning, qc])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [activeJobData?.log])

  const runMut = useMutation({
    mutationFn: async ({ sourceId, files }: { sourceId: string; files?: File[] }) => {
      const form = new FormData()
      if (files?.length) {
        for (const f of files) form.append('files', f)
      }
      const res = await api.post(`/api/etl/run/${sourceId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data) => {
      setActiveJob(data.job_id)
      qc.invalidateQueries({ queryKey: ['etl-jobs'] })
    },
  })

  function handleRun(src: Source) {
    const files = selectedFile[src.id] ?? []
    runMut.mutate({ sourceId: src.id, files: files.length ? files : undefined })
  }

  // Group sources
  const MULTI_FILE_SOURCES = new Set(['pipeline', 'pipeline_lw'])
  const csvSources = sources.filter(s => s.accept === '.csv' && s.id !== 'full_run')
  const xlsxSources = sources.filter(s => s.accept === '.xlsx')
  const fullRun = sources.find(s => s.id === 'full_run')

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-sap-text mb-1">Data Update</h2>
      <hr className="border-sap-border mb-4" />

      <div className="grid grid-cols-3 gap-6">

        {/* ── Left: source cards ─────────────────────────────────────── */}
        <div className="col-span-2 space-y-5">

          {/* Full run */}
          {fullRun && (
            <div>
              <SectionLabel>Full ETL</SectionLabel>
              <SourceCard
                src={fullRun}
                files={[]}
                multi={false}
                onFilesChange={() => {}}
                onRun={() => handleRun(fullRun)}
                running={runMut.isPending && runMut.variables?.sourceId === fullRun.id}
                highlight
              />
            </div>
          )}

          <div>
            <SectionLabel>CSV Files</SectionLabel>
            <div className="space-y-2">
              {csvSources.map(src => (
                <SourceCard
                  key={src.id}
                  src={src}
                  files={selectedFile[src.id] ?? []}
                  multi={MULTI_FILE_SOURCES.has(src.id)}
                  onFilesChange={(fs) => setSelectedFile(p => ({ ...p, [src.id]: fs }))}
                  onRun={() => handleRun(src)}
                  running={runMut.isPending && runMut.variables?.sourceId === src.id}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Excel Files</SectionLabel>
            <div className="space-y-2">
              {xlsxSources.map(src => (
                <SourceCard
                  key={src.id}
                  src={src}
                  files={selectedFile[src.id] ?? []}
                  multi={false}
                  onFilesChange={(fs) => setSelectedFile(p => ({ ...p, [src.id]: fs }))}
                  onRun={() => handleRun(src)}
                  running={runMut.isPending && runMut.variables?.sourceId === src.id}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: job history + log ───────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>History</SectionLabel>
              <button onClick={() => qc.invalidateQueries({ queryKey: ['etl-jobs'] })}
                className="text-sap-muted hover:text-sap-blue transition">
                <RefreshCw size={13} />
              </button>
            </div>
            {jobs.length === 0
              ? <p className="text-xs text-sap-muted py-4 text-center">No jobs run yet.</p>
              : (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                  {jobs.map(j => (
                    <JobRow key={j.id} job={j} active={activeJob === j.id} onClick={() => setActiveJob(j.id)} />
                  ))}
                </div>
              )
            }
          </div>

          {activeJobData && (
            <div>
              <SectionLabel>Log</SectionLabel>
              <pre
                ref={logRef}
                className="bg-[#1e1e2e] text-[#cdd6f4] text-[11px] leading-relaxed rounded-xl p-3 overflow-auto max-h-[380px] whitespace-pre-wrap"
              >
                {activeJobData.log || '…'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SourceCard ─────────────────────────────────────────────────────────────────
function SourceCard({
  src, files, multi, onFilesChange, onRun, running, highlight = false,
}: {
  src: Source
  files: File[]
  multi: boolean
  onFilesChange: (fs: File[]) => void
  onRun: () => void
  running: boolean
  highlight?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 transition ${
      highlight
        ? 'border-sap-blue bg-sap-blue-l'
        : 'border-sap-border bg-white hover:border-sap-blue/40'
    }`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-sap-text">{src.label}</p>
        <p className="text-[11px] text-sap-muted truncate">{src.desc}</p>
        {files.length > 0 && (
          <span className="text-[11px] text-sap-success font-medium">
            {files.length === 1
              ? `📎 ${files[0].name} (${(files[0].size / 1024).toFixed(0)} KB)`
              : `📎 ${files.length} arquivos selecionados (${(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB total)`
            }
          </span>
        )}
      </div>

      {/* Upload button (only for sources that take a file) */}
      {src.accept && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={src.accept}
            multiple={multi}
            className="hidden"
            onChange={e => onFilesChange(e.target.files ? Array.from(e.target.files) : [])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition text-sap-muted"
          >
            <Upload size={12} /> {multi ? 'Select files' : 'Select'}
          </button>
        </>
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={running}
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition ${
          highlight
            ? 'bg-sap-blue text-white hover:bg-sap-blue-d disabled:opacity-50'
            : 'border border-sap-blue text-sap-blue hover:bg-sap-blue-l disabled:opacity-50'
        }`}
      >
        {running
          ? <><Loader size={12} className="animate-spin" /> Running…</>
          : <><Play size={12} /> Run</>
        }
      </button>
    </div>
  )
}
